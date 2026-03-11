#!/bin/sh

# Update or Initialize Genesis Configuration
# Calculate a timestamp 3 minutes into the future to safely apply the hardfork
# without causing a block rewind error on existing databases.
# We store this timestamp in a persistent volume so on future Coolify rebuilds
# the node doesn't generate a new timestamp (which would crash geth with a mismatch error).
HF_TIME_FILE="/root/.ethereum/shanghai_time.txt"
if [ -f "$HF_TIME_FILE" ]; then
    FUTURE_TIME=$(cat "$HF_TIME_FILE")
    echo "Loaded existing hardfork activation time from volume: $FUTURE_TIME"
else
    FUTURE_TIME=$(($(date +%s) + 180))
    echo "$FUTURE_TIME" > "$HF_TIME_FILE"
    echo "Setting NEW Shanghai and Cancun hardfork activation time to: $FUTURE_TIME"
fi

# Inject the dynamic timestamp into the genesis file using jq
jq ".config.shanghaiTime = $FUTURE_TIME | .config.cancunTime = $FUTURE_TIME" /root/genesis.json > /tmp/genesis_temp.json
mv /tmp/genesis_temp.json /root/genesis.json

echo "Initializing/Updating Genesis Block Configuration..."
geth init /root/genesis.json

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
