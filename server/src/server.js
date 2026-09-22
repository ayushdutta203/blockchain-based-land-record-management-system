require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { config } = require('./config');
const { createStore } = require('./store');
const { createApp } = require('./app');

(async () => {
  const options = config();
  const store = await createStore(options);
  const app = createApp({ store, options });
  app.listen(options.port, () => console.log(`Land Ledger API listening on http://localhost:${options.port} (${options.databaseMode} mode)`));
})().catch((error) => { console.error('Unable to start API:', error); process.exit(1); });
