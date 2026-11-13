# Hyperledger Fabric Architecture and Chaincode Explanation

## Fabric Network Topology

The LandLedger prototype connects to a permissioned Hyperledger Fabric network with the following topology:

| Component | Details |
|---|---|
| Channel | `landledgerchannel` |
| Organizations | Org1MSP, Org2MSP |
| Peers | peer0.org1.example.com:7051, peer0.org2.example.com:9051 |
| Orderer | orderer.example.com:7050 |
| CAs | ca_org1, ca_org2, ca_orderer |
| Chaincode | `landrecords` v1.1, sequence 4 |
| Endorsement Policy | Approved by both Org1MSP and Org2MSP |
| Init Required | Yes (chaincode initialized on deployment) |

## Identity Wallet

Four enrolled identities are stored in `fabric/wallet/`:

| Identity Label | Mapped App UserId | Role | Files |
|---|---|---|---|
| LedgerAuthority | 1 | authority | certificate.pem, privateKey.pem |
| LedgerOwner | 2 | owner | certificate.pem, privateKey.pem |
| LedgerBuyer | 3 | buyer | certificate.pem, privateKey.pem |
| LedgerSeller | 4 | seller | certificate.pem, privateKey.pem |

Each identity's X.509 certificate contains two client identity attributes required by the chaincode:
- `role` — the user's role (authority, owner, buyer, seller)
- `appUserId` — the application user ID (1, 2, 3, 4)

## Gateway Flow (Fabric Mode)

When `FABRIC_MODE=fabric`, the API submits transactions through this flow:

1. **Gateway connection:** `FabricGatewayService` connects to `peer0.org1.example.com:7051` over gRPC with TLS.
2. **Identity loading:** Loads certificate and private key from `fabric/wallet/<IdentityLabel>/`.
3. **Transaction submission:** Calls `contract.submitAsync(methodName, arguments)` on the `landrecords` chaincode.
4. **Endorsement and ordering:** The transaction is endorsed by peers, ordered by the orderer, and committed to the channel.
5. **Result retrieval:** The API waits for transaction commit status and retrieves the result bytes.
6. **Local recording:** The transaction ID and `confirmed` status are recorded in the local mock store event log.

## Chaincode: landrecords (Go)

**File:** `fabric/chaincode/landrecords/landrecords.go`

**Framework:** `github.com/hyperledger/fabric-contract-api-go/contractapi`

**Data Structures:**

| Structure | Fields |
|---|---|
| `Property` | ID, ParcelNumber, Title, Address, AreaSqm, LandType, OwnerID, OwnerName, Status, DocumentHash, CreatedAt, UpdatedAt |
| `Transfer` | ID, PropertyID, SellerID, BuyerID, Status, CreatedAt, UpdatedAt |
| `DocumentHashRecord` | ID, PropertyID, DocumentHash, UploadedBy, CreatedAt |
| `HistoryEntry` | TxID, Timestamp, IsDelete, Record |

### World State Keys

| Key Prefix | Purpose |
|---|---|
| `property:<id>` | Stores serialized `Property` object |
| `transfer:<id>` | Stores serialized `Transfer` object |
| `documenthash:<id>` | Stores serialized `DocumentHashRecord` object |

### Chaincode Functions

| Function | Caller Role | Authorization | Description |
|---|---|---|---|
| `CreateProperty` | owner, seller, authority | appUserId must match ownerID | Creates a new property with status PENDING; rejects duplicates |
| `ApproveProperty` | authority, admin | requireAuthority() | Changes property status from PENDING to APPROVED |
| `ProposeTransfer` | owner, seller | appUserId must match sellerID | Creates a PROPOSED transfer; checks property is APPROVED and owned by seller; prevents duplicate open transfers |
| `AcceptTransfer` | buyer, owner | appUserId must match buyerID | Changes transfer status from PROPOSED to ACCEPTED |
| `RejectTransfer` | authority, admin, or buyer | authority/admin or appUserId == BuyerID | Changes transfer status to REJECTED (PROPOSED or ACCEPTED) |
| `FinalizeTransfer` | authority, admin | requireAuthority() | Validates seller is current owner; updates property OwnerID to buyer; marks transfer FINALIZED |
| `RecordDocumentHash` | owner, seller, authority, buyer | appUserId must match uploadedBy | Records a SHA-256 document hash on-chain; prevents duplicates |
| `GetPropertyHistory` | Any authenticated | None (query) | Returns Fabric transaction history for a property key |

### Authorization Enforcement

The chaincode enforces authorization through two mechanisms:

1. **`callerIdentity(ctx)`**: Extracts `role` and `appUserId` attributes from the client identity's X.509 certificate. Both attributes are required; transactions fail if missing.

2. **Role-specific checks:**
   - `requireAuthority(ctx)` — used by ApproveProperty and FinalizeTransfer
   - `requireAppUserId(ctx, expectedId)` — used by CreateProperty, ProposeTransfer, AcceptTransfer, RecordDocumentHash

### State Updates

All state-changing functions use `putStateAndEvent()` which:
1. Calls `ctx.GetStub().PutState(key, value)` to update the world state
2. Calls `ctx.GetStub().SetEvent(eventName, value)` to emit a blockchain event

`FinalizeTransfer` is the only function that calls `PutState` directly for both property and transfer keys, then emits an `OwnershipTransferred` event.

### Query Functions

- `ReadProperty(ctx, id)` — reads a property from world state by key
- `GetPropertyHistory(ctx, id)` — uses `GetHistoryForKey` to return all historical versions of a property

### Timestamps

All timestamps are derived from `ctx.GetStub().GetTxTimestamp()` (Fabric transaction time), not system time, ensuring consistent ordering across the network.

## Off-Chain vs On-Chain Storage

| Data | Storage Location | Reason |
|---|---|---|
| Document files | Off-chain (`server/uploads/`) | Avoid ledger bloat with binary data |
| Document SHA-256 hashes | On-chain (`documenthash:<id>`) | Immutable integrity proof |
| Property records | On-chain (`property:<id>`) | Authoritative ownership state |
| Transfer records | On-chain (`transfer:<id>`) | Authoritative transfer state |
| Storage keys / filenames | Off-chain only | Never written to the ledger |

## Chaincode Deployment

The chaincode is deployed as version 1.1, sequence 4 on channel `landledgerchannel`. Both Org1MSP and Org2MSP must:
1. Install the chaincode package on their peers
2. Approve the chaincode definition for their organization
3. Commit the chaincode definition to the channel
4. Initialize the chaincode (init-required)

**Do not recreate the channel.** The existing `landledgerchannel` is used.

## Fabric Mode Configuration

Environment variables (in `.env`):

| Variable | Default | Description |
|---|---|---|
| `FABRIC_MODE` | `mock` | `mock` or `fabric` |
| `FABRIC_CHANNEL` | `landledgerchannel` | Channel name |
| `FABRIC_CHAINCODE` | `landrecords` | Chaincode name |
| `FABRIC_MSP_ID` | `Org1MSP` | MSP organization ID |
| `FABRIC_PEER_ENDPOINT` | `localhost:7051` | Peer gRPC endpoint |
| `FABRIC_TLS_CA_CERT_PATH` | (empty) | Path to peer TLS CA certificate |
| `FABRIC_WALLET_PATH` | `fabric/wallet` | Identity wallet directory |

## Limitations of Fabric Integration

- Database and Fabric updates are **not atomic** — the database is updated first, then the Fabric transaction is submitted. If Fabric fails, the error is propagated to the client.
- Only Org1 peer (`peer0.org1:7051`) is used as the gateway endpoint; Org2 peer is available for endorsement but not as the primary connection.
- Chaincode initialization is required (`init-required`) but the contractapi `Init` is handled automatically by the framework.
- Private keys and certificates are stored in `fabric/wallet/` and are **gitignored** — they must be managed separately.
