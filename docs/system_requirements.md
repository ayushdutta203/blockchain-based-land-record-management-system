# System Requirements

## Hardware Requirements

### Minimum (for mock mode demo)

| Component | Requirement |
|---|---|
| Processor | Intel Core i3 / AMD equivalent or better |
| RAM | 4 GB minimum, 8 GB recommended |
| Storage | 10 GB free disk space |
| Display | 1280 x 720 resolution |
| Network | Ethernet or Wi-Fi (for local development) |

### Recommended (for Fabric mode)

| Component | Requirement |
|---|---|
| Processor | Intel Core i5 / AMD Ryzen 5 or better |
| RAM | 8 GB minimum, 16 GB recommended |
| Storage | 20 GB free disk space (Docker images, chaincode containers) |
| Display | 1920 x 1080 resolution |
| Network | Ethernet recommended for Docker container networking |

### Docker Host Requirements (Fabric mode only)

- Docker Desktop or Docker Engine installed
- Docker Compose v2
- WSL2 (Windows) or Linux kernel with container support
- At least 4 CPU cores allocated to Docker

## Software Requirements

### Development Environment

| Component | Version | Purpose |
|---|---|---|
| Node.js | 20+ | Backend runtime and frontend build tool |
| npm | 10+ | Package manager |
| Git | 2.30+ | Version control |

### Frontend Dependencies (client/package.json)

| Package | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI framework |
| React DOM | 18.3.1 | React renderer for web |
| Vite | 6.0.5 | Build tool and dev server |
| @vitejs/plugin-react | 4.3.4 | Vite React plugin |

### Backend Dependencies (server/package.json)

| Package | Version | Purpose |
|---|---|---|
| Express | 5.1.0 | Web API framework |
| @hyperledger/fabric-gateway | 1.13.0 | Fabric Gateway SDK (Fabric mode) |
| bcryptjs | 2.4.3 | Password hashing |
| jsonwebtoken | 9.0.2 | JWT authentication |
| cors | 2.8.5 | CORS middleware |
| multer | 2.0.2 | File upload handling |
| dotenv | 16.4.7 | Environment variable loading |
| pg | 8.13.1 | PostgreSQL client (optional) |
| supertest | 7.0.0 | API testing (devDependency) |

### Fabric Infrastructure (Fabric mode only)

| Component | Version | Purpose |
|---|---|---|
| Hyperledger Fabric | 2.5+ | Permissioned blockchain network |
| Docker | 20.10+ | Container runtime for Fabric peers/orderer/CAs |
| Docker Compose | v2 | Multi-container orchestration |
| Go | 1.21+ | Chaincode compilation |

### Supported Operating Systems

- Windows 10/11 (with WSL2 for Fabric mode)
- Linux (Ubuntu 20.04+)
- macOS (Intel or Apple Silicon)

## Network Requirements (Fabric Mode)

| Endpoint | Port | Purpose |
|---|---|---|
| peer0.org1.example.com | 7051 | Org1 peer gRPC endpoint |
| peer0.org2.example.com | 9051 | Org2 peer gRPC endpoint |
| orderer.example.com | 7050 | Ordering service |
| ca_org1 / ca_org2 / ca_orderer | 7054 / 8054 / 9054 | Certificate Authorities |
| API server | 5000 | Backend REST API |
| Frontend dev server | 5173 | React/Vite development server |

## Data Storage

| Mode | Storage Location | Contents |
|---|---|---|
| Mock (default) | `server/data/ledger.json` | Users, properties, documents, transfers, events |
| Mock uploads | `server/uploads/` | Uploaded document files (off-chain) |
| Fabric | Fabric world state (CouchDB/LevelDB) | Chaincode state: properties, transfers, document hashes |
| Fabric wallet | `fabric/wallet/` | Identity certificates and private keys |
