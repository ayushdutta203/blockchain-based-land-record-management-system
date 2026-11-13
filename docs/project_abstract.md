# Project Abstract

**Project Title:** Blockchain-Based Land Record and Property Transaction Management System (LandLedger)

**Type:** Academic BTech Final-Year Project Prototype

**Domain:** Blockchain, Distributed Ledger Technology, Property Records Management

## Overview

LandLedger is an academic prototype that demonstrates how blockchain technology — specifically a permissioned Hyperledger Fabric network — can be applied to land record and property transaction management. The system enables role-based access for authority, owner, buyer, and seller users to register properties, upload title documents, approve or reject property claims, and execute controlled ownership transfers through a multi-step workflow (propose → accept → finalize).

## Key Features

- **Role-Based Access Control:** Four user roles — authority, owner, buyer, seller — each with distinct permissions enforced on both the API and chaincode layers.
- **Property Registration:** Owners/sellers register properties with parcel number, title, address, area, land type, and optional title document.
- **Authority Review:** Authority users approve or reject pending property registrations before they become transferable.
- **Controlled Ownership Transfer:** A three-step transfer workflow — seller proposes, buyer accepts, authority validates and finalizes — ensures no unauthorized ownership changes.
- **Document Integrity:** Uploaded title documents are stored off-chain; only their SHA-256 hash fingerprints are recorded on the ledger for integrity verification.
- **Tamper-Evident Ledger:** In mock mode, every state change is appended to a hash-chained event log (previous hash → payload hash → block hash) that can be verified for integrity.
- **Dual Ledger Modes:** The application runs in mock mode (local JSON ledger, no infrastructure required) or Fabric mode (real Hyperledger Fabric network via the `@hyperledger/fabric-gateway` SDK).
- **Conflict Detection:** Authority analytics flag duplicate parcel references, conflicting ownership, and duplicate document fingerprints.

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18.3, Vite 6, CSS3 |
| Backend | Node.js, Express 5 |
| Authentication | bcryptjs password hashing, JWT (8-hour expiry) |
| File Upload | Multer (memory storage, off-chain filesystem) |
| Mock Ledger | Custom hash-chained JSON event store |
| Blockchain | Hyperledger Fabric 2.5+, `@hyperledger/fabric-gateway` 1.13.0 |
| Chaincode | Go, `fabric-contract-api-go` |
| Database (optional) | PostgreSQL |

## Academic Disclaimer

> **This is an academic prototype, not a government land registry.** The application uses sample identities and records. It does not connect to any government database, issue legally binding titles, or replace official land registration procedures. Blockchain records here demonstrate a permissioned ledger architecture for educational purposes only.
