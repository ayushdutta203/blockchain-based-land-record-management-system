require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { config } = require('./config');
const { createStore } = require('./store');
const { record } = require('./services/ledgerService');

async function user(store, { name, email, role, password }) {
  const existing = await store.findUserByEmail(email);
  return existing || store.createUser({ name, email, role, passwordHash: await bcrypt.hash(password, 10) });
}

async function property(store, owner, input, authority) {
  const current = (await store.listProperties()).find((item) => item.parcelNumber === input.parcelNumber && item.ownerId === owner.id);
  if (current) return current;
  const item = await store.createProperty({ ...input, ownerId: owner.id, ownerName: owner.name, createdBy: owner.id, approvedBy: input.status === 'APPROVED' ? authority.id : null });
  await record(store, { entityType: 'PROPERTY', entityId: item.id, action: 'PROPERTY_REGISTERED', actorId: owner.id, payload: { parcelNumber: item.parcelNumber, ownerId: owner.id, status: item.status, seeded: true } });
  if (item.status === 'APPROVED') await record(store, { entityType: 'PROPERTY', entityId: item.id, action: 'PROPERTY_APPROVED', actorId: authority.id, payload: { seeded: true } });
  return item;
}

async function seed() {
  const options = config();
  const store = await createStore(options);
  if (options.databaseMode === 'mock' && process.argv.includes('--reset')) store.reset();
  const authority = await user(store, { name: 'District Authority', email: 'authority@landledger.demo', role: 'authority', password: 'Authority@123' });
  const owner = await user(store, { name: 'Ananya Sharma', email: 'ananya.owner@landledger.demo', role: 'owner', password: 'Owner@123' });
  const buyer = await user(store, { name: 'Rohan Verma', email: 'rohan.buyer@landledger.demo', role: 'buyer', password: 'Buyer@123' });
  const seller = await user(store, { name: 'Meera Iyer', email: 'meera.seller@landledger.demo', role: 'seller', password: 'Seller@123' });
  await property(store, owner, { parcelNumber: 'KA-BLR-1108', title: 'Greenfield Residential Plot', address: 'Survey No. 1108, Whitefield, Bengaluru', areaSqm: 240, landType: 'Residential', status: 'APPROVED' }, authority);
  await property(store, seller, { parcelNumber: 'KA-BLR-2217', title: 'Lakeview Agricultural Land', address: 'Survey No. 2217, Varthur, Bengaluru', areaSqm: 1250, landType: 'Agricultural', status: 'APPROVED' }, authority);
  await property(store, seller, { parcelNumber: 'KA-BLR-1108', title: 'Greenfield Parcel - New Claim', address: 'Survey No. 1108, Whitefield, Bengaluru', areaSqm: 240, landType: 'Residential', status: 'PENDING' }, authority);
  console.log(`Seeded ${options.databaseMode} demo data. Buyer account available: ${buyer.email}`);
  if (store.close) await store.close();
}

seed().catch((error) => { console.error(error); process.exit(1); });
