#!/bin/bash
WORKDIR=/tmp/landrecords_pkg_flat
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"

SRC="/mnt/d/coding/Blockchain-Based Land Record and Property Transaction Management System/fabric/chaincode/landrecords"
cp "$SRC/go.mod" "$SRC/go.sum" "$SRC/landrecords.go" "$WORKDIR/"

echo '{"type": "golang", "label": "landrecords_1.1"}' > "$WORKDIR/metadata.json"

cd "$WORKDIR"
tar czf landrecords.tar.gz metadata.json go.mod go.sum landrecords.go

echo "=== Package contents ==="
tar tzf landrecords.tar.gz
echo "=== Package ID ==="
sha256sum landrecords.tar.gz
