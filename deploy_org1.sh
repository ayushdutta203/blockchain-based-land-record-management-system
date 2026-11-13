#!/bin/bash
set -e

# TLS cert paths
ORG1_TLS_CA=/etc/hyperledger/fabric/tls/ca.crt
ORDERER_TLS_CA=/etc/hyperledger/fabric/msp/tlscacerts/tlsroot.pem

# Check orderer TLS cert path
if [ ! -f "$ORDERER_TLS_CA" ]; then
  ORDERER_TLS_CA=/etc/hyperledger/fabric/tls/ca.crt
fi

echo "=== Step 1: Package chaincode v1.1 ==="
CORE_PEER_TLS_ENABLED=true \
CORE_PEER_TLS_ROOTCERT_FILE=$ORG1_TLS_CA \
CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp \
CORE_PEER_ADDRESS=peer0.org1.example.com:7051 \
peer lifecycle chaincode package landrecords.tar.gz \
  --path /tmp/landrecords \
  --lang golang \
  --label landrecords_1.1 2>&1

echo "=== Step 2: Install on Org1 peer ==="
CORE_PEER_TLS_ENABLED=true \
CORE_PEER_TLS_ROOTCERT_FILE=$ORG1_TLS_CA \
CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp \
CORE_PEER_ADDRESS=peer0.org1.example.com:7051 \
peer lifecycle chaincode install landrecords.tar.gz 2>&1

echo "=== Step 3: Query installed on Org1 ==="
CORE_PEER_TLS_ENABLED=true \
CORE_PEER_TLS_ROOTCERT_FILE=$ORG1_TLS_CA \
CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp \
CORE_PEER_ADDRESS=peer0.org1.example.com:7051 \
peer lifecycle chaincode queryinstalled 2>&1

echo "=== DONE with Org1 steps ==="
