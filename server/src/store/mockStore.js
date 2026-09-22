const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const initialData = () => ({
  users: [],
  properties: [],
  documents: [],
  transfers: [],
  events: [],
  nextIds: { user: 1, property: 1, document: 1, transfer: 1, event: 1 }
});

const stable = (value) => JSON.stringify(value, Object.keys(value).sort());
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

class MockStore {
  constructor(file) {
    this.file = file;
    this.data = initialData();
  }

  async init() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    if (fs.existsSync(this.file)) {
      this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data.nextIds ||= initialData().nextIds;
    } else {
      this.save();
    }
    return this;
  }

  save() {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  reset() {
    this.data = initialData();
    this.save();
  }

  next(type) {
    const value = this.data.nextIds[type] || 1;
    this.data.nextIds[type] = value + 1;
    return String(value);
  }

  async listUsers() { return this.data.users; }
  async findUserByEmail(email) { return this.data.users.find((item) => item.email.toLowerCase() === email.toLowerCase()) || null; }
  async findUser(id) { return this.data.users.find((item) => item.id === String(id)) || null; }
  async createUser(user) {
    const item = { id: this.next('user'), createdAt: new Date().toISOString(), ...user };
    this.data.users.push(item); this.save(); return item;
  }

  async listProperties() { return this.data.properties; }
  async getProperty(id) { return this.data.properties.find((item) => item.id === String(id)) || null; }
  async createProperty(property) {
    const now = new Date().toISOString();
    const item = { id: this.next('property'), status: 'PENDING', documentIds: [], createdAt: now, updatedAt: now, ...property };
    this.data.properties.push(item); this.save(); return item;
  }
  async updateProperty(id, changes) {
    const item = await this.getProperty(id);
    if (!item) return null;
    Object.assign(item, changes, { updatedAt: new Date().toISOString() }); this.save(); return item;
  }

  async listDocuments() { return this.data.documents; }
  async documentsForProperty(propertyId) { return this.data.documents.filter((item) => item.propertyId === String(propertyId)); }
  async getDocument(id) { return this.data.documents.find((item) => item.id === String(id)) || null; }
  async createDocument(document) {
    const item = { id: this.next('document'), createdAt: new Date().toISOString(), ...document };
    this.data.documents.push(item);
    const property = await this.getProperty(item.propertyId);
    if (property) property.documentIds.push(item.id);
    this.save(); return item;
  }

  async listTransfers() { return this.data.transfers; }
  async getTransfer(id) { return this.data.transfers.find((item) => item.id === String(id)) || null; }
  async createTransfer(transfer) {
    const now = new Date().toISOString();
    const item = { id: this.next('transfer'), status: 'PROPOSED', createdAt: now, updatedAt: now, ...transfer };
    this.data.transfers.push(item); this.save(); return item;
  }
  async updateTransfer(id, changes) {
    const item = await this.getTransfer(id);
    if (!item) return null;
    Object.assign(item, changes, { updatedAt: new Date().toISOString() }); this.save(); return item;
  }

  async appendEvent({ entityType, entityId, action, actorId, payload }) {
    const timestamp = new Date().toISOString();
    const prior = this.data.events.at(-1);
    const payloadHash = digest(stable(payload || {}));
    const previousHash = prior ? prior.blockHash : 'GENESIS';
    const blockHash = digest(`${previousHash}|${entityType}|${entityId}|${action}|${actorId}|${timestamp}|${payloadHash}`);
    const item = { id: this.next('event'), entityType, entityId: String(entityId), action, actorId: String(actorId), timestamp, payload: payload || {}, payloadHash, previousHash, blockHash };
    this.data.events.push(item); this.save(); return item;
  }
  async eventsFor(entityType, entityId) { return this.data.events.filter((item) => item.entityType === entityType && item.entityId === String(entityId)); }
  async allEvents() { return this.data.events; }
  async verifyLedger() {
    let expectedPrevious = 'GENESIS';
    for (const item of this.data.events) {
      const payloadHash = digest(stable(item.payload || {}));
      const expectedBlock = digest(`${expectedPrevious}|${item.entityType}|${item.entityId}|${item.action}|${item.actorId}|${item.timestamp}|${payloadHash}`);
      if (payloadHash !== item.payloadHash || expectedBlock !== item.blockHash || item.previousHash !== expectedPrevious) {
        return { valid: false, checkedBlocks: this.data.events.length, failedBlock: item.id };
      }
      expectedPrevious = item.blockHash;
    }
    return { valid: true, checkedBlocks: this.data.events.length, latestHash: expectedPrevious };
  }
}

module.exports = { MockStore, initialData };
