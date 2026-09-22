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

type LandRecordContract struct { contractapi.Contract }

type Property struct {
	ID           string `json:"id"`
	ParcelNumber string `json:"parcelNumber"`
	Title        string `json:"title"`
	Address      string `json:"address"`
	AreaSqm      float64 `json:"areaSqm"`
	LandType     string `json:"landType"`
	OwnerID      string `json:"ownerId"`
	OwnerName    string `json:"ownerName"`
	Status       string `json:"status"`
	DocumentHash string `json:"documentHash,omitempty"`
	StorageKey   string `json:"storageKey,omitempty"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
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
	TxID      string `json:"txId"`
	Timestamp string `json:"timestamp"`
	IsDelete  bool   `json:"isDelete"`
	Record    *Property `json:"record,omitempty"`
}

func now() string { return time.Now().UTC().Format(time.RFC3339) }
func propertyKey(id string) string { return "property:" + id }
func transferKey(id string) string { return "transfer:" + id }

func (c *LandRecordContract) requireAuthority(ctx contractapi.TransactionContextInterface) error {
	ok, err := ctx.GetClientIdentity().AssertAttributeValue("role", "authority")
	if err != nil { return fmt.Errorf("cannot read client role: %w", err) }
	if !ok { return fmt.Errorf("authority role is required") }
	return nil
}

func (c *LandRecordContract) ReadProperty(ctx contractapi.TransactionContextInterface, id string) (*Property, error) {
	bytes, err := ctx.GetStub().GetState(propertyKey(id))
	if err != nil { return nil, fmt.Errorf("read property: %w", err) }
	if bytes == nil { return nil, fmt.Errorf("property %s does not exist", id) }
	var property Property
	if err := json.Unmarshal(bytes, &property); err != nil { return nil, err }
	return &property, nil
}

func (c *LandRecordContract) CreateProperty(ctx contractapi.TransactionContextInterface, id, parcelNumber, title, address, ownerID, ownerName, landType, documentHash, storageKey string, areaSqm float64) (*Property, error) {
	exists, err := ctx.GetStub().GetState(propertyKey(id))
	if err != nil { return nil, err }
	if exists != nil { return nil, fmt.Errorf("property %s already exists", id) }
	if id == "" || parcelNumber == "" || ownerID == "" || areaSqm <= 0 { return nil, fmt.Errorf("id, parcel number, owner and positive area are required") }
	property := Property{ID: id, ParcelNumber: parcelNumber, Title: title, Address: address, AreaSqm: areaSqm, LandType: landType, OwnerID: ownerID, OwnerName: ownerName, Status: "PENDING", DocumentHash: documentHash, StorageKey: storageKey, CreatedAt: now(), UpdatedAt: now()}
	bytes, _ := json.Marshal(property)
	if err := ctx.GetStub().PutState(propertyKey(id), bytes); err != nil { return nil, err }
	_ = ctx.GetStub().SetEvent("PropertyRegistered", bytes)
	return &property, nil
}

func (c *LandRecordContract) ApproveProperty(ctx contractapi.TransactionContextInterface, id string) (*Property, error) {
	if err := c.requireAuthority(ctx); err != nil { return nil, err }
	property, err := c.ReadProperty(ctx, id); if err != nil { return nil, err }
	if property.Status != "PENDING" { return nil, fmt.Errorf("only pending properties can be approved") }
	property.Status, property.UpdatedAt = "APPROVED", now()
	bytes, _ := json.Marshal(property)
	if err := ctx.GetStub().PutState(propertyKey(id), bytes); err != nil { return nil, err }
	_ = ctx.GetStub().SetEvent("PropertyApproved", bytes)
	return property, nil
}

func (c *LandRecordContract) ProposeTransfer(ctx contractapi.TransactionContextInterface, id, propertyID, sellerID, buyerID string) (*Transfer, error) {
	property, err := c.ReadProperty(ctx, propertyID); if err != nil { return nil, err }
	if property.Status != "APPROVED" || property.OwnerID != sellerID { return nil, fmt.Errorf("ownership validation failed") }
	if id == "" || buyerID == "" || buyerID == sellerID { return nil, fmt.Errorf("valid transfer and distinct buyer are required") }
	if bytes, err := ctx.GetStub().GetState(transferKey(id)); err != nil || bytes != nil { return nil, fmt.Errorf("transfer already exists or cannot be read") }
	transfer := Transfer{ID: id, PropertyID: propertyID, SellerID: sellerID, BuyerID: buyerID, Status: "PROPOSED", CreatedAt: now(), UpdatedAt: now()}
	bytes, _ := json.Marshal(transfer)
	if err := ctx.GetStub().PutState(transferKey(id), bytes); err != nil { return nil, err }
	_ = ctx.GetStub().SetEvent("TransferProposed", bytes)
	return &transfer, nil
}

func (c *LandRecordContract) AcceptTransfer(ctx contractapi.TransactionContextInterface, id, buyerID string) (*Transfer, error) {
	bytes, err := ctx.GetStub().GetState(transferKey(id)); if err != nil || bytes == nil { return nil, fmt.Errorf("transfer %s does not exist", id) }
	var transfer Transfer; if err := json.Unmarshal(bytes, &transfer); err != nil { return nil, err }
	if transfer.Status != "PROPOSED" || transfer.BuyerID != buyerID { return nil, fmt.Errorf("buyer cannot accept this transfer") }
	transfer.Status, transfer.UpdatedAt = "ACCEPTED", now()
	bytes, _ = json.Marshal(transfer)
	if err := ctx.GetStub().PutState(transferKey(id), bytes); err != nil { return nil, err }
	_ = ctx.GetStub().SetEvent("TransferAccepted", bytes)
	return &transfer, nil
}

func (c *LandRecordContract) FinalizeTransfer(ctx contractapi.TransactionContextInterface, id string) (*Property, error) {
	if err := c.requireAuthority(ctx); err != nil { return nil, err }
	bytes, err := ctx.GetStub().GetState(transferKey(id)); if err != nil || bytes == nil { return nil, fmt.Errorf("transfer %s does not exist", id) }
	var transfer Transfer; if err := json.Unmarshal(bytes, &transfer); err != nil { return nil, err }
	if transfer.Status != "ACCEPTED" { return nil, fmt.Errorf("only accepted transfers can be finalized") }
	property, err := c.ReadProperty(ctx, transfer.PropertyID); if err != nil { return nil, err }
	if property.OwnerID != transfer.SellerID || property.Status != "APPROVED" { return nil, fmt.Errorf("seller is not the current verified owner") }
	property.OwnerID, property.UpdatedAt = transfer.BuyerID, now()
	property.OwnerName = transfer.BuyerID // Resolve display names in the API's identity directory.
	transfer.Status, transfer.UpdatedAt = "FINALIZED", now()
	propertyBytes, _ := json.Marshal(property); transferBytes, _ := json.Marshal(transfer)
	if err := ctx.GetStub().PutState(propertyKey(property.ID), propertyBytes); err != nil { return nil, err }
	if err := ctx.GetStub().PutState(transferKey(id), transferBytes); err != nil { return nil, err }
	_ = ctx.GetStub().SetEvent("OwnershipTransferred", propertyBytes)
	return property, nil
}

func (c *LandRecordContract) GetPropertyHistory(ctx contractapi.TransactionContextInterface, id string) ([]*HistoryEntry, error) {
	iterator, err := ctx.GetStub().GetHistoryForKey(propertyKey(id)); if err != nil { return nil, err }; defer iterator.Close()
	entries := []*HistoryEntry{}
	for iterator.HasNext() {
		record, err := iterator.Next(); if err != nil { return nil, err }
		entry := &HistoryEntry{TxID: record.TxId, Timestamp: time.Unix(record.Timestamp.Seconds, int64(record.Timestamp.Nanos)).UTC().Format(time.RFC3339), IsDelete: record.IsDelete}
		if !record.IsDelete { var property Property; if err := json.Unmarshal(record.Value, &property); err != nil { return nil, err }; entry.Record = &property }
		entries = append(entries, entry)
	}
	return entries, nil
}

func main() {
	chaincode, err := contractapi.NewChaincode(&LandRecordContract{})
	if err != nil { panic(fmt.Sprintf("create landrecords chaincode: %v", err)) }
	if err := chaincode.Start(); err != nil { panic(fmt.Sprintf("start landrecords chaincode: %v", err)) }
}
