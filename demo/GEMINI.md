# Blockchain Demo - AI Context (GEMINI.md)

> **⚠️ IMPORTANT INSTRUCTION FOR AI AGENTS & DEVELOPERS:**
> This file (`GEMINI.md`) is designed to provide context for AI agents working on this codebase. **Whenever structural or functional changes are made to the codebase (e.g., adding a new module, changing the UI layout, altering smart contract simulated behaviors, changing build steps), you MUST update this file to reflect the new state.**
> Use this command to easily find areas that might need attention: `grep -rnw . -e 'TODO'`

## Overview
"Blockchain Demo" is an interactive, purely frontend, in-browser learning lab designed to teach blockchain fundamentals step-by-step. It covers everything from basic cryptography (hashing, encryption, digital signatures) to advanced Web3 concepts like Smart Contracts, Tokenomics, NFTs/RWAs, DeFi, and DAOs.

The application is built entirely using **HTML, CSS, and modular Vanilla JavaScript**. It does not have a traditional backend; almost all blockchain behaviors are simulated in-memory within the browser, except for the "Smart Contracts" section which includes actual MetaMask (Web3) integration via `ethers.js` to deploy and interact with real testnets.

## Tech Stack
* **Frontend:** HTML5, CSS3 (Custom properties/variables, Flexbox/Grid for layout), Vanilla JavaScript (ES6+).
* **Libraries (loaded via CDN):**
  * `CryptoJS` (v4.2.0) - For AES encryption, HMAC, and general hashing.
  * `JSEncrypt` (v3.3.2) - For RSA asymmetric encryption.
  * `ethers.js` (v6.13.4) - For connecting to browser wallets (MetaMask), deploying, and interacting with smart contracts.
* **Cryptography:** The app also heavily utilizes the native Web Crypto API (`window.crypto.subtle`) for operations like SHA-256 and ECDSA signing where appropriate.
* **Deployment/Containerization:** Docker (`Dockerfile` using `nginx:alpine`) and `docker-compose.yml`.

## Architecture & File Structure

The project is structured as a Single Page Application (SPA). Navigation is handled by simple DOM manipulation (showing/hiding sections based on the sidebar selection).

```
.
├── index.html               # Main entry point. Contains the complete DOM structure for all sections.
├── css/
│   └── style.css            # Global stylesheet. Contains all layout, components, and theming (light/dark).
├── js/
│   ├── app.js               # Core app logic: tab navigation, mobile menu, toast notifications, theming, and shared crypto utilities (sha256).
│   ├── hash.js              # Section 1: SHA-256 hashing demo.
│   ├── symmetric.js         # Section 2: AES encryption/decryption demo.
│   ├── asymmetric.js        # Section 3: RSA key generation and encryption/decryption demo.
│   ├── signing.js           # Section 4: ECDSA digital signature generation and verification.
│   ├── consensus.js         # Section 5: Game theory and consensus mechanisms (Byzantine Generals, PoW, PoS, PoA).
│   ├── block.js             # Section 6: Single block mining (Proof of Work) simulation.
│   ├── blockchain.js        # Section 7: Chain of blocks (immutability) simulation.
│   ├── distributed.js       # Section 8: Distributed network, fork resolution, and 51% attack simulation.
│   ├── wallet.js            # Section 9: BIP39 Mnemonic wallet generation (entropy -> mnemonic -> seed -> keys -> address).
│   ├── transaction.js       # Section 10: Creating, signing, and mining transactions.
│   ├── contracts-data.js    # Data file containing Solidity source codes, ABIs, and bytecodes for various smart contract templates.
│   ├── contracts.js         # Section 11: Smart contract deployment and interaction. Supports MetaMask, raw RPC, and a Simulated in-browser EVM.
│   ├── tokenomics.js        # Section 12: Token economy simulator (Mint, Burn, Transfer, Stake, Vest, Price Simulation).
│   ├── nft.js               # Section 13: NFT & RWA simulator (Minting, Fractionalization, Marketplace).
│   ├── defi.js              # Section 14: DeFi simulator (AMM Swaps, Liquidity Pools, Lending/Borrowing, Yield Farming).
│   ├── dao.js               # Section 15: DAO simulator (Proposals, Voting, Quorum, Execution, Hostile Takeovers).
│   └── wordlist.js          # BIP39 wordlist for mnemonic generation.
├── Dockerfile               # Nginx setup for serving the static files.
└── docker-compose.yml       # Docker compose configuration (exposes port 6080).
```

## Module Details & Interactions

### 1. State Management
Most modules maintain their state in memory using global JavaScript objects (e.g., `currentWallet` in `wallet.js`, `tokenEconomy` in `tokenomics.js`, `defi` in `defi.js`, `dao` in `dao.js`, `nftEngine` in `nft.js`). Refreshing the page resets the state for these simulated environments.

### 2. Smart Contracts (`contracts.js` & `contracts-data.js`)
This is the most complex section. It bridges the gap between the simulated environment and actual Web3.
* **Modes:**
  * **Simulated (🧪):** Uses a mock in-memory state (`contractState.simStorage`) to fake contract deployments and interactions. Extremely useful for learning without gas fees.
  * **MetaMask (🦊):** Uses `ethers.BrowserProvider(window.ethereum)` to connect to the user's browser wallet and deploy real bytecodes (stored in `contracts-data.js`) to live testnets/mainnets.
    * Features a dynamic **Network Selector** that allows users to pre-select or switch networks (e.g., Akadal Chain, Sepolia, Polygon) before or after connecting. It uses `wallet_switchEthereumChain` and `wallet_addEthereumChain` to automatically configure the user's wallet.
    * **Akadal Chain:** A custom Proof-of-Authority test network for educational purposes.
      * Network Name: Akadal Chain
      * RPC URL: `https://rpc.blockchain.akadal.tr`
      * Chain ID: 1337
      * Currency Symbol: ETH
      * Faucet: Users can get test ETH via `https://faucet.blockchain.akadal.tr`
  * **Browser Wallet (🌐):** Uses `ethers.JsonRpcProvider` and a user-provided private key to connect to a specific RPC URL.
* **Dynamic UI:** When a contract is deployed or loaded, `contracts.js` dynamically reads the ABI from `contracts-data.js` and generates a UI for interacting with `view` (read) and `write` functions.

### 3. Simulators (Tokenomics, DeFi, NFT, DAO)
These sections do not use real smart contracts or `ethers.js`. They are high-level educational abstractions written in Vanilla JS.
* **Tokenomics:** Simulates price movements based on a custom formula (considering burn ratio, stake ratio, inflation, and social factors). Includes staking APY, time-locked vesting calculations (where 1 real-time second simulates 1 day), and an Airdrop module (with both minting and wallet transfer options). The price simulator now explicitly considers circulating supply versus total minted for inflation, and incorporates dynamic market trend factors (Bull vs Bear) and FUD (Fear, Uncertainty, Doubt) which introduce negative pricing pressure.
* **DeFi:** Features two modes:
  * **Simulated:** Simulates an Automated Market Maker (AMM) using the constant product formula ($x \times y = k$). Features liquidity provision, over-collateralized lending (health factors), and yield farming.
  * **Web3 (MetaMask):** Connects to a real browser wallet to interact with a simple, real AMM smart contract (`SimpleAMM`). Supports swapping between two ERC20 test tokens and providing liquidity on live testnets.
* **NFT:** Features two modes:
  * **Simulated:** Simulates minting, transferring, marketplace listing/buying, and fractional ownership (splitting an NFT into fungible shares). Generates visual representations of NFTs using HTML5 Canvas.
  * **Web3 (MetaMask):** Connects to a real browser wallet to deploy an `AdvancedNFT` contract. Supports fully on-chain minting (Base64 JSON and SVG), transferring, listing for sale, and buying natively on the blockchain.
* **DAO:** Features two modes:
  * **Simulated:** Simulates token-weighted voting on proposals. Includes a "Simulate Others" feature where AI/randomized agents vote to demonstrate quorum and proposal resolution. It also features a "Hostile Takeover Simulation" where a malicious whale attempts to drain the treasury.
  * **Web3 (MetaMask):** Connects to a browser wallet to deploy and interact with real governance smart contracts. Includes deploying an ERC20 governance token and a basic DAO contract for creating proposals and casting on-chain votes based on token holdings.
* **Consensus & Distributed Networks:** The `consensus.js` and `distributed.js` files include interactive gamification to explain complex topics. This includes a Byzantine Generals Problem simulator, a Proof of Work hash race vs. bot miners, a Proof of Stake lottery, and a 51% network attack simulation.

## UI/UX Guidelines
* **Theming:** The application supports Light and Dark modes (`data-theme="light|dark"` on the `<html>` tag), toggled via `app.js` and saved in `localStorage`.
* **Components:** UI elements (buttons, inputs, cards, info boxes, badges, tables) are highly standardized using CSS classes defined in `style.css` (e.g., `.btn`, `.btn-primary`, `.form-input`, `.card`, `.info-box`, `.badge`). When adding new features, reuse these existing classes to maintain consistency.
* **Responsiveness:** Layouts use CSS Grid and Flexbox. A mobile hamburger menu is implemented for smaller screens.

## Common Development Tasks
* **Fixing Smart Contract Templates:**
  If a smart contract template has compilation errors (e.g. `Lottery` contract transfer issues), extract the source, fix the issue ensuring strict typing (e.g., using `address payable[]`), compile it with `solc` to get the new ABI and bytecode, and update `js/contracts-data.js`.
* **Adding a new Smart Contract Template:**
  1. Compile the Solidity code using Remix or Hardhat.
  2. Add the `source`, `abi`, and `bytecode` to the `CONTRACT_TEMPLATES` object in `contracts-data.js`.
  3. Add a selection button in the `index.html` (under `#section-contracts`).
  4. If you want it to work in Simulated mode, you must implement the mock logic inside `initSimulatedState` and `createSimulatedContract` in `contracts.js`.
* **Modifying Simulators:** Update the respective JS file (e.g., `defi.js`). Ensure you update the UI rendering functions (like `updateDefiUI`) and log events using the specific logging helper (like `defiLog`).

## Running the Application
Since it's purely static files, you can run it using any simple HTTP server:
```bash
# Using Python
python3 -m http.server 8000

# Using Node (if installed)
npx serve .

# Using Docker
docker-compose up -d
```
Access via `http://localhost:8000` (or `6080` if using Docker).