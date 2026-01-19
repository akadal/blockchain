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

// Setup Provider and Wallet
let provider;
let wallet;

const connect = async () => {
    try {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        const network = await provider.getNetwork();
        console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
        
        wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        console.log(`Faucet Wallet Address: ${wallet.address}`);
        const balance = await provider.getBalance(wallet.address);
        console.log(`Faucet Balance: ${ethers.formatEther(balance)} ETH`);
    } catch (e) {
        console.error("Connection error, retrying in 5s...", e);
        setTimeout(connect, 5000);
    }
};

connect();

// API Endpoints
app.post('/fund', async (req, res) => {
    if (!wallet) return res.status(503).json({ error: "Faucet not ready" });

    const { address, amount } = req.body;

    if (!address || !ethers.isAddress(address)) {
        return res.status(400).json({ error: "Invalid address" });
    }

    // Limit amount to reasonable values (though user asked for "unlimited", we just mean no rate limit cap on requests)
    // Let's allow users to request up to 1000 ETH at a time if they want.
    const ethAmount = amount ? amount.toString() : "10";
    
    try {
        const tx = await wallet.sendTransaction({
            to: address,
            value: ethers.parseEther(ethAmount)
        });
        console.log(`Sent ${ethAmount} ETH to ${address}. Tx: ${tx.hash}`);
        res.json({ success: true, txHash: tx.hash, amount: ethAmount });
    } catch (error) {
        console.error("Transaction failed:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ 
        status: wallet ? 'ok' : 'initializing', 
        address: wallet ? wallet.address : null 
    });
});

app.listen(PORT, () => {
    console.log(`Faucet running on port ${PORT}`);
});
