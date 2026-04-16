# 🚀 Akadal Chain

**Akadal Chain** is an educational, production-ready, and lightweight **Ethereum Private Network**. It is optimized so that students, developers, and educators can experiment with blockchain, smart contracts, and Web3 technologies safely, quickly, and entirely for free.

You can instantly interact with our live, ready-to-use network directly at [blockchain.akadal.tr](https://blockchain.akadal.tr) or fork this repository to deploy your very own test network on your servers using **Coolify** or **Docker** in just minutes!

---

## 📖 Table of Contents
- [🌟 Key Features](#-key-features)
- [🌐 Connecting to the Live Network (MetaMask Setup)](#-connecting-to-the-live-network-metamask-setup)
- [💰 Faucet (Get Free Test ETH)](#-faucet-get-free-test-eth)
- [🏗️ Architecture & Technical Details](#️-architecture--technical-details)
- [🔑 Master Account Information](#-master-account-information)
- [🛠️ Deployment (Run Your Own Network)](#️-deployment-run-your-own-network)
- [📂 Project Structure](#-project-structure)

---

## 🌟 Key Features

- **Education Focused:** Perfect for learning and testing smart contract development. The block gas limit is set exceptionally high (800,000,000) to minimize `Out-of-gas` errors during educational experiments.
- **Fast and Stable:** Utilizes the Proof-of-Authority (PoA - Clique) consensus algorithm, providing a stable experience with 15-second block times.
- **Lightweight and Resource-Friendly:** Optimized for Coolify/Docker so it can run smoothly even on servers with limited hardware resources (like a Hetzner VPS).
- **Comprehensive Ecosystem:** Comes integrated with everything you need in a blockchain network (Geth Node, Nginx Proxy, Block Explorer, Faucet, and Interactive Educational Demos).
- **Persistent Data:** The network does not reset unless you explicitly choose to do so. Your deployed contracts and transactions are persistent.

---

## 🌐 Connecting to the Live Network (MetaMask Setup)

To connect to the publicly accessible **Akadal Chain**, you can add the following network settings to your MetaMask or preferred Web3 wallet:

| Setting | Value |
| :--- | :--- |
| **Network Name** | `Akadal Chain` |
| **New RPC URL** | `https://rpc.blockchain.akadal.tr` |
| **Chain ID** | `1337` |
| **Currency Symbol** | `ETH` |
| **Block Explorer URL** | `https://explorer.blockchain.akadal.tr` |

---

## 💰 Faucet (Get Free Test ETH)

To interact with the network and deploy smart contracts, you'll need test ETH to pay for gas fees. You can instantly request test ETH via our Faucet, which has an unlimited supply.

1. Go to [https://faucet.blockchain.akadal.tr](https://faucet.blockchain.akadal.tr) (or the homepage [https://blockchain.akadal.tr](https://blockchain.akadal.tr)).
2. Copy and paste your MetaMask address into the input field.
3. Click the **"Send Me ETH"** button.
4. You will instantly receive **10 ETH** in your wallet!

---

## 🏗️ Architecture & Technical Details

Akadal Chain consists of 5 core services orchestrated via `docker-compose.yml`:

### 1. Geth Node (`geth`)
- **Version:** `ethereum/client-go:v1.13.15` (The most stable v1.13 series is used targeting the **Paris EVM**, avoiding complex PoS/Merge setups for educational purposes.)
- **Consensus:** Proof-of-Authority (PoA - Clique), 15-second block time.
- **Features:** Persistent data storage (`geth_data_v2` volume), high gas limit (`800000000`).

### 2. RPC Proxy (`rpc-proxy`)
- **Role:** An **Nginx** reverse proxy positioned in front of the Geth node.
- **Why it's necessary:** It handles **CORS** (Cross-Origin Resource Sharing) and Preflight (`OPTIONS`) headers correctly so browser-based wallets (like MetaMask) can connect seamlessly. It acts as the bridge between the network and the outside world.

### 3. Explorer (`explorer`)
- **Role:** A lightweight block explorer visualizing blocks, transactions, and wallet balances (Alethio Lite Explorer).
- **Connection:** Pulls data directly by connecting to the public RPC address (https://rpc.blockchain.akadal.tr).

### 4. Faucet & Landing Page (`faucet`)
- **Role:** A custom Node.js/Express application distributing test ETH. The front end of the Faucet also serves as the Landing Page, explaining network features and displaying live block data.

### 5. Interactive Learning Demos (`demo`)
- **Role:** A visual and interactive blockchain learning laboratory ([demo.blockchain.akadal.tr](https://demo.blockchain.akadal.tr)). It provides hands-on learning for concepts like hashing, block structure, network distribution, and compiling/deploying smart contracts. It is an isolated Node.js service.

---

## 🔑 Master Account Information

When setting up the test network in your own environment, you can use the master account which is pre-funded with a massive amount of ETH in the genesis block and possesses mining authority:

- **Address:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **Private Key:** `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

*(Note: You can use this Private Key for automated tests, scripts, or custom faucet setups. The Geth service automatically unlocks this account upon startup.)*

---

## 🛠️ Deployment (Run Your Own Network)

Deploying the project on your own server (especially using **Coolify**) is very straightforward. The network architecture is designed to use SSL-certified subdomains via Cloudflare or a similar DNS manager (e.g., `rpc.domain.com`) to prevent port conflicts.

### Setup Steps via Coolify

1. Create a new **Docker Compose** service.
2. Copy the contents of the `docker-compose.yml` from this repository and paste it into Coolify (or connect the GitHub repo directly).
3. **Very Important: Domain Settings!**
   Define the domains for the respective services in Coolify (including port numbers) as follows:
   - For the **rpc-proxy** service: `https://rpc.your-domain.com:80` *(MetaMask will connect here! Do not expose the Geth port directly!)*
   - For the **explorer** service: `https://explorer.your-domain.com:4000`
   - For the **faucet** service: `https://faucet.your-domain.com:3000`
   - For the **demo** service: `https://demo.your-domain.com:5454`
4. Update the Environment Variables (`DEMO_URL`, `RPC_URL`, `EXPLORER_URL`, `MAIN_URL`) via the Coolify interface to match your new URLs.
5. Click **Deploy** and watch your network spin up!

---

## 📂 Project Structure

```text
├── geth-config/      # Geth node settings, genesis.json, and startup script
├── nginx/            # RPC Proxy configuration for CORS issues
├── faucet/           # Source code for the Faucet and Landing Page
├── demo/             # Source code for the Interactive Learning Demos
├── tests/            # Integration and system test scripts
├── GEMINI.md         # Project AI context and structural documentation
└── docker-compose.yml# Main orchestration file
```

**Happy Coding & Learning!** 🚀🎓
