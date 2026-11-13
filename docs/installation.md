# Installation and Execution Instructions

## Prerequisites

| Requirement | Version | Purpose |
|---|---|---|
| Node.js | 20+ | Backend and frontend runtime |
| npm | 10+ | Package manager |
| Git | 2.30+ | Version control |
| Docker | 20.10+ | Only for Fabric mode |
| Docker Compose | v2 | Only for Fabric mode |
| Go | 1.21+ | Only for chaincode compilation |

## Step 1: Clone or Open the Project

Open the project folder:

```
D:\coding\Blockchain-Based Land Record and Property Transaction Management System
```

## Step 2: Install Dependencies

Run the following commands from the project root in PowerShell:

```powershell
npm install
npm install --prefix server
npm install --prefix client
```

## Step 3: Configure Environment

Copy the example environment file:

```powershell
copy .env.example .env
```

### Mock Mode (Default — Recommended for Demo)

The default `.env` uses `FABRIC_MODE=mock`. No Fabric infrastructure is required. This is the recommended mode for BTech project demonstration.

### Fabric Mode (Optional — For Blockchain Demonstration)

To run with real Hyperledger Fabric:
1. Ensure the Fabric network is running (Docker containers: peer0.org1, peer0.org2, orderer, CAs)
2. Edit `.env` and set `FABRIC_MODE=fabric`
3. Ensure `FABRIC_TLS_CA_CERT_PATH` points to the peer TLS CA certificate
4. Ensure `FABRIC_WALLET_PATH` points to `fabric/wallet/` (contains identity certificates)

The Fabric network should already be running with chaincode `landrecords` v1.1, sequence 4 committed on channel `landledgerchannel`.

## Step 4: Seed Demo Data (Mock Mode Only)

```powershell
npm run seed --prefix server
```

This creates 4 demo users and 3 sample properties. Output:
```
Seeded mock demo data. Buyer account available: rohan.buyer@landledger.demo
```

## Step 5: Start the API Server

Open PowerShell in the `server` directory:

```powershell
npm run dev --prefix server
```

The API will start at `http://localhost:5000`. Verify by visiting:
```
http://localhost:5000/api/health
```

Expected response:
```json
{"status":"ok","mode":"mock","fabricMode":"mock","prototype":true}
```

## Step 6: Start the Frontend

Open a **new** PowerShell terminal in the `client` directory:

```powershell
npm run dev --prefix client
```

The frontend will start at `http://localhost:5173`.

## Step 7: Login and Use the Application

Open `http://localhost:5173` in your browser.

### Demo Accounts

| Role | Email | Password |
|---|---|---|
| Authority | authority@landledger.demo | Authority@123 |
| Owner | ananya.owner@landledger.demo | Owner@123 |
| Buyer | rohan.buyer@landledger.demo | Buyer@123 |
| Seller | meera.seller@landledger.demo | Seller@123 |

### Demo Workflow

1. **Login** as any role using the demo credentials or the role buttons
2. **Register a property** (Owner/Seller/Authority): Fill parcel number, title, address, area, land type, and optionally upload a document
3. **Approve the property** (Authority): Go to Authority portal, review pending properties, click Approve
4. **Propose a transfer** (Owner/Seller): Select an approved property, enter buyer's email, submit
5. **Accept the transfer** (Buyer): Go to Transfers, click Accept on proposed transfers
6. **Finalize the transfer** (Authority): Go to Authority portal, click Validate & Finalize on accepted transfers
7. **Verify ownership:** Check that the property now shows the buyer as the new owner
8. **View history:** Open the property detail drawer to see the tamper-evident event history
9. **Verify ledger** (Authority): Click "Verify ledger" in the Authority portal to confirm hash chain integrity

## Step 8: Run Backend Tests

```powershell
npm test --prefix server
```

Expected output:
```
✔ enforces role authorization, hashes documents, and finalizes a validated transfer
✔ authority analytics flags duplicate parcels without exposing it as a verified conflict
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

## Step 9: Build Frontend for Production

```powershell
npm run build --prefix client
```

Output is generated in `client/dist/`.

## Ports Summary

| Service | Port | URL |
|---|---|---|
| Backend API | 5000 | http://localhost:5000 |
| Frontend Dev Server | 5173 | http://localhost:5173 |
| Fabric Peer Org1 | 7051 | peer0.org1.example.com:7051 |
| Fabric Peer Org2 | 9051 | peer0.org2.example.com:9051 |
| Fabric Orderer | 7050 | orderer.example.com:7050 |

## File Structure

```
LandLedger/
├── .env                          # Environment variables (gitignored)
├── .env.example                  # Example environment template
├── .gitignore                    # Git ignore rules
├── README.md                     # Project README
├── docs/                         # BTech project documentation
│   ├── project_abstract.md
│   ├── problem_statement.md
│   ├── existing_vs_proposed.md
│   ├── system_requirements.md
│   ├── architecture.md
│   ├── er_diagram.md
│   ├── sequence_diagram.md
│   ├── fabric_chaincode.md
│   ├── api_documentation.md
│   ├── testing.md
│   ├── advantages_limitations.md
│   └── conclusion.md
├── server/                       # Backend (Node.js/Express)
│   ├── src/
│   │   ├── app.js                # Express app with all routes
│   │   ├── server.js             # Entry point
│   │   ├── config.js             # Configuration
│   │   ├── seed.js               # Demo data seeder
│   │   ├── services/
│   │   │   ├── authService.js    # JWT authentication
│   │   │   ├── fabricGateway.js  # Fabric Gateway SDK
│   │   │   ├── ledgerService.js  # Ledger adapter (mock + Fabric)
│   │   │   └── analyticsService.js
│   │   ├── store/
│   │   │   ├── index.js          # Store factory
│   │   │   ├── mockStore.js      # Mock hash-chained ledger
│   │   │   └── postgresStore.js  # PostgreSQL store (skeleton)
│   │   ├── errors.js
│   │   └── utils.js
│   ├── data/
│   │   └── ledger.json           # Mock ledger data (gitignored)
│   ├── uploads/                  # Off-chain document storage (gitignored)
│   ├── package.json
│   └── test/
│       └── *.test.js
├── client/                       # Frontend (React/Vite)
│   ├── src/
│   │   ├── main.jsx              # React application
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── dist/                     # Production build output
├── fabric/                       # Hyperledger Fabric
│   ├── chaincode/
│   │   └── landrecords/
│   │       └── landrecords.go    # Chaincode source (Go)
│   ├── wallet/                   # Identity certificates (gitignored)
│   │   ├── LedgerAuthority/
│   │   ├── LedgerOwner/
│   │   ├── LedgerBuyer/
│   │   └── LedgerSeller/
│   └── tls/
│       └── ca.crt
├── docker-compose.yml            # Fabric network definition
└── api/                          # Vercel serverless API routes
```

## Troubleshooting

| Issue | Solution |
|---|---|
| API won't start | Check that `npm install --prefix server` was run and `.env` exists |
| Frontend won't connect | Verify API is running on port 5000; check CORS settings |
| Fabric mode fails | Ensure Docker containers are running; verify `FABRIC_MODE=fabric` in `.env` |
| Login fails | Run `npm run seed --prefix server` to create demo users |
| Document upload fails | Check file size (max 10MB) and that `server/uploads/` directory exists |
| Port already in use | Change `PORT` in `.env` or stop the conflicting process |

## Production Warning

This is an academic prototype. Do not deploy to production without:
- Changing `JWT_SECRET` to a strong random value
- Enabling HTTPS
- Adding rate limiting and input validation
- Replacing mock store with PostgreSQL
- Securing Fabric wallet private keys
- Conducting an independent security review
