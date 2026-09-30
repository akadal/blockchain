# Akadal Chain - Project Context (GEMINI)

> **⚠️ AI ASSISTANT DIRECTIVE ⚠️**
> **IF YOU MAKE ANY STRUCTURAL, ARCHITECTURAL, OR CONFIGURATION CHANGES TO THIS PROJECT, YOU MUST UPDATE THIS `GEMINI.md` FILE TO REFLECT THOSE CHANGES.** This file serves as the definitive context for future AI interactions. Failure to keep this updated will lead to misinterpretations of the project state.

---

## 1. Project Overview
**Name:** Akadal Chain
**Purpose:** A production-ready, lightweight Ethereum Blockchain Environment designed strictly for educational purposes.
**Deployment Target:** Optimized for Docker and specifically **Coolify** on constrained environments (like Hetzner VPS).
**Network Specifications:**
- **Consensus mechanism:** Proof-of-Authority (PoA - Clique, 15s period)
- **Chain ID:** 1337
- **Base Currency:** ETH
- **Network Version:** Stable Geth v1.13.15 (Chosen intentionally to avoid complex PoS/Merge requirements of v1.14+). EVM target is strictly set to 'Paris'.

## 2. Architecture & Core Services
The system is orchestrated via `docker-compose.yml` and consists of 4 main services:

### 2.1 Geth Node (`geth`)
- **Version:** `ethereum/client-go:v1.13.15`
- **Role:** The core blockchain node running PoA (Clique) consensus.
- **Initialization:** Managed by `geth-boot.sh`.
  - Automatically imports the pre-funded signer key from `genesis.json` (extraData).
- **Execution flags:** Runs with `--dev` avoided to ensure data persistence. Uses `--mine`, `--miner.gaslimit 800000000`, `--allow-insecure-unlock`, `--nodiscover`, and `--gcmode archive`.
- **APIs:** `--http.api eth,net,web3,debug,txpool` (no `miner`), `--ws.api eth,net,web3`. The signer stays unlocked for Clique sealing, so the HTTP port must never be public without `rpc-proxy` in front.
- **Ports:** `8545` (HTTP RPC) & `8546` (WS), published on host **`127.0.0.1` only**.
- **Memory Limit:** 1.5GB
- **Persistence:** Volume `geth_data_v2` mapped to `/root/.ethereum`. Data persistence is critical.

### 2.2 RPC Proxy (`rpc-proxy`)
- **Role:** Nginx reverse proxy sitting in front of the `geth` node.
- **Why it exists:** Handles **CORS (Cross-Origin Resource Sharing)** and preflight (`OPTIONS`) requests correctly so browser wallets like MetaMask can connect without issues.
- **Method filter:** `nginx/rpc_filter.js` (njs, loaded in `nginx/Dockerfile`) parses every JSON-RPC call (single or batch, max 100) and only forwards `eth_*`/`net_*`/`web3_*`, `debug_traceTransaction` (built-in tracers, no custom `timeout`), `debug_storageRangeAt` and `txpool_status/content/inspect`. It refuses `eth_sendTransaction`, `eth_resend`, `eth_sign*`, `miner_*`, `debug_setHead`, `debug_traceCall`/`traceBlock*` and every other namespace, and answers `eth_accounts` with `[]`. Fully allowed requests are `internalRedirect`ed to the internal `/_geth` location (streamed, no size cap); only mixed batches use a buffered subrequest (8 MB). CORS headers live at `server` level so they apply after the redirect. Coolify's predefined network lets other apps on the server reach `geth:8545` unfiltered; keep that in mind if unrelated apps share the host.
- **Routing:** Forwards requests to `http://geth:8545`. Uses Docker's internal DNS (`127.0.0.11`) dynamically so Nginx doesn't crash if Geth is slow to start.
- **Exposure:** Port `80` internal, mapped externally via Coolify (e.g., `https://rpc.yourdomain.com`).

### 2.3 Faucet & Landing Page (`faucet`)
- **Role:** Node.js Express application distributing test ETH (1 ETH per request), minting Akadal Test USDT (1000 USDT per request), and serving as the primary **Landing Page** for the Akadal Educational Chain. The frontend (`faucet/public/index.html`) includes network details, MetaMask integration, a search bar directing to the Explorer, a copyable USDT contract address, and a dynamic display of recent blocks fetched from the RPC.
- **Setup:** Connects to `geth` via `RPC_URL=http://geth:8545`.
- **Abuse limits:** The ETH amount is fixed server-side (`FAUCET_ETH_AMOUNT`, default 1); the client `amount` is ignored. `faucet/limits.js` enforces a per-address, per-asset cooldown (`FAUCET_ADDRESS_COOLDOWN_SECONDS`, 3600) and a per-IP budget (`FAUCET_IP_MAX_REQUESTS` per `FAUCET_IP_WINDOW_SECONDS`, 120/3600; generous because a classroom shares one NAT IP). State is in memory. `trust proxy` is `TRUST_PROXY_HOPS` (default 1, the Coolify proxy; 2 behind a CDN); the faucet host port is bound to `127.0.0.1` so `X-Forwarded-For` cannot be spoofed by hitting port 3000 directly.
- **Funding Source:** It signs with the genesis private key from `PRIVATE_KEY` (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`), falling back to the unlocked Geth account if no private key is configured.
- **USDT Persistence:** On startup, the service reads `/app/data/usdt-token.json` from the `faucet_data` volume. If the saved address has valid contract code, `symbol() == "USDT"`, `decimals() == 6`, and the owner is the faucet address, it reuses that contract. Otherwise it deploys `AkadalUSDT`, writes the address to the volume, and mints from that contract for future faucet requests.
- **Exposure:** Port `3000` internal and host.

### 2.4 Explorer (`explorer`)
- **Role:** Alethio Lite Explorer (`alethio/ethereum-lite-explorer:latest`).
- **Setup:** Configured via `APP_NODE_URL` to point to the **public RPC URL** (e.g., `https://rpc.blockchain.akadal.tr`). This is important because the explorer client runs in the user's browser, not server-side.
- **Exposure:** Port `80` internal, mapped to host port `4000` to avoid conflicts on the VPS.

### 2.5 Interactive Demo (`demo`)
- **Role:** Visual Blockchain Demo application (merged from `akadal/blockchaindemo`) for educational purposes. Allows users to interact with concepts like hashing, blocks, and distributed networks interactively.
- **Setup:** Fully isolated Node.js application. Configured with environment variables `DEMO_URL`, `RPC_URL`, `EXPLORER_URL`, and `MAIN_URL` which can be managed dynamically via Coolify.
- **Exposure:** Port `3000` internal, mapped to host port `5454`. Accessed publicly via subdomain `demo.blockchain.akadal.tr`.

## 3. Key Configurations & Networking details
- **Pre-funded Master Account:**
  - **Address:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
  - **Private Key:** `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` (Used in `docker-compose.yml` for Faucet and `geth-boot.sh` for auto-unlock).
  - **Known weakness:** this is the public Hardhat/Anvil #0 key, so anyone can sign for the signer and faucet account offline (drain the ETH, mint USDT as owner) through `eth_sendRawTransaction`. The RPC filter cannot stop that. The fix is rotating to a private signer (Clique vote to add the new signer and drop the old one, then move the balance and `transferOwnership` of USDT) or a new genesis. The faucet key is read from `FAUCET_PRIVATE_KEY` in Coolify, with the public key as fallback until rotation.
- **Subdomains (Typical Coolify Setup):**
  - RPC/MetaMask: `rpc.domain.com` -> `rpc-proxy:80`
  - Explorer: `explorer.domain.com` -> `explorer:4000`
  - Faucet: `faucet.domain.com` -> `faucet:3000`
  - Demo: `demo.domain.com` -> `demo:5454`

## 4. Common Troubleshooting / Edge Cases
- **MetaMask Chain ID Issues:** Usually caused by connecting directly to the Geth node bypassing the Nginx `rpc-proxy`. The proxy *must* be used for correct CORS headers.

## 5. Development Guidelines for AI
- **Modifying Geth:** If changing `genesis.json` or `geth-boot.sh`, remember the PoA rules. The master account must be both funded in the alloc block AND defined in the `extraData` block for mining permissions.
- **Adding new RPC Methods:** Must ensure Nginx proxy passes the necessary methods and doesn't block them.
- **Resource Constraints:** Keep images and operations lightweight. The target environment (Hetzner via Coolify) has limited resources. Avoid heavy indexers unless strictly necessary.
