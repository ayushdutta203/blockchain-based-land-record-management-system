# Existing System vs Proposed System

## Existing System (Conventional Land Record Management)

| Aspect | Existing Conventional Approach |
|---|---|
| Record storage | Centralized database or paper files at local revenue/land offices |
| Ownership proof | Physical title deeds, mutation registers, sale deeds |
| Approval process | Manual, in-person verification by revenue officials |
| Audit trail | Limited; paper logs or basic database timestamps |
| Document integrity | No cryptographic verification; documents can be altered undetected |
| Transparency | Buyers/sellers cannot independently verify current ownership status |
| Single source of truth | Multiple departments may hold conflicting records for same parcel |
| Transfer process | Manual paperwork, physical stamp duty, registry office visit |
| Tamper resistance | Low — privileged users can modify records without detection |

### Limitations of Existing System

- **Central point of failure:** A single database administrator or official can alter records.
- **No immutable history:** Past ownership changes cannot be cryptographically verified.
- **Document forgery risk:** Scanned title documents lack hash-based integrity proofs.
- **Opaque status:** Interested parties must visit offices to check property status.
- **Duplicate records:** Same parcel may be registered multiple times without detection.

## Proposed System (LandLedger Prototype)

| Aspect | LandLedger Prototype |
|---|---|
| Record storage | Hash-chained mock ledger (mock mode) or Hyperledger Fabric world state (Fabric mode) |
| Ownership proof | Digitally signed JWT session + on-chain property records |
| Approval process | Authority review via API; chaincode enforces role-based authorization |
| Audit trail | Every event recorded with payload hash, previous hash, block hash |
| Document integrity | SHA-256 hash of document recorded; document stored off-chain |
| Transparency | Role-based property view; history endpoint shows event chain |
| Single source of truth | Chaincode world state is the authoritative record; mock ledger verifies integrity |
| Transfer process | Digital three-step workflow: propose → accept → finalize |
| Tamper resistance | Hash chain verification detects any modification to recorded events |

### Improvements Over Existing System

1. **Immutable audit trail:** Every state change is appended to a verifiable event chain (mock mode) or Fabric world state (Fabric mode).
2. **Role-based authorization:** API routes and chaincode both enforce that only authorized roles can perform specific actions (e.g., only authority can approve/finalize).
3. **Document integrity without ledger bloat:** Documents stay off-chain; only SHA-256 fingerprints are recorded.
4. **Controlled transfer:** Ownership cannot change without seller proposal, buyer acceptance, and authority validation.
5. **Conflict detection:** Analytics automatically flag duplicate parcels, conflicting ownership, and duplicate documents.
6. **No infrastructure required for demo:** Mock mode runs with just Node.js; Fabric mode available for blockchain demonstration.

## Comparative Summary

| Feature | Existing System | LandLedger Prototype |
|---|---|---|
| Record immutability | No | Yes (hash-chained ledger / Fabric) |
| Role-based access | Partial | Full (API + chaincode) |
| Document integrity | No | SHA-256 hash recorded |
| Transfer workflow | Manual | Digital (3-step with authority) |
| Conflict detection | Manual | Automated analytics |
| Demo infrastructure | N/A | Mock mode (no setup) |
| Government integration | Yes (real) | No (academic prototype only) |
