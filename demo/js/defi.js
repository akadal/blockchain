/* ========================================
   Section 14 — DeFi Simulator & Web3 AMM
   ======================================== */

// Global DeFi State
var defi = {
    initialized: false,
    mode: 'simulated', // 'simulated' or 'web3'

    // --- Simulated State ---
    tokenA: { name: 'ETH', symbol: 'ETH' },
    tokenB: { name: 'DAI', symbol: 'DAI' },
    pool: { reserveA: 0, reserveB: 0, k: 0, feeRate: 0.003, totalLP: 0, feesEarnedA: 0, feesEarnedB: 0, totalVolume: 0 },
    user: { balA: 10, balB: 10000, lpTokens: 0, stakedLP: 0, farmReward: 0, farmStakedAt: 0 },
    lending: { deposited: 0, borrowed: 0, collateralRatio: 150, interestRate: 5, depositAPY: 3 },
    farm: { rewardToken: 'FARM', rewardRate: 50, totalStaked: 0 },
    priceHistory: [],
    swapHistory: [],
    eventLog: [],

    // --- Web3 State ---
    web3: {
        provider: null,
        signer: null,
        address: null,
        chainId: null,
        ammContract: null,
        tokenAContract: null,
        tokenBContract: null,
        lendingContract: null,
        farmContract: null,
        rewardTokenContract: null,
        resA: 0n,
        resB: 0n,
        totalShares: 0n,
        userBalA: 0n,
        userBalB: 0n,
        userShares: 0n,
        symbolA: 'TKA',
        symbolB: 'TKB',
        collateral: 0n,
        borrowed: 0n,
        health: "∞",
        stakedLP: 0n,
        pendingFarm: 0n
    }
};

// ==========================================
// INIT & MODE SWITCH
// ==========================================

function initDeFi() {
    if (defi.initialized) return;
    defi.initialized = true;

    // Init Simulated
    defi.pool.reserveA = 100;
    defi.pool.reserveB = 100000;
    defi.pool.k = defi.pool.reserveA * defi.pool.reserveB;
    defi.pool.totalLP = Math.sqrt(defi.pool.reserveA * defi.pool.reserveB);
    defi.priceHistory = [{ time: Date.now(), price: defi.pool.reserveB / defi.pool.reserveA }];

    updateDefiUI();
}

window.setDefiMode = function(mode) {
    defi.mode = mode;
    document.getElementById('defiModeSimulated').classList.toggle('active', mode === 'simulated');
    document.getElementById('defiModeWeb3').classList.toggle('active', mode === 'web3');

    document.getElementById('defiSimulatedContainer').style.display = mode === 'simulated' ? 'block' : 'none';
    document.getElementById('defiWeb3Container').style.display = mode === 'web3' ? 'block' : 'none';

    if (mode === 'simulated') {
        updateDefiUI();
    } else {
        updateWeb3DefiUI();
    }
};


// ==========================================
// SIMULATED: AMM SWAP
// ==========================================

window.defiSwap = function() {
    var direction = document.getElementById('defiSwapDir').value;
    var amount = parseFloat(document.getElementById('defiSwapAmount').value);
    if (!amount || amount <= 0) { showToast('Enter amount to swap'); return; }

    var p = defi.pool;
    if (direction === 'AtoB') {
        if (defi.user.balA < amount) { showToast('Insufficient ' + defi.tokenA.symbol); return; }
        var fee = amount * p.feeRate;
        var amountIn = amount - fee;
        var newReserveA = p.reserveA + amountIn;
        var newReserveB = p.k / newReserveA;
        var amountOut = p.reserveB - newReserveB;

        defi.user.balA -= amount;
        defi.user.balB += amountOut;
        p.reserveA = newReserveA;
        p.reserveB = newReserveB;
        p.feesEarnedA += fee;
        p.totalVolume += amount;

        var rate = (amountOut / amount).toFixed(2);
        defiLog('swap', 'Swapped ' + fmtD(amount) + ' ' + defi.tokenA.symbol + ' → ' + fmtD(amountOut) + ' ' + defi.tokenB.symbol + ' (rate: 1:' + rate + ')');
    } else {
        if (defi.user.balB < amount) { showToast('Insufficient ' + defi.tokenB.symbol); return; }
        var fee = amount * p.feeRate;
        var amountIn = amount - fee;
        var newReserveB = p.reserveB + amountIn;
        var newReserveA = p.k / newReserveB;
        var amountOut = p.reserveA - newReserveA;

        defi.user.balB -= amount;
        defi.user.balA += amountOut;
        p.reserveB = newReserveB;
        p.reserveA = newReserveA;
        p.feesEarnedB += fee;
        p.totalVolume += amount;

        var rate = (amountOut / amount).toFixed(6);
        defiLog('swap', 'Swapped ' + fmtD(amount) + ' ' + defi.tokenB.symbol + ' → ' + fmtD(amountOut) + ' ' + defi.tokenA.symbol + ' (rate: ' + rate + ')');
    }

    var price = p.reserveB / p.reserveA;
    defi.priceHistory.push({ time: Date.now(), price: price });
    if (defi.priceHistory.length > 100) defi.priceHistory.shift();

    document.getElementById('defiSwapAmount').value = '';
    updateDefiUI();
    drawDefiChart();
    showToast('Swap completed!');
};

window.defiCalcPreview = function() {
    var direction = document.getElementById('defiSwapDir').value;
    var amount = parseFloat(document.getElementById('defiSwapAmount').value) || 0;
    var preview = document.getElementById('defiSwapPreview');
    if (!amount || amount <= 0) { preview.textContent = '—'; return; }

    var p = defi.pool;
    if (direction === 'AtoB') {
        var fee = amount * p.feeRate;
        var amountIn = amount - fee;
        var newReserveA = p.reserveA + amountIn;
        var output = p.reserveB - (p.k / newReserveA);
        var impact = ((amount / p.reserveA) * 100).toFixed(2);
        preview.innerHTML = '≈ ' + fmtD(output) + ' ' + defi.tokenB.symbol + ' <span style="color:var(--text-muted);font-size:11px;">(fee: ' + fmtD(fee) + ', impact: ' + impact + '%)</span>';
    } else {
        var fee = amount * p.feeRate;
        var amountIn = amount - fee;
        var newReserveB = p.reserveB + amountIn;
        var output = p.reserveA - (p.k / newReserveB);
        var impact = ((amount / p.reserveB) * 100).toFixed(2);
        preview.innerHTML = '≈ ' + fmtD(output) + ' ' + defi.tokenA.symbol + ' <span style="color:var(--text-muted);font-size:11px;">(fee: ' + fmtD(fee) + ', impact: ' + impact + '%)</span>';
    }
};

// ==========================================
// SIMULATED: LIQUIDITY
// ==========================================

window.defiAddLiquidity = function() {
    var amtA = parseFloat(document.getElementById('defiLiqA').value);
    if (!amtA || amtA <= 0) { showToast('Enter ' + defi.tokenA.symbol + ' amount'); return; }

    var p = defi.pool;
    var ratio = p.reserveB / p.reserveA;
    var amtB = amtA * ratio;

    if (defi.user.balA < amtA) { showToast('Insufficient ' + defi.tokenA.symbol); return; }
    if (defi.user.balB < amtB) { showToast('Insufficient ' + defi.tokenB.symbol + ' (need ' + fmtD(amtB) + ')'); return; }

    var lpMinted = (amtA / p.reserveA) * p.totalLP;

    defi.user.balA -= amtA;
    defi.user.balB -= amtB;
    p.reserveA += amtA;
    p.reserveB += amtB;
    p.k = p.reserveA * p.reserveB;
    p.totalLP += lpMinted;
    defi.user.lpTokens += lpMinted;

    defiLog('liquidity', 'Added liquidity: ' + fmtD(amtA) + ' ' + defi.tokenA.symbol + ' + ' + fmtD(amtB) + ' ' + defi.tokenB.symbol + ' → ' + fmtD(lpMinted) + ' LP');
    document.getElementById('defiLiqA').value = '';
    updateDefiUI();
    showToast('Liquidity added!');
};

window.defiRemoveLiquidity = function() {
    var lpAmt = parseFloat(document.getElementById('defiRemoveLP').value);
    if (!lpAmt || lpAmt <= 0) { showToast('Enter LP amount'); return; }
    if (defi.user.lpTokens < lpAmt) { showToast('Insufficient LP tokens'); return; }

    var p = defi.pool;
    var share = lpAmt / p.totalLP;
    var outA = p.reserveA * share;
    var outB = p.reserveB * share;

    defi.user.lpTokens -= lpAmt;
    defi.user.balA += outA;
    defi.user.balB += outB;
    p.reserveA -= outA;
    p.reserveB -= outB;
    p.totalLP -= lpAmt;
    p.k = p.reserveA * p.reserveB;

    defiLog('liquidity', 'Removed ' + fmtD(lpAmt) + ' LP → ' + fmtD(outA) + ' ' + defi.tokenA.symbol + ' + ' + fmtD(outB) + ' ' + defi.tokenB.symbol);
    document.getElementById('defiRemoveLP').value = '';
    updateDefiUI();
    showToast('Liquidity removed!');
};

// ==========================================
// SIMULATED: LENDING / YIELD FARMING (UNCHANGED)
// ==========================================

window.defiDeposit = function() {
    var amount = parseFloat(document.getElementById('defiDepositAmt').value);
    if (!amount || amount <= 0) { showToast('Enter deposit amount'); return; }
    if (defi.user.balB < amount) { showToast('Insufficient ' + defi.tokenB.symbol); return; }
    defi.user.balB -= amount;
    defi.lending.deposited += amount;
    defiLog('lend', 'Deposited ' + fmtD(amount) + ' ' + defi.tokenB.symbol + ' as collateral');
    document.getElementById('defiDepositAmt').value = '';
    updateDefiUI();
    showToast('Deposited!');
};

window.defiBorrow = function() {
    var amount = parseFloat(document.getElementById('defiBorrowAmt').value);
    if (!amount || amount <= 0) { showToast('Enter borrow amount'); return; }
    var maxBorrow = (defi.lending.deposited / (defi.lending.collateralRatio / 100)) - defi.lending.borrowed;
    if (amount > maxBorrow) { showToast('Max borrow: ' + fmtD(maxBorrow) + ' ' + defi.tokenB.symbol + ' (need ' + defi.lending.collateralRatio + '% collateral)'); return; }
    defi.lending.borrowed += amount;
    defi.user.balB += amount;
    defiLog('borrow', 'Borrowed ' + fmtD(amount) + ' ' + defi.tokenB.symbol + ' at ' + defi.lending.interestRate + '% APR');
    document.getElementById('defiBorrowAmt').value = '';
    updateDefiUI();
    showToast('Borrowed!');
};

window.defiRepay = function() {
    var amount = parseFloat(document.getElementById('defiRepayAmt').value);
    if (!amount || amount <= 0) { showToast('Enter repay amount'); return; }
    if (amount > defi.lending.borrowed) amount = defi.lending.borrowed;
    if (defi.user.balB < amount) { showToast('Insufficient balance'); return; }
    defi.user.balB -= amount;
    defi.lending.borrowed -= amount;
    defiLog('repay', 'Repaid ' + fmtD(amount) + ' ' + defi.tokenB.symbol);
    document.getElementById('defiRepayAmt').value = '';
    updateDefiUI();
    showToast('Repaid!');
};

window.defiWithdrawCollateral = function() {
    var minCollateral = defi.lending.borrowed * (defi.lending.collateralRatio / 100);
    var withdrawable = defi.lending.deposited - minCollateral;
    if (withdrawable <= 0) { showToast('Cannot withdraw — collateral locked'); return; }
    defi.lending.deposited -= withdrawable;
    defi.user.balB += withdrawable;
    defiLog('withdraw', 'Withdrew ' + fmtD(withdrawable) + ' ' + defi.tokenB.symbol + ' collateral');
    updateDefiUI();
    showToast('Collateral withdrawn!');
};

window.defiFarmStake = function() {
    var amount = parseFloat(document.getElementById('defiFarmAmt').value);
    if (!amount || amount <= 0) { showToast('Enter LP amount to stake'); return; }
    if (defi.user.lpTokens < amount) { showToast('Insufficient LP tokens'); return; }
    defiFarmHarvestInternal();
    defi.user.lpTokens -= amount;
    defi.user.stakedLP += amount;
    defi.farm.totalStaked += amount;
    defi.user.farmStakedAt = Date.now();
    defiLog('farm', 'Staked ' + fmtD(amount) + ' LP tokens in yield farm');
    document.getElementById('defiFarmAmt').value = '';
    updateDefiUI();
    showToast('LP tokens staked in farm!');
};

window.defiFarmUnstake = function() {
    if (defi.user.stakedLP <= 0) { showToast('Nothing staked'); return; }
    defiFarmHarvestInternal();
    var amount = defi.user.stakedLP;
    defi.user.lpTokens += amount;
    defi.farm.totalStaked -= amount;
    defi.user.stakedLP = 0;
    defi.user.farmStakedAt = 0;
    defiLog('farm', 'Unstaked ' + fmtD(amount) + ' LP from farm + claimed rewards');
    updateDefiUI();
    showToast('Unstaked from farm!');
};

function defiFarmHarvestInternal() {
    if (defi.user.stakedLP <= 0 || defi.user.farmStakedAt <= 0) return;
    var elapsed = (Date.now() - defi.user.farmStakedAt) / 1000;
    var reward = (defi.user.stakedLP / Math.max(defi.farm.totalStaked, 1)) * defi.farm.rewardRate * (elapsed / 365);
    defi.user.farmReward += reward;
    defi.user.farmStakedAt = Date.now();
}

window.defiFarmHarvest = function() {
    defiFarmHarvestInternal();
    var reward = defi.user.farmReward;
    if (reward <= 0.01) { showToast('No rewards to harvest'); return; }
    defi.user.farmReward = 0;
    defiLog('harvest', 'Harvested ' + fmtD(reward) + ' ' + defi.farm.rewardToken + ' from yield farm');
    updateDefiUI();
    showToast(fmtD(reward) + ' ' + defi.farm.rewardToken + ' harvested!');
};


// ==========================================
// SIMULATED UI UPDATES
// ==========================================

function updateDefiUI() {
    if (defi.mode !== 'simulated') return;

    var p = defi.pool;
    var price = p.reserveA > 0 ? (p.reserveB / p.reserveA) : 0;
    var tvl = p.reserveA * price + p.reserveB;

    setT('defiPrice', '1 ' + defi.tokenA.symbol + ' = ' + fmtD(price) + ' ' + defi.tokenB.symbol);
    setT('defiTVL', '$' + fmtD(tvl));
    setT('defiVolume', '$' + fmtD(p.totalVolume));
    setT('defiPoolA', fmtD(p.reserveA) + ' ' + defi.tokenA.symbol);
    setT('defiPoolB', fmtD(p.reserveB) + ' ' + defi.tokenB.symbol);
    setT('defiTotalLP', fmtD(p.totalLP));
    setT('defiFees', fmtD(p.feesEarnedA) + ' ' + defi.tokenA.symbol + ' + ' + fmtD(p.feesEarnedB) + ' ' + defi.tokenB.symbol);

    setT('defiBalA', fmtD(defi.user.balA) + ' ' + defi.tokenA.symbol);
    setT('defiBalB', fmtD(defi.user.balB) + ' ' + defi.tokenB.symbol);
    setT('defiUserLP', fmtD(defi.user.lpTokens));

    setT('defiDeposited', fmtD(defi.lending.deposited) + ' ' + defi.tokenB.symbol);
    setT('defiBorrowed', fmtD(defi.lending.borrowed) + ' ' + defi.tokenB.symbol);
    var healthRatio = defi.lending.borrowed > 0 ? ((defi.lending.deposited / defi.lending.borrowed) * 100).toFixed(0) : '∞';
    var healthEl = document.getElementById('defiHealth');
    if (healthEl) {
        healthEl.textContent = healthRatio + '%';
        healthEl.style.color = healthRatio === '∞' || parseInt(healthRatio) > 150 ? 'var(--accent-green)' : parseInt(healthRatio) > 120 ? 'var(--accent-orange)' : 'var(--accent-red)';
    }
    var maxBorrow = Math.max(0, (defi.lending.deposited / (defi.lending.collateralRatio / 100)) - defi.lending.borrowed);
    setT('defiMaxBorrow', fmtD(maxBorrow) + ' ' + defi.tokenB.symbol);

    defiFarmHarvestInternal();
    setT('defiFarmStaked', fmtD(defi.user.stakedLP) + ' LP');
    setT('defiFarmPending', fmtD(defi.user.farmReward) + ' ' + defi.farm.rewardToken);
    setT('defiFarmAPY', defi.farm.rewardRate + '%');

    if (defi.user.stakedLP > 0) {
        if (!defi._farmTimer) {
            defi._farmTimer = setInterval(function () {
                if (!defi.initialized || defi.user.stakedLP <= 0 || defi.mode !== 'simulated') { clearInterval(defi._farmTimer); defi._farmTimer = null; return; }
                defiFarmHarvestInternal();
                setT('defiFarmPending', fmtD(defi.user.farmReward) + ' ' + defi.farm.rewardToken);
            }, 1000);
        }
    }

    var logEl = document.getElementById('defiEventLog');
    if (logEl) {
        logEl.innerHTML = '';
        defi.eventLog.slice().reverse().forEach(function (ev) {
            var icons = { swap: '🔄', liquidity: '💧', lend: '🏦', borrow: '💳', repay: '✅', withdraw: '📤', farm: '🌾', harvest: '🌻' };
            var div = document.createElement('div');
            div.className = 'te-event';
            div.innerHTML = '<span class="te-event-badge">' + (icons[ev.type] || '📋') + '</span><span class="te-event-msg">' + ev.msg + '</span><span class="te-event-time">' + ev.time + '</span>';
            logEl.appendChild(div);
        });
    }
}

function drawDefiChart() {
    var canvas = document.getElementById('defiPriceChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
    var H = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    var w = canvas.offsetWidth; var h = canvas.offsetHeight;
    ctx.clearRect(0, 0, w, h);

    var data = defi.priceHistory;
    if (data.length < 2) return;

    var prices = data.map(function (d) { return d.price; });
    var minP = Math.min.apply(null, prices) * 0.9;
    var maxP = Math.max.apply(null, prices) * 1.1;
    if (maxP === minP) maxP = minP + 1;

    var pad = { top: 20, right: 10, bottom: 25, left: 55 };
    var plotW = w - pad.left - pad.right;
    var plotH = h - pad.top - pad.bottom;

    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-subtle').trim() || '#21262d';
    ctx.lineWidth = 0.5;
    for (var g = 0; g <= 4; g++) {
        var gy = pad.top + plotH * (1 - g / 4);
        ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(w - pad.right, gy); ctx.stroke();
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#484f58';
        ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(fmtD(minP + (maxP - minP) * (g / 4)), pad.left - 4, gy + 3);
    }

    ctx.beginPath(); ctx.strokeStyle = '#3fb950'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    for (var i = 0; i < data.length; i++) {
        var x = pad.left + (i / (data.length - 1)) * plotW;
        var y = pad.top + plotH * (1 - (data[i].price - minP) / (maxP - minP));
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    var grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    grad.addColorStop(0, 'rgba(63, 185, 80, 0.2)');
    grad.addColorStop(1, 'rgba(63, 185, 80, 0.01)');
    ctx.lineTo(pad.left + plotW, pad.top + plotH);
    ctx.lineTo(pad.left, pad.top + plotH);
    ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
}


// ==========================================
// WEB3: INIT & WALLET CONNECTION
// ==========================================

window.web3DefiConnectWallet = async function() {
    let providerSource = window.ethereum;

    if (typeof providerSource === 'undefined') {
        showToast("MetaMask not found!");
        return;
    }

    var btn = document.getElementById('web3DefiConnectBtn');
    btn.disabled = true;
    btn.textContent = 'Connecting...';

    try {
        // Find the real MetaMask
        if (providerSource.providers && providerSource.providers.length > 0) {
            const mmProvider = providerSource.providers.find(p => p.isMetaMask && !p.isBraveWallet && !p.isCoinbaseWallet);
            if (mmProvider) {
                providerSource = mmProvider;
            }
        }

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

        var provider = new ethers.BrowserProvider(providerSource, "any");
        var signer = await provider.getSigner();
        var network = await provider.getNetwork();

        defi.web3.provider = provider;
        defi.web3.signer = signer;
        defi.web3.address = accounts[0];
        defi.web3.chainId = Number(network.chainId);

        document.getElementById('web3DefiWalletSection').style.display = 'none';
        document.getElementById('web3DefiAmmSection').style.display = 'block';

        setT('web3DefiWalletAddr', shortAddrDeFi(defi.web3.address));
        setT('web3DefiNetwork', defi.web3.chainId);

        showToast("Wallet connected");

        // Listeners
        if (typeof providerSource.removeAllListeners === 'function') {
            providerSource.removeAllListeners('accountsChanged');
            providerSource.removeAllListeners('chainChanged');
        }
        providerSource.on('accountsChanged', function(accs) {
            if (accs.length === 0) window.location.reload();
            else {
                defi.web3.address = accs[0];
                setT('web3DefiWalletAddr', shortAddrDeFi(accs[0]));
            }
        });
        providerSource.on('chainChanged', function() { window.location.reload(); });

    } catch (e) {
        console.error(e);
        let errorMsg = e.message || e;
        if (errorMsg.includes('timed out')) {
            errorMsg = "Conflicting wallet extension detected! Please disable other crypto wallets.";
        }
        showToast("Connection failed: " + errorMsg);

        btn.disabled = false;
        btn.textContent = 'Connect MetaMask 🦊';
    }
};

// ==========================================
// WEB3: DEPLOY & LOAD CONTRACTS
// ==========================================

window.web3DefiDeployAmm = async function() {
    if (!defi.web3.signer) return;
    try {
        var btn = document.getElementById('web3DefiDeployBtn');
        btn.disabled = true;
        btn.textContent = "Deploying Token A...";

        var tData = CONTRACT_TEMPLATES['token'];
        var aData = CONTRACT_TEMPLATES['simpleamm'];
        var lData = CONTRACT_TEMPLATES['simplelending'];
        var fData = CONTRACT_TEMPLATES['simpleyieldfarm'];

        var TokenFactory = new ethers.ContractFactory(tData.abi, tData.bytecode, defi.web3.signer);

        // Deploy Token A
        var tokenA = await TokenFactory.deploy("Token A", "TKA", 1000000, { gasLimit: 3000000 });
        await tokenA.waitForDeployment();
        var addrA = await tokenA.getAddress();

        btn.textContent = "Deploying Token B...";

        // Deploy Token B
        var tokenB = await TokenFactory.deploy("Token B", "TKB", 1000000, { gasLimit: 3000000 });
        await tokenB.waitForDeployment();
        var addrB = await tokenB.getAddress();

        btn.textContent = "Deploying AMM...";

        // Deploy AMM
        var AmmFactory = new ethers.ContractFactory(aData.abi, aData.bytecode, defi.web3.signer);
        var amm = await AmmFactory.deploy(addrA, addrB, { gasLimit: 3000000 });
        await amm.waitForDeployment();
        var addrAmm = await amm.getAddress();

        btn.textContent = "Deploying Lending...";
        var LendingFactory = new ethers.ContractFactory(lData.abi, lData.bytecode, defi.web3.signer);
        var lending = await LendingFactory.deploy(addrA, { gasLimit: 3000000 });
        await lending.waitForDeployment();
        var addrLending = await lending.getAddress();

        btn.textContent = "Deploying Reward Token...";
        var rewardToken = await TokenFactory.deploy("Farm Reward", "FARM", 1000000, { gasLimit: 3000000 });
        await rewardToken.waitForDeployment();
        var addrReward = await rewardToken.getAddress();

        btn.textContent = "Deploying Yield Farm...";
        var FarmFactory = new ethers.ContractFactory(fData.abi, fData.bytecode, defi.web3.signer);
        // SimpleYieldFarm(address _lpToken, address _rewardToken)
        var farm = await FarmFactory.deploy(addrAmm, addrReward, { gasLimit: 3000000 });
        await farm.waitForDeployment();
        var addrFarm = await farm.getAddress();

        // Transfer reward tokens to farm
        btn.textContent = "Funding Farm...";
        var txFund = await rewardToken.mint(defi.web3.address, ethers.parseUnits("1000000", 18));
        await txFund.wait();
        var txTrans = await rewardToken.transfer(addrFarm, ethers.parseUnits("1000000", 18));
        await txTrans.wait();

        showToast("Successfully deployed entire DeFi bundle!");
        document.getElementById('web3DefiAmmAddr').value = addrAmm;

        await web3DefiLoadAmmContract(addrAmm, addrA, addrB, addrLending, addrFarm, addrReward);

    } catch (e) {
        console.error(e);
        showToast("Deployment failed: " + e.message);
    } finally {
        var btn = document.getElementById('web3DefiDeployBtn');
        btn.disabled = false;
        btn.textContent = "Deploy AMM Bundle 🚀";
    }
};

window.web3DefiLoadAmm = async function() {
    var addr = document.getElementById('web3DefiAmmAddr').value.trim();
    if (!addr) { showToast("Enter AMM address"); return; }

    try {
        var btn = document.getElementById('web3DefiLoadBtn');
        btn.disabled = true;
        btn.textContent = "Loading...";

        var aData = CONTRACT_TEMPLATES['simpleamm'];
        var amm = new ethers.Contract(addr, aData.abi, defi.web3.signer);

        var addrA = await amm.tokenA();
        var addrB = await amm.tokenB();

        await web3DefiLoadAmmContract(addr, addrA, addrB);
        showToast("AMM Loaded");
    } catch (e) {
        console.error(e);
        showToast("Failed to load AMM: " + e.message);
    } finally {
        var btn = document.getElementById('web3DefiLoadBtn');
        btn.disabled = false;
        btn.textContent = "Load AMM ⬇️";
    }
};

async function web3DefiLoadAmmContract(ammAddr, tokenAAddr, tokenBAddr, lendingAddr, farmAddr, rewardAddr) {
    var aData = CONTRACT_TEMPLATES['simpleamm'];
    var tData = CONTRACT_TEMPLATES['token'];
    var lData = CONTRACT_TEMPLATES['simplelending'];
    var fData = CONTRACT_TEMPLATES['simpleyieldfarm'];

    defi.web3.ammContract = new ethers.Contract(ammAddr, aData.abi, defi.web3.signer);
    defi.web3.tokenAContract = new ethers.Contract(tokenAAddr, tData.abi, defi.web3.signer);
    defi.web3.tokenBContract = new ethers.Contract(tokenBAddr, tData.abi, defi.web3.signer);

    if (lendingAddr) {
        defi.web3.lendingContract = new ethers.Contract(lendingAddr, lData.abi, defi.web3.signer);
    }
    if (farmAddr) {
        defi.web3.farmContract = new ethers.Contract(farmAddr, fData.abi, defi.web3.signer);
        defi.web3.rewardTokenContract = new ethers.Contract(rewardAddr, tData.abi, defi.web3.signer);
    }

    // Get symbols
    defi.web3.symbolA = await defi.web3.tokenAContract.symbol();
    defi.web3.symbolB = await defi.web3.tokenBContract.symbol();

    setT('web3DefiSymbolA', defi.web3.symbolA);
    setT('web3DefiSymbolB', defi.web3.symbolB);

    // Update select options
    var dirSel = document.getElementById('web3DefiSwapDir');
    dirSel.options[0].text = defi.web3.symbolA + " \u2192 " + defi.web3.symbolB;
    dirSel.options[1].text = defi.web3.symbolB + " \u2192 " + defi.web3.symbolA;

    document.getElementById('web3DefiAmmSection').style.display = 'none';
    document.getElementById('web3DefiInteractionContainer').style.display = 'block';

    await web3DefiRefreshPool();
}

// ==========================================
// WEB3: FETCH DATA & UI
// ==========================================

window.web3DefiRefreshPool = async function() {
    if (!defi.web3.ammContract) return;

    try {
        // Pool stats
        defi.web3.resA = await defi.web3.ammContract.reserveA();
        defi.web3.resB = await defi.web3.ammContract.reserveB();
        defi.web3.totalShares = await defi.web3.ammContract.totalSupply();

        // User stats
        defi.web3.userBalA = await defi.web3.tokenAContract.balanceOf(defi.web3.address);
        defi.web3.userBalB = await defi.web3.tokenBContract.balanceOf(defi.web3.address);
        defi.web3.userShares = await defi.web3.ammContract.balanceOf(defi.web3.address);

        // Lending stats
        if (defi.web3.lendingContract) {
            defi.web3.collateral = await defi.web3.lendingContract.collateral(defi.web3.address);
            defi.web3.borrowed = await defi.web3.lendingContract.borrowed(defi.web3.address);
            
            var colVal = parseFloat(ethers.formatUnits(defi.web3.collateral, 18));
            var borVal = parseFloat(ethers.formatUnits(defi.web3.borrowed, 18));
            
            if (borVal > 0) {
                // Simplified health factor: (collateral / borrowed) * (100 / collateralRatio)
                // Contract uses 150 (ratio)
                var health = (colVal / (borVal * 1.5)) * 100;
                defi.web3.health = health.toFixed(0) + "%";
            } else {
                defi.web3.health = "∞";
            }
        }

        // Farm stats
        if (defi.web3.farmContract) {
            defi.web3.stakedLP = await defi.web3.farmContract.stakedBalance(defi.web3.address);
            defi.web3.pendingFarm = await defi.web3.farmContract.pendingRewards(defi.web3.address);
        }

        updateWeb3DefiUI();
    } catch(e) {
        console.error(e);
        showToast("Error fetching pool data");
    }
};

function updateWeb3DefiUI() {
    if (defi.mode !== 'web3' || !defi.web3.ammContract) return;

    setT('web3DefiReserveA', ethers.formatUnits(defi.web3.resA, 18));
    setT('web3DefiReserveB', ethers.formatUnits(defi.web3.resB, 18));
    setT('web3DefiTotalShares', ethers.formatUnits(defi.web3.totalShares, 18));

    setT('web3DefiUserBalA', ethers.formatUnits(defi.web3.userBalA, 18) + ' ' + defi.web3.symbolA);
    setT('web3DefiUserBalB', ethers.formatUnits(defi.web3.userBalB, 18) + ' ' + defi.web3.symbolB);
    setT('web3DefiUserShares', ethers.formatUnits(defi.web3.userShares, 18));

    setT('web3DefiCollateral', ethers.formatUnits(defi.web3.collateral, 18));
    setT('web3DefiBorrowed', ethers.formatUnits(defi.web3.borrowed, 18));
    setT('web3DefiHealth', defi.web3.health);

    setT('web3DefiStakedLP', ethers.formatUnits(defi.web3.stakedLP, 18));
    setT('web3DefiPendingFarm', ethers.formatUnits(defi.web3.pendingFarm, 18));
}

window.web3DefiCalcPreview = async function() {
    var amtStr = document.getElementById('web3DefiSwapAmount').value;
    var preview = document.getElementById('web3DefiSwapPreview');
    var dir = document.getElementById('web3DefiSwapDir').value;

    if (!amtStr || parseFloat(amtStr) <= 0 || !defi.web3.ammContract) {
        preview.textContent = "≈ 0 Out";
        return;
    }

    try {
        var amtIn = ethers.parseUnits(amtStr, 18);
        var resIn = dir === 'AtoB' ? defi.web3.resA : defi.web3.resB;
        var resOut = dir === 'AtoB' ? defi.web3.resB : defi.web3.resA;
        var symOut = dir === 'AtoB' ? defi.web3.symbolB : defi.web3.symbolA;

        if (resIn === 0n || resOut === 0n) {
            preview.textContent = "Pool is empty";
            return;
        }

        var amtOut = await defi.web3.ammContract.getAmountOut(amtIn, resIn, resOut);
        preview.textContent = "≈ " + ethers.formatUnits(amtOut, 18) + " " + symOut;
    } catch (e) {
        preview.textContent = "Error calculating";
    }
};

// ==========================================
// WEB3: ACTIONS (Mint, Swap, Liq)
// ==========================================

window.web3DefiMintTokens = async function() {
    if (!defi.web3.tokenAContract) return;
    try {
        showToast("Minting 100 TKA...");
        var txA = await defi.web3.tokenAContract.mint(defi.web3.address, ethers.parseUnits("100", 18));
        await txA.wait();

        showToast("Minting 1000 TKB...");
        var txB = await defi.web3.tokenBContract.mint(defi.web3.address, ethers.parseUnits("1000", 18));
        await txB.wait();

        showToast("Tokens minted!");
        await web3DefiRefreshPool();
    } catch(e) {
        console.error(e);
        showToast("Mint failed: " + e.message);
    }
};

window.web3DefiSwap = async function() {
    var amtStr = document.getElementById('web3DefiSwapAmount').value;
    var dir = document.getElementById('web3DefiSwapDir').value;
    if (!amtStr || parseFloat(amtStr) <= 0) { showToast("Enter amount"); return; }

    try {
        var amt = ethers.parseUnits(amtStr, 18);
        var ammAddr = await defi.web3.ammContract.getAddress();

        if (dir === 'AtoB') {
            showToast("Approving Token A...");
            var txApp = await defi.web3.tokenAContract.approve(ammAddr, amt);
            await txApp.wait();

            showToast("Swapping...");
            var tx = await defi.web3.ammContract.swapAToB(amt);
            await tx.wait();
        } else {
            showToast("Approving Token B...");
            var txApp = await defi.web3.tokenBContract.approve(ammAddr, amt);
            await txApp.wait();

            showToast("Swapping...");
            var tx = await defi.web3.ammContract.swapBToA(amt);
            await tx.wait();
        }

        showToast("Swap successful!");
        document.getElementById('web3DefiSwapAmount').value = '';
        await web3DefiRefreshPool();
    } catch(e) {
        console.error(e);
        showToast("Swap failed: " + e.message);
    }
};

window.web3DefiAddLiquidity = async function() {
    var amtAStr = document.getElementById('web3DefiAddLiqA').value;
    var amtBStr = document.getElementById('web3DefiAddLiqB').value;
    if (!amtAStr || !amtBStr) { showToast("Enter amounts"); return; }

    try {
        var amtA = ethers.parseUnits(amtAStr, 18);
        var amtB = ethers.parseUnits(amtBStr, 18);
        var ammAddr = await defi.web3.ammContract.getAddress();

        showToast("Approving Tokens...");
        var txAppA = await defi.web3.tokenAContract.approve(ammAddr, amtA);
        await txAppA.wait();
        var txAppB = await defi.web3.tokenBContract.approve(ammAddr, amtB);
        await txAppB.wait();

        showToast("Adding Liquidity...");
        var tx = await defi.web3.ammContract.addLiquidity(amtA, amtB);
        await tx.wait();

        showToast("Liquidity added!");
        document.getElementById('web3DefiAddLiqA').value = '';
        document.getElementById('web3DefiAddLiqB').value = '';
        await web3DefiRefreshPool();
    } catch(e) {
        console.error(e);
        showToast("Failed to add liquidity: " + e.message);
    }
};

window.web3DefiRemoveLiquidity = async function() {
    var sharesStr = document.getElementById('web3DefiRemoveShares').value;
    if (!sharesStr || parseFloat(sharesStr) <= 0) { showToast("Enter shares to remove"); return; }

    try {
        var shares = ethers.parseUnits(sharesStr, 18);
        showToast("Removing Liquidity...");
        var tx = await defi.web3.ammContract.removeLiquidity(shares);
        await tx.wait();

        showToast("Liquidity removed!");
        document.getElementById('web3DefiRemoveShares').value = '';
        await web3DefiRefreshPool();
    } catch(e) {
        console.error(e);
        showToast("Failed to remove liquidity: " + e.message);
    }
};

// ==========================================
// WEB3: LENDING ACTIONS
// ==========================================

window.web3DefiLendingDeposit = async function() {
    var amtStr = document.getElementById('web3DefiDepositAmt').value;
    if (!amtStr || !defi.web3.lendingContract) return;
    try {
        var amt = ethers.parseUnits(amtStr, 18);
        var lendingAddr = await defi.web3.lendingContract.getAddress();
        showToast("Approving Token A...");
        var txApp = await defi.web3.tokenAContract.approve(lendingAddr, amt);
        await txApp.wait();
        showToast("Depositing collateral...");
        var tx = await defi.web3.lendingContract.deposit(amt);
        await tx.wait();
        showToast("Collateral deposited!");
        await web3DefiRefreshPool();
    } catch(e) { showToast("Deposit failed: " + e.message); }
};

window.web3DefiLendingWithdraw = async function() {
    var amtStr = document.getElementById('web3DefiDepositAmt').value;
    if (!amtStr || !defi.web3.lendingContract) return;
    try {
        var amt = ethers.parseUnits(amtStr, 18);
        showToast("Withdrawing collateral...");
        var tx = await defi.web3.lendingContract.withdraw(amt);
        await tx.wait();
        showToast("Collateral withdrawn!");
        await web3DefiRefreshPool();
    } catch(e) { showToast("Withdraw failed: " + e.message); }
};

window.web3DefiLendingBorrow = async function() {
    var amtStr = document.getElementById('web3DefiBorrowAmt').value;
    if (!amtStr || !defi.web3.lendingContract) return;
    try {
        var amt = ethers.parseUnits(amtStr, 18);
        showToast("Borrowing...");
        var tx = await defi.web3.lendingContract.borrow(amt);
        await tx.wait();
        showToast("Borrow successful!");
        await web3DefiRefreshPool();
    } catch(e) { showToast("Borrow failed: " + e.message); }
};

window.web3DefiLendingRepay = async function() {
    var amtStr = document.getElementById('web3DefiBorrowAmt').value;
    if (!amtStr || !defi.web3.lendingContract) return;
    try {
        var amt = ethers.parseUnits(amtStr, 18);
        var lendingAddr = await defi.web3.lendingContract.getAddress();
        showToast("Approving repayment...");
        var txApp = await defi.web3.tokenAContract.approve(lendingAddr, amt);
        await txApp.wait();
        showToast("Repaying...");
        var tx = await defi.web3.lendingContract.repay(amt);
        await tx.wait();
        showToast("Repay successful!");
        await web3DefiRefreshPool();
    } catch(e) { showToast("Repay failed: " + e.message); }
};

// ==========================================
// WEB3: FARMING ACTIONS
// ==========================================

window.web3DefiFarmStake = async function() {
    var amtStr = document.getElementById('web3DefiFarmAmt').value;
    if (!amtStr || !defi.web3.farmContract) return;
    try {
        var amt = ethers.parseUnits(amtStr, 18);
        var farmAddr = await defi.web3.farmContract.getAddress();
        showToast("Approving LP tokens...");
        var txApp = await defi.web3.ammContract.approve(farmAddr, amt);
        await txApp.wait();
        showToast("Staking in farm...");
        var tx = await defi.web3.farmContract.stake(amt);
        await tx.wait();
        showToast("Staked!");
        await web3DefiRefreshPool();
    } catch(e) { showToast("Stake failed: " + e.message); }
};

window.web3DefiFarmUnstake = async function() {
    var amtStr = document.getElementById('web3DefiFarmAmt').value;
    if (!amtStr || !defi.web3.farmContract) return;
    try {
        var amt = ethers.parseUnits(amtStr, 18);
        showToast("Unstaking...");
        var tx = await defi.web3.farmContract.unstake(amt);
        await tx.wait();
        showToast("Unstaked!");
        await web3DefiRefreshPool();
    } catch(e) { showToast("Unstake failed: " + e.message); }
};

window.web3DefiFarmHarvest = async function() {
    if (!defi.web3.farmContract) return;
    try {
        showToast("Harvesting rewards...");
        var tx = await defi.web3.farmContract.harvest();
        await tx.wait();
        showToast("Harvested!");
        await web3DefiRefreshPool();
    } catch(e) { showToast("Harvest failed: " + e.message); }
};

// ==========================================
// UTILS
// ==========================================

function defiLog(type, msg) {
    defi.eventLog.push({ type: type, msg: msg, time: new Date().toLocaleTimeString() });
}

function fmtD(n) {
    if (typeof n !== 'number') n = parseFloat(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    if (n >= 1) return n.toFixed(2);
    return n.toFixed(4);
}

function setT(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
}

function shortAddrDeFi(addr) {
    if (!addr) return '';
    return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
}
