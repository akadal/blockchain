/* ========================================
   Section 9 — Smart Contracts
   MetaMask + Browser Wallet + Simulated
   Uses ethers.js v6
   ======================================== */

var contractState = {
    provider: null,
    signer: null,
    address: null,
    chainId: null,
    walletMode: null,
    selectedTemplate: 'storage',
    deployedAddress: null,
    deployedContract: null,
    simStorage: {}
};

// ==========================================
// WALLET MODE TOGGLE
// ==========================================

function setWalletMode(mode) {
    document.getElementById('modeMetaMask').classList.toggle('active', mode === 'metamask');
    document.getElementById('modeBrowser').classList.toggle('active', mode === 'browser');
    document.getElementById('walletModeMetaMask').style.display = mode === 'metamask' ? 'block' : 'none';
    document.getElementById('walletModeBrowser').style.display = mode === 'browser' ? 'block' : 'none';
}

function updateRpcUrl() {
    var sel = document.getElementById('browserNetwork');
    var isSimulated = sel.value === 'simulated';
    var isCustom = sel.value === 'custom';
    document.getElementById('customRpcGroup').style.display = isCustom ? 'block' : 'none';
    document.getElementById('privKeyGroup').style.display = isSimulated ? 'none' : 'block';
    document.getElementById('simulatedInfo').style.display = isSimulated ? 'block' : 'none';
}

// ==========================================
// METAMASK NETWORK SWITCHING
// ==========================================

const METAMASK_NETWORKS = {
    1337: {
        chainId: '0x539', // 1337
        chainName: 'Akadal Chain',
        nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://rpc.blockchain.akadal.tr'],
        blockExplorerUrls: ['https://explorer.blockchain.akadal.tr/']
    },
    11155111: {
        chainId: '0xaa36a7', // 11155111
        chainName: 'Sepolia test network',
        nativeCurrency: { name: 'SepoliaETH', symbol: 'SEP', decimals: 18 },
        rpcUrls: ['https://sepolia.infura.io/v3/'],
        blockExplorerUrls: ['https://sepolia.etherscan.io']
    },
    1: {
        chainId: '0x1', // 1
        chainName: 'Ethereum Mainnet',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://mainnet.infura.io/v3/'],
        blockExplorerUrls: ['https://etherscan.io']
    },
    137: {
        chainId: '0x89', // 137
        chainName: 'Polygon Mainnet',
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        rpcUrls: ['https://polygon-rpc.com/'],
        blockExplorerUrls: ['https://polygonscan.com/']
    },
    56: {
        chainId: '0x38', // 56
        chainName: 'Smart Chain',
        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
        rpcUrls: ['https://bsc-dataseed.binance.org/'],
        blockExplorerUrls: ['https://bscscan.com']
    },
    42161: {
        chainId: '0xa4b1', // 42161
        chainName: 'Arbitrum One',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://arb1.arbitrum.io/rpc'],
        blockExplorerUrls: ['https://arbiscan.io']
    },
    8453: {
        chainId: '0x2105', // 8453
        chainName: 'Base',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://mainnet.base.org'],
        blockExplorerUrls: ['https://basescan.org']
    }
};

async function switchMetaMaskNetwork(chainIdStr) {
    if (!chainIdStr) return; // "Auto-detect" selected
    const targetChainId = parseInt(chainIdStr);
    const networkParams = METAMASK_NETWORKS[targetChainId];

    if (!networkParams) {
        showToast("Network parameters not found for chain ID: " + targetChainId);
        return;
    }

    if (!window.ethereum) {
        showToast("MetaMask is not installed.");
        return;
    }

    // Attempt to bypass conflicting wallet extensions
    let providerSource = window.ethereum;
    if (providerSource.providers && providerSource.providers.length > 0) {
        const mmProvider = providerSource.providers.find(p => p.isMetaMask && !p.isBraveWallet && !p.isCoinbaseWallet);
        if (mmProvider) providerSource = mmProvider;
    }

    try {
        await providerSource.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: networkParams.chainId }],
        });
        showToast("Successfully switched to " + networkParams.chainName);
    } catch (switchError) {
        // This error code indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
            try {
                await providerSource.request({
                    method: 'wallet_addEthereumChain',
                    params: [networkParams],
                });
                showToast("Successfully added and switched to " + networkParams.chainName);
            } catch (addError) {
                console.error("Error adding network:", addError);
                showToast("Failed to add network.");
            }
        } else {
            console.error("Error switching network:", switchError);
            if (switchError.code === 4001) {
                showToast("Network switch rejected by user.");
            } else {
                showToast("Failed to switch network: " + switchError.message);
            }
        }
    }
}

// ==========================================
// METAMASK CONNECTION
// ==========================================

async function connectWallet() {
    let providerSource = window.ethereum;

    if (typeof providerSource === 'undefined') {
        showToast('Wallet extension not found! Please install MetaMask.');
        return;
    }

    var btn = document.getElementById('walletConnectBtn');
    btn.disabled = true;
    btn.textContent = 'Connecting...';

    try {
        console.log('[MetaMask] Starting connection... Using default provider:', providerSource);

        // 1. Attempt to bypass conflicting wallet extensions (like evmAsk.js) by finding the real MetaMask
        if (providerSource.providers && providerSource.providers.length > 0) {
            const mmProvider = providerSource.providers.find(p => p.isMetaMask && !p.isBraveWallet && !p.isCoinbaseWallet);
            if (mmProvider) {
                providerSource = mmProvider;
                console.log('[MetaMask] -> Real MetaMask provider found in window.ethereum.providers');
            }
        } else if (providerSource.isMetaMask === false) {
            console.log('[MetaMask] -> Warning: window.ethereum is intercepted by another non-MetaMask wallet.');
        }

        // 2. Request accounts using Promise.race to prevent buggy extensions from hanging the code
        console.log('[MetaMask] -> Requesting accounts...');

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Wallet prompt timed out. Conflicting extension detected!')), 15000);
        });

        const accounts = await Promise.race([
            providerSource.request({ method: 'eth_requestAccounts' }),
            timeoutPromise
        ]);

        if (!accounts || accounts.length === 0) {
            throw new Error('No accounts returned from wallet');
        }
        console.log('[MetaMask] -> Connected account:', accounts[0]);

        // 2.5 Check if a specific network was selected before connecting
        const preSelectedNetwork = document.getElementById('metaMaskNetworkSelect').value;
        if (preSelectedNetwork) {
            console.log('[MetaMask] -> Pre-selected network detected, attempting to switch...');
            await switchMetaMaskNetwork(preSelectedNetwork);
            // wait a little bit for the network switch to propagate in the extension
            await new Promise(r => setTimeout(r, 500));
        }

        // 3. Setup ethers provider using the exact providerSource
        console.log('[MetaMask] -> Creating ethers provider...');
        contractState.provider = new ethers.BrowserProvider(providerSource, "any");

        console.log('[MetaMask] -> getting signer...');
        contractState.signer = await contractState.provider.getSigner();
        contractState.address = await contractState.signer.getAddress();

        console.log('[MetaMask] -> getting network...');
        var network = await contractState.provider.getNetwork();
        contractState.chainId = Number(network.chainId);
        console.log('[MetaMask] -> Chain ID:', contractState.chainId);

        // 4. Update UI
        contractState.walletMode = 'metamask';
        console.log('[MetaMask] -> Updating UI via showWalletInfo()');
        await showWalletInfo('MetaMask 🦊');

        // Listeners: use the specific providerSource
        if (typeof providerSource.removeAllListeners === 'function') {
            providerSource.removeAllListeners('accountsChanged');
            providerSource.removeAllListeners('chainChanged');
        }
        providerSource.on('accountsChanged', handleAccountChange);
        providerSource.on('chainChanged', function () { window.location.reload(); });

        // Keep button showing connected state
        btn.textContent = 'Connected ✔';
        btn.style.background = 'var(--accent-green)';
        btn.style.color = '#fff';
        btn.disabled = false;
        console.log('[MetaMask] -> Connection sequence completed fully!');

    } catch (e) {
        console.error('[MetaMask] Connection Error:', e);
        let errorMsg = e.message || e;
        if (errorMsg.includes('timed out')) {
            errorMsg = "Conflicting wallet extension detected! Please disable other crypto wallets.";
        }
        showToast('Connection failed: ' + errorMsg);

        btn.disabled = false;
        btn.style.background = '';
        btn.style.color = '';
        btn.textContent = 'Connect MetaMask 🦊';
    }
}

// ==========================================
// BROWSER WALLET CONNECTION
// ==========================================

async function connectBrowserWallet() {
    var sel = document.getElementById('browserNetwork');
    if (sel.value === 'simulated') return connectSimulated();

    var rpcUrl = sel.value === 'custom'
        ? document.getElementById('customRpcUrl').value.trim() : sel.value;
    var privKey = document.getElementById('browserPrivKey').value.trim();
    if (!rpcUrl) { showToast('Select a network or enter a custom RPC URL.'); return; }
    if (!privKey) { showToast('Enter your private key.'); return; }
    if (!privKey.startsWith('0x')) privKey = '0x' + privKey;

    var btn = document.getElementById('browserConnectBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="mining-spinner"></span> Connecting...';
    try {
        contractState.provider = new ethers.JsonRpcProvider(rpcUrl);
        contractState.signer = new ethers.Wallet(privKey, contractState.provider);
        contractState.address = contractState.signer.address;
        var network = await contractState.provider.getNetwork();
        contractState.chainId = Number(network.chainId);
        contractState.walletMode = 'browser';
        var selectedOpt = sel.options[sel.selectedIndex];
        if (selectedOpt.dataset.chain) contractState.chainId = parseInt(selectedOpt.dataset.chain);
        await showWalletInfo('Browser 🌐');
    } catch (e) {
        var msg = e.message || 'Connection failed';
        if (msg.includes('invalid private key')) msg = 'Invalid private key format';
        if (msg.length > 80) msg = msg.substring(0, 80) + '...';
        showToast(msg);
    }
    btn.disabled = false;
    btn.textContent = 'Connect 🌐';
}

// ==========================================
// SIMULATED MODE
// ==========================================

function connectSimulated() {
    var randomBytes = new Uint8Array(20);
    crypto.getRandomValues(randomBytes);
    contractState.address = '0x' + bytesToHex(randomBytes);
    contractState.chainId = 31337;
    contractState.walletMode = 'simulated';
    contractState.provider = null;
    contractState.signer = null;
    contractState.simStorage = {};

    document.getElementById('walletInfo').style.display = 'block';
    document.getElementById('walletMode').textContent = 'Simulated 🧪';
    document.getElementById('walletAddr').textContent = shortAddr(contractState.address);
    document.getElementById('walletNetworkName').textContent = 'Simulated (In-Browser)';
    document.getElementById('walletNetworkName').style.display = 'inline';
    document.getElementById('walletNetworkSelect').style.display = 'none';
    document.getElementById('walletBalance').textContent = '100.0000 ETH';
    document.getElementById('walletModeMetaMask').style.display = 'none';
    document.getElementById('walletModeBrowser').style.display = 'none';
    document.querySelector('.wallet-mode-toggle').style.display = 'none';
    document.getElementById('walletDisconnectBtn').style.display = 'inline-flex';
    document.getElementById('deployBtn').disabled = false;
    showToast('Simulated wallet connected — no real gas needed!');
}

// ==========================================
// SHARED WALLET UI
// ==========================================

async function showWalletInfo(modeLabel) {
    var networkName = NETWORK_NAMES[contractState.chainId] || 'Chain ' + contractState.chainId;
    var balance;
    try { balance = await contractState.provider.getBalance(contractState.address); }
    catch (e) { balance = 0n; }
    var balEth = ethers.formatEther(balance);

    document.getElementById('walletInfo').style.display = 'block';
    document.getElementById('walletMode').textContent = modeLabel;
    document.getElementById('walletAddr').textContent = shortAddr(contractState.address);

    var netNameEl = document.getElementById('walletNetworkName');
    var netSelectEl = document.getElementById('walletNetworkSelect');

    if (contractState.walletMode === 'metamask') {
        netNameEl.style.display = 'none';
        netSelectEl.style.display = 'inline-block';
        // Check if current chainId exists in our dropdown
        var optionExists = Array.from(netSelectEl.options).some(opt => opt.value === String(contractState.chainId));
        if (optionExists) {
            netSelectEl.value = contractState.chainId;
        } else {
            // Add custom option dynamically
            var opt = document.createElement('option');
            opt.value = contractState.chainId;
            opt.textContent = networkName;
            netSelectEl.appendChild(opt);
            netSelectEl.value = contractState.chainId;
        }
    } else {
        netNameEl.style.display = 'inline';
        netSelectEl.style.display = 'none';
        netNameEl.textContent = networkName;
    }

    document.getElementById('walletBalance').textContent = parseFloat(balEth).toFixed(4) + ' ETH';
    document.getElementById('walletModeMetaMask').style.display = 'none';
    document.getElementById('walletModeBrowser').style.display = 'none';
    document.querySelector('.wallet-mode-toggle').style.display = 'none';
    document.getElementById('walletDisconnectBtn').style.display = 'inline-flex';
    document.getElementById('deployBtn').disabled = false;
    showToast('Wallet connected on ' + networkName);
}

function disconnectWallet() {
    contractState.provider = null;
    contractState.signer = null;
    contractState.address = null;
    contractState.chainId = null;
    contractState.walletMode = null;
    contractState.simStorage = {};

    document.getElementById('walletInfo').style.display = 'none';
    document.getElementById('walletDisconnectBtn').style.display = 'none';
    document.getElementById('deployBtn').disabled = true;
    document.querySelector('.wallet-mode-toggle').style.display = 'flex';
    document.getElementById('walletModeMetaMask').style.display = 'block';
    document.getElementById('walletModeBrowser').style.display = 'none';
    document.getElementById('modeMetaMask').classList.add('active');
    document.getElementById('modeBrowser').classList.remove('active');
    document.getElementById('deployResult').style.display = 'none';
    document.getElementById('interactionSection').style.display = 'none';
    showToast('Wallet disconnected');
}

async function handleAccountChange(accounts) {
    if (accounts.length === 0) disconnectWallet();
    else {
        contractState.address = accounts[0];
        document.getElementById('walletAddr').textContent = shortAddr(accounts[0]);
    }
}

// ==========================================
// CONTRACT TEMPLATE SELECTION
// ==========================================

function selectContract(templateKey) {
    contractState.selectedTemplate = templateKey;
    var template = CONTRACT_TEMPLATES[templateKey];

    document.querySelectorAll('.contract-select-btn').forEach(function (btn) { btn.classList.remove('active'); });
    var activeBtn = document.querySelector('.contract-select-btn[data-template="' + templateKey + '"]');
    if (activeBtn) activeBtn.classList.add('active');

    document.getElementById('contractSource').textContent = template.source;
    document.getElementById('contractDescription').textContent = template.description;
    document.getElementById('deployResult').style.display = 'none';
    document.getElementById('interactionSection').style.display = 'none';

    // Build constructor args inputs if needed
    var argsSection = document.getElementById('constructorArgsSection');
    var argsContainer = document.getElementById('constructorArgsInputs');
    argsContainer.innerHTML = '';

    if (template.constructorArgs && template.constructorArgs.length > 0) {
        argsSection.style.display = 'block';
        template.constructorArgs.forEach(function (arg) {
            var group = document.createElement('div');
            group.className = 'form-group';
            group.style.marginBottom = '8px';
            var label = document.createElement('label');
            label.className = 'form-label';
            label.textContent = arg.name;
            var input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-input form-input-sm';
            input.placeholder = arg.type;
            input.value = arg.default || '';
            input.dataset.argType = arg.type;
            group.appendChild(label);
            group.appendChild(input);
            argsContainer.appendChild(group);
        });
    } else {
        argsSection.style.display = 'none';
    }
}

// ==========================================
// DEPLOY
// ==========================================

function getConstructorArgs() {
    var inputs = document.querySelectorAll('#constructorArgsInputs input');
    var args = [];
    inputs.forEach(function (input) {
        var val = input.value;
        if (input.dataset.argType === 'uint256') val = val || '0';
        args.push(val);
    });
    return args;
}

async function deployContract() {
    if (!contractState.signer && contractState.walletMode !== 'simulated') {
        showToast('Connect your wallet first!');
        return;
    }

    var templateKey = contractState.selectedTemplate;
    var template = CONTRACT_TEMPLATES[templateKey];
    var btn = document.getElementById('deployBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="mining-spinner"></span> Deploying...';

    if (contractState.walletMode === 'simulated') {
        await simulatedDeploy(templateKey, template, btn);
        return;
    }

    try {
        var factory = new ethers.ContractFactory(template.abi, template.bytecode, contractState.signer);
        var constructorArgs = getConstructorArgs();

        // Explicit gasLimit bypasses "estimateGas" which fails on networks with EVM incompatibilities
        // or unexpected RPC configurations (like 'missing revert data' errors).
        var overrides = { gasLimit: 3000000 };

        var contract = constructorArgs.length > 0
            ? await factory.deploy(...constructorArgs, overrides)
            : await factory.deploy(overrides);

        document.getElementById('deployResult').style.display = 'block';
        document.getElementById('deployedAddr').textContent = contract.target;
        document.getElementById('deployStatus').textContent = '⏳ Waiting for confirmation...';
        document.getElementById('deployStatus').className = 'badge';
        document.getElementById('deployStatus').style.color = 'var(--accent-orange)';

        await contract.waitForDeployment();
        contractState.deployedAddress = contract.target;
        contractState.deployedContract = contract;

        document.getElementById('deployStatus').textContent = '✔ Deployed';
        document.getElementById('deployStatus').className = 'badge badge-valid';
        document.getElementById('deployStatus').style.color = '';

        updateExplorerLink(contract.target);
        buildInteractionUI(template.abi, contract);
        autoVerify(templateKey, contract.target);
        showToast('Contract deployed successfully!');
    } catch (e) {
        console.error("Deploy Error:", e);
        var msg = e.message || 'Deploy failed';
        if (msg.includes('user rejected')) msg = 'Transaction rejected by user';
        // DO NOT abbreviate error messages, user wants to see them / copy them
        showToast('Error: ' + msg);

        // If contract target was already generated, don't hide the div so user can copy it
        let deployedAddrEl = document.getElementById('deployedAddr');
        if (!deployedAddrEl.textContent || deployedAddrEl.textContent === '...') {
            document.getElementById('deployResult').style.display = 'none';
        } else {
            document.getElementById('deployStatus').textContent = '❌ Failed / Reverted';
            document.getElementById('deployStatus').className = 'badge';
            document.getElementById('deployStatus').style.color = 'var(--accent-red)';
        }
    }
    btn.disabled = false;
    btn.textContent = 'Deploy Contract 🚀';
}

// ==========================================
// SIMULATED DEPLOY & INTERACT
// ==========================================

async function simulatedDeploy(templateKey, template, btn) {
    await new Promise(function (r) { setTimeout(r, 800); });

    var randomAddr = new Uint8Array(20);
    crypto.getRandomValues(randomAddr);
    var fakeAddress = '0x' + bytesToHex(randomAddr);

    contractState.simStorage[fakeAddress] = {};
    contractState.deployedAddress = fakeAddress;

    document.getElementById('deployResult').style.display = 'block';
    document.getElementById('deployedAddr').textContent = fakeAddress;
    document.getElementById('deployStatus').textContent = '✔ Deployed (Simulated)';
    document.getElementById('deployStatus').className = 'badge badge-valid';
    document.getElementById('deployStatus').style.color = '';
    document.getElementById('explorerLink').style.display = 'none';
    document.getElementById('verifyStatus').textContent = '✔ No verification needed (simulated)';
    document.getElementById('verifyStatus').style.color = 'var(--text-muted)';

    // Initialize simulated contract state
    var store = contractState.simStorage[fakeAddress];
    var cArgs = getConstructorArgs();
    initSimulatedState(templateKey, store, cArgs);

    var simContract = createSimulatedContract(templateKey, fakeAddress);
    buildInteractionUI(template.abi, simContract);
    showToast('Contract deployed (simulated) at ' + shortAddr(fakeAddress));

    btn.disabled = false;
    btn.textContent = 'Deploy Contract 🚀';
}

function initSimulatedState(templateKey, store, cArgs) {
    if (templateKey === 'storage') {
        store._number = 0n;
    } else if (templateKey === 'counter') {
        store._count = 0n;
    } else if (templateKey === 'owner') {
        store._owner = contractState.address;
        store._message = '';
    } else if (templateKey === 'voting') {
        store._admin = contractState.address;
        store._proposals = [];
        store._hasVoted = {};
    } else if (templateKey === 'token') {
        store._name = cArgs[0] || 'DemoToken';
        store._symbol = cArgs[1] || 'DMT';
        store._decimals = 18;
        var supply = BigInt(cArgs[2] || '1000000') * (10n ** 18n);
        store._totalSupply = supply;
        store._balances = {};
        store._balances[contractState.address] = supply;
        store._allowances = {};
    } else if (templateKey === 'nft') {
        store._name = cArgs[0] || 'DemoNFT';
        store._symbol = cArgs[1] || 'DNFT';
        store._tokenCounter = 0n;
        store._owners = {};
        store._uris = {};
        store._balances = {};
    } else if (templateKey === 'greeting') {
        store._entries = [];
    } else if (templateKey === 'todolist') {
        store._owner = contractState.address;
        store._tasks = [];
    } else if (templateKey === 'lottery') {
        store._manager = contractState.address;
        store._players = [];
        store._lastWinner = '0x0000000000000000000000000000000000000000';
        store._ticketPrice = BigInt(cArgs[0] || '1000000000000000');
        store._balance = 0n;
    }
}

function createSimulatedContract(templateKey, address) {
    var store = contractState.simStorage[address];
    var fakeTx = function () {
        var h = '0x' + bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
        return { hash: h, wait: async function () { await new Promise(function (r) { setTimeout(r, 300); }); } };
    };
    var delay = function () { return new Promise(function (r) { setTimeout(r, 400); }); };

    if (templateKey === 'storage') {
        return {
            target: address,
            store: async function (num) { await delay(); store._number = BigInt(num); return fakeTx(); },
            retrieve: async function () { return store._number; }
        };
    }

    if (templateKey === 'counter') {
        return {
            target: address,
            increment: async function () { await delay(); store._count += 1n; return fakeTx(); },
            decrement: async function () {
                if (store._count <= 0n) throw new Error('Counter: cannot go below zero');
                await delay(); store._count -= 1n; return fakeTx();
            },
            getCount: async function () { return store._count; },
            reset: async function () { await delay(); store._count = 0n; return fakeTx(); }
        };
    }

    if (templateKey === 'owner') {
        return {
            target: address,
            owner: async function () { return store._owner; },
            getMessage: async function () { return store._message; },
            setMessage: async function (msg) { await delay(); store._message = msg; return fakeTx(); },
            transferOwnership: async function (addr) {
                if (!addr || addr === '0x0000000000000000000000000000000000000000') throw new Error('Invalid address');
                await delay(); store._owner = addr; return fakeTx();
            }
        };
    }

    if (templateKey === 'voting') {
        return {
            target: address,
            admin: async function () { return store._admin; },
            proposalCount: async function () { return BigInt(store._proposals.length); },
            addProposal: async function (name) { await delay(); store._proposals.push({ name: name, votes: 0n }); return fakeTx(); },
            vote: async function (id) {
                var i = Number(id);
                if (i >= store._proposals.length) throw new Error('Invalid proposal');
                await delay(); store._proposals[i].votes += 1n; return fakeTx();
            },
            getProposal: async function (id) {
                var i = Number(id);
                if (i >= store._proposals.length) throw new Error('Invalid proposal');
                return [store._proposals[i].name, store._proposals[i].votes];
            },
            hasVoted: async function (addr) { return store._hasVoted[addr] || false; },
            proposals: async function (id) {
                var i = Number(id);
                if (i >= store._proposals.length) throw new Error('Invalid proposal');
                return [store._proposals[i].name, store._proposals[i].votes];
            }
        };
    }

    if (templateKey === 'token') {
        return {
            target: address,
            name: async function () { return store._name; },
            symbol: async function () { return store._symbol; },
            decimals: async function () { return BigInt(store._decimals); },
            totalSupply: async function () { return store._totalSupply; },
            owner: async function () { return contractState.address; },
            balanceOf: async function (addr) { return store._balances[addr] || 0n; },
            allowance: async function (owner, spender) {
                return (store._allowances[owner] && store._allowances[owner][spender]) || 0n;
            },
            transfer: async function (to, amount) {
                var amt = BigInt(amount);
                var from = contractState.address;
                if ((store._balances[from] || 0n) < amt) throw new Error('Insufficient balance');
                await delay();
                store._balances[from] = (store._balances[from] || 0n) - amt;
                store._balances[to] = (store._balances[to] || 0n) + amt;
                return fakeTx();
            },
            approve: async function (spender, amount) {
                await delay();
                if (!store._allowances[contractState.address]) store._allowances[contractState.address] = {};
                store._allowances[contractState.address][spender] = BigInt(amount);
                return fakeTx();
            },
            transferFrom: async function (from, to, amount) {
                var amt = BigInt(amount);
                if ((store._balances[from] || 0n) < amt) throw new Error('Insufficient balance');
                await delay();
                store._balances[from] = (store._balances[from] || 0n) - amt;
                store._balances[to] = (store._balances[to] || 0n) + amt;
                return fakeTx();
            },
            mint: async function (to, amount) {
                var amt = BigInt(amount);
                await delay();
                store._totalSupply += amt;
                store._balances[to] = (store._balances[to] || 0n) + amt;
                return fakeTx();
            }
        };
    }

    if (templateKey === 'nft') {
        return {
            target: address,
            name: async function () { return store._name; },
            symbol: async function () { return store._symbol; },
            tokenCounter: async function () { return store._tokenCounter; },
            owner: async function () { return contractState.address; },
            balanceOf: async function (addr) { return store._balances[addr] || 0n; },
            ownerOf: async function (id) {
                var tid = Number(id);
                return store._owners[tid] || '0x0000000000000000000000000000000000000000';
            },
            tokenURI: async function (id) {
                var tid = Number(id);
                return store._uris[tid] || '';
            },
            mint: async function (to, uri) {
                await delay();
                var tid = Number(store._tokenCounter);
                store._owners[tid] = to;
                store._uris[tid] = uri;
                store._balances[to] = (store._balances[to] || 0n) + 1n;
                store._tokenCounter += 1n;
                return fakeTx();
            },
            transferFrom: async function (from, to, tokenId) {
                var tid = Number(tokenId);
                if (store._owners[tid] !== from) throw new Error('Not the token owner');
                await delay();
                store._owners[tid] = to;
                store._balances[from] = (store._balances[from] || 0n) - 1n;
                store._balances[to] = (store._balances[to] || 0n) + 1n;
                return fakeTx();
            }
        };
    }

    if (templateKey === 'greeting') {
        return {
            target: address,
            totalEntries: async function () { return BigInt(store._entries.length); },
            post: async function (message) {
                await delay();
                store._entries.push({ author: contractState.address, message: message, timestamp: BigInt(Math.floor(Date.now() / 1000)) });
                return fakeTx();
            },
            getEntry: async function (index) {
                var i = Number(index);
                if (i >= store._entries.length) throw new Error('Index out of bounds');
                var e = store._entries[i];
                return [e.author, e.message, e.timestamp];
            },
            getLatest: async function () {
                if (store._entries.length === 0) throw new Error('No entries yet');
                var e = store._entries[store._entries.length - 1];
                return [e.author, e.message, e.timestamp];
            },
            entries: async function (index) {
                var i = Number(index);
                if (i >= store._entries.length) throw new Error('Index out of bounds');
                var e = store._entries[i];
                return [e.author, e.message, e.timestamp];
            }
        };
    }

    if (templateKey === 'todolist') {
        return {
            target: address,
            owner: async function () { return store._owner; },
            taskCount: async function () { return BigInt(store._tasks.length); },
            pendingCount: async function () {
                var c = 0;
                for (var i = 0; i < store._tasks.length; i++) { if (!store._tasks[i].completed) c++; }
                return BigInt(c);
            },
            addTask: async function (text) {
                await delay();
                store._tasks.push({ text: text, completed: false });
                return fakeTx();
            },
            completeTask: async function (id) {
                var i = Number(id);
                if (i >= store._tasks.length) throw new Error('Invalid task');
                if (store._tasks[i].completed) throw new Error('Already completed');
                await delay();
                store._tasks[i].completed = true;
                return fakeTx();
            },
            getTask: async function (id) {
                var i = Number(id);
                if (i >= store._tasks.length) throw new Error('Invalid task');
                return [store._tasks[i].text, store._tasks[i].completed];
            },
            tasks: async function (id) {
                var i = Number(id);
                if (i >= store._tasks.length) throw new Error('Invalid task');
                return [store._tasks[i].text, store._tasks[i].completed];
            }
        };
    }

    if (templateKey === 'lottery') {
        return {
            target: address,
            manager: async function () { return store._manager; },
            lastWinner: async function () { return store._lastWinner; },
            ticketPrice: async function () { return store._ticketPrice; },
            getBalance: async function () { return store._balance; },
            getPlayers: async function () { return BigInt(store._players.length); },
            players: async function (index) {
                var i = Number(index);
                if (i >= store._players.length) throw new Error('Invalid index');
                return store._players[i];
            },
            buyTicket: async function () {
                await delay();
                store._players.push(contractState.address);
                store._balance += store._ticketPrice;
                return fakeTx();
            },
            pickWinner: async function () {
                if (store._players.length < 2) throw new Error('Need at least 2 players');
                await delay();
                var idx = Math.floor(Math.random() * store._players.length);
                store._lastWinner = store._players[idx];
                store._players = [];
                store._balance = 0n;
                return fakeTx();
            }
        };
    }

    return { target: address };
}

function updateExplorerLink(address) {
    var explorer = EXPLORER_APIS[contractState.chainId];
    var linkEl = document.getElementById('explorerLink');
    if (explorer) {
        linkEl.href = explorer.url + '/address/' + address;
        linkEl.textContent = 'View on ' + explorer.name + ' ↗';
        linkEl.style.display = 'inline-flex';
    } else {
        linkEl.style.display = 'none';
    }
}

// ==========================================
// AUTO-VERIFY
// ==========================================

async function autoVerify(templateKey, address) {
    var template = CONTRACT_TEMPLATES[templateKey];
    var explorer = EXPLORER_APIS[contractState.chainId];
    var verifyEl = document.getElementById('verifyStatus');
    if (!explorer) {
        verifyEl.textContent = '⚠ No explorer API for this network';
        verifyEl.style.color = 'var(--text-muted)';
        return;
    }
    verifyEl.textContent = '⏳ Verifying on ' + explorer.name + '...';
    verifyEl.style.color = 'var(--accent-orange)';
    await new Promise(function (r) { setTimeout(r, 5000); });
    try {
        var params = new URLSearchParams();
        params.append('apikey', '');
        params.append('module', 'contract');
        params.append('action', 'verifysourcecode');
        params.append('contractaddress', address);
        params.append('sourceCode', template.source);
        params.append('codeformat', 'solidity-single-file');
        params.append('contractname', template.name);
        params.append('compilerversion', 'v' + template.compiler + '+commit.e11b9ed9');
        params.append('optimizationUsed', '0');
        params.append('runs', '200');
        params.append('licenseType', '3');
        var response = await fetch(explorer.api, { method: 'POST', body: params });
        var data = await response.json();
        if (data.status === '1' || data.message === 'OK') {
            verifyEl.textContent = '✔ Verification submitted to ' + explorer.name;
            verifyEl.style.color = 'var(--accent-green)';
            if (data.result) setTimeout(function () { checkVerifyStatus(explorer, data.result, verifyEl); }, 10000);
        } else {
            verifyEl.textContent = '⚠ Verify: ' + (data.result || data.message || 'Failed');
            verifyEl.style.color = 'var(--accent-orange)';
        }
    } catch (e) {
        verifyEl.textContent = '⚠ Could not verify automatically (CORS or API limit)';
        verifyEl.style.color = 'var(--text-muted)';
    }
}

async function checkVerifyStatus(explorer, guid, verifyEl) {
    try {
        var url = explorer.api + '?module=contract&action=checkverifystatus&guid=' + guid;
        var response = await fetch(url);
        var data = await response.json();
        if (data.result === 'Pass - Verified') {
            verifyEl.textContent = '✔ Contract Verified on ' + explorer.name;
            verifyEl.style.color = 'var(--accent-green)';
        } else if (data.result === 'Pending in queue') {
            verifyEl.textContent = '⏳ Pending verification...';
            setTimeout(function () { checkVerifyStatus(explorer, guid, verifyEl); }, 10000);
        } else {
            verifyEl.textContent = '⚠ ' + (data.result || 'Verification pending');
            verifyEl.style.color = 'var(--accent-orange)';
        }
    } catch (e) { /* silent */ }
}

// ==========================================
// INTERACTION UI (Dynamic from ABI)
// ==========================================

function buildInteractionUI(abi, contract) {
    var section = document.getElementById('interactionSection');
    section.style.display = 'block';
    var readContainer = document.getElementById('readFunctions');
    var writeContainer = document.getElementById('writeFunctions');
    readContainer.innerHTML = '';
    writeContainer.innerHTML = '';
    var readCount = 0, writeCount = 0;

    abi.forEach(function (item) {
        if (item.type !== 'function') return;
        var isRead = item.stateMutability === 'view' || item.stateMutability === 'pure';
        var fnCard = createFunctionCard(item, contract);
        if (isRead) { readContainer.appendChild(fnCard); readCount++; }
        else { writeContainer.appendChild(fnCard); writeCount++; }
    });

    document.getElementById('readSection').style.display = readCount > 0 ? 'block' : 'none';
    document.getElementById('writeSection').style.display = writeCount > 0 ? 'block' : 'none';
}

function createFunctionCard(abiItem, contract) {
    var card = document.createElement('div');
    card.className = 'fn-card';
    var isRead = abiItem.stateMutability === 'view' || abiItem.stateMutability === 'pure';
    var isPayable = abiItem.stateMutability === 'payable';

    var header = document.createElement('div');
    header.className = 'fn-header';
    header.innerHTML = '<span class="fn-name">' + abiItem.name + '</span>' +
        '<span class="badge ' + (isRead ? 'badge-valid' : 'badge-write') + '">' +
        (isRead ? 'view' : (isPayable ? 'payable' : 'write')) + '</span>';
    card.appendChild(header);

    var inputs = [];
    if (abiItem.inputs && abiItem.inputs.length > 0) {
        abiItem.inputs.forEach(function (inp, idx) {
            var group = document.createElement('div');
            group.className = 'form-group';
            group.style.marginBottom = '8px';
            var label = document.createElement('label');
            label.className = 'form-label';
            label.textContent = (inp.name || 'param' + idx) + ' (' + inp.type + ')';
            var input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-input form-input-sm';
            input.placeholder = inp.type;
            input.dataset.type = inp.type;
            group.appendChild(label);
            group.appendChild(input);
            card.appendChild(group);
            inputs.push(input);
        });
    }

    if (isPayable) {
        var group = document.createElement('div');
        group.className = 'form-group';
        group.style.marginBottom = '8px';
        var label = document.createElement('label');
        label.className = 'form-label';
        label.style.color = 'var(--accent-orange)';
        label.textContent = 'Payable Value (ETH)';
        var input = document.createElement('input');
        input.type = 'number';
        input.step = '0.000000000000000001';
        input.className = 'form-input form-input-sm';
        input.placeholder = 'ETH amount (e.g., 0.01)';
        input.dataset.isPayableValue = 'true';
        group.appendChild(label);
        group.appendChild(input);
        card.appendChild(group);
        inputs.push(input);
    }

    var btnWrapper = document.createElement('div');
    btnWrapper.style.display = 'flex';
    btnWrapper.style.gap = '8px';
    btnWrapper.style.alignItems = 'center';
    var btn = document.createElement('button');
    btn.className = 'btn btn-sm ' + (isRead ? 'btn-green' : 'btn-orange');
    btn.textContent = isRead ? 'Call' : 'Send';
    var resultEl = document.createElement('div');
    resultEl.className = 'fn-result';
    resultEl.style.display = 'none';
    btn.onclick = function () { executeFn(abiItem, contract, inputs, btn, resultEl); };
    btnWrapper.appendChild(btn);
    card.appendChild(btnWrapper);
    card.appendChild(resultEl);
    return card;
}

async function executeFn(abiItem, contract, inputs, btn, resultEl) {
    var isRead = abiItem.stateMutability === 'view' || abiItem.stateMutability === 'pure';
    var isPayable = abiItem.stateMutability === 'payable';
    var oldText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="mining-spinner"></span>';

    try {
        var normalInputs = inputs.filter(inp => inp.dataset.isPayableValue !== 'true');
        var payableInput = inputs.find(inp => inp.dataset.isPayableValue === 'true');

        var args = normalInputs.map(function (input) {
            var val = input.value;
            var typ = input.dataset.type;
            if (typ.startsWith('uint') || typ.startsWith('int')) return val;
            if (typ === 'bool') return val.toLowerCase() === 'true';
            return val;
        });

        if (isRead) {
            var result = await contract[abiItem.name](...args);
            resultEl.style.display = 'block';
            resultEl.className = 'fn-result fn-result-success';
            // Format multi-return values
            if (Array.isArray(result)) {
                var parts = result.map(function (v) { return v.toString(); });
                resultEl.textContent = '→ ' + parts.join(', ');
            } else {
                resultEl.textContent = '→ ' + result.toString();
            }
        } else {
            var overrides = {};
            if (isPayable && payableInput && payableInput.value) {
                overrides.value = ethers.parseEther(payableInput.value);
            }
            var tx;
            if (Object.keys(overrides).length > 0) {
                tx = await contract[abiItem.name](...args, overrides);
            } else {
                tx = await contract[abiItem.name](...args);
            }

            resultEl.style.display = 'block';
            resultEl.className = 'fn-result';
            resultEl.textContent = '⏳ Tx: ' + shortAddr(tx.hash);
            await tx.wait();
            resultEl.className = 'fn-result fn-result-success';
            resultEl.textContent = '✔ Confirmed: ' + shortAddr(tx.hash);
            showToast('Transaction confirmed!');
        }
    } catch (e) {
        console.error("Execute Function Error:", e);
        var msg = e.message || 'Call failed';
        if (msg.includes('user rejected')) msg = 'Transaction rejected';
        // DO NOT truncate the error message anymore, the user explicitly requested to see the full error.
        resultEl.style.display = 'block';
        resultEl.className = 'fn-result fn-result-error';
        resultEl.textContent = '✘ ' + msg;
    }
    btn.disabled = false;
    btn.textContent = oldText;
}

// ==========================================
// LOAD EXISTING CONTRACT
// ==========================================

async function loadExistingContract() {
    var address = document.getElementById('existingAddr').value.trim();
    var templateKey = document.getElementById('existingTemplate').value;
    if (!address) { showToast('Enter a contract address.'); return; }

    var template = CONTRACT_TEMPLATES[templateKey];
    if (!template) { showToast('Unknown contract type.'); return; }

    if (contractState.walletMode === 'simulated') {
        contractState.simStorage[address] = contractState.simStorage[address] || {};
        initSimulatedState(templateKey, contractState.simStorage[address], []);
        var simContract = createSimulatedContract(templateKey, address);

        document.getElementById('deployResult').style.display = 'block';
        document.getElementById('deployedAddr').textContent = address;
        document.getElementById('deployStatus').textContent = '✔ Loaded (Simulated)';
        document.getElementById('deployStatus').className = 'badge badge-valid';
        document.getElementById('explorerLink').style.display = 'none';
        document.getElementById('verifyStatus').textContent = '';
        buildInteractionUI(template.abi, simContract);
        showToast('Contract loaded (simulated) at ' + shortAddr(address));
        return;
    }

    if (!contractState.signer) { showToast('Connect your wallet first!'); return; }

    try {
        var contract = new ethers.Contract(address, template.abi, contractState.signer);
        contractState.deployedAddress = address;
        contractState.deployedContract = contract;

        document.getElementById('deployResult').style.display = 'block';
        document.getElementById('deployedAddr').textContent = address;
        document.getElementById('deployStatus').textContent = '✔ Loaded';
        document.getElementById('deployStatus').className = 'badge badge-valid';
        updateExplorerLink(address);
        document.getElementById('verifyStatus').textContent = '';
        buildInteractionUI(template.abi, contract);
        showToast('Contract loaded at ' + shortAddr(address));
    } catch (e) {
        showToast('Error loading contract: ' + e.message);
    }
}

// ==========================================
// INIT
// ==========================================

function initContracts() {
    selectContract('storage');
    updateRpcUrl();
}

// ==========================================
// CONTRACT ACTION MODE (Deploy vs Load)
// ==========================================

function setContractActionMode(mode) {
    document.getElementById('modeDeploy').classList.toggle('active', mode === 'deploy');
    document.getElementById('modeLoad').classList.toggle('active', mode === 'load');
    document.getElementById('contractActionDeploy').style.display = mode === 'deploy' ? 'block' : 'none';
    document.getElementById('contractActionLoad').style.display = mode === 'load' ? 'block' : 'none';

    // Hide interaction section when switching modes to prevent confusion
    document.getElementById('interactionSection').style.display = 'none';

    // Clear out load address if switching
    if (mode === 'load') {
        document.getElementById('existingAddr').value = '';
    }
}
