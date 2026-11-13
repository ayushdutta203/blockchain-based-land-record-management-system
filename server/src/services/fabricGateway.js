const grpc = require('@grpc/grpc-js');
const { connect, hash, signers } = require('@hyperledger/fabric-gateway');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { TextDecoder } = require('util');

const utf8Decoder = new TextDecoder();

function extractHostname(endpoint) {
  const [host] = endpoint.split(':');
  return host;
}

class FabricGatewayService {
  constructor(config) {
    this.config = config;
    this.gateways = new Map();
    this.clients = new Map();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.tlsRootCert = await this.loadFile(this.config.fabricTlsCaCertPath);
    this.peerHostname = extractHostname(this.config.fabricPeerEndpoint);
    this.initialized = true;
  }

  async loadFile(filePath) {
    if (!filePath) return null;
    return await fs.promises.readFile(filePath);
  }

  async loadIdentity(identityLabel) {
    const certPath = path.join(this.config.fabricWalletPath, identityLabel, 'certificate.pem');
    const keyPath = path.join(this.config.fabricWalletPath, identityLabel, 'privateKey.pem');

    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(`Identity files not found for ${identityLabel}`);
    }

    const certificate = await fs.promises.readFile(certPath);
    const privateKeyPem = await fs.promises.readFile(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);
    const signer = signers.newPrivateKeySigner(privateKey);

    return { certificate, signer, mspId: this.config.fabricMspId };
  }

  createGrpcClient() {
    const tlsRootCert = this.tlsRootCert;
    const credentials = tlsRootCert
      ? grpc.credentials.createSsl(tlsRootCert)
      : grpc.credentials.createInsecure();

    const client = new grpc.Client(
      this.config.fabricPeerEndpoint,
      credentials,
      {
        'grpc.ssl_target_name_override': this.peerHostname,
      }
    );
    return client;
  }

  async getGateway(identityLabel) {
    if (this.gateways.has(identityLabel)) {
      return this.gateways.get(identityLabel);
    }

    const { certificate, signer, mspId } = await this.loadIdentity(identityLabel);
    const client = this.createGrpcClient();

    const gateway = connect({
      identity: { mspId, credentials: certificate },
      signer,
      hash: hash.sha256,
      client,
    });

    this.gateways.set(identityLabel, gateway);
    this.clients.set(identityLabel, client);
    return gateway;
  }

  async submitTransaction(identityLabel, chaincodeName, methodName, args = []) {
    const gateway = await this.getGateway(identityLabel);
    const network = gateway.getNetwork(this.config.fabricChannel);
    const contract = network.getContract(chaincodeName);

    const start = Date.now();
    try {
      const submitted = await contract.submitAsync(methodName, { arguments: args });
      const txId = submitted.getTransactionId();
      const result = await submitted.getStatus();
      const duration = Date.now() - start;
      if (!result.successful) {
        throw new Error(`Fabric transaction ${txId} failed with status code ${result.code}`);
      }
      const resultBytes = await submitted.getResult();
      console.log(`[Fabric] submitTransaction ${methodName} identity=${identityLabel} txId=${txId} duration=${duration}ms`);
      return { result: resultBytes ? JSON.parse(utf8Decoder.decode(resultBytes)) : null, txId };
    } catch (error) {
      const duration = Date.now() - start;
      const txId = error.transactionId || error.txId || 'unknown';
      console.error(`[Fabric] submitTransaction ${methodName} identity=${identityLabel} txId=${txId} failed duration=${duration}ms: ${error.message}`);
      throw error;
    }
  }

  async evaluateTransaction(identityLabel, chaincodeName, methodName, args = []) {
    const gateway = await this.getGateway(identityLabel);
    const network = gateway.getNetwork(this.config.fabricChannel);
    const contract = network.getContract(chaincodeName);

    const start = Date.now();
    try {
      const result = await contract.evaluateTransaction(methodName, ...args);
      const duration = Date.now() - start;
      console.log(`[Fabric] evaluateTransaction ${methodName} identity=${identityLabel} duration=${duration}ms`);
      return result ? JSON.parse(utf8Decoder.decode(result)) : null;
    } catch (error) {
      const duration = Date.now() - start;
      console.error(`[Fabric] evaluateTransaction ${methodName} identity=${identityLabel} failed duration=${duration}ms: ${error.message}`);
      throw error;
    }
  }

  async close() {
    for (const [label, gateway] of this.gateways.entries()) {
      try {
        gateway.close();
      } catch (error) {
        console.error(`[Fabric] error closing gateway for ${label}: ${error.message}`);
      }
    }
    for (const [label, client] of this.clients.entries()) {
      try {
        client.close();
      } catch (error) {
        console.error(`[Fabric] error closing client for ${label}: ${error.message}`);
      }
    }
    this.gateways.clear();
    this.clients.clear();
    this.initialized = false;
  }
}

let gatewayService = null;

async function getGatewayService(config) {
  if (!gatewayService) {
    gatewayService = new FabricGatewayService(config);
    await gatewayService.init();
  }
  return gatewayService;
}

async function closeGatewayService() {
  if (gatewayService) {
    await gatewayService.close();
    gatewayService = null;
  }
}

module.exports = { FabricGatewayService, getGatewayService, closeGatewayService };
