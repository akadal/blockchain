const { ethers } = require('ethers');
const axios = require('axios');

// Configurations
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const FAUCET_URL = process.env.FAUCET_URL || 'http://localhost:3000';
const EXPLORER_URL = process.env.EXPLORER_URL || 'http://localhost:4000';

// Genesis Key for verifying Geth state (if needed) or just use a random wallet
const TEST_WALLET_PK = ethers.Wallet.createRandom().privateKey;

async function runTests() {
    console.log("🚀 Starting Blockchain Integration Tests...");
    console.log(`Config: RPC=${RPC_URL}, Faucet=${FAUCET_URL}`);

    // 1. Check RPC Connection
    let provider;
    try {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        const network = await provider.getNetwork();
        console.log(`✅ [RPC] Connected to chainId: ${network.chainId}`);
    } catch (e) {
        console.error(`❌ [RPC] Failed to connect: ${e.message}`);
        process.exit(1);
    }

    // 2. Check Faucet Health
    try {
        const res = await axios.get(`${FAUCET_URL}/health`);
        if (res.data.status === 'ok') {
            console.log(`✅ [Faucet] Healthcheck passed. Address: ${res.data.address}`);
        } else {
            throw new Error('Faucet status not ok');
        }
    } catch (e) {
        console.error(`❌ [Faucet] Health check failed: ${e.message}`);
        process.exit(1);
    }

    // 3. Request Funds
    const wallet = new ethers.Wallet(TEST_WALLET_PK, provider);
    console.log(`ℹ️ Test Wallet: ${wallet.address}`);

    try {
        console.log("⏳ [Faucet] Requesting funds...");
        const fundRes = await axios.post(`${FAUCET_URL}/fund`, {
            address: wallet.address,
            amount: 10
        });

        if (fundRes.data.success) {
            console.log(`✅ [Faucet] Funds requested. Tx: ${fundRes.data.txHash}`);
            // Wait for mining
            console.log("⏳ Waiting for transaction receipt...");
            const receipt = await provider.waitForTransaction(fundRes.data.txHash, 1, 10000); // Wait up to 10s
            if (receipt && receipt.status === 1) {
                console.log(`✅ [Chain] Transaction mined! Block: ${receipt.blockNumber}`);
            } else {
                throw new Error("Transaction failed or timed out");
            }
        }
    } catch (e) {
        console.error(`❌ [Faucet] Funding flow failed: ${e.message}`);
        process.exit(1);
    }

    // 4. Verify Balance
    const bal = await provider.getBalance(wallet.address);
    if (bal >= ethers.parseEther("1.0")) {
        console.log(`✅ [Chain] Balance verified: ${ethers.formatEther(bal)} ETH`);
    } else {
        console.error(`❌ [Chain] Balance incorrect: ${ethers.formatEther(bal)}`);
        process.exit(1);
    }

    // 5. Check Explorer (Static check)
    // Since Otterscan is client-side, we just check if the index.html is served
    try {
        const expRes = await axios.get(EXPLORER_URL);
        if (expRes.status === 200 && expRes.data.includes('title>Otterscan')) {
            console.log(`✅ [Explorer] Serving Otterscan UI`);
        } else {
            console.warn(`⚠️ [Explorer] UI reachable but title check failed (Might be different version)`);
        }
    } catch (e) {
        console.error(`❌ [Explorer] Failed to fetch explorer UI: ${e.message}`);
        // Not fatal if locally running and ports are different, but we assume localhost:4000
    }

    console.log("\n🎉 ALL SYSTEMS GO! The environment is ready for deployment.");
}

runTests();
