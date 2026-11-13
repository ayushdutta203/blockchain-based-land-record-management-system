# Fabric network handoff template

This folder is deliberately a configuration **template**, not a live government or public-authority network. It contains no certificates, private keys, organization credentials, or production connection profile.

## Recommended academic network topology

- Channel: `landledgerchannel`
- Chaincode: `landrecords`
- Organizations: `Org1MSP`, `Org2MSP`
- Endorsement: Org1MSP peer endorsement for property and transfer operations.
- Identity attributes: issue `role` and `appUserId` attributes to identities; chaincode checks these attributes before authorization.

## Deploy after starting a Fabric test network

Use the Fabric samples test network (Fabric 2.5+), then package and deploy `../chaincode/landrecords` as Go chaincode on `landledgerchannel`. Keep real wallet material outside this repository and use environment variables or a secret manager for the connection profile and identity locations.

## API integration boundary

The Express application runs in `FABRIC_MODE=mock` by default. For a real Fabric proof of concept:

1. Add a Fabric Gateway adapter beside `server/src/services/ledgerService.js`.
2. Map `PROPERTY_REGISTERED`, `PROPERTY_APPROVED`, `TRANSFER_PROPOSED`, `TRANSFER_ACCEPTED`, `TRANSFER_FINALIZED`, `TRANSFER_REJECTED`, and `DOCUMENT_HASHED` to the corresponding chaincode transactions.
3. Retain documents in encrypted object storage or IPFS; pass only the SHA-256 digest and storage reference to Fabric.
4. Reconcile Fabric events into PostgreSQL read models for the dashboard.

Do not deploy this template for legal title registration without regulatory approval, data-protection controls, and an independent security assessment.
