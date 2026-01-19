# Educational Ethereum Private Network (Coolify Ready)

This project provides a **production-ready, lightweight Ethereum Blockchain Environment** designed for educational purposes. It is optimized for easy deployment on **Coolify** or any Docker-based environment.

It includes everything you need to start teaching or learning Ethereum development:
1.  **Geth Node**: A stable Proof-of-Authority (Clique) blockchain.
2.  **Explorer**: A lightweight block explorer (Alethio) to view transactions.
3.  **Faucet**: A web interface to get free test ETH (`10 ETH` per request).
4.  **RPC Proxy**: A pre-configured Nginx proxy to handle CORS and SSL correctly for MetaMask connectivity.

---

## 🚀 Architecture

The system is composed of 4 Docker services:

| Service | Port (Internal) | Description |
| :--- | :--- | :--- |
| **geth** | `8545`, `8546` | The Ethereum Node (v1.12.2). Runs via `geth-boot.sh`. |
| **rpc-proxy** | `80` | **Crucial Component**. Nginx proxy that forwards requests to Geth and handles **CORS headers** to ensure MetaMask works. |
| **explorer** | `80` | Alethio Lite Explorer. Visualizes blocks/txs. |
| **faucet** | `3000` | Node.js App. Sends ETH to users using the Genesis Master Key. |

### Why Geth v1.12?
We explicitly use **Geth v1.12.2** because newer versions (v1.14+) require complex Proof-of-Stake (Merge) configurations (Beacon Chain, Prysm, etc.) which are overkill for a simple educational chain. v1.12 is the "Gold Standard" for stable, simple PoA chains.

---

## 🛠 Prerequisites

- **Coolify** (Recommended) or Docker & Docker Compose installed locally.
- A domain name (e.g., `blockchain.yourdomain.com`).

---

## 📦 Deployment Guide within Coolify

1.  **Create a New Service**: Choose "Docker Compose".
2.  **Paste Configuration**: Copy the contents of `docker-compose.yml`.
3.  **Configure Domains**:
    Go to the **Configuration** tab in Coolify and set the domains as follows. **This is critical.**

    *   **Domains for rpc-proxy**: `https://rpc.yourdomain.com:80`
        *   *Note: Do NOT expose `geth` directly. MetaMask connects here.*
    *   **Domains for explorer**: `https://explorer.yourdomain.com:80`
    *   **Domains for faucet**: `https://faucet.yourdomain.com:3000`

    *(Make sure to append the internal ports like `:80` or `:3000` so Coolify knows where to map).*

4.  **Deploy**: Click "Deploy". The initial build might take 1-2 minutes.

---

## 🔌 Connection Details for Users

To use this blockchain, users (Students/Developers) should configure their **MetaMask** as follows:

- **Network Name**: `My Edu Chain` (or any name)
- **RPC URL**: `https://rpc.yourdomain.com` (The domain you assigned to `rpc-proxy`)
- **Chain ID**: `1337`
- **Currency Symbol**: `ETH`
- **Block Explorer URL**: `https://explorer.yourdomain.com`

---

## 💰 How to Get Funds (Faucet)

1.  Open the Faucet URL (`https://faucet.yourdomain.com`).
2.  Paste your MetaMask address.
3.  Click **"Send Me ETH"**.
4.  You will receive **10 ETH** instantly.

---

## 🔧 Troubleshooting

### 1. MetaMask says "Failed to fetch chain ID"
*   **Cause**: This is usually a CORS (Cross-Origin Resource Sharing) issue.
*   **Fix**: Ensure you are connecting to the `rpc-proxy` domain, **NOT** the raw Geth domain. The Proxy (`nginx/default.conf`) is specially configured to add the necessary `Access-Control-Allow-Origin: *` headers.

### 2. Faucet says "Insufficient funds"
*   **Cause**: The master account might be empty (unlikely as it has 1 Billion ETH).
*   **Fix**: Check the `faucet` logs. Ensure the `PRIVATE_KEY` in `docker-compose.yml` matches the one in `genesis.json` (Hint: It is `0xac09...`).

### 3. Explorer shows nothing
*   **Cause**: Explorer cannot reach the RPC.
*   **Fix**: Check the `APP_NODE_URL` environment variable in `docker-compose.yml`. It must point to the **public** HTTPS RPC URL (`https://rpc.yourdomain.com`).

---

## 📂 File Structure

- `docker-compose.yml`: Main orchestration file.
- `geth-config/`:
    - `genesis.json`: Defines the blockchain rules (Chain ID 1337).
    - `geth-boot.sh`: Startup script (Initializes genesis if empty).
    - `Dockerfile`: Builds the custom Geth image.
- `nginx/`:
    - `default.conf`: Proxy configuration for CORS.
    - `Dockerfile`: Builds the Proxy image.
- `faucet/`: Source code for the Node.js Faucet app.

---

**Happy Hacking!** 🚀
