const express = require('express');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Configuration from ENV
const RPC_URL = process.env.RPC_URL || 'http://geth:8545';
const PRIVATE_KEY = process.env.PRIVATE_KEY; // The genesis key
const PORT = process.env.PORT || 3000;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '1337');

if (!PRIVATE_KEY) {
    console.error("FATAL: PRIVATE_KEY environment variable is required.");
    process.exit(1);
}

// Setup Provider and Signer
let provider;
let signer;

const connect = async () => {
    try {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        const network = await provider.getNetwork();
        console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);

        // In Geth --dev mode, the first account is unlocked and funded.
        // We obtain a signer for that account.
        signer = await provider.getSigner();
        const address = await signer.getAddress();

        console.log(`Faucet Wallet Address (Node Account): ${address}`);
        const balance = await provider.getBalance(address);
        console.log(`Faucet Balance: ${ethers.formatEther(balance)} ETH`);
    } catch (e) {
        console.error("Connection error, retrying in 5s...", e);
        setTimeout(connect, 5000);
    }
};

connect();

// API Endpoints
app.post('/fund', async (req, res) => {
    if (!signer) return res.status(503).json({ error: "Faucet not ready" });

    const { address, amount } = req.body;

    if (!address || !ethers.isAddress(address)) {
        return res.status(400).json({ error: "Invalid address" });
    }

    const ethAmount = amount ? amount.toString() : "10";

    try {
        const tx = await signer.sendTransaction({
            to: address,
            value: ethers.parseEther(ethAmount)
        });
        console.log(`Sent ${ethAmount} ETH to ${address}. Tx: ${tx.hash}`);

        // Return explorer base URL from env or default
        const explorerUrl = process.env.EXPLORER_URL || "https://explorer.blockchain.akadal.tr";
        res.json({ success: true, txHash: tx.hash, amount: ethAmount, explorerUrl });
    } catch (error) {
        console.error("Transaction failed:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', async (req, res) => {
    let address = null;
    if (signer) {
        try { address = await signer.getAddress(); } catch { }
    }
    res.json({
        status: signer ? 'ok' : 'initializing',
        address: address
    });
});

app.listen(PORT, () => {
    console.log(`Faucet running on port ${PORT}`);
});
