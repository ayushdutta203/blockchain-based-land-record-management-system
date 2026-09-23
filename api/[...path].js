const os = require('os');
const path = require('path');
const { createApp } = require('../server/src/app');
const { createStore } = require('../server/src/store');
const { seedStore } = require('../server/src/seed');

let appPromise;

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const temporaryRoot = path.join(os.tmpdir(), 'landledger-prototype');

      const options = {
        port: 0,
        databaseMode: 'mock',
        dataFile: path.join(temporaryRoot, 'ledger.json'),
        uploadDir: path.join(temporaryRoot, 'uploads'),
        jwtSecret: process.env.JWT_SECRET || 'vercel-demo-secret-change-me',
        fabricMode: 'mock'
      };

      const store = await createStore(options);
      await seedStore(store);

      return createApp({ store, options });
    })();
  }

  return appPromise;
}

module.exports = async (req, res) => {
  const app = await getApp();
  return app(req, res);
};