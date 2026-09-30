#!/bin/sh
set -eu

# The Clique signer is generated on first boot and never leaves the data
# volume: no private key or password lives in the repository or image.
# The faucet signs through this unlocked account over the internal network;
# the public RPC reaches Geth only through rpc-proxy, which refuses
# eth_sendTransaction and the other account/admin methods.

DATADIR=/root/.ethereum
KEYSTORE="$DATADIR/keystore"
PASSWORD_FILE="$DATADIR/signer.pass"
GENESIS="$DATADIR/genesis.json"

umask 077
mkdir -p "$KEYSTORE"

if [ -z "$(ls -A "$KEYSTORE")" ]; then
    echo "No signer key found. Generating a new Clique signer..."
    head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n' > "$PASSWORD_FILE"
    geth account new --datadir "$DATADIR" --password "$PASSWORD_FILE" > /dev/null
fi

KEYFILE=$(ls "$KEYSTORE" | head -n 1)
SIGNER_HEX=${KEYFILE##*--}
case "$SIGNER_HEX" in
    *[!0-9a-fA-F]*|"") echo "Cannot read signer address from keystore file $KEYFILE" >&2; exit 1 ;;
esac
if [ ${#SIGNER_HEX} -ne 40 ] || [ ! -s "$PASSWORD_FILE" ]; then
    echo "Keystore or $PASSWORD_FILE is not in the expected state; refusing to start." >&2
    exit 1
fi
SIGNER="0x$SIGNER_HEX"
echo "Clique signer: $SIGNER"

# The genesis is derived from the signer address, so it is identical on every
# boot and `geth init` stays idempotent.
sed "s/__SIGNER__/$SIGNER_HEX/g" /root/genesis.template.json > "$GENESIS"
geth init --datadir "$DATADIR" "$GENESIS"

echo "Starting Geth Node..."
exec geth \
  --datadir "$DATADIR" \
  --networkid 1337 \
  --http \
  --http.addr 0.0.0.0 \
  --http.port 8545 \
  --http.corsdomain "*" \
  --http.vhosts "*" \
  --http.api "eth,net,web3,debug,txpool" \
  --ws \
  --ws.addr "0.0.0.0" \
  --ws.port 8546 \
  --ws.origins "*" \
  --ws.api "eth,net,web3" \
  --mine \
  --miner.etherbase "$SIGNER" \
  --miner.gaslimit 800000000 \
  --unlock "$SIGNER" \
  --password "$PASSWORD_FILE" \
  --allow-insecure-unlock \
  --nodiscover \
  --gcmode archive \
  --cache 256
