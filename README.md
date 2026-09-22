# Blockchain-Based Land Record and Property Transaction Management System

> **Academic prototype - not a government land registry.** This demonstration application uses sample identities and records. It does not connect to a government database, issue legally binding titles, or replace official registration procedures.

## What is included

- Role-based access for **owner**, **buyer**, **seller**, and **authority/admin** users.
- Property registration, authority approval/rejection, ownership verification, and transfer requests.
- Document upload metadata with SHA-256 hashes, integrity verification, and off-chain file storage.
- A tamper-evident local mock ledger: each history entry records a payload hash, previous block hash, and block hash.
- Duplicate/conflicting ownership detection and an authority analytics dashboard.
- PostgreSQL repository/schema for containerized deployment.
- Go chaincode and Fabric network configuration templates for moving the prototype to a permissioned Fabric network.
- A polished React/Vite interface and REST API.

## Quick start - mock ledger (recommended for demo)

Prerequisites: Node.js 20+ and npm.

```bash
copy .env.example .env
npm install
npm install --prefix server
npm install --prefix client
npm run seed
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:5000`.

`DATABASE_MODE=mock` is the default. It stores non-sensitive demo data at `server/data/ledger.json` and uploaded files in `server/uploads/`. Do not use the mock ledger for real records.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Authority | authority@landledger.demo | Authority@123 |
| Owner | ananya.owner@landledger.demo | Owner@123 |
| Buyer | rohan.buyer@landledger.demo | Buyer@123 |
| Seller | meera.seller@landledger.demo | Seller@123 |

## PostgreSQL and Docker

For the full PostgreSQL-backed container setup:

```bash
docker compose up --build
```

Open `http://localhost:8080`. The API automatically uses the supplied `POSTGRES_URL` when `DATABASE_MODE=postgres`.

To use Postgres outside Docker, create a database with `server/sql/schema.sql`, set `DATABASE_MODE=postgres` and `POSTGRES_URL` in `.env`, then run the seed script.

## Workflow

1. An owner or seller registers a property with core metadata and an optional title document.
2. The system calculates a SHA-256 document digest and stores the file off-chain. The digest and storage key are recorded in the ledger history.
3. An authority reviews the submitted property. Approved properties can be transferred.
4. A seller/owner proposes a transfer; the buyer accepts it; an authority finalizes it after ownership validation.
5. Every status or ownership event is appended to the mock ledger. The integrity endpoint recomputes the hash chain.
6. The analytics screen flags repeated parcels, multiple active owners, duplicate document hashes, and pending transfers.

## REST API overview

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/auth/login` | Receive a role-aware JWT |
| GET | `/api/properties` | Browse properties filtered by access role |
| POST | `/api/properties` | Register a property and optional document |
| GET | `/api/properties/:id/history` | View tamper-evident ownership history |
| POST | `/api/transfers` | Propose a property transfer |
| POST | `/api/transfers/:id/accept` | Buyer accepts a proposal |
| POST | `/api/transfers/:id/finalize` | Authority validates and finalizes transfer |
| GET | `/api/analytics/overview` | Authority analytics and conflict flags |
| GET | `/api/ledger/verify` | Check mock-ledger hash chain integrity |

## Hyperledger Fabric compatibility

The application’s mock mode lets a college demonstration run without the infrastructure overhead of Fabric. `fabric/chaincode/landrecords` contains a Go contract that exposes the same core concepts: property creation, approval, transfer, history, and document hashes. `fabric/network/README.md` describes the expected Fabric network variables and integration boundary.

To connect a real Fabric network, implement a Fabric gateway adapter in `server/src/services/ledgerService.js`, use organization identities from a wallet, and set `FABRIC_MODE=fabric`. The included configuration deliberately contains no real certificates or public-agency integration.

## Verification

Run these before demonstration or submission:

```bash
npm test
npm run build
```

The API test suite verifies login, role restrictions, document hashing, authority approval, full transfer lifecycle, conflict analytics, and the mock-ledger integrity chain.

## Security notes

- Passwords are hashed with bcrypt; authentication is signed JWT-based.
- Authorization is enforced on API routes, not only in the UI.
- Uploaded files are kept off-chain. Only SHA-256 fingerprints and storage references are written to the ledger history.
- Production deployment requires HTTPS, secret rotation, malware scanning, object-storage encryption, data retention policies, input throttling, and an independent security review.
