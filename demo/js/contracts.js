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

var CONTRACT_LAB_TEMPLATES = [
    { key: 'storage', icon: '📦', label: 'Storage' },
    { key: 'counter', icon: '🔢', label: 'Counter' },
    { key: 'greeting', icon: '💬', label: 'Greeting' },
    { key: 'todolist', icon: '📝', label: 'TodoList' },
    { key: 'owner', icon: '👤', label: 'Owner' },
    { key: 'voting', icon: '🗳️', label: 'Voting' },
    { key: 'lottery', icon: '🎰', label: 'Lottery' },
    { key: 'token', icon: '🪙', label: 'Token' },
    { key: 'nft', icon: '🖼️', label: 'NFT' },
    { key: 'piggybank', icon: '🐷', label: 'PiggyBank' },
    { key: 'escrow', icon: '🤝', label: 'Escrow' },
    { key: 'crowdfund', icon: '🎯', label: 'Crowdfund' }
];

var ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function getContractTemplate(templateKey) {
    return CONTRACT_TEMPLATES && CONTRACT_TEMPLATES[templateKey] ? CONTRACT_TEMPLATES[templateKey] : null;
}

function parseConstructorArg(arg, index) {
    if (typeof arg === 'string') {
        var parts = arg.trim().split(/\s+/);
        var type = parts[0] || 'string';
        var name = parts.slice(1).join(' ') || 'Argument ' + (index + 1);
        return { name: name.replace(/^_/, ''), type: type, default: '' };
    }
    return {
        name: arg.name || 'Argument ' + (index + 1),
        type: arg.type || 'string',
        default: arg.default || ''
    };
}

function getConstructorDefinitions(template) {
    return (template.constructorArgs || []).map(parseConstructorArg);
}

function getConstructorAbi(template) {
    return (template.abi || []).find(function (item) { return item.type === 'constructor'; }) || null;
}

function hasPayableConstructor(template) {
    var constructorAbi = getConstructorAbi(template);
    return constructorAbi && constructorAbi.stateMutability === 'payable';
}

function hasPayableReceive(abi) {
    return (abi || []).some(function (item) {
        return (item.type === 'receive' || item.type === 'fallback') && item.stateMutability === 'payable';
    });
}

function isUintType(type) {
    return /^uint([0-9]+)?$/.test(type || '');
}

function isIntType(type) {
    return /^int([0-9]+)?$/.test(type || '');
}

function isAddressType(type) {
    return type === 'address' || type === 'address payable';
}

function sameAddress(a, b) {
    return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

function getDefaultInputValue(type, fallback) {
    if (fallback !== undefined && fallback !== null && fallback !== '') return String(fallback);
    if (isAddressType(type) && contractState.address) return contractState.address;
    if (isUintType(type) || isIntType(type)) return '0';
    if (type === 'bool') return 'false';
    return '';
}

function getInputPlaceholder(type) {
    if (isAddressType(type)) return '0x...';
    if (isUintType(type) || isIntType(type)) return '0';
    if (type === 'bool') return 'true / false';
    if (type === 'bytes4') return '0x01ffc9a7';
    if (type && type.indexOf('bytes') === 0) return '0x...';
    return type || 'value';
}

function parseTypedInput(value, type, fieldName, options) {
    options = options || {};
    var raw = String(value || '').trim();
    if (!raw && options.defaultValue !== undefined && options.defaultValue !== null && options.defaultValue !== '') {
        raw = String(options.defaultValue).trim();
    }

    if (isAddressType(type)) {
        if (!raw) throw new Error(fieldName + ' address is required.');
        if (!ethers.isAddress(raw)) throw new Error(fieldName + ' must be a valid Ethereum address.');
        return ethers.getAddress(raw);
    }

    if (isUintType(type) || isIntType(type)) {
        if (!raw) raw = '0';
        try {
            var n = BigInt(raw);
            if (isUintType(type) && n < 0n) throw new Error('negative');
            return n;
        } catch (e) {
            throw new Error(fieldName + ' must be an integer.');
        }
    }

    if (type === 'bool') {
        if (!raw) return false;
        if (['true', '1', 'yes', 'evet'].indexOf(raw.toLowerCase()) >= 0) return true;
        if (['false', '0', 'no', 'hayir', 'hayır'].indexOf(raw.toLowerCase()) >= 0) return false;
        throw new Error(fieldName + ' must be true or false.');
    }

    if ((type || '').indexOf('bytes') === 0) {
        if (!raw) return '0x';
        if (!/^0x[0-9a-fA-F]*$/.test(raw)) throw new Error(fieldName + ' must be hex data starting with 0x.');
        return raw;
    }

    return raw;
}

function getSimulatedConstructorFallbackArgs(template) {
    return getConstructorDefinitions(template).map(function (arg) {
        if (isAddressType(arg.type)) return contractState.address || ZERO_ADDRESS;
        return parseTypedInput('', arg.type, arg.name, { defaultValue: arg.default });
    });
}

function formatContractValue(value) {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'bigint') return value.toString();
    if (Array.isArray(value)) return value.map(formatContractValue).join(', ');
    if (typeof value === 'object' && typeof value.length === 'number') {
        return Array.prototype.map.call(value, formatContractValue).join(', ');
    }
    return String(value);
}

function getFunctionSignature(abiItem) {
    var inputTypes = (abiItem.inputs || []).map(function (input) { return input.type; }).join(',');
    return abiItem.name + '(' + inputTypes + ')';
}

function getContractFunction(contract, abiItem) {
    return contract[getFunctionSignature(abiItem)] || contract[abiItem.name];
}

function getDeployGasLimit(template) {
    var byteLength = Math.max(0, ((template.bytecode || '').length - 2) / 2);
    var fallback = Math.ceil(byteLength * 280 + 1200000);
    return BigInt(Math.min(Math.max(fallback, 3000000), 12000000));
}

function getConstructorValue() {
    var input = document.getElementById('constructorPayableValue');
    if (!input || !input.value.trim()) return 0n;
    try {
        return ethers.parseEther(input.value.trim());
    } catch (e) {
        throw new Error('Initial ETH value must be a valid ETH amount.');
    }
}

async function getDeployOverrides(factory, constructorArgs, template, baseOverrides) {
    baseOverrides = baseOverrides || {};
    var fallbackGas = getDeployGasLimit(template);
    try {
        var deployTx = await factory.getDeployTransaction(...constructorArgs);
        if (baseOverrides.value && baseOverrides.value > 0n) deployTx.value = baseOverrides.value;
        var estimated = await contractState.signer.estimateGas(deployTx);
        baseOverrides.gasLimit = (estimated * 120n) / 100n;
        return baseOverrides;
    } catch (e) {
        console.warn('[Contracts] Gas estimation failed, using fallback gas limit:', e);
        baseOverrides.gasLimit = fallbackGas;
        return baseOverrides;
    }
}

function renderContractTemplateControls() {
    var row = document.getElementById('contractTemplateGrid');
    var select = document.getElementById('existingTemplate');
    if (!row || !select || row.dataset.rendered === 'true') return;

    row.innerHTML = '';
    select.innerHTML = '';

    CONTRACT_LAB_TEMPLATES.forEach(function (meta, index) {
        var template = getContractTemplate(meta.key);
        if (!template) return;

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'contract-select-btn' + (index === 0 ? ' active' : '');
        btn.dataset.template = meta.key;
        btn.textContent = meta.icon + ' ' + meta.label;
        btn.onclick = function () { selectContract(meta.key); };
        row.appendChild(btn);

        var option = document.createElement('option');
        option.value = meta.key;
        option.textContent = meta.label + (template.name && template.name !== meta.label ? ' (' + template.name + ')' : '');
        select.appendChild(option);
    });

    row.dataset.rendered = 'true';
}

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
    if (contractState.selectedTemplate && !contractState.deployedAddress) {
        selectContract(contractState.selectedTemplate);
    }
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
    if (contractState.selectedTemplate && !contractState.deployedAddress) {
        selectContract(contractState.selectedTemplate);
    }
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
    var template = getContractTemplate(templateKey);
    if (!template) {
        showToast('Unknown contract template: ' + templateKey);
        return;
    }

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

    var constructorDefs = getConstructorDefinitions(template);
    if (constructorDefs.length > 0 || hasPayableConstructor(template)) {
        argsSection.style.display = 'block';
        constructorDefs.forEach(function (arg) {
            var group = document.createElement('div');
            group.className = 'form-group';
            group.style.marginBottom = '8px';
            var label = document.createElement('label');
            label.className = 'form-label';
            label.textContent = arg.name + ' (' + arg.type + ')';
            var input = document.createElement(arg.type === 'bool' ? 'select' : 'input');
            if (arg.type === 'bool') {
                var falseOpt = document.createElement('option');
                falseOpt.value = 'false';
                falseOpt.textContent = 'false';
                var trueOpt = document.createElement('option');
                trueOpt.value = 'true';
                trueOpt.textContent = 'true';
                input.appendChild(falseOpt);
                input.appendChild(trueOpt);
            } else {
                input.type = 'text';
                input.placeholder = getInputPlaceholder(arg.type);
            }
            input.className = 'form-input form-input-sm';
            input.value = getDefaultInputValue(arg.type, arg.default);
            input.dataset.argType = arg.type;
            input.dataset.argName = arg.name;
            input.dataset.defaultValue = arg.default || '';
            group.appendChild(label);
            group.appendChild(input);
            argsContainer.appendChild(group);
        });

        if (hasPayableConstructor(template)) {
            var valueGroup = document.createElement('div');
            valueGroup.className = 'form-group';
            valueGroup.style.marginBottom = '8px';
            var valueLabel = document.createElement('label');
            valueLabel.className = 'form-label';
            valueLabel.textContent = 'Initial ETH value (payable constructor)';
            var valueInput = document.createElement('input');
            valueInput.id = 'constructorPayableValue';
            valueInput.type = 'number';
            valueInput.min = '0';
            valueInput.step = '0.000000000000000001';
            valueInput.className = 'form-input form-input-sm';
            valueInput.placeholder = '0.01';
            valueInput.value = '';
            valueGroup.appendChild(valueLabel);
            valueGroup.appendChild(valueInput);
            argsContainer.appendChild(valueGroup);
        }
    } else {
        argsSection.style.display = 'none';
    }
}

// ==========================================
// DEPLOY
// ==========================================

function getConstructorArgs() {
    var args = [];
    document.querySelectorAll('#constructorArgsInputs [data-arg-type]').forEach(function (input) {
        args.push(parseTypedInput(
            input.value,
            input.dataset.argType,
            input.dataset.argName || 'Constructor argument',
            { defaultValue: input.dataset.defaultValue }
        ));
    });
    return args;
}

async function deployContract() {
    if (!contractState.signer && contractState.walletMode !== 'simulated') {
        showToast('Connect your wallet first!');
        return;
    }

    var templateKey = contractState.selectedTemplate;
    var template = getContractTemplate(templateKey);
    if (!template) {
        showToast('Unknown contract template: ' + templateKey);
        return;
    }
    var btn = document.getElementById('deployBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="mining-spinner"></span> Deploying...';

    if (contractState.walletMode === 'simulated') {
        try {
            await simulatedDeploy(templateKey, template, btn);
        } catch (e) {
            showToast('Error: ' + (e.message || e));
            btn.disabled = false;
            btn.textContent = 'Deploy Contract 🚀';
        }
        return;
    }

    try {
        var factory = new ethers.ContractFactory(template.abi, template.bytecode, contractState.signer);
        var constructorArgs = getConstructorArgs();
        var constructorValue = getConstructorValue();
        var deployOverrides = constructorValue > 0n ? { value: constructorValue } : {};
        var overrides = await getDeployOverrides(factory, constructorArgs, template, deployOverrides);

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
    var cArgs = getConstructorArgs();
    var constructorValue = getConstructorValue();
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
    initSimulatedState(templateKey, store, cArgs, constructorValue);

    var simContract = createSimulatedContract(templateKey, fakeAddress);
    contractState.deployedContract = simContract;
    buildInteractionUI(template.abi, simContract);
    showToast('Contract deployed (simulated) at ' + shortAddr(fakeAddress));

    btn.disabled = false;
    btn.textContent = 'Deploy Contract 🚀';
}

function initSimulatedState(templateKey, store, cArgs, constructorValue) {
    constructorValue = constructorValue || 0n;
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
        store._owner = contractState.address;
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
    } else if (templateKey === 'piggybank') {
        store._owner = contractState.address;
        store._balance = 0n;
    } else if (templateKey === 'escrow') {
        store._arbiter = cArgs[0];
        store._beneficiary = cArgs[1];
        store._depositor = contractState.address;
        store._isApproved = false;
        store._balance = constructorValue;
    } else if (templateKey === 'crowdfund') {
        store._creator = contractState.address;
        store._goal = BigInt(cArgs[0] || '0');
        store._pledged = 0n;
        store._claimed = false;
        store._pledges = {};
    }
}

function createSimulatedContract(templateKey, address) {
    var store = contractState.simStorage[address];
    var fakeTx = function () {
        var h = '0x' + bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
        return { hash: h, wait: async function () { await new Promise(function (r) { setTimeout(r, 300); }); } };
    };
    var delay = function () { return new Promise(function (r) { setTimeout(r, 400); }); };
    var msgValue = function (overrides) {
        return overrides && overrides.value ? BigInt(overrides.value) : 0n;
    };

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
            addProposal: async function (name) {
                if (!sameAddress(contractState.address, store._admin)) throw new Error('Only admin');
                await delay();
                store._proposals.push({ name: name, votes: 0n });
                return fakeTx();
            },
            vote: async function (id) {
                var i = Number(id);
                if (store._hasVoted[contractState.address]) throw new Error('Already voted');
                if (i >= store._proposals.length) throw new Error('Invalid proposal');
                await delay();
                store._hasVoted[contractState.address] = true;
                store._proposals[i].votes += 1n;
                return fakeTx();
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
                if (sameAddress(to, ZERO_ADDRESS)) throw new Error('Transfer to zero address');
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
                if (sameAddress(to, ZERO_ADDRESS)) throw new Error('Transfer to zero address');
                if ((store._balances[from] || 0n) < amt) throw new Error('Insufficient balance');
                var allowance = (store._allowances[from] && store._allowances[from][contractState.address]) || 0n;
                if (allowance < amt) throw new Error('Insufficient allowance');
                await delay();
                store._allowances[from][contractState.address] = allowance - amt;
                store._balances[from] = (store._balances[from] || 0n) - amt;
                store._balances[to] = (store._balances[to] || 0n) + amt;
                return fakeTx();
            },
            mint: async function (to, amount) {
                var amt = BigInt(amount);
                if (!sameAddress(contractState.address, store._owner) && store._owner) throw new Error('Only owner can mint');
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
            buyTicket: async function (overrides) {
                var paid = msgValue(overrides);
                if (paid < store._ticketPrice) throw new Error('Not enough ETH for ticket');
                await delay();
                store._players.push(contractState.address);
                store._balance += paid;
                return fakeTx();
            },
            pickWinner: async function () {
                if (!sameAddress(contractState.address, store._manager)) throw new Error('Only manager');
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

    if (templateKey === 'piggybank') {
        return {
            target: address,
            owner: async function () { return store._owner; },
            getBalance: async function () { return store._balance; },
            __receive: async function (amountWei) {
                var amount = BigInt(amountWei || 0);
                if (amount <= 0n) throw new Error('Enter an ETH amount greater than zero');
                await delay();
                store._balance += amount;
                return fakeTx();
            },
            withdraw: async function () {
                if (!sameAddress(contractState.address, store._owner)) throw new Error('Only owner can withdraw');
                if (store._balance <= 0n) throw new Error('Piggy bank is empty');
                await delay();
                store._balance = 0n;
                return fakeTx();
            }
        };
    }

    if (templateKey === 'escrow') {
        return {
            target: address,
            arbiter: async function () { return store._arbiter; },
            beneficiary: async function () { return store._beneficiary; },
            depositor: async function () { return store._depositor; },
            isApproved: async function () { return store._isApproved; },
            getBalance: async function () { return store._balance; },
            approve: async function () {
                if (!sameAddress(contractState.address, store._arbiter)) throw new Error('Only arbiter can approve');
                if (store._isApproved) throw new Error('Already approved');
                await delay();
                store._isApproved = true;
                store._balance = 0n;
                return fakeTx();
            },
            refund: async function () {
                if (!sameAddress(contractState.address, store._arbiter)) throw new Error('Only arbiter can refund');
                if (store._isApproved) throw new Error('Already approved');
                await delay();
                store._balance = 0n;
                return fakeTx();
            }
        };
    }

    if (templateKey === 'crowdfund') {
        return {
            target: address,
            creator: async function () { return store._creator; },
            goal: async function () { return store._goal; },
            pledged: async function () { return store._pledged; },
            claimed: async function () { return store._claimed; },
            pledges: async function (addr) { return store._pledges[addr] || 0n; },
            pledge: async function (overrides) {
                if (store._claimed) throw new Error('Funding is closed');
                var amount = msgValue(overrides);
                if (amount <= 0n) throw new Error('Enter a pledge amount greater than zero');
                await delay();
                store._pledges[contractState.address] = (store._pledges[contractState.address] || 0n) + amount;
                store._pledged += amount;
                return fakeTx();
            },
            claim: async function () {
                if (!sameAddress(contractState.address, store._creator)) throw new Error('Not creator');
                if (store._pledged < store._goal) throw new Error('Goal not reached yet');
                if (store._claimed) throw new Error('Already claimed');
                await delay();
                store._claimed = true;
                return fakeTx();
            },
            refund: async function () {
                if (store._pledged >= store._goal) throw new Error('Goal reached, no refunds');
                var amount = store._pledges[contractState.address] || 0n;
                if (amount <= 0n) throw new Error('No pledge to refund');
                await delay();
                store._pledges[contractState.address] = 0n;
                store._pledged -= amount;
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

function getSolcVerifyVersion(template) {
    var match = String(template.compiler || '').match(/\d+\.\d+\.\d+/);
    return 'v' + (match ? match[0] : '0.8.24') + '+commit.e11b9ed9';
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
        params.append('compilerversion', getSolcVerifyVersion(template));
        params.append('optimizationUsed', '0');
        params.append('runs', '200');
        params.append('licenseType', '3');
        var constructorDefs = getConstructorDefinitions(template);
        if (constructorDefs.length > 0) {
            var encodedArgs = ethers.AbiCoder.defaultAbiCoder()
                .encode(constructorDefs.map(function (arg) { return arg.type; }), getConstructorArgs())
                .replace(/^0x/, '');
            params.append('constructorArguements', encodedArgs);
        }
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
    var readFragment = document.createDocumentFragment();
    var writeFragment = document.createDocumentFragment();

    abi.forEach(function (item) {
        if (item.type !== 'function') return;
        var isRead = item.stateMutability === 'view' || item.stateMutability === 'pure';
        var fnCard = createFunctionCard(item, contract);
        if (isRead) { readFragment.appendChild(fnCard); readCount++; }
        else { writeFragment.appendChild(fnCard); writeCount++; }
    });

    if (hasPayableReceive(abi)) {
        writeFragment.appendChild(createReceiveCard(contract));
        writeCount++;
    }

    readContainer.appendChild(readFragment);
    writeContainer.appendChild(writeFragment);
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
    var nameEl = document.createElement('span');
    nameEl.className = 'fn-name';
    nameEl.textContent = abiItem.name;
    var badgeEl = document.createElement('span');
    badgeEl.className = 'badge ' + (isRead ? 'badge-valid' : 'badge-write');
    badgeEl.textContent = isRead ? 'view' : (isPayable ? 'payable' : 'write');
    header.appendChild(nameEl);
    header.appendChild(badgeEl);
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
            var input = document.createElement(inp.type === 'bool' ? 'select' : 'input');
            if (inp.type === 'bool') {
                ['false', 'true'].forEach(function (value) {
                    var opt = document.createElement('option');
                    opt.value = value;
                    opt.textContent = value;
                    input.appendChild(opt);
                });
            } else {
                input.type = 'text';
                input.placeholder = getInputPlaceholder(inp.type);
                if (isAddressType(inp.type) && contractState.address) {
                    input.value = contractState.address;
                } else if (isUintType(inp.type) || isIntType(inp.type)) {
                    input.value = '0';
                }
            }
            input.className = 'form-input form-input-sm';
            input.dataset.type = inp.type;
            input.dataset.name = inp.name || 'param' + idx;
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
        input.min = '0';
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

function createReceiveCard(contract) {
    var card = document.createElement('div');
    card.className = 'fn-card';

    var header = document.createElement('div');
    header.className = 'fn-header';
    var nameEl = document.createElement('span');
    nameEl.className = 'fn-name';
    nameEl.textContent = 'receive()';
    var badgeEl = document.createElement('span');
    badgeEl.className = 'badge badge-write';
    badgeEl.textContent = 'payable';
    header.appendChild(nameEl);
    header.appendChild(badgeEl);
    card.appendChild(header);

    var group = document.createElement('div');
    group.className = 'form-group';
    group.style.marginBottom = '8px';
    var label = document.createElement('label');
    label.className = 'form-label';
    label.style.color = 'var(--accent-orange)';
    label.textContent = 'ETH to send';
    var input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '0.000000000000000001';
    input.className = 'form-input form-input-sm';
    input.placeholder = '0.01';
    group.appendChild(label);
    group.appendChild(input);
    card.appendChild(group);

    var btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-orange';
    btn.textContent = 'Send ETH';
    var resultEl = document.createElement('div');
    resultEl.className = 'fn-result';
    resultEl.style.display = 'none';
    btn.onclick = function () { executeReceive(contract, input, btn, resultEl); };
    card.appendChild(btn);
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
            return parseTypedInput(input.value, input.dataset.type, input.dataset.name || 'Parameter');
        });
        var fn = getContractFunction(contract, abiItem);
        if (typeof fn !== 'function') throw new Error('Function not available in this contract instance.');

        if (isRead) {
            var result = await fn(...args);
            resultEl.style.display = 'block';
            resultEl.className = 'fn-result fn-result-success';
            resultEl.textContent = '→ ' + formatContractValue(result);
        } else {
            var overrides = {};
            if (isPayable && payableInput && payableInput.value) {
                overrides.value = ethers.parseEther(payableInput.value);
            }
            var tx;
            if (Object.keys(overrides).length > 0) {
                tx = await fn(...args, overrides);
            } else {
                tx = await fn(...args);
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

async function executeReceive(contract, input, btn, resultEl) {
    var oldText = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="mining-spinner"></span>';

    try {
        if (!input.value) throw new Error('Enter an ETH amount.');
        var value = ethers.parseEther(input.value);
        var tx;
        if (contractState.walletMode === 'simulated') {
            if (typeof contract.__receive !== 'function') throw new Error('This simulated contract cannot receive ETH.');
            tx = await contract.__receive(value);
        } else {
            if (!contractState.signer) throw new Error('Connect your wallet first.');
            tx = await contractState.signer.sendTransaction({ to: contract.target, value: value });
        }

        resultEl.style.display = 'block';
        resultEl.className = 'fn-result';
        resultEl.textContent = '⏳ Tx: ' + shortAddr(tx.hash);
        await tx.wait();
        resultEl.className = 'fn-result fn-result-success';
        resultEl.textContent = '✔ Confirmed: ' + shortAddr(tx.hash);
        showToast('ETH sent to contract!');
    } catch (e) {
        resultEl.style.display = 'block';
        resultEl.className = 'fn-result fn-result-error';
        resultEl.textContent = '✘ ' + (e.message || 'Transfer failed');
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
    if (!ethers.isAddress(address)) { showToast('Enter a valid Ethereum address.'); return; }
    address = ethers.getAddress(address);

    var template = getContractTemplate(templateKey);
    if (!template) { showToast('Unknown contract type.'); return; }

    if (contractState.walletMode === 'simulated') {
        contractState.simStorage[address] = contractState.simStorage[address] || {};
        initSimulatedState(templateKey, contractState.simStorage[address], getSimulatedConstructorFallbackArgs(template), 0n);
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
    renderContractTemplateControls();
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
