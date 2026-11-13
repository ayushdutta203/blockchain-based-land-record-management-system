# Problem Statement and Objectives

## Problem Statement

Conventional land record management systems in many regions rely on centralized, paper-heavy processes that are vulnerable to:

1. **Tampering and fraud:** Centralized databases can be altered by privileged insiders without an immutable audit trail.
2. **Lack of transparency:** Buyers and sellers cannot independently verify ownership history or the current status of a property claim.
3. **Slow, manual approvals:** Property registration and transfer approvals require physical presence, paperwork, and manual verification, causing delays.
4. **Document integrity risks:** Title documents stored in ordinary file systems lack cryptographic proof of integrity — it is difficult to prove a document has not been altered.
5. **No single source of truth:** Multiple departments may maintain conflicting records for the same parcel.

These problems are especially acute in academic demonstrations of land registry systems, where a tamper-evident, role-controlled, auditable prototype can illustrate how distributed ledger technology addresses these concerns.

## Objectives

The primary objective of LandLedger is to build and demonstrate an academic prototype of a permissioned blockchain-based land record and property transaction management system. Specific objectives:

1. **Role-based access:** Implement four distinct user roles (authority, owner, buyer, seller) with authorization enforced at both API and chaincode layers.
2. **Controlled property registration:** Allow property submission with metadata and optional documents, pending authority approval before transfer eligibility.
3. **Immutable ownership history:** Record every property and transfer event in a tamper-evident ledger that can be independently verified.
4. **Document integrity without on-chain storage:** Store actual documents off-chain and record only SHA-256 hash fingerprints on-chain, avoiding bloating the ledger with binary data.
5. **Controlled transfer workflow:** Implement a three-step transfer (propose → accept → finalize) requiring authority validation before ownership changes.
6. **Conflict detection:** Provide authority analytics that flag duplicate parcels, conflicting ownership, and duplicate document fingerprints.
7. **Dual-mode operation:** Support mock mode (no infrastructure) for demos and Fabric mode (real Hyperledger Fabric) for blockchain demonstration.

## Scope

**In scope:**
- User registration and role-based login (JWT authentication)
- Property registration with metadata and document upload
- Authority approval/rejection of property claims
- Three-step ownership transfer with authority finalization
- Off-chain document storage with on-chain SHA-256 hash recording
- Tamper-evident mock ledger with integrity verification
- Authority analytics dashboard with conflict flags
- Fabric mode integration with real chaincode (landrecords v1.1)
- React/Vite frontend with role-aware dashboards

**Out of scope:**
- Government land registry integration
- Legally binding title issuance
- Public blockchain deployment
- Cryptocurrency or tokenization
- Biometric or Aadhaar-based identity verification
- Multi-language support
- Mobile application
