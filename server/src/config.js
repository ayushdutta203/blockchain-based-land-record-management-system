const path = require('path');

function config(overrides = {}) {
  return {
    port: Number(overrides.port || process.env.PORT || 5000),
    jwtSecret: overrides.jwtSecret || process.env.JWT_SECRET || 'local-demo-secret-change-me',
    databaseMode: overrides.databaseMode || process.env.DATABASE_MODE || 'mock',
    postgresUrl: overrides.postgresUrl || process.env.POSTGRES_URL || '',
    dataFile: overrides.dataFile || path.resolve(__dirname, '../data/ledger.json'),
    uploadDir: overrides.uploadDir || path.resolve(__dirname, '../uploads'),
    fabricMode: overrides.fabricMode || process.env.FABRIC_MODE || 'mock'
  };
}

module.exports = { config };
