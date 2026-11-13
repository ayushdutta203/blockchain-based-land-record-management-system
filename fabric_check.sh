#!/bin/bash
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
export CORE_PEER_ADDRESS=peer0.org1.example.com:7051

echo "=== Channel list ==="
peer channel list 2>&1

echo "=== Committed chaincode ==="
peer lifecycle chaincode querycommitted -C landledgerchannel 2>&1

echo "=== Query ReadProperty PROP-1 ==="
peer chaincode query -C landledgerchannel -n landrecords -c '{"Args":["ReadProperty","PROP-1"]}' 2>&1
