#!/bin/bash
WORKDIR=/tmp/landrecords_pkg2
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"

SRC="/mnt/d/coding/Blockchain-Based Land Record and Property Transaction Management System/fabric/chaincode/landrecords"
cp "$SRC/go.mod" "$SRC/go.sum" "$SRC/landrecords.go" "$WORKDIR/"

echo '{"type": "golang", "label": "landrecords_1.1"}' > "$WORKDIR/metadata.json"

cd "$WORKDIR"
tar czf code.tar.gz go.mod go.sum landrecords.go
tar czf landrecords.tar.gz metadata.json code.tar.gz

echo "Package created:"
ls -la "$WORKDIR/landrecords.tar.gz"
