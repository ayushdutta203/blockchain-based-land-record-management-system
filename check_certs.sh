#!/bin/bash
BASE="/home/ayushdutta/landledger-blockchain/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users"

for user in Admin LedgerAuthority LedgerOwner LedgerBuyer LedgerSeller User1; do
  echo "=== $user ==="
  CERT="$BASE/${user}@org1.example.com/msp/signcerts/cert.pem"
  if [ -f "$CERT" ]; then
    openssl x509 -in "$CERT" -text -noout 2>&1 | grep -E 'Subject:|OU=|role=|appUserId=|X509v3'
  else
    echo "CERT NOT FOUND"
  fi
  echo ""
done

echo "=== Orderer TLS CA ==="
ORDERER_TLS="/home/ayushdutta/landledger-blockchain/fabric-samples/test-network/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/tls/ca.crt"
if [ -f "$ORDERER_TLS" ]; then
  echo "Found: $ORDERER_TLS"
else
  echo "NOT FOUND"
fi

echo "=== Org1 Peer TLS CA ==="
ORG1_TLS_CA="/home/ayushdutta/landledger-blockchain/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/tlsca/tlsca.org1.example.com-cert.pem"
if [ -f "$ORG1_TLS_CA" ]; then
  echo "Found: $ORG1_TLS_CA"
else
  echo "NOT FOUND at $ORG1_TLS_CA"
  wsl_ls=$(ls /home/ayushdutta/landledger-blockchain/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/tlsca/ 2>&1)
  echo "tlsca contents: $wsl_ls"
fi
