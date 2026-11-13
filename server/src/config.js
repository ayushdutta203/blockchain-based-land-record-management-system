const path = require('path');

function config(overrides = {}) {
  return {
    port: Number(overrides.port || process.env.PORT || 5000),
    jwtSecret: overrides.jwtSecret || process.env.JWT_SECRET || 'local-demo-secret-change-me',
    databaseMode: overrides.databaseMode || process.env.DATABASE_MODE || 'mock',
    postgresUrl: overrides.postgresUrl || process.env.POSTGRES_URL || '',
    dataFile: overrides.dataFile || path.resolve(__dirname, '../data/ledger.json'),
    uploadDir: overrides.uploadDir || path.resolve(__dirname, '../uploads'),
    fabricMode: overrides.fabricMode || process.env.FABRIC_MODE || 'mock',
    fabricChannel: overrides.fabricChannel || process.env.FABRIC_CHANNEL || 'landledgerchannel',
    fabricChaincode: overrides.fabricChaincode || process.env.FABRIC_CHAINCODE || 'landrecords',
    fabricMspId: overrides.fabricMspId || process.env.FABRIC_MSP_ID || 'Org1MSP',
    fabricPeerEndpoint: overrides.fabricPeerEndpoint || process.env.FABRIC_PEER_ENDPOINT || 'localhost:7051',
    fabricTlsCaCertPath: overrides.fabricTlsCaCertPath || process.env.FABRIC_TLS_CA_CERT_PATH || '',
    fabricWalletPath: overrides.fabricWalletPath || process.env.FABRIC_WALLET_PATH || path.resolve(__dirname, '../../fabric/wallet'),
    fabricIdentityMapping: {
      '1': 'LedgerAuthority',
      '2': 'LedgerOwner',
      '3': 'LedgerBuyer',
      '4': 'LedgerSeller',
    },
  };
}

module.exports = { config };
