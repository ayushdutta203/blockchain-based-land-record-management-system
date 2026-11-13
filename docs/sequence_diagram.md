# Sequence Diagram: Property Ownership Transfer

## Complete Transfer Workflow

```mermaid
sequenceDiagram
    autonumber
    participant O as Owner/Seller
    participant B as Buyer
    participant A as Authority
    participant API as API Server<br/>(Express)
    participant DB as Mock Ledger /<br/>Fabric World State
    participant FW as Fabric Wallet
    participant CC as Chaincode<br/>landrecords v1.1

    Note over O, CC: Phase 1: Property Registration
    O->>API: POST /api/properties<br/>(parcelNumber, title, address, areaSqm, landType)
    API->>DB: CreateProperty (status: PENDING)
    API->>FW: Load LedgerOwner identity
    FW-->>API: Certificate + private key
    API->>CC: submitTransaction CreateProperty
    CC-->>API: Property created (PENDING)
    API->>DB: Record event PROPERTY_REGISTERED
    API-->>O: 201 Property created

    Note over O, CC: Phase 2: Authority Approval
    A->>API: POST /api/properties/:id/review<br/>{decision: "APPROVED"}
    API->>DB: UpdateProperty status → APPROVED
    API->>FW: Load LedgerAuthority identity
    FW-->>API: Certificate + private key
    API->>CC: submitTransaction ApproveProperty
    CC-->>API: Property approved
    API->>DB: Record event PROPERTY_APPROVED
    API-->>A: 200 Property approved

    Note over O, CC: Phase 3: Transfer Proposal
    O->>API: POST /api/transfers<br/>{propertyId, buyerEmail, notes}
    API->>DB: CreateTransfer (status: PROPOSED)
    API->>FW: Load LedgerSeller identity
    FW-->>API: Certificate + private key
    API->>CC: submitTransaction ProposeTransfer
    CC-->>API: Transfer proposed
    API->>DB: Record event TRANSFER_PROPOSED
    API-->>O: 201 Transfer proposed

    Note over O, CC: Phase 4: Buyer Acceptance
    B->>API: POST /api/transfers/:id/accept
    API->>DB: UpdateTransfer status → ACCEPTED
    API->>FW: Load LedgerBuyer identity
    FW-->>API: Certificate + private key
    API->>CC: submitTransaction AcceptTransfer
    CC-->>API: Transfer accepted
    API->>DB: Record event TRANSFER_ACCEPTED
    API-->>B: 200 Transfer accepted

    Note over O, CC: Phase 5: Authority Finalization
    A->>API: POST /api/transfers/:id/finalize
    API->>DB: Validate seller is current owner<br/>and property is APPROVED
    API->>FW: Load LedgerAuthority identity
    FW-->>API: Certificate + private key
    API->>CC: submitTransaction FinalizeTransfer
    CC->>CC: Update property OwnerID → BuyerID
    CC->>CC: Update transfer status → FINALIZED
    CC-->>API: Ownership transferred
    API->>DB: UpdateProperty ownerId → buyerId
    API->>DB: UpdateTransfer status → FINALIZED
    API->>DB: Record event TRANSFER_FINALIZED
    API->>DB: Record event OWNERSHIP_TRANSFERRED
    API-->>A: 200 Ownership transferred

    Note over O, CC: Phase 6: Verify New Owner
    B->>API: GET /api/properties/:id
    API->>DB: Read property (ownerId = buyer)
    API-->>B: 200 Property with new owner name
```

## Step-by-Step Description

| Step | Actor | Action | System Response |
|---|---|---|---|
| 1 | Owner/Seller | Registers property with metadata + optional document | Property created with status `PENDING`, recorded on ledger |
| 2 | Authority | Reviews and approves the property | Property status → `APPROVED`, transferable |
| 3 | Owner/Seller | Proposes transfer to a buyer (email lookup) | Transfer created with status `PROPOSED` |
| 4 | Buyer | Accepts the proposed transfer | Transfer status → `ACCEPTED` |
| 5 | Authority | Validates seller is current owner and finalizes | Property ownerId changes to buyer; transfer status → `FINALIZED` |
| 6 | Buyer | Views property to confirm new ownership | Property displays buyer as owner |

## Authorization Checks at Each Step

| Step | API Authorization | Chaincode Authorization |
|---|---|---|
| Register Property | `owner`, `seller`, `authority` roles | Role: owner/seller/authority; appUserId matches ownerID |
| Approve Property | `authority`, `admin` roles | Role: authority/admin |
| Propose Transfer | `owner`, `seller` roles | Role: owner/seller; appUserId matches sellerID; property APPROVED |
| Accept Transfer | No role restriction (buyerId check) | Role: buyer/owner; appUserId matches buyerID; transfer PROPOSED |
| Finalize Transfer | `authority`, `admin` roles | Role: authority/admin; transfer ACCEPTED; seller is current owner |

## Error Conditions Handled

| Condition | HTTP Status | Chaincode Error |
|---|---|---|
| Property not found | 404 | "property X does not exist" |
| Property not approved | 400 | "ownership validation failed" |
| Not the owner | 403 | "caller appUserId does not match sellerID" |
| Duplicate open transfer | 409 | "an open transfer already exists for property X" |
| Transfer not found | 404 | "transfer X does not exist" |
| Transfer not proposed | 409 | "only proposed transfers can be accepted" |
| Wrong buyer | 403 | "caller appUserId does not match buyerID" |
| Already finalized | 409 | "only accepted transfers can be finalized" |
