const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const { MockStore } = require('../src/store/mockStore');
const { createApp } = require('../src/app');

async function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'land-ledger-'));
  const store = await new MockStore(path.join(root, 'ledger.json')).init();
  const makeUser = async (name, email, role, password) => store.createUser({ name, email, role, passwordHash: await bcrypt.hash(password, 4) });
  const accounts = {
    authority: await makeUser('Authority', 'authority@test.local', 'authority', 'Authority@123'),
    owner: await makeUser('Owner', 'owner@test.local', 'owner', 'Owner@123'),
    buyer: await makeUser('Buyer', 'buyer@test.local', 'buyer', 'Buyer@123')
  };
  const app = createApp({ store, options: { jwtSecret: 'test-secret', uploadDir: path.join(root, 'uploads'), databaseMode: 'mock', fabricMode: 'mock' } });
  const login = async (email, password) => (await request(app).post('/api/auth/login').send({ email, password })).body.token;
  return { app, store, accounts, login };
}

test('enforces role authorization, hashes documents, and finalizes a validated transfer', async () => {
  const { app, login } = await setup();
  const ownerToken = await login('owner@test.local', 'Owner@123');
  const buyerToken = await login('buyer@test.local', 'Buyer@123');
  const authorityToken = await login('authority@test.local', 'Authority@123');
  assert.ok(ownerToken && buyerToken && authorityToken);
  const created = await request(app).post('/api/properties').set('Authorization', `Bearer ${ownerToken}`)
    .field('parcelNumber', 'TEST-100').field('title', 'Test Parcel').field('address', 'Test Address').field('areaSqm', '150').field('landType', 'Residential')
    .attach('document', Buffer.from('official-demo-title'), 'title.txt');
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.property.status, 'PENDING');
  assert.equal(created.body.property.documents[0].sha256.length, 64);
  const propertyId = created.body.property.id;
  const forbidden = await request(app).post(`/api/properties/${propertyId}/review`).set('Authorization', `Bearer ${buyerToken}`).send({ decision: 'APPROVED' });
  assert.equal(forbidden.status, 403);
  const review = await request(app).post(`/api/properties/${propertyId}/review`).set('Authorization', `Bearer ${authorityToken}`).send({ decision: 'APPROVED' });
  assert.equal(review.status, 200);
  const transfer = await request(app).post('/api/transfers').set('Authorization', `Bearer ${ownerToken}`).send({ propertyId, buyerEmail: 'buyer@test.local', notes: 'Academic test transfer' });
  assert.equal(transfer.status, 201);
  const accepted = await request(app).post(`/api/transfers/${transfer.body.transfer.id}/accept`).set('Authorization', `Bearer ${buyerToken}`).send({});
  assert.equal(accepted.status, 200);
  const finalized = await request(app).post(`/api/transfers/${transfer.body.transfer.id}/finalize`).set('Authorization', `Bearer ${authorityToken}`).send({});
  assert.equal(finalized.status, 200);
  assert.equal(finalized.body.property.ownerName, 'Buyer');
  const integrity = await request(app).get('/api/ledger/verify').set('Authorization', `Bearer ${authorityToken}`);
  assert.equal(integrity.status, 200);
  assert.equal(integrity.body.valid, true);
});

test('authority analytics flags duplicate parcels without exposing it as a verified conflict', async () => {
  const { app, store, accounts, login } = await setup();
  await store.createProperty({ parcelNumber: 'DUP-1', title: 'First', address: 'One', areaSqm: 10, landType: 'Residential', ownerId: accounts.owner.id, ownerName: accounts.owner.name, createdBy: accounts.owner.id, status: 'APPROVED' });
  await store.createProperty({ parcelNumber: 'DUP-1', title: 'Claim', address: 'One', areaSqm: 10, landType: 'Residential', ownerId: accounts.buyer.id, ownerName: accounts.buyer.name, createdBy: accounts.buyer.id, status: 'PENDING' });
  const token = await login('authority@test.local', 'Authority@123');
  const response = await request(app).get('/api/analytics/overview').set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.conflicts.duplicateParcels.length, 1);
  assert.equal(response.body.conflicts.conflictingOwnership.length, 0);
});
