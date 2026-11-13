// Package main provides a Fabric-compatible academic chaincode implementation.
// It is a template for a permissioned network; it contains no public-authority
// certificates or government registry integration.
package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

type LandRecordContract struct{ contractapi.Contract }

type Property struct {
	ID           string  `json:"id"`
	ParcelNumber string  `json:"parcelNumber"`
	Title        string  `json:"title"`
	Address      string  `json:"address"`
	AreaSqm      float64 `json:"areaSqm"`
	LandType     string  `json:"landType"`
	OwnerID      string  `json:"ownerId"`
	OwnerName    string  `json:"ownerName"`
	Status       string  `json:"status"`
	DocumentHash string  `json:"documentHash,omitempty"`
	CreatedAt    string  `json:"createdAt"`
	UpdatedAt    string  `json:"updatedAt"`
}

type Transfer struct {
	ID         string `json:"id"`
	PropertyID string `json:"propertyId"`
	SellerID   string `json:"sellerId"`
	BuyerID    string `json:"buyerId"`
	Status     string `json:"status"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

type HistoryEntry struct {
	TxID      string    `json:"txId"`
	Timestamp string    `json:"timestamp"`
	IsDelete  bool      `json:"isDelete"`
	Record    *Property `json:"record,omitempty"`
}

type DocumentHashRecord struct {
	ID           string `json:"id"`
	PropertyID   string `json:"propertyId"`
	DocumentHash string `json:"documentHash"`
	UploadedBy   string `json:"uploadedBy"`
	CreatedAt    string `json:"createdAt"`
}

func propertyKey(id string) string     { return "property:" + id }
func transferKey(id string) string     { return "transfer:" + id }
func documentHashKey(id string) string { return "documenthash:" + id }

func callerIdentity(ctx contractapi.TransactionContextInterface) (string, string, error) {
	role, ok, err := ctx.GetClientIdentity().GetAttributeValue("role")
	if err != nil {
		return "", "", fmt.Errorf("read role attribute: %w", err)
	}
	if !ok || role == "" {
		return "", "", fmt.Errorf("caller identity missing role attribute")
	}
	appUserId, ok, err := ctx.GetClientIdentity().GetAttributeValue("appUserId")
	if err != nil {
		return "", "", fmt.Errorf("read appUserId attribute: %w", err)
	}
	if !ok || appUserId == "" {
		return "", "", fmt.Errorf("caller identity missing appUserId attribute")
	}
	return role, appUserId, nil
}

func txTimestamp(ctx contractapi.TransactionContextInterface) (string, error) {
	ts, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return "", fmt.Errorf("get transaction timestamp: %w", err)
	}
	return time.Unix(ts.Seconds, int64(ts.Nanos)).UTC().Format(time.RFC3339), nil
}

func requireAuthority(ctx contractapi.TransactionContextInterface) error {
	role, _, err := callerIdentity(ctx)
	if err != nil {
		return err
	}
	if role != "authority" && role != "admin" {
		return fmt.Errorf("authority role is required, caller has role %s", role)
	}
	return nil
}

func requireAppUserId(ctx contractapi.TransactionContextInterface, expectedAppUserId string) error {
	_, appUserId, err := callerIdentity(ctx)
	if err != nil {
		return err
	}
	if appUserId != expectedAppUserId {
		return fmt.Errorf("caller appUserId %s does not match expected %s", appUserId, expectedAppUserId)
	}
	return nil
}

func marshalOrError(value interface{}) ([]byte, error) {
	bytes, err := json.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}
	return bytes, nil
}

func putStateAndEvent(ctx contractapi.TransactionContextInterface, key string, value []byte, eventName string) error {
	if err := ctx.GetStub().PutState(key, value); err != nil {
		return fmt.Errorf("put state: %w", err)
	}
	if err := ctx.GetStub().SetEvent(eventName, value); err != nil {
		return fmt.Errorf("set event: %w", err)
	}
	return nil
}

func (c *LandRecordContract) ReadProperty(ctx contractapi.TransactionContextInterface, id string) (*Property, error) {
	bytes, err := ctx.GetStub().GetState(propertyKey(id))
	if err != nil {
		return nil, fmt.Errorf("read property: %w", err)
	}
	if bytes == nil {
		return nil, fmt.Errorf("property %s does not exist", id)
	}
	var property Property
	if err := json.Unmarshal(bytes, &property); err != nil {
		return nil, fmt.Errorf("unmarshal property: %w", err)
	}
	return &property, nil
}

func (c *LandRecordContract) CreateProperty(ctx contractapi.TransactionContextInterface, id, parcelNumber, title, address, ownerID, ownerName, landType, documentHash string, areaSqm float64) (*Property, error) {
	role, appUserId, err := callerIdentity(ctx)
	if err != nil {
		return nil, err
	}
	if role != "owner" && role != "seller" && role != "authority" {
		return nil, fmt.Errorf("caller role %s cannot create properties", role)
	}
	if appUserId != ownerID {
		return nil, fmt.Errorf("caller appUserId %s does not match ownerID %s", appUserId, ownerID)
	}
	exists, err := ctx.GetStub().GetState(propertyKey(id))
	if err != nil {
		return nil, fmt.Errorf("check property existence: %w", err)
	}
	if exists != nil {
		return nil, fmt.Errorf("property %s already exists", id)
	}
	if id == "" || parcelNumber == "" || ownerID == "" || areaSqm <= 0 {
		return nil, fmt.Errorf("id, parcel number, owner and positive area are required")
	}
	timestamp, err := txTimestamp(ctx)
	if err != nil {
		return nil, err
	}
	property := Property{ID: id, ParcelNumber: parcelNumber, Title: title, Address: address, AreaSqm: areaSqm, LandType: landType, OwnerID: ownerID, OwnerName: ownerName, Status: "PENDING", DocumentHash: documentHash, CreatedAt: timestamp, UpdatedAt: timestamp}
	bytes, err := marshalOrError(property)
	if err != nil {
		return nil, err
	}
	if err := putStateAndEvent(ctx, propertyKey(id), bytes, "PropertyRegistered"); err != nil {
		return nil, err
	}
	return &property, nil
}

func (c *LandRecordContract) ApproveProperty(ctx contractapi.TransactionContextInterface, id string) (*Property, error) {
	if err := requireAuthority(ctx); err != nil {
		return nil, err
	}
	property, err := c.ReadProperty(ctx, id)
	if err != nil {
		return nil, err
	}
	if property.Status != "PENDING" {
		return nil, fmt.Errorf("only pending properties can be approved")
	}
	timestamp, err := txTimestamp(ctx)
	if err != nil {
		return nil, err
	}
	property.Status, property.UpdatedAt = "APPROVED", timestamp
	bytes, err := marshalOrError(property)
	if err != nil {
		return nil, err
	}
	if err := putStateAndEvent(ctx, propertyKey(id), bytes, "PropertyApproved"); err != nil {
		return nil, err
	}
	return property, nil
}

func (c *LandRecordContract) ProposeTransfer(ctx contractapi.TransactionContextInterface, id, propertyID, sellerID, buyerID string) (*Transfer, error) {
	role, appUserId, err := callerIdentity(ctx)
	if err != nil {
		return nil, err
	}
	if role != "owner" && role != "seller" {
		return nil, fmt.Errorf("caller role %s cannot propose transfers", role)
	}
	if appUserId != sellerID {
		return nil, fmt.Errorf("caller appUserId %s does not match sellerID %s", appUserId, sellerID)
	}
	property, err := c.ReadProperty(ctx, propertyID)
	if err != nil {
		return nil, err
	}
	if property.Status != "APPROVED" || property.OwnerID != sellerID {
		return nil, fmt.Errorf("ownership validation failed")
	}
	if id == "" || buyerID == "" || buyerID == sellerID {
		return nil, fmt.Errorf("valid transfer and distinct buyer are required")
	}
	if existing, err := ctx.GetStub().GetState(transferKey(id)); err != nil {
		return nil, fmt.Errorf("check transfer existence: %w", err)
	} else if existing != nil {
		return nil, fmt.Errorf("transfer %s already exists", id)
	}
	// Prevent duplicate open transfers for the same property
	openTransfers, err := ctx.GetStub().GetStateByRange("transfer:"+propertyID, "transfer:"+propertyID+"\uffff")
	if err != nil {
		return nil, fmt.Errorf("check open transfers: %w", err)
	}
	defer openTransfers.Close()
	for openTransfers.HasNext() {
		record, err := openTransfers.Next()
		if err != nil {
			return nil, fmt.Errorf("iterate open transfers: %w", err)
		}
		var existingTransfer Transfer
		if err := json.Unmarshal(record.Value, &existingTransfer); err != nil {
			return nil, fmt.Errorf("unmarshal existing transfer: %w", err)
		}
		if existingTransfer.PropertyID == propertyID && (existingTransfer.Status == "PROPOSED" || existingTransfer.Status == "ACCEPTED") {
			return nil, fmt.Errorf("an open transfer already exists for property %s", propertyID)
		}
	}
	timestamp, err := txTimestamp(ctx)
	if err != nil {
		return nil, err
	}
	transfer := Transfer{ID: id, PropertyID: propertyID, SellerID: sellerID, BuyerID: buyerID, Status: "PROPOSED", CreatedAt: timestamp, UpdatedAt: timestamp}
	bytes, err := marshalOrError(transfer)
	if err != nil {
		return nil, err
	}
	if err := putStateAndEvent(ctx, transferKey(id), bytes, "TransferProposed"); err != nil {
		return nil, err
	}
	return &transfer, nil
}

func (c *LandRecordContract) AcceptTransfer(ctx contractapi.TransactionContextInterface, id, buyerID string) (*Transfer, error) {
	role, appUserId, err := callerIdentity(ctx)
	if err != nil {
		return nil, err
	}
	if role != "buyer" && role != "owner" {
		return nil, fmt.Errorf("caller role %s cannot accept transfers", role)
	}
	if appUserId != buyerID {
		return nil, fmt.Errorf("caller appUserId %s does not match buyerID %s", appUserId, buyerID)
	}
	bytes, err := ctx.GetStub().GetState(transferKey(id))
	if err != nil || bytes == nil {
		return nil, fmt.Errorf("transfer %s does not exist", id)
	}
	var transfer Transfer
	if err := json.Unmarshal(bytes, &transfer); err != nil {
		return nil, fmt.Errorf("unmarshal transfer: %w", err)
	}
	if transfer.Status != "PROPOSED" {
		return nil, fmt.Errorf("only proposed transfers can be accepted")
	}
	timestamp, err := txTimestamp(ctx)
	if err != nil {
		return nil, err
	}
	transfer.Status, transfer.UpdatedAt = "ACCEPTED", timestamp
	bytes, err = marshalOrError(transfer)
	if err != nil {
		return nil, err
	}
	if err := putStateAndEvent(ctx, transferKey(id), bytes, "TransferAccepted"); err != nil {
		return nil, err
	}
	return &transfer, nil
}

func (c *LandRecordContract) RejectTransfer(ctx contractapi.TransactionContextInterface, id string) (*Transfer, error) {
	role, appUserId, err := callerIdentity(ctx)
	if err != nil {
		return nil, err
	}
	bytes, err := ctx.GetStub().GetState(transferKey(id))
	if err != nil || bytes == nil {
		return nil, fmt.Errorf("transfer %s does not exist", id)
	}
	var transfer Transfer
	if err := json.Unmarshal(bytes, &transfer); err != nil {
		return nil, fmt.Errorf("unmarshal transfer: %w", err)
	}
	if transfer.Status != "PROPOSED" && transfer.Status != "ACCEPTED" {
		return nil, fmt.Errorf("only proposed or accepted transfers can be rejected")
	}
	// Authority or the designated buyer can reject
	if role != "authority" && role != "admin" && appUserId != transfer.BuyerID {
		return nil, fmt.Errorf("only authority or the designated buyer can reject this transfer")
	}
	timestamp, err := txTimestamp(ctx)
	if err != nil {
		return nil, err
	}
	transfer.Status, transfer.UpdatedAt = "REJECTED", timestamp
	bytes, err = marshalOrError(transfer)
	if err != nil {
		return nil, err
	}
	if err := putStateAndEvent(ctx, transferKey(id), bytes, "TransferRejected"); err != nil {
		return nil, err
	}
	return &transfer, nil
}

func (c *LandRecordContract) FinalizeTransfer(ctx contractapi.TransactionContextInterface, id string) (*Property, error) {
	if err := requireAuthority(ctx); err != nil {
		return nil, err
	}
	bytes, err := ctx.GetStub().GetState(transferKey(id))
	if err != nil || bytes == nil {
		return nil, fmt.Errorf("transfer %s does not exist", id)
	}
	var transfer Transfer
	if err := json.Unmarshal(bytes, &transfer); err != nil {
		return nil, fmt.Errorf("unmarshal transfer: %w", err)
	}
	if transfer.Status != "ACCEPTED" {
		return nil, fmt.Errorf("only accepted transfers can be finalized")
	}
	property, err := c.ReadProperty(ctx, transfer.PropertyID)
	if err != nil {
		return nil, err
	}
	if property.OwnerID != transfer.SellerID || property.Status != "APPROVED" {
		return nil, fmt.Errorf("seller is not the current verified owner")
	}
	timestamp, err := txTimestamp(ctx)
	if err != nil {
		return nil, err
	}
	property.OwnerID, property.UpdatedAt = transfer.BuyerID, timestamp
	property.OwnerName = transfer.BuyerID
	transfer.Status, transfer.UpdatedAt = "FINALIZED", timestamp
	propertyBytes, err := marshalOrError(property)
	if err != nil {
		return nil, err
	}
	transferBytes, err := marshalOrError(transfer)
	if err != nil {
		return nil, err
	}
	if err := ctx.GetStub().PutState(propertyKey(property.ID), propertyBytes); err != nil {
		return nil, fmt.Errorf("put property state: %w", err)
	}
	if err := ctx.GetStub().PutState(transferKey(id), transferBytes); err != nil {
		return nil, fmt.Errorf("put transfer state: %w", err)
	}
	if err := ctx.GetStub().SetEvent("OwnershipTransferred", propertyBytes); err != nil {
		return nil, fmt.Errorf("set event: %w", err)
	}
	return property, nil
}

func (c *LandRecordContract) RecordDocumentHash(ctx contractapi.TransactionContextInterface, id, propertyID, documentHash, uploadedBy string) (*DocumentHashRecord, error) {
	role, appUserId, err := callerIdentity(ctx)
	if err != nil {
		return nil, err
	}
	if role != "owner" && role != "seller" && role != "authority" && role != "buyer" {
		return nil, fmt.Errorf("caller role %s cannot record document hashes", role)
	}
	if appUserId != uploadedBy {
		return nil, fmt.Errorf("caller appUserId %s does not match uploadedBy %s", appUserId, uploadedBy)
	}
	if _, err := c.ReadProperty(ctx, propertyID); err != nil {
		return nil, err
	}
	if id == "" || documentHash == "" {
		return nil, fmt.Errorf("id and document hash are required")
	}
	if existing, err := ctx.GetStub().GetState(documentHashKey(id)); err != nil {
		return nil, fmt.Errorf("check document hash existence: %w", err)
	} else if existing != nil {
		return nil, fmt.Errorf("document hash record %s already exists", id)
	}
	timestamp, err := txTimestamp(ctx)
	if err != nil {
		return nil, err
	}
	record := DocumentHashRecord{ID: id, PropertyID: propertyID, DocumentHash: documentHash, UploadedBy: uploadedBy, CreatedAt: timestamp}
	bytes, err := marshalOrError(record)
	if err != nil {
		return nil, err
	}
	if err := putStateAndEvent(ctx, documentHashKey(id), bytes, "DocumentHashRecorded"); err != nil {
		return nil, err
	}
	return &record, nil
}

func (c *LandRecordContract) GetPropertyHistory(ctx contractapi.TransactionContextInterface, id string) ([]*HistoryEntry, error) {
	iterator, err := ctx.GetStub().GetHistoryForKey(propertyKey(id))
	if err != nil {
		return nil, err
	}
	defer iterator.Close()
	entries := []*HistoryEntry{}
	for iterator.HasNext() {
		record, err := iterator.Next()
		if err != nil {
			return nil, err
		}
		entry := &HistoryEntry{TxID: record.TxId, Timestamp: time.Unix(record.Timestamp.Seconds, int64(record.Timestamp.Nanos)).UTC().Format(time.RFC3339), IsDelete: record.IsDelete}
		if !record.IsDelete {
			var property Property
			if err := json.Unmarshal(record.Value, &property); err != nil {
				return nil, fmt.Errorf("unmarshal history record: %w", err)
			}
			entry.Record = &property
		}
		entries = append(entries, entry)
	}
	return entries, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&LandRecordContract{})
	if err != nil {
		panic(fmt.Sprintf("create landrecords chaincode: %v", err))
	}
	if err := chaincode.Start(); err != nil {
		panic(fmt.Sprintf("start landrecords chaincode: %v", err))
	}
}
