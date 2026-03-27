/* ========================================
   Section 10 — Tokenomics Simulator
   In-browser token economy simulation
   ======================================== */

var tokenEconomy = {
    created: false,
    token: { name: '', symbol: '', decimals: 18 },
    totalMinted: 0,
    totalBurned: 0,
    stakingAPY: 12,
    accounts: {},
    vestings: [],
    eventLog: [],
    // Price simulation
    price: 1.00,
    priceHistory: [],
    initialSupply: 0,
    social: { community: 20, buzz: 10, devActivity: 15, marketTrend: 50, fud: 10 },
    defaultAccounts: [
        { name: 'You (Creator)', addr: '0xYou' },
        { name: 'Alice', addr: '0xAlice' },
        { name: 'Bob', addr: '0xBob' },
        { name: 'Treasury', addr: '0xTreasury' },
        { name: 'Investor', addr: '0xInvestor' }
    ]
};

// ==========================================
// TOKEN CREATION
// ==========================================

function createTokenEconomy() {
    var name = document.getElementById('teTokenName').value.trim() || 'DemoToken';
    var symbol = document.getElementById('teTokenSymbol').value.trim() || 'DMT';
    var supply = parseFloat(document.getElementById('teInitialSupply').value) || 1000000;

    tokenEconomy.created = true;
    tokenEconomy.token.name = name;
    tokenEconomy.token.symbol = symbol;
    tokenEconomy.totalMinted = supply;
    tokenEconomy.totalBurned = 0;
    tokenEconomy.accounts = {};
    tokenEconomy.vestings = [];
    tokenEconomy.eventLog = [];

    // Initialize default accounts
    tokenEconomy.defaultAccounts.forEach(function (a) {
        tokenEconomy.accounts[a.addr] = { balance: 0, staked: 0, stakedAt: 0, name: a.name };
    });

    // Give all initial supply to creator
    tokenEconomy.accounts['0xYou'].balance = supply;

    logEvent('create', 'Token "' + name + '" (' + symbol + ') created with ' + fmt(supply) + ' supply');

    tokenEconomy.initialSupply = supply;
    tokenEconomy.price = 1.00;
    tokenEconomy.priceHistory = [{ time: Date.now(), price: 1.00 }];
    tokenEconomy.social = { community: 20, buzz: 10, devActivity: 15, marketTrend: 50, fud: 10 };

    // Enable all UI
    document.getElementById('teCreationCard').style.display = 'none';
    document.getElementById('teActiveUI').style.display = 'block';
    document.getElementById('teTokenLabel').textContent = name + ' (' + symbol + ')';

    // Setup intersection observer for mobile sticky compact view
    var stickyTrigger = document.getElementById('teStickyTrigger');
    var tokenValueCard = document.getElementById('teTokenValueCard');
    if (stickyTrigger && tokenValueCard) {
        if (tokenEconomy.observer) {
            tokenEconomy.observer.disconnect();
        }
        tokenEconomy.observer = new IntersectionObserver(function(entries) {
            if (window.innerWidth < 1024) {
                if (entries[0].isIntersecting) {
                    tokenValueCard.classList.remove('is-sticky-compact');
                } else {
                    tokenValueCard.classList.add('is-sticky-compact');
                }
            } else {
                tokenValueCard.classList.remove('is-sticky-compact');
            }
        }, { threshold: [0, 1], rootMargin: "-56px 0px 0px 0px" });
        tokenEconomy.observer.observe(stickyTrigger);
    }

    // Populate dropdowns
    populateAccountSelects();
    updateDashboard();
    updateAccountsTable();
    updateEventLog();
    recalcPrice();
    updateSocialSliders();
    drawPriceChart();
    showToast(name + ' (' + symbol + ') created!');
}

// ==========================================
// MINT
// ==========================================

function teMint() {
    if (!tokenEconomy.created) return;
    var to = document.getElementById('teMintTo').value;
    var amount = parseFloat(document.getElementById('teMintAmount').value);
    if (!to || !amount || amount <= 0) { showToast('Enter a valid address and amount.'); return; }

    tokenEconomy.totalMinted += amount;
    tokenEconomy.accounts[to].balance += amount;
    logEvent('mint', 'Minted ' + fmt(amount) + ' ' + tokenEconomy.token.symbol + ' to ' + getAccountName(to));
    updateDashboard();
    updateAccountsTable();
    updateEventLog();
    recalcPrice();
    drawPriceChart();
    document.getElementById('teMintAmount').value = '';
    showToast(fmt(amount) + ' ' + tokenEconomy.token.symbol + ' minted!');
}

// ==========================================
// BURN
// ==========================================

// ==========================================
// AIRDROP
// ==========================================

function teAirdrop() {
    if (!tokenEconomy.created) return;
    var source = document.getElementById('teAirdropSource').value;
    var to = document.getElementById('teAirdropTo').value;
    var amount = parseFloat(document.getElementById('teAirdropAmount').value);

    if (!to || !amount || amount <= 0) { showToast('Enter a valid address and amount.'); return; }

    if (source === 'wallet') {
        var acc = tokenEconomy.accounts['0xYou'];
        if (acc.balance < amount) { showToast('Insufficient balance for airdrop! You have ' + fmt(acc.balance)); return; }
        acc.balance -= amount;
        tokenEconomy.accounts[to].balance += amount;
        logEvent('social', 'Airdropped ' + fmt(amount) + ' ' + tokenEconomy.token.symbol + ' to ' + getAccountName(to) + ' from wallet');
        // Increase social buzz as a marketing effect
        tokenEconomy.social.buzz = Math.min(100, tokenEconomy.social.buzz + 5);
        updateSocialSliders();
    } else {
        // Mint source
        tokenEconomy.totalMinted += amount;
        tokenEconomy.accounts[to].balance += amount;
        logEvent('mint', 'Minted & Airdropped ' + fmt(amount) + ' ' + tokenEconomy.token.symbol + ' to ' + getAccountName(to));
        // Increase social buzz as a marketing effect, but also dilutes supply
        tokenEconomy.social.buzz = Math.min(100, tokenEconomy.social.buzz + 5);
        updateSocialSliders();
    }

    updateDashboard();
    updateAccountsTable();
    updateEventLog();
    recalcPrice();
    drawPriceChart();

    document.getElementById('teAirdropAmount').value = '';
    showToast(fmt(amount) + ' ' + tokenEconomy.token.symbol + ' Airdropped!');
}

function teBurn() {
    if (!tokenEconomy.created) return;
    var amount = parseFloat(document.getElementById('teBurnAmount').value);
    if (!amount || amount <= 0) { showToast('Enter a valid amount.'); return; }

    var acc = tokenEconomy.accounts['0xYou'];
    if (acc.balance < amount) { showToast('Insufficient balance! You have ' + fmt(acc.balance)); return; }

    acc.balance -= amount;
    tokenEconomy.totalBurned += amount;
    logEvent('burn', 'Burned ' + fmt(amount) + ' ' + tokenEconomy.token.symbol + ' 🔥');
    updateDashboard();
    updateAccountsTable();
    updateEventLog();
    recalcPrice();
    drawPriceChart();
    document.getElementById('teBurnAmount').value = '';
    showToast(fmt(amount) + ' ' + tokenEconomy.token.symbol + ' burned!');
}

// ==========================================
// TRANSFER
// ==========================================

function teTransfer() {
    if (!tokenEconomy.created) return;
    var from = document.getElementById('teTransferFrom').value;
    var to = document.getElementById('teTransferTo').value;
    var amount = parseFloat(document.getElementById('teTransferAmount').value);
    if (!from || !to || !amount || amount <= 0) { showToast('Fill all transfer fields.'); return; }
    if (from === to) { showToast('Cannot transfer to same address.'); return; }

    var sender = tokenEconomy.accounts[from];
    if (sender.balance < amount) { showToast('Insufficient balance! ' + getAccountName(from) + ' has ' + fmt(sender.balance)); return; }

    sender.balance -= amount;
    tokenEconomy.accounts[to].balance += amount;
    logEvent('transfer', getAccountName(from) + ' → ' + getAccountName(to) + ': ' + fmt(amount) + ' ' + tokenEconomy.token.symbol);
    updateDashboard();
    updateAccountsTable();
    updateEventLog();
    document.getElementById('teTransferAmount').value = '';
    showToast('Transfer complete!');
}

// ==========================================
// STAKE
// ==========================================

function teStake() {
    if (!tokenEconomy.created) return;
    var amount = parseFloat(document.getElementById('teStakeAmount').value);
    if (!amount || amount <= 0) { showToast('Enter a valid stake amount.'); return; }

    var acc = tokenEconomy.accounts['0xYou'];

    // If already staking, harvest rewards first
    if (acc.staked > 0) {
        harvestRewards(acc);
    }

    if (acc.balance < amount) { showToast('Insufficient balance! You have ' + fmt(acc.balance)); return; }

    acc.balance -= amount;
    acc.staked += amount;
    acc.stakedAt = Date.now();
    logEvent('stake', 'Staked ' + fmt(amount) + ' ' + tokenEconomy.token.symbol + ' at ' + tokenEconomy.stakingAPY + '% APY');
    updateDashboard();
    updateAccountsTable();
    updateStakingInfo();
    updateEventLog();
    recalcPrice();
    drawPriceChart();
    document.getElementById('teStakeAmount').value = '';
    showToast(fmt(amount) + ' ' + tokenEconomy.token.symbol + ' staked!');
}

function teUnstake() {
    if (!tokenEconomy.created) return;
    var acc = tokenEconomy.accounts['0xYou'];
    if (acc.staked <= 0) { showToast('Nothing staked!'); return; }

    var reward = calculateReward(acc);
    var total = acc.staked + reward;

    logEvent('unstake', 'Unstaked ' + fmt(acc.staked) + ' + earned ' + fmt(reward) + ' ' + tokenEconomy.token.symbol + ' reward');

    acc.balance += total;
    tokenEconomy.totalMinted += reward; // Rewards are newly minted
    acc.staked = 0;
    acc.stakedAt = 0;

    updateDashboard();
    updateAccountsTable();
    updateStakingInfo();
    updateEventLog();
    recalcPrice();
    drawPriceChart();
    showToast('Unstaked! Earned ' + fmt(reward) + ' ' + tokenEconomy.token.symbol + ' reward');
}

function calculateReward(acc) {
    if (acc.staked <= 0 || acc.stakedAt <= 0) return 0;
    var elapsed = (Date.now() - acc.stakedAt) / 1000; // seconds
    // For demo: 1 second = 1 day (so rewards accumulate fast)
    var days = elapsed;
    var annualRate = tokenEconomy.stakingAPY / 100;
    var reward = acc.staked * annualRate * (days / 365);
    return Math.round(reward * 100) / 100;
}

function harvestRewards(acc) {
    var reward = calculateReward(acc);
    if (reward > 0) {
        acc.balance += reward;
        tokenEconomy.totalMinted += reward;
        logEvent('harvest', 'Harvested ' + fmt(reward) + ' ' + tokenEconomy.token.symbol + ' staking reward');
    }
    acc.stakedAt = Date.now();
}

// ==========================================
// VESTING
// ==========================================

function teCreateVesting() {
    if (!tokenEconomy.created) return;
    var to = document.getElementById('teVestingTo').value;
    var amount = parseFloat(document.getElementById('teVestingAmount').value);
    var duration = parseInt(document.getElementById('teVestingDuration').value) || 30;
    if (!to || !amount || amount <= 0) { showToast('Fill all vesting fields.'); return; }

    // Vesting now acts as a form of minting
    tokenEconomy.totalMinted += amount;

    tokenEconomy.vestings.push({
        to: to,
        total: amount,
        released: 0,
        startTime: Date.now(),
        duration: duration // in "days" (seconds in demo)
    });

    logEvent('vesting', 'Minted & Locked: ' + fmt(amount) + ' ' + tokenEconomy.token.symbol + ' → ' + getAccountName(to) + ' over ' + duration + ' days');
    updateDashboard();
    updateAccountsTable();
    updateVestingList();
    updateEventLog();
    recalcPrice();
    drawPriceChart();
    document.getElementById('teVestingAmount').value = '';
    showToast('Vesting schedule created (Minted & Locked)!');
}

function teClaimVesting(index) {
    var v = tokenEconomy.vestings[index];
    if (!v) return;

    var elapsed = (Date.now() - v.startTime) / 1000; // 1 sec = 1 day for demo
    var progress = Math.min(elapsed / v.duration, 1);
    var totalUnlocked = v.total * progress;
    var claimable = totalUnlocked - v.released;

    if (claimable <= 0.01) { showToast('Nothing to claim yet.'); return; }

    claimable = Math.round(claimable * 100) / 100;
    v.released += claimable;
    tokenEconomy.accounts[v.to].balance += claimable;

    logEvent('claim', getAccountName(v.to) + ' claimed ' + fmt(claimable) + ' ' + tokenEconomy.token.symbol + ' from vesting');
    updateDashboard();
    updateAccountsTable();
    updateVestingList();
    updateEventLog();

    // Claiming brings tokens into circulating supply, creating sell pressure
    recalcPrice();
    drawPriceChart();

    showToast(fmt(claimable) + ' ' + tokenEconomy.token.symbol + ' claimed!');
}

// ==========================================
// APY CHANGE
// ==========================================

function teChangeAPY() {
    var newAPY = parseFloat(document.getElementById('teAPYInput').value);
    if (isNaN(newAPY) || newAPY < 0 || newAPY > 1000) { showToast('APY must be 0-1000%.'); return; }
    tokenEconomy.stakingAPY = newAPY;
    logEvent('config', 'Staking APY changed to ' + newAPY + '%');
    updateStakingInfo();
    updateEventLog();
    showToast('APY updated to ' + newAPY + '%');
}

// ==========================================
// RESET
// ==========================================

function teReset() {
    tokenEconomy.created = false;
    tokenEconomy.accounts = {};
    tokenEconomy.vestings = [];
    tokenEconomy.eventLog = [];
    tokenEconomy.totalMinted = 0;
    tokenEconomy.totalBurned = 0;
    tokenEconomy.stakingAPY = 12;
    document.getElementById('teCreationCard').style.display = 'block';
    document.getElementById('teActiveUI').style.display = 'none';
    showToast('Token economy reset!');
}

// ==========================================
// DASHBOARD & UI UPDATES
// ==========================================

function updateDashboard() {
    var totalSupply = tokenEconomy.totalMinted - tokenEconomy.totalBurned;
    var totalStaked = 0;
    var totalFree = 0;
    Object.keys(tokenEconomy.accounts).forEach(function (addr) {
        totalStaked += tokenEconomy.accounts[addr].staked;
        totalFree += tokenEconomy.accounts[addr].balance;
    });
    var totalVestingLocked = 0;
    tokenEconomy.vestings.forEach(function (v) {
        totalVestingLocked += (v.total - v.released);
    });
    var circulating = totalFree;

    var sym = tokenEconomy.token.symbol;
    document.getElementById('teTotalSupply').textContent = fmt(totalSupply) + ' ' + sym;
    document.getElementById('teCirculating').textContent = fmt(circulating) + ' ' + sym;
    document.getElementById('teStakedSupply').textContent = fmt(totalStaked) + ' ' + sym;
    document.getElementById('teBurnedSupply').textContent = fmt(tokenEconomy.totalBurned) + ' ' + sym;
    document.getElementById('teVestingLocked').textContent = fmt(totalVestingLocked) + ' ' + sym;

    // Supply distribution bar
    var bar = document.getElementById('teSupplyBar');
    if (totalSupply > 0) {
        var pctCirc = (circulating / totalSupply) * 100;
        var pctStaked = (totalStaked / totalSupply) * 100;
        var pctVesting = (totalVestingLocked / totalSupply) * 100;
        var pctBurned = (tokenEconomy.totalBurned / (tokenEconomy.totalMinted)) * 100;
        bar.innerHTML =
            '<div class="supply-seg supply-seg-circ" style="width:' + pctCirc + '%;" title="Circulating ' + pctCirc.toFixed(1) + '%"></div>' +
            '<div class="supply-seg supply-seg-staked" style="width:' + pctStaked + '%;" title="Staked ' + pctStaked.toFixed(1) + '%"></div>' +
            '<div class="supply-seg supply-seg-vesting" style="width:' + pctVesting + '%;" title="Vesting ' + pctVesting.toFixed(1) + '%"></div>';
        document.getElementById('teSupplyBarBurned').style.width = pctBurned + '%';
    }
}

function updateAccountsTable() {
    var tbody = document.getElementById('teAccountsBody');
    tbody.innerHTML = '';
    var sym = tokenEconomy.token.symbol;
    Object.keys(tokenEconomy.accounts).forEach(function (addr) {
        var a = tokenEconomy.accounts[addr];
        var row = document.createElement('tr');
        row.innerHTML =
            '<td>' + a.name + '</td>' +
            '<td style="font-family: var(--font-mono); font-size: 11px;">' + addr + '</td>' +
            '<td style="text-align:right; color: var(--accent-green); font-weight:600;">' + fmt(a.balance) + '</td>' +
            '<td style="text-align:right; color: var(--accent-purple); font-weight:600;">' + fmt(a.staked) + '</td>' +
            '<td style="text-align:right; font-weight:600;">' + fmt(a.balance + a.staked) + '</td>';
        tbody.appendChild(row);
    });
}

function updateStakingInfo() {
    var acc = tokenEconomy.accounts['0xYou'];
    if (!acc) return;
    var sym = tokenEconomy.token.symbol;
    document.getElementById('teStakedAmount').textContent = fmt(acc.staked) + ' ' + sym;
    document.getElementById('teStakingAPY').textContent = tokenEconomy.stakingAPY + '%';
    document.getElementById('teAPYInput').value = tokenEconomy.stakingAPY;

    var reward = calculateReward(acc);
    document.getElementById('teCurrentReward').textContent = fmt(reward) + ' ' + sym;

    // Update reward live
    if (acc.staked > 0 && tokenEconomy.created) {
        if (tokenEconomy._rewardTimer) clearInterval(tokenEconomy._rewardTimer);
        tokenEconomy._rewardTimer = setInterval(function () {
            if (!tokenEconomy.created) { clearInterval(tokenEconomy._rewardTimer); return; }
            var r = calculateReward(tokenEconomy.accounts['0xYou']);
            var el = document.getElementById('teCurrentReward');
            if (el) el.textContent = fmt(r) + ' ' + tokenEconomy.token.symbol;
        }, 1000);
    } else {
        if (tokenEconomy._rewardTimer) clearInterval(tokenEconomy._rewardTimer);
    }
}

function updateVestingList() {
    var container = document.getElementById('teVestingList');
    container.innerHTML = '';
    if (tokenEconomy.vestings.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 13px;">No vesting schedules yet.</p>';
        return;
    }
    var sym = tokenEconomy.token.symbol;
    tokenEconomy.vestings.forEach(function (v, i) {
        var elapsed = (Date.now() - v.startTime) / 1000;
        var progress = Math.min(elapsed / v.duration, 1);
        var pct = (progress * 100).toFixed(1);
        var claimable = Math.round((v.total * progress - v.released) * 100) / 100;
        if (claimable < 0) claimable = 0;
        var isComplete = v.released >= v.total - 0.01;

        var div = document.createElement('div');
        div.className = 'vesting-item';
        div.innerHTML =
            '<div class="vesting-header">' +
            '<span><strong>' + getAccountName(v.to) + '</strong> — ' + fmt(v.total) + ' ' + sym + ' over ' + v.duration + ' days</span>' +
            '<span class="badge ' + (isComplete ? 'badge-valid' : '') + '">' + pct + '%</span>' +
            '</div>' +
            '<div class="vesting-bar-track"><div class="vesting-bar-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="vesting-footer">' +
            '<span>Released: ' + fmt(v.released) + ' / ' + fmt(v.total) + ' ' + sym + '</span>' +
            (claimable > 0.01 ? '<button class="btn btn-sm btn-green" onclick="teClaimVesting(' + i + ')">Claim ' + fmt(claimable) + '</button>' : '<span class="badge">' + (isComplete ? '✔ Complete' : 'Vesting...') + '</span>') +
            '</div>';
        container.appendChild(div);
    });

    // Auto-refresh vesting progress
    if (tokenEconomy._vestingTimer) clearInterval(tokenEconomy._vestingTimer);
    tokenEconomy._vestingTimer = setInterval(function () {
        if (!tokenEconomy.created) { clearInterval(tokenEconomy._vestingTimer); return; }
        updateVestingList();
    }, 2000);
}

function updateEventLog() {
    var container = document.getElementById('teEventLog');
    container.innerHTML = '';
    var logs = tokenEconomy.eventLog.slice().reverse(); // newest first
    logs.forEach(function (ev) {
        var div = document.createElement('div');
        div.className = 'te-event te-event-' + ev.type;
        div.innerHTML =
            '<span class="te-event-badge te-badge-' + ev.type + '">' + getEventIcon(ev.type) + '</span>' +
            '<span class="te-event-msg">' + ev.message + '</span>' +
            '<span class="te-event-time">' + ev.timeStr + '</span>';
        container.appendChild(div);
    });
}

// ==========================================
// HELPERS
// ==========================================

function populateAccountSelects() {
    var selects = ['teMintTo', 'teTransferFrom', 'teTransferTo', 'teVestingTo', 'teAirdropTo'];
    selects.forEach(function (selId) {
        var sel = document.getElementById(selId);
        if (!sel) return;
        sel.innerHTML = '';
        Object.keys(tokenEconomy.accounts).forEach(function (addr) {
            var opt = document.createElement('option');
            opt.value = addr;
            opt.textContent = tokenEconomy.accounts[addr].name + ' (' + addr + ')';
            sel.appendChild(opt);
        });
    });
}

function getAccountName(addr) {
    return tokenEconomy.accounts[addr] ? tokenEconomy.accounts[addr].name : addr;
}

function logEvent(type, message) {
    var now = new Date();
    tokenEconomy.eventLog.push({
        type: type,
        message: message,
        time: now.getTime(),
        timeStr: now.toLocaleTimeString()
    });
}

function getEventIcon(type) {
    var icons = {
        create: '🪙', mint: '➕', burn: '🔥', transfer: '↔️',
        stake: '🔒', unstake: '🔓', harvest: '🌾',
        vesting: '📅', claim: '✅', config: '⚙️', social: '📣'
    };
    return icons[type] || '📋';
}

function fmt(n) {
    if (typeof n !== 'number') n = parseFloat(n) || 0;
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return n.toFixed(2);
}

// ==========================================
// PRICE ENGINE
// ==========================================

function recalcPrice() {
    if (!tokenEconomy.created) return;
    var totalSupply = tokenEconomy.totalMinted - tokenEconomy.totalBurned;
    if (totalSupply <= 0) totalSupply = 1;

    var totalStaked = 0;
    var totalFree = 0;
    Object.keys(tokenEconomy.accounts).forEach(function (addr) {
        totalStaked += tokenEconomy.accounts[addr].staked;
        totalFree += tokenEconomy.accounts[addr].balance;
    });

    var totalVestingLocked = 0;
    tokenEconomy.vestings.forEach(function (v) {
        totalVestingLocked += (v.total - v.released);
    });
    var circulating = totalFree;

    // Factors
    var burnRatio = tokenEconomy.totalBurned / tokenEconomy.totalMinted; // 0..1 higher = deflationary
    var stakeRatio = totalStaked / totalSupply; // 0..1 higher = locked supply

    // Inflation ratio now counts circulating supply instead of totalMinted, making claims drop price
    var inflationRatio = circulating / tokenEconomy.initialSupply; // >1 = inflated
    if (inflationRatio < 1) inflationRatio = 1;

    var socialFactor = (tokenEconomy.social.community + tokenEconomy.social.buzz + tokenEconomy.social.devActivity) / 300; // 0..1

    // Negative factors
    var marketTrendFactor = (tokenEconomy.social.marketTrend - 50) / 50; // -1 (bear) to +1 (bull)
    var fudFactor = tokenEconomy.social.fud / 100; // 0 to 1 (high fud)

    // Price formula: base price adjusted by factors
    var base = 1.0;
    var deflationBonus = 1 + (burnRatio * 3);         // burning up to 3x multiplier
    var stakingBonus = 1 + (stakeRatio * 1.5);        // staking up to 1.5x
    var socialBonus = 1 + (socialFactor * 2);          // social up to 2x
    var inflationPenalty = Math.max(0.2, 1 / Math.sqrt(inflationRatio)); // inflation drags price down

    // Applying market & FUD
    var marketMultiplier = 1 + (marketTrendFactor * 0.5); // max ±50% effect from market
    var fudPenalty = Math.max(0.1, 1 - (fudFactor * 0.8)); // FUD can drop price by up to 80%

    tokenEconomy.price = Math.round(base * deflationBonus * stakingBonus * socialBonus * inflationPenalty * marketMultiplier * fudPenalty * 100) / 100;
    tokenEconomy.priceHistory.push({ time: Date.now(), price: tokenEconomy.price });
    if (tokenEconomy.priceHistory.length > 100) tokenEconomy.priceHistory.shift();

    // Update price display
    var priceEl = document.getElementById('teTokenPrice');
    if (priceEl) priceEl.textContent = '$' + tokenEconomy.price.toFixed(2);
    var mcapEl = document.getElementById('teMarketCap');
    if (mcapEl) mcapEl.textContent = '$' + fmt(tokenEconomy.price * totalSupply);
    var changeEl = document.getElementById('tePriceChange');
    if (changeEl && tokenEconomy.priceHistory.length >= 2) {
        var prev = tokenEconomy.priceHistory[tokenEconomy.priceHistory.length - 2].price;
        var pct = ((tokenEconomy.price - prev) / prev * 100).toFixed(1);
        changeEl.textContent = (pct >= 0 ? '+' : '') + pct + '%';
        changeEl.style.color = pct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    }
}

// ==========================================
// PRICE CHART (Canvas)
// ==========================================

function drawPriceChart() {
    var canvas = document.getElementById('tePriceChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var W = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1);
    var H = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
    var w = canvas.offsetWidth;
    var h = canvas.offsetHeight;

    // Clear
    ctx.clearRect(0, 0, w, h);

    var data = tokenEconomy.priceHistory;
    if (data.length < 2) return;

    var prices = data.map(function (d) { return d.price; });
    var minP = Math.min.apply(null, prices) * 0.9;
    var maxP = Math.max.apply(null, prices) * 1.1;
    if (maxP === minP) maxP = minP + 1;

    var pad = { top: 20, right: 10, bottom: 25, left: 45 };
    var plotW = w - pad.left - pad.right;
    var plotH = h - pad.top - pad.bottom;

    // Grid lines
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-subtle').trim() || '#21262d';
    ctx.lineWidth = 0.5;
    for (var g = 0; g <= 4; g++) {
        var gy = pad.top + plotH * (1 - g / 4);
        ctx.beginPath(); ctx.moveTo(pad.left, gy); ctx.lineTo(w - pad.right, gy); ctx.stroke();
        var label = (minP + (maxP - minP) * (g / 4)).toFixed(2);
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#484f58';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('$' + label, pad.left - 4, gy + 3);
    }

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    for (var i = 0; i < data.length; i++) {
        var x = pad.left + (i / (data.length - 1)) * plotW;
        var y = pad.top + plotH * (1 - (data[i].price - minP) / (maxP - minP));
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill gradient
    var lastX = pad.left + plotW;
    var gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    gradient.addColorStop(0, 'rgba(88, 166, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(88, 166, 255, 0.01)');
    ctx.lineTo(lastX, pad.top + plotH);
    ctx.lineTo(pad.left, pad.top + plotH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // Current price dot
    var lastP = data[data.length - 1].price;
    var dotX = lastX;
    var dotY = pad.top + plotH * (1 - (lastP - minP) / (maxP - minP));
    ctx.beginPath();
    ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#58a6ff';
    ctx.fill();
}

// ==========================================
// SOCIAL PARAMETERS
// ==========================================

function teSocialChange(param) {
    var slider = document.getElementById('teSocial_' + param);
    var valEl = document.getElementById('teSocialVal_' + param);
    if (!slider) return;
    tokenEconomy.social[param] = parseInt(slider.value);
    if (valEl) valEl.textContent = slider.value;
    recalcPrice();
    drawPriceChart();
    logEvent('social', param.charAt(0).toUpperCase() + param.slice(1) + ' changed to ' + slider.value);
    updateEventLog();
}

function updateSocialSliders() {
    ['community', 'buzz', 'devActivity', 'marketTrend', 'fud'].forEach(function (param) {
        var slider = document.getElementById('teSocial_' + param);
        var valEl = document.getElementById('teSocialVal_' + param);
        if (slider) slider.value = tokenEconomy.social[param];
        if (valEl) valEl.textContent = tokenEconomy.social[param];
    });
}

// ==========================================
// INIT
// ==========================================

function initTokenomics() {
    // Nothing to init — user creates the token manually
}
