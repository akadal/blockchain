#!/bin/sh

# Initialize only if not already done
if [ ! -d "/root/.ethereum/geth/chaindata" ]; then
    echo "Initializing Genesis Block..."
    geth init /root/genesis.json
else
    echo "Blockchain data found. Skipping initialization."
fi

# Check if the specific account is already imported
if [ ! -d "/root/.ethereum/keystore" ] || [ -z "$(ls -A /root/.ethereum/keystore)" ]; then
    echo "Importing signer key..."
    echo "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" > /tmp/priv.key
    geth account import --password /tmp/password /tmp/priv.key
    rm /tmp/priv.key
else
    echo "Keystore not empty. Skipping import."
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
