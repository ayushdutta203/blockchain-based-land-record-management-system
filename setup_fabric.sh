#!/bin/bash
set -e

BASE="/home/ayushdutta/landledger-blockchain/fabric-samples/test-network/organizations"
ORG1_USERS="$BASE/peerOrganizations/org1.example.com/users"
TLS_CA="$BASE/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem"
ORDERER_TLS="$BASE/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt"

echo "=== Checking identity attributes in CA ==="

# Use fabric-ca-client to check identity info
export FABRIC_CA_CLIENT_HOME=/tmp/fabric-ca-client-admin
export FABRIC_CA_CLIENT_URL=https://localhost:7054
export FABRIC_CA_CLIENT_TLS_CERTFILES=/home/ayushdutta/landledger-blockchain/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem
export FABRIC_CA_CLIENT_CANAME=Org1CA

# Enroll admin first
mkdir -p $FABRIC_CA_CLIENT_HOME
fabric-ca-client enroll -u https://admin:adminpw@localhost:7054 --tls.certfiles $TLS_CA --caname Org1CA 2>&1 || echo "Admin already enrolled"

# Check each identity
for id in LedgerAuthority LedgerOwner LedgerBuyer LedgerSeller; do
  echo "--- Identity: $id ---"
  fabric-ca-client identity list $id 2>&1 || true
done

echo ""
echo "=== TLS CA Cert ==="
ls -la $TLS_CA 2>&1

echo ""
echo "=== Orderer TLS Cert ==="
ls -la $ORDERER_TLS 2>&1
