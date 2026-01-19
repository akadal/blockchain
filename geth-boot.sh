#!/bin/sh

# Initialize only if not already done
if [ ! -d "/root/.ethereum/geth/chaindata" ]; then
    echo "Initializing Genesis Block..."
    geth init /root/genesis.json
else
    echo "Blockchain data found. Skipping initialization."
fi

# Start Geth
# --mine: Enable mining (needed for Clique to produce blocks)
# --miner.etherbase: The signer address (from genesis extraData)
# --unlock: Unlock the signer key (we need to import it first? No, for Clique dev we can use insecure unlock or just --dev but we are avoiding dev)
# Actually, for Clique, the signer needs the private key loaded.
# Simpler approach for "Education": Use --dev but with --datadir to force persistence?
# The user log showed --dev wipes data.
# 
# Let's use standard Proof of Work (Ethash) configuration? No, kills CPU.
# Use Clique (PoA). We need to import the key.
# 
# Let's inject the key into the keystore on first run.

if [ ! -f "/root/.ethereum/keystore/UTC--2022-01-01T00-00-00.000000000Z--f39fd6e51aad88f6f4ce6ab8827279cfffb92266" ]; then
    echo "Importing signer key..."
    echo "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" > /tmp/priv.key
    geth account import --password /tmp/password /tmp/priv.key
    rm /tmp/priv.key
fi

echo "Starting Geth Node..."
exec geth \
  --networkid 1337 \
  --http \
  --http.addr 0.0.0.0 \
  --http.port 8545 \
  --http.corsdomain "*" \
  --http.vhosts "*" \
  --http.api "eth,net,web3,debug,txpool,miner" \
  --ws \
  --ws.addr "0.0.0.0" \
  --ws.port 8546 \
  --ws.origins "*" \
  --ws.api "eth,net,web3,debug,txpool,miner" \
  --mine \
  --miner.etherbase 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --unlock 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 \
  --password /tmp/password \
  --allow-insecure-unlock \
  --nodiscover \
  --gcmode archive \
  --cache 256
