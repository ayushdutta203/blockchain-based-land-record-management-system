const crypto = require('crypto');
const { Pool } = require('pg');

const stable = (value) => JSON.stringify(value, Object.keys(value).sort());
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const mapProperty = (row) => row && ({ ...row, id: String(row.id), ownerId: String(row.owner_id), ownerName: row.owner_name, parcelNumber: row.parcel_number, areaSqm: Number(row.area_sqm), landType: row.land_type, documentIds: row.document_ids || [], createdAt: row.created_at, updatedAt: row.updated_at });
const mapUser = (row) => row && ({ ...row, id: String(row.id), passwordHash: row.password_hash, createdAt: row.created_at });
const mapDocument = (row) => row && ({ ...row, id: String(row.id), propertyId: String(row.property_id), fileName: row.file_name, mimeType: row.mime_type, storageKey: row.storage_key, uploadedBy: String(row.uploaded_by), createdAt: row.created_at });
const mapTransfer = (row) => row && ({ ...row, id: String(row.id), propertyId: String(row.property_id), sellerId: String(row.seller_id), buyerId: String(row.buyer_id), authorityId: row.authority_id ? String(row.authority_id) : null, createdAt: row.created_at, updatedAt: row.updated_at });
const mapEvent = (row) => row && ({ ...row, id: String(row.id), entityType: row.entity_type, entityId: String(row.entity_id), actorId: String(row.actor_id), timestamp: typeof row.timestamp === 'string' ? row.timestamp : row.timestamp.toISOString(), payloadHash: row.payload_hash, previousHash: row.previous_hash, blockHash: row.block_hash });

class PostgresStore {
  constructor(connectionString) { this.pool = new Pool({ connectionString }); }
  async init() { await this.pool.query('SELECT 1'); return this; }
  async close() { await this.pool.end(); }
  async listUsers() { return (await this.pool.query('SELECT * FROM users ORDER BY id')).rows.map(mapUser); }
  async findUserByEmail(email) { return mapUser((await this.pool.query('SELECT * FROM users WHERE lower(email) = lower($1)', [email])).rows[0]); }
  async findUser(id) { return mapUser((await this.pool.query('SELECT * FROM users WHERE id = $1', [id])).rows[0]); }
  async createUser(user) { return mapUser((await this.pool.query('INSERT INTO users (email,name,role,password_hash) VALUES ($1,$2,$3,$4) RETURNING *', [user.email, user.name, user.role, user.passwordHash])).rows[0]); }
  async listProperties() { return (await this.pool.query('SELECT * FROM properties ORDER BY updated_at DESC')).rows.map(mapProperty); }
  async getProperty(id) { return mapProperty((await this.pool.query('SELECT * FROM properties WHERE id=$1', [id])).rows[0]); }
  async createProperty(property) {
    const row = (await this.pool.query('INSERT INTO properties (parcel_number,title,address,area_sqm,land_type,owner_id,owner_name,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [property.parcelNumber, property.title, property.address, property.areaSqm, property.landType, property.ownerId, property.ownerName, property.status || 'PENDING', property.createdBy])).rows[0];
    return mapProperty(row);
  }
  async updateProperty(id, changes) {
    const allowed = { title: 'title', address: 'address', areaSqm: 'area_sqm', landType: 'land_type', ownerId: 'owner_id', ownerName: 'owner_name', status: 'status', approvedBy: 'approved_by', rejectionReason: 'rejection_reason' };
    const entries = Object.entries(changes).filter(([key]) => allowed[key]); if (!entries.length) return this.getProperty(id);
    const sets = entries.map(([key], index) => `${allowed[key]}=$${index + 1}`); const values = entries.map(([, value]) => value);
    const row = (await this.pool.query(`UPDATE properties SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${values.length + 1} RETURNING *`, [...values, id])).rows[0]; return mapProperty(row);
  }
  async listDocuments() { return (await this.pool.query('SELECT * FROM documents ORDER BY id')).rows.map(mapDocument); }
  async documentsForProperty(propertyId) { return (await this.pool.query('SELECT * FROM documents WHERE property_id=$1 ORDER BY id', [propertyId])).rows.map(mapDocument); }
  async getDocument(id) { return mapDocument((await this.pool.query('SELECT * FROM documents WHERE id=$1', [id])).rows[0]); }
  async createDocument(document) { return mapDocument((await this.pool.query('INSERT INTO documents (property_id,file_name,mime_type,size,sha256,storage_key,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *', [document.propertyId, document.fileName, document.mimeType, document.size, document.sha256, document.storageKey, document.uploadedBy])).rows[0]); }
  async listTransfers() { return (await this.pool.query('SELECT * FROM transfers ORDER BY updated_at DESC')).rows.map(mapTransfer); }
  async getTransfer(id) { return mapTransfer((await this.pool.query('SELECT * FROM transfers WHERE id=$1', [id])).rows[0]); }
  async createTransfer(transfer) { return mapTransfer((await this.pool.query('INSERT INTO transfers (property_id,seller_id,buyer_id,notes,status) VALUES ($1,$2,$3,$4,$5) RETURNING *', [transfer.propertyId, transfer.sellerId, transfer.buyerId, transfer.notes || '', transfer.status || 'PROPOSED'])).rows[0]); }
  async updateTransfer(id, changes) {
    const allowed = { status: 'status', notes: 'notes', authorityId: 'authority_id', finalizedAt: 'finalized_at', acceptedAt: 'accepted_at', rejectionReason: 'rejection_reason' };
    const entries = Object.entries(changes).filter(([key]) => allowed[key]); if (!entries.length) return this.getTransfer(id);
    const sets = entries.map(([key], index) => `${allowed[key]}=$${index + 1}`); const values = entries.map(([, value]) => value);
    const row = (await this.pool.query(`UPDATE transfers SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${values.length + 1} RETURNING *`, [...values, id])).rows[0]; return mapTransfer(row);
  }
  async appendEvent({ entityType, entityId, action, actorId, payload }) {
    const previous = (await this.pool.query('SELECT block_hash FROM ledger_events ORDER BY id DESC LIMIT 1')).rows[0]; const previousHash = previous ? previous.block_hash : 'GENESIS';
    const timestamp = new Date().toISOString(); const payloadHash = digest(stable(payload || {}));
    const blockHash = digest(`${previousHash}|${entityType}|${entityId}|${action}|${actorId}|${timestamp}|${payloadHash}`);
    const row = (await this.pool.query('INSERT INTO ledger_events (entity_type,entity_id,action,actor_id,timestamp,payload,payload_hash,previous_hash,block_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [entityType, entityId, action, actorId, timestamp, payload || {}, payloadHash, previousHash, blockHash])).rows[0]; return mapEvent(row);
  }
  async eventsFor(entityType, entityId) { return (await this.pool.query('SELECT * FROM ledger_events WHERE entity_type=$1 AND entity_id=$2 ORDER BY id', [entityType, entityId])).rows.map(mapEvent); }
  async allEvents() { return (await this.pool.query('SELECT * FROM ledger_events ORDER BY id')).rows.map(mapEvent); }
  async verifyLedger() {
    const events = await this.allEvents(); let previousHash = 'GENESIS';
    for (const event of events) {
      const payloadHash = digest(stable(event.payload || {})); const blockHash = digest(`${previousHash}|${event.entityType}|${event.entityId}|${event.action}|${event.actorId}|${event.timestamp}|${payloadHash}`);
      if (event.previousHash !== previousHash || event.payloadHash !== payloadHash || event.blockHash !== blockHash) return { valid: false, checkedBlocks: events.length, failedBlock: event.id };
      previousHash = event.blockHash;
    }
    return { valid: true, checkedBlocks: events.length, latestHash: previousHash };
  }
}

module.exports = { PostgresStore };
