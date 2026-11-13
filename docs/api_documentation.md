# API Documentation

## Base URL

- Development: `http://localhost:5000/api`
- Production (Vercel): API routes served from `api/` directory

## Authentication

All API endpoints (except login and health) require a JWT Bearer token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Tokens are issued by `POST /api/auth/login` and expire after 8 hours.

## Demo Login

For demonstration purposes, `POST /api/auth/demo-login` accepts a `role` parameter (`authority`, `owner`, `buyer`, `seller`) and returns a token for the corresponding demo account. This endpoint is disabled unless `DEMO_MODE=true`.

## Demo Accounts

| Role | Email | Password | userId |
|---|---|---|---|
| Authority | authority@landledger.demo | Authority@123 | 1 |
| Owner | ananya.owner@landledger.demo | Owner@123 | 2 |
| Buyer | rohan.buyer@landledger.demo | Buyer@123 | 3 |
| Seller | meera.seller@landledger.demo | Seller@123 | 4 |

## Endpoints

### Authentication

#### POST /api/auth/login
Authenticate a user and receive a JWT token.

**Request:**
```json
{
  "email": "authority@landledger.demo",
  "password": "Authority@123"
}
```

**Response (200):**
```json
{
  "token": "<jwt_token>",
  "user": {
    "id": "1",
    "email": "authority@landledger.demo",
    "name": "District Authority",
    "role": "authority",
    "createdAt": "2026-..."
  }
}
```

**Errors:** 400 (missing email/password), 401 (invalid credentials)

#### POST /api/auth/demo-login
Demo login for BTech project demonstration. Requires `DEMO_MODE=true`.

**Request:**
```json
{
  "role": "authority"
}
```

**Response (200):** Same as login.

**Errors:** 403 (demo disabled), 400 (invalid role)

#### GET /api/auth/me
Get the currently authenticated user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "user": {
    "id": "2",
    "email": "ananya.owner@landledger.demo",
    "name": "Ananya Sharma",
    "role": "owner",
    "createdAt": "2026-..."
  }
}
```

---

### Properties

#### GET /api/properties
List properties visible to the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Access rules:**
- Authority/Admin: sees all properties
- Owner/Seller/Buyer: sees APPROVED properties + properties they own/created

**Response (200):**
```json
{
  "properties": [
    {
      "id": "1",
      "parcelNumber": "KA-BLR-1108",
      "title": "Greenfield Residential Plot",
      "address": "Survey No. 1108, Whitefield, Bengaluru",
      "areaSqm": 240,
      "landType": "Residential",
      "ownerId": "2",
      "ownerName": "Ananya Sharma",
      "createdBy": "2",
      "status": "APPROVED",
      "approvedBy": "1",
      "documentIds": [],
      "documents": [],
      "createdAt": "2026-...",
      "updatedAt": "2026-..."
    }
  ]
}
```

#### POST /api/properties
Register a new property. Requires `owner`, `seller`, or `authority` role.

**Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`

**Body (form-data):**
| Field | Type | Required | Description |
|---|---|---|---|
| parcelNumber | string | Yes | Unique parcel identifier |
| title | string | Yes | Property title |
| address | string | Yes | Registered location |
| areaSqm | number | Yes | Area in square meters (positive) |
| landType | string | Yes | Residential / Commercial / Agricultural / Industrial |
| document | file | No | Title document (PDF, PNG, JPG, TXT, max 10MB) |

**Response (201):**
```json
{
  "property": { ... },
  "message": "Property submitted for authority review."
}
```

**Errors:** 400 (validation), 403 (unauthorized role)

#### GET /api/properties/:id
Get a specific property with its documents.

**Headers:** `Authorization: Bearer <token>`

**Access:** Authority/Admin, or property owner/creator, or if status is APPROVED

**Response (200):** Property object with `documents` array

**Errors:** 404 (not found), 403 (forbidden)

#### GET /api/properties/:id/history
Get tamper-evident history for a property.

**Headers:** `Authorization: Bearer <token>`

**Mock mode:** Returns local mock store events + transfer events, sorted by timestamp.

**Fabric mode:** Returns chaincode `GetPropertyHistory` results (Fabric transaction history).

**Response (200):**
```json
{
  "property": { ... },
  "history": [
    {
      "id": "1",
      "entityType": "PROPERTY",
      "entityId": "1",
      "action": "PROPERTY_REGISTERED",
      "actorId": "2",
      "timestamp": "2026-...",
      "payload": { ... }
    }
  ]
}
```

#### POST /api/properties/:id/review
Approve or reject a property. Requires `authority` or `admin` role.

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**Body:**
```json
{
  "decision": "APPROVED",
  "reason": "Optional review note"
}
```

**Response (200):**
```json
{
  "property": { ... },
  "message": "Property approved."
}
```

**Errors:** 400 (invalid decision), 403 (forbidden), 404 (not found)

#### POST /api/properties/:id/documents
Upload a document for a property. Requires `owner`, `seller`, or `authority` role. Owner/seller can only upload to their own properties.

**Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`

**Body (form-data):**
| Field | Type | Required |
|---|---|---|
| document | file | Yes |

**Response (201):**
```json
{
  "document": {
    "id": "1",
    "propertyId": "1",
    "fileName": "title-deed.pdf",
    "mimeType": "application/pdf",
    "storageKey": "1794583707358-....-title-deed.pdf",
    "sha256": "abc123...",
    "uploadedBy": "2",
    "createdAt": "2026-..."
  }
}
```

**Errors:** 400 (no file), 403 (forbidden), 404 (not found)

#### GET /api/documents/:id/download
Download an uploaded document.

**Headers:** `Authorization: Bearer <token>`

**Access:** Authority/Admin, or if user can see the property

**Response:** File download with original filename and MIME type

**Errors:** 403 (forbidden), 404 (not found)

---

### Transfers

#### GET /api/transfers
List transfers visible to the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Access:** Authority/Admin sees all; others see transfers where they are seller or buyer.

**Response (200):**
```json
{
  "transfers": [
    {
      "id": "4",
      "propertyId": "1",
      "sellerId": "2",
      "buyerId": "3",
      "status": "PROPOSED",
      "notes": "Transfer note",
      "createdAt": "2026-...",
      "updatedAt": "2026-...",
      "property": { ... },
      "seller": { "id": "2", "email": "...", "name": "...", "role": "owner" },
      "buyer": { "id": "3", "email": "...", "name": "...", "role": "buyer" }
    }
  ]
}
```

#### POST /api/transfers
Propose a property transfer. Requires `owner` or `seller` role.

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**Body:**
```json
{
  "propertyId": "1",
  "buyerEmail": "rohan.buyer@landledger.demo",
  "notes": "Optional reference note"
}
```

**Validation:**
- Property must exist and be APPROVED
- Current user must be the property owner
- Buyer must be a registered buyer/owner account
- Buyer must not be the current owner
- No open (PROPOSED or ACCEPTED) transfer for this property

**Response (201):**
```json
{
  "transfer": { ... },
  "message": "Transfer proposal sent to buyer."
}
```

**Errors:** 400 (validation), 403 (forbidden), 404 (not found), 409 (transfer exists)

#### POST /api/transfers/:id/accept
Accept a proposed transfer. The user must be the designated buyer.

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**Response (200):**
```json
{
  "transfer": { ... },
  "message": "Transfer accepted and queued for authority validation."
}
```

**Errors:** 403 (not the designated buyer), 404 (not found), 409 (invalid state)

#### POST /api/transfers/:id/finalize
Finalize an accepted transfer. Requires `authority` or `admin` role.

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**Validation:**
- Transfer must be ACCEPTED
- Seller must still be the verified owner
- Property must be APPROVED

**Response (200):**
```json
{
  "transfer": { ... },
  "property": { ... },
  "message": "Ownership transferred after authority validation."
}
```

**Errors:** 403 (forbidden), 404 (not found), 409 (invalid state / ownership validation failed)

#### POST /api/transfers/:id/reject
Reject a proposed or accepted transfer. Authority or the designated buyer can reject.

**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`

**Body:**
```json
{
  "reason": "Optional rejection reason"
}
```

**Response (200):**
```json
{
  "transfer": { ... }
}
```

**Errors:** 403 (forbidden), 404 (not found), 409 (already resolved)

---

### Analytics and Ledger

#### GET /api/analytics/overview
Get authority dashboard analytics. Requires `authority` or `admin` role.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "summary": {
    "totalProperties": 3,
    "approvedProperties": 2,
    "pendingApprovals": 1,
    "totalUsers": 4,
    "documents": 0,
    "transfers": 1,
    "finalizedTransfers": 0,
    "ledgerBlocks": 30
  },
  "propertyStatus": { "APPROVED": 2, "PENDING": 1 },
  "transferStatus": { "PROPOSED": 1 },
  "conflicts": {
    "duplicateParcels": [],
    "conflictingOwnership": [],
    "duplicateDocuments": [],
    "totalFlags": 0
  },
  "integrity": {
    "valid": true,
    "checkedBlocks": 30,
    "latestHash": "..."
  },
  "recentActivity": [ ... ]
}
```

#### GET /api/ledger/verify
Verify mock ledger hash chain integrity. Requires `authority` or `admin` role.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "valid": true,
  "checkedBlocks": 30,
  "latestHash": "b65c5b45f6dd83b6ad33816ac008e094a241aedac2940aefa6aa0f7d833df1aa"
}
```

---

### Health

#### GET /api/health
Check API status and configuration mode.

**Response (200):**
```json
{
  "status": "ok",
  "mode": "mock",
  "fabricMode": "mock",
  "prototype": true
}
```

---

## Error Response Format

All errors return a JSON body:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password."
  }
}
```

| HTTP Status | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Unauthenticated (missing or invalid token) |
| 403 | Forbidden (insufficient role) |
| 404 | Not found |
| 409 | Conflict (invalid state, duplicate) |
| 500 | Internal server error |

## Error Codes

| Code | Condition |
|---|---|
| `INVALID_CREDENTIALS` | Login failed |
| `UNAUTHENTICATED` | Missing or invalid token |
| `FORBIDDEN` | Role not authorized |
| `NOT_FOUND` | Resource not found |
| `BAD_REQUEST` | Validation error |
| `INTERNAL_ERROR` | Server error |
| `FILE_NOT_FOUND` | Uploaded file missing from disk |
| `OWNERSHIP_VALIDATION_FAILED` | Transfer finalization ownership check failed |
| `TRANSFER_EXISTS` | Open transfer already exists for property |
| `INVALID_TRANSFER_STATE` | Transfer not in expected state |
| `DEMO_DISABLED` | Demo login disabled |
| `INVALID_DEMO_ROLE` | Invalid demo role |

## Content Types

| Endpoint | Content-Type |
|---|---|
| POST /api/auth/login | application/json |
| POST /api/auth/demo-login | application/json |
| POST /api/properties | multipart/form-data |
| POST /api/properties/:id/review | application/json |
| POST /api/properties/:id/documents | multipart/form-data |
| POST /api/transfers | application/json |
| POST /api/transfers/:id/* | application/json |
| GET /api/* | N/A |
