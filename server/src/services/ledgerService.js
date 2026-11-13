const path = require('path');
const { getGatewayService, closeGatewayService } = require('./fabricGateway');

/*
 * Ledger adapter. Supports mock mode (existing MockStore behavior) and Fabric
 * mode (real Hyperledger Fabric Gateway transactions).
 *
 * In mock mode, append delegates to store.appendEvent() unchanged.
 * In fabric mode, events are mapped to Fabric chaincode transactions and
 * submitted via the Fabric Gateway SDK using certificate-based identity.
 */
const EVENT_TO_TX = {
  PROPERTY_REGISTERED: 'CreateProperty',
  PROPERTY_APPROVED: 'ApproveProperty',
  TRANSFER_PROPOSED: 'ProposeTransfer',
  TRANSFER_ACCEPTED: 'AcceptTransfer',
  TRANSFER_FINALIZED: 'FinalizeTransfer',
  TRANSFER_REJECTED: 'RejectTransfer',
  DOCUMENT_HASHED: 'RecordDocumentHash',
};

const DEFAULT_IDENTITY_MAPPING = {
  '1': 'LedgerAuthority',
  '2': 'LedgerOwner',
  '3': 'LedgerBuyer',
  '4': 'LedgerSeller',
};

function gatewayConfig(options) {
  return {
    fabricChannel: options.fabricChannel || process.env.FABRIC_CHANNEL || 'landledgerchannel',
    fabricChaincode: options.fabricChaincode || process.env.FABRIC_CHAINCODE || 'landrecords',
    fabricMspId: options.fabricMspId || process.env.FABRIC_MSP_ID || 'Org1MSP',
    fabricPeerEndpoint: options.fabricPeerEndpoint || process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051',
    fabricTlsCaCertPath: options.fabricTlsCaCertPath || process.env.FABRIC_TLS_CA_CERT_PATH || '',
    fabricWalletPath: options.fabricWalletPath || process.env.FABRIC_WALLET_PATH || path.resolve(__dirname, '../../fabric/wallet'),
    fabricIdentityMapping: options.fabricIdentityMapping || DEFAULT_IDENTITY_MAPPING,
  };
}

async function record(store, event, options = {}) {
  const fabricMode = options.fabricMode || process.env.FABRIC_MODE || 'mock';

  if (fabricMode === 'mock') {
    return store.appendEvent(event);
  }

  if (fabricMode === 'fabric') {
    return recordFabric(store, event, gatewayConfig(options));
  }

  return store.appendEvent(event);
}

async function recordFabric(store, event, config) {
  const { actorId, action, entityType, entityId, payload } = event;

  const gatewayService = await getGatewayService(config);

  const identityLabel = config.fabricIdentityMapping[String(actorId)];
  if (!identityLabel) {
    throw new Error(`No Fabric identity mapping for appUserId ${actorId}`);
  }

  const txName = EVENT_TO_TX[action];
  if (!txName) {
    console.log(`[Fabric] no chaincode mapping for action ${action}, skipping Fabric submission`);
    return store.appendEvent({ ...event, blockchainStatus: 'skipped' });
  }

  const args = fabricTxArgs(txName, entityType, entityId, payload);
  const { result, txId } = await gatewayService.submitTransaction(identityLabel, config.fabricChaincode, txName, args);

  // Record the Fabric transaction locally with confirmed status and txId
  return store.appendEvent({ ...event, blockchainStatus: 'confirmed', fabricTxId: txId });
}

function fabricTxArgs(txName, entityType, entityId, payload = {}) {
  switch (txName) {
    case 'CreateProperty':
      return [
        String(entityId),
        payload.parcelNumber || '',
        payload.title || '',
        payload.address || '',
        payload.ownerId || '',
        payload.ownerName || '',
        payload.landType || '',
        payload.documentHash || '',
        String(Number(payload.areaSqm) || 0),
      ];
    case 'ApproveProperty':
      return [String(entityId)];
    case 'ProposeTransfer':
      return [
        String(entityId),
        payload.propertyId || '',
        payload.sellerId || '',
        payload.buyerId || '',
      ];
    case 'AcceptTransfer':
      return [String(entityId), payload.buyerId || ''];
    case 'RejectTransfer':
      return [String(entityId)];
    case 'FinalizeTransfer':
      return [String(entityId)];
    case 'RecordDocumentHash':
      return [
        String(entityId),
        payload.propertyId || '',
        payload.documentHash || '',
        payload.uploadedBy || '',
      ];
    default:
      return [String(entityId)];
  }
}

async function evaluate(identityLabel, chaincodeName, methodName, args = [], options = {}) {
  const fabricMode = options.fabricMode || process.env.FABRIC_MODE || 'mock';

  if (fabricMode !== 'fabric') {
    throw new Error('evaluate is only available in fabric mode');
  }

  const gatewayService = await getGatewayService(gatewayConfig(options));
  return gatewayService.evaluateTransaction(identityLabel, chaincodeName, methodName, args);
}

module.exports = { record, evaluate, closeGatewayService };
