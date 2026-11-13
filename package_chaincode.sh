#!/bin/bash
WORKDIR=/tmp/landrecords_pkg
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR/src"

SRC="/mnt/d/coding/Blockchain-Based Land Record and Property Transaction Management System/fabric/chaincode/landrecords"
cp "$SRC/go.mod" "$SRC/go.sum" "$SRC/landrecords.go" "$WORKDIR/src/"

echo '{"type": "golang", "label": "landrecords_1.1"}' > "$WORKDIR/metadata.json"

cd "$WORKDIR/src"
tar czf "$WORKDIR/code.tar.gz" .

cd "$WORKDIR"
tar czf landrecords.tar.gz metadata.json code.tar.gz

echo "Package created:"
ls -la "$WORKDIR/landrecords.tar.gz"
