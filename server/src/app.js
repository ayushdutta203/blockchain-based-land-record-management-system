const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { login, authenticate, allow, publicUser } = require('./services/authService');
const { overview } = require('./services/analyticsService');
const { record } = require('./services/ledgerService');
const { AppError } = require('./errors');
const { required, number, documentMetadata } = require('./utils');

const roles = { authority: ['authority', 'admin'], propertyWriter: ['owner', 'seller', 'authority', 'admin'] };

function canSeeProperty(property, user) {
  return ['authority', 'admin'].includes(user.role) || property.status === 'APPROVED' || property.ownerId === String(user.sub) || property.createdBy === String(user.sub);
}

async function propertyView(store, property) {
  if (!property) return null;
  return { ...property, documents: await store.documentsForProperty(property.id) };
}

function createApp({ store, options }) {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
  fs.mkdirSync(options.uploadDir, { recursive: true });
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', async (_req, res) => res.json({ status: 'ok', mode: options.databaseMode, fabricMode: options.fabricMode, prototype: true }));

  app.post('/api/auth/login', async (req, res, next) => {
    try { res.json(await login(store, req.body.email, req.body.password, options.jwtSecret)); } catch (error) { next(error); }
  });

  app.post('/api/auth/demo-login', async (req, res, next) => {
    try {
      if (process.env.DEMO_MODE !== 'true') throw new AppError('Demo access is disabled.', 403, 'DEMO_DISABLED');
      const demoAccounts = {
        authority: { email: 'authority@landledger.demo', password: 'Authority@123' },
        owner: { email: 'ananya.owner@landledger.demo', password: 'Owner@123' },
        buyer: { email: 'rohan.buyer@landledger.demo', password: 'Buyer@123' },
        seller: { email: 'meera.seller@landledger.demo', password: 'Seller@123' }
      };
      const account = demoAccounts[req.body?.role];
      if (!account) throw new AppError('Invalid demo role.', 400, 'INVALID_DEMO_ROLE');
      res.json(await login(store, account.email, account.password, options.jwtSecret));
    } catch (error) { next(error); }
  });
  app.get('/api/auth/me', authenticate(options.jwtSecret), async (req, res, next) => {
    try { const user = await store.findUser(req.auth.sub); if (!user) throw new AppError('User account was not found.', 401); res.json({ user: publicUser(user) }); } catch (error) { next(error); }
  });

  app.get('/api/properties', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const properties = (await store.listProperties()).filter((item) => canSeeProperty(item, req.auth));
      const result = await Promise.all(properties.map((item) => propertyView(store, item)));
      res.json({ properties: result });
    } catch (error) { next(error); }
  });
  app.get('/api/properties/:id', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const property = await store.getProperty(req.params.id);
      if (!property) throw new AppError('Property not found.', 404, 'NOT_FOUND');
      if (!canSeeProperty(property, req.auth)) throw new AppError('You do not have access to this property.', 403, 'FORBIDDEN');
      res.json({ property: await propertyView(store, property) });
    } catch (error) { next(error); }
  });
  app.post('/api/properties', authenticate(options.jwtSecret), allow(...roles.propertyWriter), upload.single('document'), async (req, res, next) => {
    try {
      const currentUser = await store.findUser(req.auth.sub);
      const property = await store.createProperty({
        parcelNumber: required(req.body.parcelNumber, 'Parcel number'),
        title: required(req.body.title, 'Property title'),
        address: required(req.body.address, 'Address'),
        areaSqm: number(req.body.areaSqm, 'Area'),
        landType: required(req.body.landType, 'Land type'),
        ownerId: currentUser.id,
        ownerName: currentUser.name,
        createdBy: currentUser.id,
        status: ['authority', 'admin'].includes(req.auth.role) && req.body.status === 'APPROVED' ? 'APPROVED' : 'PENDING'
      });
      let document = null;
      if (req.file) {
        const metadata = documentMetadata(req.file); metadata.storageKey = `${Date.now()}-${crypto.randomUUID()}-${metadata.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        fs.writeFileSync(path.join(options.uploadDir, metadata.storageKey), req.file.buffer);
        document = await store.createDocument({ ...metadata, propertyId: property.id, uploadedBy: currentUser.id });
      }
      await record(store, { entityType: 'PROPERTY', entityId: property.id, action: 'PROPERTY_REGISTERED', actorId: currentUser.id, payload: { parcelNumber: property.parcelNumber, ownerId: property.ownerId, status: property.status, documentHash: document?.sha256 || null } });
      res.status(201).json({ property: await propertyView(store, property), message: 'Property submitted for authority review.' });
    } catch (error) { next(error); }
  });
  app.post('/api/properties/:id/documents', authenticate(options.jwtSecret), allow(...roles.propertyWriter), upload.single('document'), async (req, res, next) => {
    try {
      if (!req.file) throw new AppError('A document file is required.');
      const property = await store.getProperty(req.params.id);
      if (!property) throw new AppError('Property not found.', 404, 'NOT_FOUND');
      if (!roles.authority.includes(req.auth.role) && property.ownerId !== String(req.auth.sub)) throw new AppError('Only the current owner can add a document.', 403, 'FORBIDDEN');
      const metadata = documentMetadata(req.file); metadata.storageKey = `${Date.now()}-${crypto.randomUUID()}-${metadata.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      fs.writeFileSync(path.join(options.uploadDir, metadata.storageKey), req.file.buffer);
      const document = await store.createDocument({ ...metadata, propertyId: property.id, uploadedBy: req.auth.sub });
      await record(store, { entityType: 'DOCUMENT', entityId: document.id, action: 'DOCUMENT_HASHED', actorId: req.auth.sub, payload: { propertyId: property.id, sha256: document.sha256, storageKey: document.storageKey } });
      res.status(201).json({ document });
    } catch (error) { next(error); }
  });
  app.get('/api/properties/:id/history', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const property = await store.getProperty(req.params.id);
      if (!property) throw new AppError('Property not found.', 404, 'NOT_FOUND');
      if (!canSeeProperty(property, req.auth)) throw new AppError('You do not have access to this history.', 403, 'FORBIDDEN');
      const events = await store.eventsFor('PROPERTY', property.id);
      const transfers = (await store.listTransfers()).filter((item) => item.propertyId === property.id);
      const transferEvents = (await Promise.all(transfers.map((item) => store.eventsFor('TRANSFER', item.id)))).flat();
      res.json({ property: await propertyView(store, property), history: [...events, ...transferEvents].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)) });
    } catch (error) { next(error); }
  });
  app.post('/api/properties/:id/review', authenticate(options.jwtSecret), allow(...roles.authority), async (req, res, next) => {
    try {
      const property = await store.getProperty(req.params.id);
      if (!property) throw new AppError('Property not found.', 404, 'NOT_FOUND');
      const decision = required(req.body.decision, 'Review decision').toUpperCase();
      if (!['APPROVED', 'REJECTED'].includes(decision)) throw new AppError('Review decision must be APPROVED or REJECTED.');
      const updated = await store.updateProperty(property.id, { status: decision, approvedBy: req.auth.sub, rejectionReason: decision === 'REJECTED' ? (req.body.reason || 'Authority review rejected.') : null });
      await record(store, { entityType: 'PROPERTY', entityId: property.id, action: `PROPERTY_${decision}`, actorId: req.auth.sub, payload: { previousStatus: property.status, decision, reason: req.body.reason || null } });
      res.json({ property: await propertyView(store, updated), message: `Property ${decision.toLowerCase()}.` });
    } catch (error) { next(error); }
  });
  app.get('/api/documents/:id/download', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const document = await store.getDocument(req.params.id); if (!document) throw new AppError('Document not found.', 404, 'NOT_FOUND');
      const property = await store.getProperty(document.propertyId); if (!canSeeProperty(property, req.auth)) throw new AppError('You do not have access to this document.', 403, 'FORBIDDEN');
      const file = path.join(options.uploadDir, document.storageKey); if (!fs.existsSync(file)) throw new AppError('The off-chain file is unavailable.', 404, 'FILE_NOT_FOUND');
      res.type(document.mimeType).download(file, document.fileName);
    } catch (error) { next(error); }
  });

  app.get('/api/transfers', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const transfers = await store.listTransfers();
      const visible = roles.authority.includes(req.auth.role) ? transfers : transfers.filter((item) => item.sellerId === String(req.auth.sub) || item.buyerId === String(req.auth.sub));
      const properties = await store.listProperties(); const users = await store.listUsers();
      res.json({ transfers: visible.map((transfer) => ({ ...transfer, property: properties.find((item) => item.id === transfer.propertyId), seller: publicUser(users.find((item) => item.id === transfer.sellerId)), buyer: publicUser(users.find((item) => item.id === transfer.buyerId)) })) });
    } catch (error) { next(error); }
  });
  app.post('/api/transfers', authenticate(options.jwtSecret), allow('owner', 'seller'), async (req, res, next) => {
    try {
      const property = await store.getProperty(required(req.body.propertyId, 'Property'));
      if (!property) throw new AppError('Property not found.', 404, 'NOT_FOUND');
      if (property.status !== 'APPROVED') throw new AppError('Only authority-approved properties may be transferred.');
      if (property.ownerId !== String(req.auth.sub)) throw new AppError('Only the current verified owner can propose a transfer.', 403, 'FORBIDDEN');
      const buyer = await store.findUserByEmail(required(req.body.buyerEmail, 'Buyer email'));
      if (!buyer || !['buyer', 'owner'].includes(buyer.role)) throw new AppError('Select a registered buyer account.');
      if (buyer.id === property.ownerId) throw new AppError('The buyer must be different from the current owner.');
      const open = (await store.listTransfers()).find((item) => item.propertyId === property.id && ['PROPOSED', 'ACCEPTED'].includes(item.status));
      if (open) throw new AppError('An open transfer already exists for this property.', 409, 'TRANSFER_EXISTS');
      const transfer = await store.createTransfer({ propertyId: property.id, sellerId: req.auth.sub, buyerId: buyer.id, notes: (req.body.notes || '').trim() });
      await record(store, { entityType: 'TRANSFER', entityId: transfer.id, action: 'TRANSFER_PROPOSED', actorId: req.auth.sub, payload: { propertyId: property.id, sellerId: req.auth.sub, buyerId: buyer.id } });
      res.status(201).json({ transfer, message: 'Transfer proposal sent to buyer.' });
    } catch (error) { next(error); }
  });
  app.post('/api/transfers/:id/accept', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const transfer = await store.getTransfer(req.params.id); if (!transfer) throw new AppError('Transfer not found.', 404, 'NOT_FOUND');
      if (transfer.buyerId !== String(req.auth.sub)) throw new AppError('Only the designated buyer can accept this transfer.', 403, 'FORBIDDEN');
      if (transfer.status !== 'PROPOSED') throw new AppError('Only a proposed transfer can be accepted.', 409, 'INVALID_TRANSFER_STATE');
      const updated = await store.updateTransfer(transfer.id, { status: 'ACCEPTED', acceptedAt: new Date().toISOString() });
      await record(store, { entityType: 'TRANSFER', entityId: transfer.id, action: 'TRANSFER_ACCEPTED', actorId: req.auth.sub, payload: { propertyId: transfer.propertyId, buyerId: req.auth.sub } });
      res.json({ transfer: updated, message: 'Transfer accepted and queued for authority validation.' });
    } catch (error) { next(error); }
  });
  app.post('/api/transfers/:id/finalize', authenticate(options.jwtSecret), allow(...roles.authority), async (req, res, next) => {
    try {
      const transfer = await store.getTransfer(req.params.id); if (!transfer) throw new AppError('Transfer not found.', 404, 'NOT_FOUND');
      if (transfer.status !== 'ACCEPTED') throw new AppError('Only an accepted transfer can be finalized.', 409, 'INVALID_TRANSFER_STATE');
      const property = await store.getProperty(transfer.propertyId); if (!property || property.ownerId !== transfer.sellerId || property.status !== 'APPROVED') throw new AppError('Ownership validation failed. The seller is no longer the verified owner.', 409, 'OWNERSHIP_VALIDATION_FAILED');
      const buyer = await store.findUser(transfer.buyerId);
      const finalizedAt = new Date().toISOString();
      const updatedProperty = await store.updateProperty(property.id, { ownerId: buyer.id, ownerName: buyer.name });
      const updatedTransfer = await store.updateTransfer(transfer.id, { status: 'FINALIZED', authorityId: req.auth.sub, finalizedAt });
      await record(store, { entityType: 'TRANSFER', entityId: transfer.id, action: 'TRANSFER_FINALIZED', actorId: req.auth.sub, payload: { propertyId: property.id, priorOwnerId: transfer.sellerId, newOwnerId: buyer.id, finalizedAt } });
      await record(store, { entityType: 'PROPERTY', entityId: property.id, action: 'OWNERSHIP_TRANSFERRED', actorId: req.auth.sub, payload: { transferId: transfer.id, priorOwnerId: transfer.sellerId, newOwnerId: buyer.id } });
      res.json({ transfer: updatedTransfer, property: await propertyView(store, updatedProperty), message: 'Ownership transferred after authority validation.' });
    } catch (error) { next(error); }
  });
  app.post('/api/transfers/:id/reject', authenticate(options.jwtSecret), async (req, res, next) => {
    try {
      const transfer = await store.getTransfer(req.params.id); if (!transfer) throw new AppError('Transfer not found.', 404, 'NOT_FOUND');
      const allowed = roles.authority.includes(req.auth.role) || transfer.buyerId === String(req.auth.sub);
      if (!allowed) throw new AppError('You cannot reject this transfer.', 403, 'FORBIDDEN');
      if (!['PROPOSED', 'ACCEPTED'].includes(transfer.status)) throw new AppError('This transfer has already been resolved.', 409, 'INVALID_TRANSFER_STATE');
      const updated = await store.updateTransfer(transfer.id, { status: 'REJECTED', rejectionReason: req.body.reason || 'Rejected by participant.' });
      await record(store, { entityType: 'TRANSFER', entityId: transfer.id, action: 'TRANSFER_REJECTED', actorId: req.auth.sub, payload: { reason: updated.rejectionReason } });
      res.json({ transfer: updated });
    } catch (error) { next(error); }
  });

  app.get('/api/analytics/overview', authenticate(options.jwtSecret), allow(...roles.authority), async (req, res, next) => { try { res.json(await overview(store)); } catch (error) { next(error); } });
  app.get('/api/ledger/verify', authenticate(options.jwtSecret), allow(...roles.authority), async (req, res, next) => { try { res.json(await store.verifyLedger()); } catch (error) { next(error); } });

  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) return res.status(400).json({ error: { code: error.code, message: 'Document upload failed. Maximum size is 10 MB.' } });
    const status = error.status || 500;
    if (status >= 500) console.error(error);
    res.status(status).json({ error: { code: error.code || 'INTERNAL_ERROR', message: status >= 500 ? 'An unexpected server error occurred.' : error.message } });
  });
  return app;
}

module.exports = { createApp };
