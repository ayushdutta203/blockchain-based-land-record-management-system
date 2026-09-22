CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','buyer','seller','authority','admin')),
  password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS properties (
  id BIGSERIAL PRIMARY KEY, parcel_number TEXT NOT NULL, title TEXT NOT NULL, address TEXT NOT NULL,
  area_sqm NUMERIC NOT NULL, land_type TEXT NOT NULL, owner_id BIGINT NOT NULL REFERENCES users(id),
  owner_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  created_by BIGINT REFERENCES users(id), approved_by BIGINT REFERENCES users(id), rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS properties_parcel_index ON properties(parcel_number);
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY, property_id BIGINT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL, mime_type TEXT NOT NULL, size BIGINT NOT NULL, sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL, uploaded_by BIGINT NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS documents_hash_index ON documents(sha256);
CREATE TABLE IF NOT EXISTS transfers (
  id BIGSERIAL PRIMARY KEY, property_id BIGINT NOT NULL REFERENCES properties(id), seller_id BIGINT NOT NULL REFERENCES users(id),
  buyer_id BIGINT NOT NULL REFERENCES users(id), notes TEXT, status TEXT NOT NULL DEFAULT 'PROPOSED'
  CHECK (status IN ('PROPOSED','ACCEPTED','FINALIZED','REJECTED')), authority_id BIGINT REFERENCES users(id),
  accepted_at TIMESTAMPTZ, finalized_at TIMESTAMPTZ, rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ledger_events (
  id BIGSERIAL PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, action TEXT NOT NULL,
  actor_id BIGINT NOT NULL REFERENCES users(id), timestamp TIMESTAMPTZ NOT NULL, payload JSONB NOT NULL,
  payload_hash TEXT NOT NULL, previous_hash TEXT NOT NULL, block_hash TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS ledger_entity_index ON ledger_events(entity_type, entity_id, id);
