#!/bin/bash
BASE="/home/ayushdutta/landledger-blockchain/fabric-samples/test-network/organizations/peerOrganizations/org1.example.com/users"
WALLET="/mnt/d/coding/Blockchain-Based Land Record and Property Transaction Management System/fabric/wallet"

declare -A mapping=(["LedgerAuthority"]="LedgerAuthority@org1.example.com" ["LedgerOwner"]="LedgerOwner@org1.example.com" ["LedgerBuyer"]="LedgerBuyer@org1.example.com" ["LedgerSeller"]="LedgerSeller@org1.example.com")

for label in LedgerAuthority LedgerOwner LedgerBuyer LedgerSeller; do
  user="${mapping[$label]}"
  mkdir -p "$WALLET/$label"
  cp "$BASE/$user/msp/signcerts/cert.pem" "$WALLET/$label/certificate.pem"
  cp "$BASE/$user/msp/keystore/"*_sk "$WALLET/$label/privateKey.pem"
  echo "Set up $label from $user"
done

echo "=== Wallet contents ==="
ls -laR "$WALLET"
