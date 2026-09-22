/*
 * Mock ledger adapter. Swap this module's append function for a Fabric Gateway
 * submission when FABRIC_MODE=fabric. The Go chaincode mirrors these actions.
 */
async function record(store, event) {
  return store.appendEvent(event);
}

module.exports = { record };
