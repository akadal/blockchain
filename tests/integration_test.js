const { ethers } = require('ethers');
const axios = require('axios');

// Configurations
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
const FAUCET_URL = process.env.FAUCET_URL || 'http://localhost:3000';
const EXPLORER_URL = process.env.EXPLORER_URL || 'http://localhost:4000';
const USDT_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)"
];

// Genesis Key for verifying Geth state (if needed) or just use a random wallet
const TEST_WALLET_PK = ethers.Wallet.createRandom().privateKey;

async function waitForUsdtToken() {
    const deadline = Date.now() + 60000;
    let lastError = null;

    while (Date.now() < deadline) {
        try {
            const res = await axios.get(`${FAUCET_URL}/token/usdt`);
            if (res.data.ready && ethers.isAddress(res.data.address)) {
                return res.data;
            }
            lastError = new Error(`USDT status: ${res.data.status}`);
        } catch (e) {
            lastError = e;
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw lastError || new Error('USDT token was not ready in time');
}

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
            amount: 1
        });

        if (fundRes.data.success) {
            console.log(`✅ [Faucet] Funds requested. Tx: ${fundRes.data.txHash}`);
            // Wait for mining
            console.log("⏳ Waiting for transaction receipt...");
            const receipt = await provider.waitForTransaction(fundRes.data.txHash, 1, 45000); // Clique period is 15s.
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

    // 5. Verify USDT faucet and contract
    try {
        console.log("[USDT] Waiting for token metadata...");
        const usdtToken = await waitForUsdtToken();
        console.log(`[USDT] Token ready at ${usdtToken.address}`);

        const code = await provider.getCode(usdtToken.address);
        if (!code || code === '0x') throw new Error('No contract code at USDT address');

        const usdt = new ethers.Contract(usdtToken.address, USDT_ABI, provider);
        const [name, symbol, decimals] = await Promise.all([
            usdt.name(),
            usdt.symbol(),
            usdt.decimals()
        ]);

        if (symbol !== 'USDT' || Number(decimals) !== 6) {
            throw new Error(`Unexpected token metadata: ${name}/${symbol}/${decimals}`);
        }

        console.log("[USDT] Requesting 1000 USDT...");
        const usdtFundRes = await axios.post(`${FAUCET_URL}/fund-usdt`, {
            address: wallet.address
        });

        if (!usdtFundRes.data.success) {
            throw new Error(usdtFundRes.data.error || 'USDT faucet response was not successful');
        }

        const receipt = await provider.waitForTransaction(usdtFundRes.data.txHash, 1, 45000);
        if (!receipt || receipt.status !== 1) {
            throw new Error('USDT mint transaction failed or timed out');
        }

        const usdtBalance = await usdt.balanceOf(wallet.address);
        const expectedUsdt = ethers.parseUnits("1000", 6);
        if (usdtBalance < expectedUsdt) {
            throw new Error(`USDT balance too low: ${ethers.formatUnits(usdtBalance, 6)}`);
        }

        console.log(`[USDT] Balance verified: ${ethers.formatUnits(usdtBalance, 6)} USDT`);
    } catch (e) {
        console.error(`[USDT] Faucet flow failed: ${e.message}`);
        process.exit(1);
    }

    // 6. Check Explorer (Static check)
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
