const { MockStore } = require('./mockStore');
const { PostgresStore } = require('./postgresStore');

async function createStore(options) {
  const store = options.databaseMode === 'postgres'
    ? new PostgresStore(options.postgresUrl)
    : new MockStore(options.dataFile);
  return store.init();
}

module.exports = { createStore };
