const express = require('express');
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const usdtArtifact = require('./contracts/AkadalUSDT.json');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Configuration from ENV
const RPC_URL = process.env.RPC_URL || 'http://geth:8545';
const PORT = process.env.PORT || 3000;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '1337');
const EXPLORER_URL = process.env.EXPLORER_URL || "https://explorer.blockchain.akadal.tr";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USDT_STATE_FILE = process.env.USDT_STATE_FILE || path.join(DATA_DIR, 'usdt-token.json');
const USDT_FAUCET_AMOUNT = '1000';
const USDT_DECIMALS = 6;
const USDT_SYMBOL = 'USDT';


// Setup Provider and Signer
let provider;
let signer;
let usdtContract;
let usdtSetupPromise;

let usdtState = {
    status: 'initializing',
    address: null,
    symbol: USDT_SYMBOL,
    decimals: USDT_DECIMALS,
    faucetAmount: USDT_FAUCET_AMOUNT,
    error: null
};

function ensureDataDir() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readSavedUsdtState() {
    try {
        if (!fs.existsSync(USDT_STATE_FILE)) return null;

        const state = JSON.parse(fs.readFileSync(USDT_STATE_FILE, 'utf8'));
        if (!state.address || !ethers.isAddress(state.address)) {
            console.warn(`Ignoring invalid USDT state file at ${USDT_STATE_FILE}`);
            return null;
        }

        return state;
    } catch (error) {
        console.warn(`Could not read USDT state file: ${error.message}`);
        return null;
    }
}

function writeUsdtState(nextState) {
    ensureDataDir();
    const tempFile = `${USDT_STATE_FILE}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(nextState, null, 2)}\n`);
    fs.renameSync(tempFile, USDT_STATE_FILE);
}

async function getSignerAddress() {
    if (!signer) return null;
    return signer.getAddress();
}

async function validateUsdtContract(address) {
    const code = await provider.getCode(address);
    if (!code || code === '0x') {
        throw new Error(`No contract code found at saved USDT address ${address}`);
    }

    const contract = new ethers.Contract(address, usdtArtifact.abi, signer);
    const [name, symbol, decimals, owner, faucetAddress] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
        contract.owner(),
        getSignerAddress()
    ]);

    if (symbol !== USDT_SYMBOL || Number(decimals) !== USDT_DECIMALS) {
        throw new Error(`Saved contract metadata mismatch: ${symbol}/${decimals}`);
    }

    if (owner.toLowerCase() !== faucetAddress.toLowerCase()) {
        throw new Error(`Saved USDT owner ${owner} does not match faucet ${faucetAddress}`);
    }

    return { contract, metadata: { name, symbol, decimals: Number(decimals), owner } };
}

async function deployUsdtContract() {
    console.log('USDT state missing or invalid. Deploying Akadal Test USDT...');
    usdtState = {
        ...usdtState,
        status: 'deploying',
        error: null
    };

    const factory = new ethers.ContractFactory(usdtArtifact.abi, usdtArtifact.bytecode, signer);
    const contract = await factory.deploy();
    const deploymentTx = contract.deploymentTransaction();
    console.log(`USDT deployment transaction: ${deploymentTx.hash}`);

    await contract.waitForDeployment();
    const address = await contract.getAddress();
    const { metadata } = await validateUsdtContract(address);
    const network = await provider.getNetwork();
    const faucetAddress = await getSignerAddress();

    const nextState = {
        status: 'ready',
        address,
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: metadata.decimals,
        owner: metadata.owner,
        faucetAddress,
        faucetAmount: USDT_FAUCET_AMOUNT,
        chainId: network.chainId.toString(),
        deployTxHash: deploymentTx.hash,
        deployedAt: new Date().toISOString(),
        error: null
    };

    writeUsdtState(nextState);
    usdtState = nextState;
    usdtContract = contract;

    console.log(`USDT contract ready at ${address}`);
    return contract;
}

async function ensureUsdtContract() {
    if (!provider || !signer) {
        throw new Error('Faucet signer is not ready');
    }

    if (usdtContract) return usdtContract;

    usdtState = {
        ...usdtState,
        status: 'checking',
        error: null
    };

    const savedState = readSavedUsdtState();
    if (savedState) {
        try {
            const { contract, metadata } = await validateUsdtContract(savedState.address);
            usdtContract = contract;
            usdtState = {
                ...savedState,
                status: 'ready',
                name: metadata.name,
                symbol: metadata.symbol,
                decimals: metadata.decimals,
                owner: metadata.owner,
                faucetAmount: USDT_FAUCET_AMOUNT,
                error: null
            };
            writeUsdtState(usdtState);
            console.log(`Using saved USDT contract at ${savedState.address}`);
            return contract;
        } catch (error) {
            console.warn(`Saved USDT contract cannot be used: ${error.message}`);
        }
    }

    return deployUsdtContract();
}

function startUsdtSetup() {
    if (usdtSetupPromise) return usdtSetupPromise;

    usdtSetupPromise = ensureUsdtContract()
        .catch((error) => {
            usdtState = {
                ...usdtState,
                status: 'error',
                error: error.message
            };
            console.error('USDT setup failed:', error);
            setTimeout(() => {
                usdtSetupPromise = null;
                startUsdtSetup().catch(() => { });
            }, 10000);
            throw error;
        })
        .finally(() => {
            if (usdtState.status !== 'ready') {
                usdtSetupPromise = null;
            }
        });

    return usdtSetupPromise;
}

function createSigner() {
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
        const normalizedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;
        return new ethers.NonceManager(new ethers.Wallet(normalizedKey, provider));
    }

    return provider.getSigner().then((jsonRpcSigner) => new ethers.NonceManager(jsonRpcSigner));
}

function validateRecipient(address) {
    return address && ethers.isAddress(address);
}

const connect = async () => {
    try {
        provider = new ethers.JsonRpcProvider(RPC_URL);
        const network = await provider.getNetwork();
        console.log(`Connected to network: ${network.name} (chainId: ${network.chainId})`);
        if (Number(network.chainId) !== CHAIN_ID) {
            console.warn(`Configured CHAIN_ID=${CHAIN_ID}, connected chainId=${network.chainId}`);
        }

        signer = await createSigner();
        const address = await signer.getAddress();

        console.log(`Faucet Wallet Address (Node Account): ${address}`);
        const balance = await provider.getBalance(address);
        console.log(`Faucet Balance: ${ethers.formatEther(balance)} ETH`);
        startUsdtSetup().catch(() => { });
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

    if (!validateRecipient(address)) {
        return res.status(400).json({ error: "Invalid address" });
    }

    const ethAmount = amount ? amount.toString() : "1";

    try {
        const tx = await signer.sendTransaction({
            to: address,
            value: ethers.parseEther(ethAmount)
        });
        console.log(`Sent ${ethAmount} ETH to ${address}. Tx: ${tx.hash}`);

        res.json({ success: true, txHash: tx.hash, amount: ethAmount, asset: 'ETH', explorerUrl: EXPLORER_URL });
    } catch (error) {
        console.error("Transaction failed:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/fund-usdt', async (req, res) => {
    if (!signer) return res.status(503).json({ error: "Faucet not ready" });

    const { address } = req.body;

    if (!validateRecipient(address)) {
        return res.status(400).json({ error: "Invalid address" });
    }

    try {
        if (!usdtContract) {
            await startUsdtSetup();
        }

        const tokenAmount = ethers.parseUnits(USDT_FAUCET_AMOUNT, USDT_DECIMALS);
        const tx = await usdtContract.mint(address, tokenAmount);
        console.log(`Minted ${USDT_FAUCET_AMOUNT} USDT to ${address}. Tx: ${tx.hash}`);

        res.json({
            success: true,
            txHash: tx.hash,
            amount: USDT_FAUCET_AMOUNT,
            asset: USDT_SYMBOL,
            tokenAddress: usdtState.address,
            explorerUrl: EXPLORER_URL
        });
    } catch (error) {
        console.error("USDT faucet failed:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/token/usdt', async (req, res) => {
    if (signer && !usdtContract && !usdtSetupPromise) {
        startUsdtSetup().catch(() => { });
    }

    res.json({
        ready: usdtState.status === 'ready',
        status: usdtState.status,
        address: usdtState.address,
        name: usdtState.name || 'Akadal Test USDT',
        symbol: USDT_SYMBOL,
        decimals: USDT_DECIMALS,
        faucetAmount: USDT_FAUCET_AMOUNT,
        explorerUrl: EXPLORER_URL,
        error: usdtState.error || null
    });
});

app.get('/health', async (req, res) => {
    let address = null;
    if (signer) {
        try { address = await signer.getAddress(); } catch { }
    }
    res.json({
        status: signer ? 'ok' : 'initializing',
        address: address,
        usdt: {
            status: usdtState.status,
            address: usdtState.address,
            symbol: USDT_SYMBOL,
            decimals: USDT_DECIMALS,
            faucetAmount: USDT_FAUCET_AMOUNT,
            error: usdtState.error || null
        }
    });
});

app.listen(PORT, () => {
    console.log(`Faucet running on port ${PORT}`);
});
