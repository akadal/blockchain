# Akadal Chain - Project Context (GEMINI)

> **⚠️ AI ASSISTANT DIRECTIVE ⚠️**
> **IF YOU MAKE ANY STRUCTURAL, ARCHITECTURAL, OR CONFIGURATION CHANGES TO THIS PROJECT, YOU MUST UPDATE THIS `GEMINI.md` FILE TO REFLECT THOSE CHANGES.** This file serves as the definitive context for future AI interactions. Failure to keep this updated will lead to misinterpretations of the project state.

---

## 1. Project Overview
**Name:** Akadal Chain
**Purpose:** A production-ready, lightweight Ethereum Blockchain Environment designed strictly for educational purposes.
**Deployment Target:** Optimized for Docker and specifically **Coolify** on constrained environments (like Hetzner VPS).
**Network Specifications:**
- **Consensus mechanism:** Proof-of-Authority (PoA - Clique)
- **Chain ID:** 1337
- **Base Currency:** ETH
- **Network Version:** Stable Geth v1.12.2 (Chosen intentionally to avoid complex PoS/Merge requirements of v1.14+).

## 2. Architecture & Core Services
The system is orchestrated via `docker-compose.yml` and consists of 4 main services:

### 2.1 Geth Node (`geth`)
- **Version:** `ethereum/client-go:v1.12.2`
- **Role:** The core blockchain node running PoA (Clique) consensus.
- **Initialization:** Managed by `geth-boot.sh`.
  - Dynamically injects `shanghaiTime` and `cancunTime` hardfork timestamps (3 minutes in the future) into `genesis.json` on the first run using `jq` to avoid rewinds.
  - Automatically imports the pre-funded signer key from `genesis.json` (extraData).
- **Execution flags:** Runs with `--dev` avoided to ensure data persistence. Uses `--mine`, `--allow-insecure-unlock`, `--nodiscover`, and `--gcmode archive`.
- **Ports:** `8545` (HTTP RPC) & `8546` (WS).
- **Persistence:** Volume `geth_data_stable` mapped to `/root/.ethereum`. Data persistence is critical.

### 2.2 RPC Proxy (`rpc-proxy`)
- **Role:** Nginx reverse proxy sitting in front of the `geth` node.
- **Why it exists:** Handles **CORS (Cross-Origin Resource Sharing)** and preflight (`OPTIONS`) requests correctly so browser wallets like MetaMask can connect without issues.
- **Routing:** Forwards requests to `http://geth:8545`. Uses Docker's internal DNS (`127.0.0.11`) dynamically so Nginx doesn't crash if Geth is slow to start.
- **Exposure:** Port `80` internal, mapped externally via Coolify (e.g., `https://rpc.yourdomain.com`).

### 2.3 Faucet (`faucet`)
- **Role:** Node.js Express application distributing test ETH (10 ETH per request).
- **Setup:** Connects to `geth` via `RPC_URL=http://geth:8545`.
- **Funding Source:** It uses the unlocked master account (`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`) which is heavily funded in the genesis block.
- **Exposure:** Port `3000` internal and host.

### 2.4 Explorer (`explorer`)
- **Role:** Alethio Lite Explorer (`alethio/ethereum-lite-explorer:latest`).
- **Setup:** Configured via `APP_NODE_URL` to point to the **public RPC URL** (e.g., `https://rpc.blockchain.akadal.tr`). This is important because the explorer client runs in the user's browser, not server-side.
- **Exposure:** Port `80` internal, mapped to host port `4000` to avoid conflicts on the VPS.

## 3. Key Configurations & Networking details
- **Pre-funded Master Account:**
  - **Address:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
  - **Private Key:** `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` (Used in `docker-compose.yml` for Faucet and `geth-boot.sh` for auto-unlock).
- **Subdomains (Typical Coolify Setup):**
  - RPC/MetaMask: `rpc.domain.com` -> `rpc-proxy:80`
  - Explorer: `explorer.domain.com` -> `explorer:4000`
  - Faucet: `faucet.domain.com` -> `faucet:3000`

## 4. Common Troubleshooting / Edge Cases
- **MetaMask Chain ID Issues:** Usually caused by connecting directly to the Geth node bypassing the Nginx `rpc-proxy`. The proxy *must* be used for correct CORS headers.
- **Blockchain Resets:** The hardfork timestamp injection (`shanghai_time.txt`) prevents the chain from throwing a rewind error upon container rebuilds in Coolify by saving the generated timestamp into the persistent volume.

## 5. Development Guidelines for AI
- **Modifying Geth:** If changing `genesis.json` or `geth-boot.sh`, remember the PoA rules. The master account must be both funded in the alloc block AND defined in the `extraData` block for mining permissions.
- **Adding new RPC Methods:** Must ensure Nginx proxy passes the necessary methods and doesn't block them.
- **Resource Constraints:** Keep images and operations lightweight. The target environment (Hetzner via Coolify) has limited resources. Avoid heavy indexers unless strictly necessary.
