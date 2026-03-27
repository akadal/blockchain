#!/bin/sh

# Varsayılan değerler
export RPC_URL=${RPC_URL:-"https://rpc.blockchain.akadal.tr"}
export EXPLORER_URL=${EXPLORER_URL:-"https://explorer.blockchain.akadal.tr"}
export MAIN_URL=${MAIN_URL:-"https://blockchain.akadal.tr"}
export DEMO_URL=${DEMO_URL:-"https://demo.blockchain.akadal.tr"}

# Dosyaları güncelle (js/contracts.js, vs)
find /usr/share/nginx/html -type f -name "*.js" -exec sed -i "s|https://rpc.blockchain.akadal.tr|${RPC_URL}|g" {} +
find /usr/share/nginx/html -type f -name "*.js" -exec sed -i "s|https://explorer.blockchain.akadal.tr|${EXPLORER_URL}|g" {} +
find /usr/share/nginx/html -type f -name "*.html" -exec sed -i "s|https://blockchain.akadal.tr|${MAIN_URL}|g" {} +
find /usr/share/nginx/html -type f -name "*.html" -exec sed -i "s|https://demo.blockchain.akadal.tr|${DEMO_URL}|g" {} +

exec "$@"
