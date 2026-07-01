/* ========================================
   Section 15 — DAO Simulator & Web3
   Governance, Voting, Treasury, Execution
   ======================================== */

var dao = {
    initialized: false,
    mode: 'simulated', // 'simulated' or 'web3'

    // --- Simulated State ---
    created: false,
    name: '',
    token: 'GOV',
    quorum: 50,
    votingPeriod: 30,
    members: {
        '0xYou': { name: 'You (Founder)', tokens: 0 },
        '0xAlice': { name: 'Alice', tokens: 0 },
        '0xBob': { name: 'Bob', tokens: 0 },
        '0xCharlie': { name: 'Charlie', tokens: 0 },
        '0xDave': { name: 'Dave', tokens: 0 }
    },
    totalSupply: 0,
    treasury: 0,
    proposals: [],
    nextProposalId: 1,
    eventLog: [],

    // --- Web3 State ---
    web3: {
        provider: null,
        signer: null,
        address: null,
        chainId: null,
        daoContract: null,
        govTokenContract: null,
        userBalance: 0n,
        userVotes: 0n
    }
};

// ==========================================
// INIT & MODE SWITCH
// ==========================================

function initDAO() {
    if (dao.initialized) return;
    dao.initialized = true;
}

function placeDaoWeb3SetupFirst() {
    var web3 = document.getElementById('daoWeb3Container');
    var shared = document.getElementById('daoSimulatedContainer');
    if (web3 && shared && web3.nextElementSibling !== shared) {
        shared.parentNode.insertBefore(web3, shared);
    }
}

window.setDaoMode = function(mode) {
    dao.mode = mode;
    document.getElementById('daoModeSimulated').classList.toggle('active', mode === 'simulated');
    document.getElementById('daoModeWeb3').classList.toggle('active', mode === 'web3');

    if (mode === 'web3') placeDaoWeb3SetupFirst();
    document.getElementById('daoSimulatedContainer').style.display = 'block';
    document.getElementById('daoWeb3Container').style.display = mode === 'web3' ? 'block' : 'none';
    var web3Interaction = document.getElementById('web3DaoInteractionContainer');
    if (web3Interaction) web3Interaction.style.display = 'none';

    if (mode === 'simulated') {
        var hint = document.getElementById('daoWeb3SharedHint');
        if (hint) hint.style.display = 'none';
        updateDAOUI();
    } else {
        syncDaoSharedFromWeb3();
    }
};

function getDefaultDaoMembers() {
    return {
        '0xYou': { name: 'You (Founder)', tokens: 0 },
        '0xAlice': { name: 'Alice', tokens: 0 },
        '0xBob': { name: 'Bob', tokens: 0 },
        '0xCharlie': { name: 'Charlie', tokens: 0 },
        '0xDave': { name: 'Dave', tokens: 0 }
    };
}

// ==========================================
// SIMULATED: INIT / CREATE DAO
// ==========================================

window.daoCreate = function() {
    var name = document.getElementById('daoName').value.trim() || 'My DAO';
    var token = document.getElementById('daoToken').value.trim() || 'GOV';
    var supply = parseInt(document.getElementById('daoSupply').value) || 10000;
    var quorum = parseInt(document.getElementById('daoQuorum').value) || 50;
    var period = parseInt(document.getElementById('daoVotingPeriod').value) || 30;
    var treasury = parseInt(document.getElementById('daoTreasury').value) || 1000;

    dao.members = getDefaultDaoMembers();
    dao.name = name;
    dao.token = token;
    dao.quorum = quorum;
    dao.votingPeriod = period;
    dao.totalSupply = supply;
    dao.treasury = treasury;
    dao.created = true;
    dao.proposals = [];
    dao.nextProposalId = 1;
    dao.eventLog = [];

    var founderShare = Math.floor(supply * 0.4);
    var otherShare = Math.floor((supply - founderShare) / 4);
    dao.members['0xYou'].tokens = founderShare;
    dao.members['0xAlice'].tokens = otherShare;
    dao.members['0xBob'].tokens = otherShare;
    dao.members['0xCharlie'].tokens = otherShare;
    dao.members['0xDave'].tokens = supply - founderShare - otherShare * 3;

    daoLog('create', 'DAO "' + name + '" created with ' + supply + ' ' + token + ' governance tokens');

    document.getElementById('daoCreateCard').style.display = 'none';
    document.getElementById('daoActiveUI').style.display = 'block';
    document.getElementById('daoLabel').textContent = name + ' (' + token + ')';

    updateDAOUI();
    syncDaoSharedFromWeb3();
    showToast(name + ' DAO created!');
};

window.daoReset = function() {
    dao.created = false;
    dao.members = getDefaultDaoMembers();
    dao.proposals = [];
    dao.eventLog = [];
    dao.nextProposalId = 1;
    document.getElementById('daoCreateCard').style.display = 'block';
    document.getElementById('daoActiveUI').style.display = 'none';
    showToast('DAO reset');
};

// ==========================================
// SIMULATED: HOSTILE TAKEOVER
// ==========================================

window.daoHostileTakeoverScenario = function() {
    if (!dao.created) { showToast("Create a DAO first!"); return; }
    daoLog('create', '🚨 HOSTILE TAKEOVER ATTEMPT DETECTED!');

    var attacker = '0xAttacker';
    var attackAmount = Math.floor(dao.totalSupply * 0.45);

    dao.members[attacker] = { name: '😈 Shadow Whale', tokens: attackAmount };
    dao.totalSupply += attackAmount;

    var proposal = {
        id: dao.nextProposalId++,
        title: "URGENT: Treasury Restructuring",
        desc: "Transfer entire treasury to external advisory firm for 'yield optimization'.",
        type: 'transfer',
        amount: dao.treasury,
        target: attacker,
        proposer: attacker,
        votesFor: attackAmount,
        votesAgainst: 0,
        votesAbstain: 0,
        voters: { '0xAttacker': 'for' },
        status: 'active',
        createdAt: Date.now()
    };

    dao.proposals.push(proposal);
    daoLog('propose', '🚨 Shadow Whale proposed to drain the treasury!');
    daoLog('vote', '😈 Shadow Whale voted FOR with ' + attackAmount + ' ' + dao.token);

    updateDAOUI();
    showToast('Hostile Takeover Attempt!');
};

// ==========================================
// SIMULATED: PROPOSALS
// ==========================================

window.daoCreateProposal = function() {
    if (!dao.created) return;
    var title = document.getElementById('daoPropTitle').value.trim();
    var desc = document.getElementById('daoPropDesc').value.trim();
    var type = document.getElementById('daoPropType').value;
    if (!title) { showToast('Enter proposal title'); return; }

    var amount = 0;
    var target = '';
    if (type === 'transfer') {
        amount = parseFloat(document.getElementById('daoPropAmount').value) || 0;
        target = document.getElementById('daoPropTarget').value;
        if (amount <= 0) { showToast('Enter transfer amount'); return; }
        if (amount > dao.treasury) { showToast('Treasury only has ' + dao.treasury + ' ' + dao.token); return; }
    } else if (type === 'mint') {
        amount = parseFloat(document.getElementById('daoPropAmount').value) || 0;
        target = document.getElementById('daoPropTarget').value;
        if (amount <= 0) { showToast('Enter mint amount'); return; }
    } else if (type === 'quorum') {
        amount = parseInt(document.getElementById('daoPropAmount').value) || 0;
        if (amount < 1 || amount > 100) { showToast('Quorum must be 1-100%'); return; }
    }

    var proposal = {
        id: dao.nextProposalId++,
        title: title,
        desc: desc || 'No description',
        type: type,
        amount: amount,
        target: target,
        proposer: '0xYou',
        votesFor: 0,
        votesAgainst: 0,
        votesAbstain: 0,
        voters: {},
        status: 'active',
        createdAt: Date.now()
    };

    dao.proposals.push(proposal);
    daoLog('propose', 'Proposal #' + proposal.id + ': "' + title + '" (' + type + ')');
    document.getElementById('daoPropTitle').value = '';
    document.getElementById('daoPropDesc').value = '';
    document.getElementById('daoPropAmount').value = '';
    updateDAOUI();
    showToast('Proposal created!');
};

window.daoVote = function(proposalId, voterAddr, vote) {
    var prop = dao.proposals.find(function (p) { return p.id === proposalId; });
    if (!prop || prop.status !== 'active') { showToast('Proposal not active'); return; }
    if (prop.voters[voterAddr]) { showToast(dao.members[voterAddr].name + ' already voted'); return; }

    var member = dao.members[voterAddr];
    var weight = member.tokens;
    prop.voters[voterAddr] = vote;

    if (vote === 'for') prop.votesFor += weight;
    else if (vote === 'against') prop.votesAgainst += weight;
    else prop.votesAbstain += weight;

    daoLog('vote', dao.members[voterAddr].name + ' voted ' + vote.toUpperCase() + ' on Proposal #' + proposalId + ' (' + weight + ' ' + dao.token + ')');
    updateDAOUI();
};

window.daoCheckProposal = function(proposalId) {
    var prop = dao.proposals.find(function (p) { return p.id === proposalId; });
    if (!prop || prop.status !== 'active') return;

    var totalVoted = prop.votesFor + prop.votesAgainst + prop.votesAbstain;
    var participation = (totalVoted / dao.totalSupply) * 100;

    if (participation < dao.quorum) {
        showToast('Quorum not reached (' + participation.toFixed(0) + '% / ' + dao.quorum + '%)');
        return;
    }

    if (prop.votesFor > prop.votesAgainst) {
        prop.status = 'passed';
        daoExecuteProposal(prop);
        daoLog('execute', 'Proposal #' + prop.id + ' PASSED and executed ✔');
    } else {
        prop.status = 'rejected';
        daoLog('reject', 'Proposal #' + prop.id + ' REJECTED ✘');
    }

    updateDAOUI();
};

function daoExecuteProposal(prop) {
    if (prop.type === 'transfer') {
        if (dao.treasury >= prop.amount) {
            dao.treasury -= prop.amount;
            dao.members[prop.target].tokens += prop.amount;
        }
    } else if (prop.type === 'mint') {
        dao.totalSupply += prop.amount;
        dao.members[prop.target].tokens += prop.amount;
    } else if (prop.type === 'quorum') {
        dao.quorum = prop.amount;
    } else if (prop.type === 'burn') {
        var burnFrom = '0xYou';
        var burnAmt = Math.min(prop.amount, dao.members[burnFrom].tokens);
        dao.members[burnFrom].tokens -= burnAmt;
        dao.totalSupply -= burnAmt;
    }
}

window.daoSimulateVoting = function(proposalId) {
    var prop = dao.proposals.find(function (p) { return p.id === proposalId; });
    if (!prop || prop.status !== 'active') return;

    var others = ['0xAlice', '0xBob', '0xCharlie', '0xDave'];
    others.forEach(function (addr) {
        if (prop.voters[addr]) return;
        var rand = Math.random();
        var vote;
        if (prop.type === 'transfer' && prop.target === addr) vote = 'for';
        else if (rand > 0.35) vote = 'for';
        else if (rand > 0.15) vote = 'against';
        else vote = 'abstain';
        setTimeout(function () { daoVote(proposalId, addr, vote); }, Math.random() * 1500 + 500);
    });
};

// ==========================================
// SIMULATED: UPDATE UI
// ==========================================

function updateDAOUI() {
    if (!dao.created) return;

    setDAO('daoTotalSupply', dao.totalSupply.toLocaleString() + ' ' + dao.token);
    setDAO('daoTreasuryBal', dao.treasury.toLocaleString() + ' ' + dao.token);
    setDAO('daoQuorumVal', dao.quorum + '%');
    setDAO('daoTotalProposals', dao.proposals.length);
    var active = dao.proposals.filter(function (p) { return p.status === 'active'; }).length;
    var passed = dao.proposals.filter(function (p) { return p.status === 'passed'; }).length;
    var rejected = dao.proposals.filter(function (p) { return p.status === 'rejected'; }).length;
    setDAO('daoActiveCount', active);
    setDAO('daoPassedCount', passed);
    setDAO('daoRejectedCount', rejected);

    var tbody = document.getElementById('daoMembersBody');
    if (tbody) {
        tbody.innerHTML = '';
        Object.keys(dao.members).forEach(function (addr) {
            var m = dao.members[addr];
            var pct = ((m.tokens / dao.totalSupply) * 100).toFixed(1);
            var row = document.createElement('tr');
            row.innerHTML =
                '<td>' + m.name + '</td>' +
                '<td style="font-family:var(--font-mono);font-size:11px;">' + addr + '</td>' +
                '<td style="text-align:right;color:var(--accent-blue);font-weight:600;">' + m.tokens.toLocaleString() + '</td>' +
                '<td style="text-align:right;">' + pct + '%</td>';
            tbody.appendChild(row);
        });
    }

    var sel = document.getElementById('daoPropTarget');
    if (sel && (dao.mode === 'web3' || sel.options.length <= 1)) {
        sel.innerHTML = '';
        Object.keys(dao.members).forEach(function (addr) {
            var opt = document.createElement('option');
            opt.value = addr;
            opt.textContent = dao.members[addr].name;
            sel.appendChild(opt);
        });
    }

    var propList = document.getElementById('daoProposalsList');
    if (propList) {
        propList.innerHTML = '';
        if (dao.proposals.length === 0) {
            propList.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No proposals yet. Create one above!</p>';
        }
        dao.proposals.slice().reverse().forEach(function (prop) {
            var totalVoted = prop.votesFor + prop.votesAgainst + prop.votesAbstain;
            var participation = dao.totalSupply > 0 ? ((totalVoted / dao.totalSupply) * 100).toFixed(0) : 0;
            var forPct = totalVoted > 0 ? ((prop.votesFor / totalVoted) * 100).toFixed(0) : 0;
            var againstPct = totalVoted > 0 ? ((prop.votesAgainst / totalVoted) * 100).toFixed(0) : 0;
            var abstainPct = totalVoted > 0 ? ((prop.votesAbstain / totalVoted) * 100).toFixed(0) : 0;

            var statusBadge = '';
            if (prop.status === 'active') statusBadge = '<span class="badge" style="background:rgba(88,166,255,0.15);color:var(--accent-blue);">🗳️ Active</span>';
            else if (prop.status === 'passed') statusBadge = '<span class="badge badge-valid">✔ Passed</span>';
            else statusBadge = '<span class="badge" style="background:rgba(248,81,73,0.15);color:var(--accent-red);">✘ Rejected</span>';

            var typeLabel = { transfer: '💰 Treasury Transfer', mint: '➕ Mint Tokens', quorum: '⚖️ Change Quorum', burn: '🔥 Burn Tokens', general: '📋 General' };

            var proposerName = getDaoMemberName(prop.proposer);
            var targetName = prop.target ? getDaoMemberName(prop.target) : '';

            var div = document.createElement('div');
            div.className = 'dao-proposal-card';
            div.innerHTML =
                '<div class="dao-prop-header">' +
                '<div><strong>#' + prop.id + ' — ' + escapeHtmlDao(prop.title) + '</strong><br>' +
                '<span style="color:var(--text-muted);font-size:12px;">' + (typeLabel[prop.type] || prop.type) + ' · Proposed by ' + proposerName + '</span></div>' +
                statusBadge +
                '</div>' +
                '<p style="font-size:13px;color:var(--text-secondary);">' + escapeHtmlDao(prop.desc) + '</p>' +
                (prop.amount ? '<p style="font-size:13px;">Amount: <strong>' + prop.amount + (prop.type === 'quorum' ? '%' : ' ' + dao.token) + '</strong>' +
                    (prop.target ? ' → ' + targetName : '') + '</p>' : '') +
                '<div class="dao-vote-bar">' +
                '<div class="dao-vote-for" style="width:' + forPct + '%;"></div>' +
                '<div class="dao-vote-against" style="width:' + againstPct + '%;"></div>' +
                '<div class="dao-vote-abstain" style="width:' + abstainPct + '%;"></div>' +
                '</div>' +
                '<div class="dao-vote-labels">' +
                '<span style="color:var(--accent-green);">For: ' + prop.votesFor + ' (' + forPct + '%)</span>' +
                '<span style="color:var(--accent-red);">Against: ' + prop.votesAgainst + ' (' + againstPct + '%)</span>' +
                '<span style="color:var(--text-muted);">Abstain: ' + prop.votesAbstain + ' (' + abstainPct + '%)</span>' +
                '<span>Participation: ' + participation + '% / ' + dao.quorum + '%</span>' +
                '</div>' +
                (prop.status === 'active' ?
                    '<div class="dao-vote-actions">' +
                    '<button class="btn btn-sm btn-green" onclick="daoVote(' + prop.id + ',\'0xYou\',\'for\')" ' + (prop.voters['0xYou'] ? 'disabled' : '') + '>👍 For</button>' +
                    '<button class="btn btn-sm" style="background:var(--accent-red);color:#fff;" onclick="daoVote(' + prop.id + ',\'0xYou\',\'against\')" ' + (prop.voters['0xYou'] ? 'disabled' : '') + '>👎 Against</button>' +
                    '<button class="btn btn-sm btn-ghost" onclick="daoVote(' + prop.id + ',\'0xYou\',\'abstain\')" ' + (prop.voters['0xYou'] ? 'disabled' : '') + '>🤷 Abstain</button>' +
                    '<button class="btn btn-sm btn-blue" onclick="daoSimulateVoting(' + prop.id + ')">🤖 Simulate Others</button>' +
                    '<button class="btn btn-sm btn-orange" onclick="daoCheckProposal(' + prop.id + ')">⚡ Finalize</button>' +
                    '</div>' : '') +
                (prop.voters['0xYou'] ? '<p style="font-size:12px;color:var(--text-muted);">You voted: ' + prop.voters['0xYou'].toUpperCase() + '</p>' : '');

            propList.appendChild(div);
        });
    }

    var logEl = document.getElementById('daoEventLog');
    if (logEl) {
        logEl.innerHTML = '';
        dao.eventLog.slice().reverse().forEach(function (ev) {
            var icons = { create: '🏛️', propose: '📝', vote: '🗳️', execute: '⚡', reject: '❌' };
            var div = document.createElement('div');
            div.className = 'te-event';
            div.innerHTML = '<span class="te-event-badge">' + (icons[ev.type] || '📋') + '</span><span class="te-event-msg">' + ev.msg + '</span><span class="te-event-time">' + ev.time + '</span>';
            logEl.appendChild(div);
        });
    }
}

window.showPropFields = function() {
    var type = document.getElementById('daoPropType').value;
    var amtGroup = document.getElementById('daoPropAmountGroup');
    var tgtGroup = document.getElementById('daoPropTargetGroup');
    if (type === 'transfer' || type === 'mint') {
        amtGroup.style.display = 'block';
        tgtGroup.style.display = 'block';
    } else if (type === 'quorum' || type === 'burn') {
        amtGroup.style.display = 'block';
        tgtGroup.style.display = 'none';
    } else {
        amtGroup.style.display = 'none';
        tgtGroup.style.display = 'none';
    }
};


// ==========================================
// WEB3: INIT & WALLET CONNECTION
// ==========================================

window.web3DaoConnectWallet = async function() {
    let providerSource = window.ethereum;

    if (typeof providerSource === 'undefined') {
        showToast("MetaMask not found!");
        return;
    }

    var btn = document.getElementById('web3DaoConnectBtn');
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

        dao.web3.provider = provider;
        dao.web3.signer = signer;
        dao.web3.address = accounts[0];
        dao.web3.chainId = Number(network.chainId);

        document.getElementById('web3DaoWalletSection').style.display = 'none';
        document.getElementById('web3DaoSetupSection').style.display = 'block';

        setDAO('web3DaoWalletAddr', shortAddrDAO(dao.web3.address));
        setDAO('web3DaoNetwork', dao.web3.chainId);

        showToast("Wallet connected");

        // Listeners
        if (typeof providerSource.removeAllListeners === 'function') {
            providerSource.removeAllListeners('accountsChanged');
            providerSource.removeAllListeners('chainChanged');
        }
        providerSource.on('accountsChanged', function(accs) {
            if (accs.length === 0) window.location.reload();
            else {
                dao.web3.address = accs[0];
                setDAO('web3DaoWalletAddr', shortAddrDAO(accs[0]));
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

window.web3DaoDeployBundle = async function() {
    if (!dao.web3.signer) return;
    try {
        var btn = document.getElementById('web3DaoDeployBtn');
        btn.disabled = true;
        btn.textContent = "Deploying Token...";

        var gData = CONTRACT_TEMPLATES['governancetoken'];
        var dData = CONTRACT_TEMPLATES['simpledao'];

        // Deploy Gov Token (Initial supply: 0)
        var TokenFactory = new ethers.ContractFactory(gData.abi, gData.bytecode, dao.web3.signer);
        var govToken = await TokenFactory.deploy(0n, { gasLimit: 3000000 });
        await govToken.waitForDeployment();
        var tokenAddr = await govToken.getAddress();

        btn.textContent = "Deploying DAO...";

        // Deploy DAO
        var DaoFactory = new ethers.ContractFactory(dData.abi, dData.bytecode, dao.web3.signer);
        var daoContract = await DaoFactory.deploy(tokenAddr, { gasLimit: 3000000 });
        await daoContract.waitForDeployment();
        var daoAddr = await daoContract.getAddress();

        showToast("DAO & Token successfully deployed!");
        document.getElementById('web3DaoContractAddr').value = daoAddr;

        await web3DaoLoadDaoContract(daoAddr, tokenAddr);

    } catch (e) {
        console.error(e);
        showToast("Deployment failed: " + e.message);
    } finally {
        var btn = document.getElementById('web3DaoDeployBtn');
        btn.disabled = false;
        btn.textContent = "Deploy DAO Bundle 🚀";
    }
};

window.web3DaoLoadContract = async function() {
    var addr = document.getElementById('web3DaoContractAddr').value.trim();
    if (!addr) { showToast("Enter DAO address"); return; }

    try {
        var btn = document.getElementById('web3DaoLoadBtn');
        btn.disabled = true;
        btn.textContent = "Loading...";

        var dData = CONTRACT_TEMPLATES['simpledao'];
        var daoContract = new ethers.Contract(addr, dData.abi, dao.web3.signer);

        var tokenAddr = await daoContract.govToken();

        await web3DaoLoadDaoContract(addr, tokenAddr);
        showToast("DAO Loaded");
    } catch (e) {
        console.error(e);
        showToast("Failed to load DAO: " + e.message);
    } finally {
        var btn = document.getElementById('web3DaoLoadBtn');
        btn.disabled = false;
        btn.textContent = "Load DAO ⬇️";
    }
};

async function web3DaoLoadDaoContract(daoAddr, tokenAddr) {
    var dData = CONTRACT_TEMPLATES['simpledao'];
    var gData = CONTRACT_TEMPLATES['governancetoken'];

    dao.web3.daoContract = new ethers.Contract(daoAddr, dData.abi, dao.web3.signer);
    dao.web3.govTokenContract = new ethers.Contract(tokenAddr, gData.abi, dao.web3.signer);

    document.getElementById('web3DaoSetupSection').style.display = 'none';
    document.getElementById('web3DaoInteractionContainer').style.display = 'none';

    await web3DaoRefreshMemberInfo();
}

// ==========================================
// WEB3: MEMBER INFO & ACTIONS
// ==========================================

window.web3DaoRefreshMemberInfo = async function() {
    if (!dao.web3.govTokenContract) return;

    try {
        dao.web3.userBalance = await dao.web3.govTokenContract.balanceOf(dao.web3.address);
        dao.web3.userVotes = await dao.web3.govTokenContract.getVotes(dao.web3.address);

        await syncDaoOnChainState();
        updateWeb3DaoUI();
    } catch(e) {
        console.error(e);
        showToast("Error fetching member data");
    }
};

function updateWeb3DaoUI() {
    if (dao.mode !== 'web3' || !dao.web3.govTokenContract) return;

    setDAO('web3DaoUserBal', ethers.formatUnits(dao.web3.userBalance, 18) + ' GOV');
    setDAO('web3DaoUserVotes', ethers.formatUnits(dao.web3.userVotes, 18));
    syncDaoSharedFromWeb3();
}

window.web3DaoMintGovTokens = async function() {
    if (!dao.web3.govTokenContract) return;
    try {
        showToast("Minting 100 GOV tokens...");
        var tx = await dao.web3.govTokenContract.mint(dao.web3.address, ethers.parseUnits("100", 18));
        await tx.wait();
        showToast("Tokens minted!");
        await web3DaoRefreshMemberInfo();
    } catch(e) {
        console.error(e);
        showToast("Mint failed: " + e.message);
    }
};

// ==========================================
// WEB3: PROPOSALS & VOTING
// ==========================================

window.web3DaoCreateProposal = async function() {
    var desc = document.getElementById('web3DaoPropDesc').value.trim();
    if (!desc) { showToast("Enter description"); return; }

    // Check for voting power first
    if (dao.web3.userVotes === 0n) {
        showToast("Error: No voting power! Mint GOV tokens first.");
        return;
    }

    try {
        var btn = event.target;
        var oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Creating...";

        showToast("Creating proposal on-chain...");
        var tx = await dao.web3.daoContract.createProposal(desc);
        await tx.wait();
        showToast("Proposal created!");
        document.getElementById('web3DaoPropDesc').value = '';
        
        btn.disabled = false;
        btn.textContent = oldText;
        
        await web3DaoRefreshMemberInfo();
    } catch(e) {
        console.error(e);
        var btn = document.querySelector('button[onclick="web3DaoCreateProposal()"]');
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Submit Proposal 📝";
        }
        showToast("Failed: " + (e.reason || e.message));
    }
};

window.web3DaoFetchProposal = async function() {
    var idStr = document.getElementById('web3DaoFetchId').value;
    if (!idStr || parseInt(idStr) <= 0) { showToast("Enter valid ID"); return; }

    var list = document.getElementById('web3DaoProposalsList');

    try {
        var id = parseInt(idStr);
        var p = await dao.web3.daoContract.getProposal(id);

        // p returns: [id, description, votesFor, votesAgainst, deadline, executed, proposer]
        var pId = Number(p.id);
        var desc = p.description;
        var votesFor = parseFloat(ethers.formatUnits(p.votesFor, 18));
        var votesAgainst = parseFloat(ethers.formatUnits(p.votesAgainst, 18));
        var deadline = Number(p.deadline) * 1000; // ms
        var executed = p.executed;
        var proposer = p.proposer;

        var totalVotes = votesFor + votesAgainst;
        var forPct = totalVotes > 0 ? (votesFor / totalVotes * 100).toFixed(0) : 0;
        var againstPct = totalVotes > 0 ? (votesAgainst / totalVotes * 100).toFixed(0) : 0;

        var now = Date.now();
        var statusBadge = '';
        if (executed) statusBadge = '<span class="badge badge-valid">✔ Executed</span>';
        else if (now > deadline) statusBadge = '<span class="badge" style="background:rgba(248,81,73,0.15);color:var(--accent-red);">Voting Ended</span>';
        else statusBadge = '<span class="badge" style="background:rgba(88,166,255,0.15);color:var(--accent-blue);">🗳️ Active</span>';

        var div = document.createElement('div');
        div.className = 'dao-proposal-card';
        div.innerHTML =
            '<div class="dao-prop-header">' +
            '<div><strong>#' + pId + ' — On-Chain Proposal</strong><br>' +
            '<span style="color:var(--text-muted);font-size:12px;">Proposed by ' + shortAddrDAO(proposer) + '</span></div>' +
            statusBadge +
            '</div>' +
            '<p style="font-size:13px;color:var(--text-secondary);">' + escapeHtmlDao(desc) + '</p>' +
            '<div class="dao-vote-bar">' +
            '<div class="dao-vote-for" style="width:' + forPct + '%;"></div>' +
            '<div class="dao-vote-against" style="width:' + againstPct + '%;"></div>' +
            '</div>' +
            '<div class="dao-vote-labels">' +
            '<span style="color:var(--accent-green);">For: ' + votesFor + ' (' + forPct + '%)</span>' +
            '<span style="color:var(--accent-red);">Against: ' + votesAgainst + ' (' + againstPct + '%)</span>' +
            '</div>' +
            (!executed && now <= deadline ?
                '<div class="dao-vote-actions">' +
                '<button class="btn btn-sm btn-green" onclick="web3DaoCastVote(' + pId + ', true)">👍 Vote For</button>' +
                '<button class="btn btn-sm" style="background:var(--accent-red);color:#fff;" onclick="web3DaoCastVote(' + pId + ', false)">👎 Vote Against</button>' +
                '</div>' : '') +
            (!executed && now > deadline ?
                '<div class="dao-vote-actions">' +
                '<button class="btn btn-sm btn-orange" onclick="web3DaoExecute(' + pId + ')">⚡ Execute</button>' +
                '</div>' : '');

        list.innerHTML = '';
        list.appendChild(div);

    } catch(e) {
        console.error(e);
        list.innerHTML = '<p style="color:var(--accent-red);font-size:13px;text-align:center;">Proposal not found or error loading.</p>';
    }
};

window.web3DaoCastVote = async function(id, support) {
    try {
        showToast("Submitting vote...");
        var tx = await dao.web3.daoContract.castVote(id, support);
        await tx.wait();
        showToast("Vote cast successfully!");
        web3DaoFetchProposal(); // reload
    } catch(e) {
        console.error(e);
        showToast("Vote failed: " + e.message);
    }
};

window.web3DaoExecute = async function(id) {
    try {
        showToast("Executing proposal...");
        var tx = await dao.web3.daoContract.executeProposal(id);
        await tx.wait();
        showToast("Proposal executed!");
        web3DaoFetchProposal(); // reload
    } catch(e) {
        console.error(e);
        showToast("Execution failed: " + e.message);
    }
};

window.web3DaoRefreshProposals = function() {
    var list = document.getElementById('web3DaoProposalsList');
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;text-align:center;">Enter an ID and fetch to view.</p>';
};


// ==========================================
// UTILS
// ==========================================

function daoLog(type, msg) {
    dao.eventLog.push({ type: type, msg: msg, time: new Date().toLocaleTimeString() });
}

function setDAO(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
}

function escapeHtmlDao(t) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(t));
    return d.innerHTML;
}

function shortAddrDAO(addr) {
    if (!addr) return '';
    return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
}

function syncDaoSharedFromWeb3() {
    if (dao.mode !== 'web3') return;

    var web3Interaction = document.getElementById('web3DaoInteractionContainer');
    if (web3Interaction) web3Interaction.style.display = 'none';

    if (!dao.web3.address) return;

    var label = document.getElementById('daoLabel');
    if (label && dao.created) {
        label.textContent = dao.name + ' (' + dao.token + ') · MetaMask ' + shortAddrDAO(dao.web3.address);
    }

    var hint = document.getElementById('daoWeb3SharedHint');
    if (!hint) {
        var active = document.getElementById('daoActiveUI');
        if (active) {
            hint = document.createElement('div');
            hint.id = 'daoWeb3SharedHint';
            hint.className = 'info-box info-purple';
            hint.style.marginBottom = 'var(--space-md)';
            active.insertBefore(hint, active.firstChild);
        }
    }

    if (hint) {
        hint.style.display = 'block';
        var balance = dao.web3.govTokenContract ? ethers.formatUnits(dao.web3.userBalance || 0n, 18) : '0';
        var votes = dao.web3.govTokenContract ? ethers.formatUnits(dao.web3.userVotes || 0n, 18) : '0';
        hint.innerHTML = '<strong>MetaMask mode:</strong> Same DAO lab controls are active. Wallet: <strong>' +
            shortAddrDAO(dao.web3.address) + '</strong> · On-chain GOV: <strong>' + balance +
            '</strong> · Voting power: <strong>' + votes + '</strong>';
    }
}

function getDaoMemberName(addr) {
    if (!addr) return '';
    if (dao.members[addr]) return dao.members[addr].name;
    return shortAddrDAO(addr);
}

function formatDaoUnits(value) {
    var raw = ethers.formatUnits(value || 0n, 18);
    var numeric = Number(raw);
    if (!Number.isFinite(numeric)) return 0;
    return Math.round(numeric * 10000) / 10000;
}

function daoWeb3Ready() {
    if (dao.mode !== 'web3') return false;
    if (!dao.web3.daoContract || !dao.web3.govTokenContract) {
        showToast('Connect MetaMask and load or deploy a DAO first.');
        return false;
    }
    return true;
}

function ensureDaoSharedWeb3Shell(totalSupply, userVotes) {
    dao.created = true;
    dao.name = dao.name || 'On-chain DAO';
    dao.token = 'GOV';
    dao.quorum = 0;
    dao.votingPeriod = 600;
    dao.totalSupply = totalSupply;
    dao.treasury = 0;
    dao.members = {};
    dao.members['0xYou'] = { name: 'You (MetaMask)', tokens: userVotes };
    if (dao.web3.address) {
        dao.members[dao.web3.address] = { name: 'MetaMask Wallet', tokens: userVotes };
    }

    var createCard = document.getElementById('daoCreateCard');
    var activeUI = document.getElementById('daoActiveUI');
    if (createCard) createCard.style.display = 'none';
    if (activeUI) activeUI.style.display = 'block';

    var mintBtn = document.getElementById('daoWeb3MintSharedBtn');
    if (!mintBtn && activeUI && dao.web3.govTokenContract) {
        mintBtn = document.createElement('button');
        mintBtn.id = 'daoWeb3MintSharedBtn';
        mintBtn.className = 'btn btn-sm btn-pink';
        mintBtn.textContent = 'Mint 100 GOV';
        mintBtn.onclick = function () { web3DaoMintGovTokens(); };
        var header = activeUI.querySelector('div');
        if (header) header.appendChild(mintBtn);
    }
}

async function syncDaoOnChainState() {
    if (dao.mode !== 'web3' || !dao.web3.daoContract || !dao.web3.govTokenContract) return;

    var totalSupply = formatDaoUnits(await dao.web3.govTokenContract.totalSupply());
    var userVotes = formatDaoUnits(dao.web3.userVotes || 0n);
    ensureDaoSharedWeb3Shell(totalSupply, userVotes);

    var proposalCount = Number(await dao.web3.daoContract.proposalCount());
    var proposals = [];
    for (var i = 1; i <= proposalCount; i++) {
        var p = await dao.web3.daoContract.getProposal(i);
        var votesFor = formatDaoUnits(p.votesFor);
        var votesAgainst = formatDaoUnits(p.votesAgainst);
        var status = p.executed ? (p.votesFor > p.votesAgainst ? 'passed' : 'rejected') : 'active';
        proposals.push({
            id: Number(p.id),
            title: 'On-chain Proposal',
            desc: p.description || 'No description',
            type: 'general',
            amount: 0,
            target: '',
            proposer: p.proposer,
            votesFor: votesFor,
            votesAgainst: votesAgainst,
            votesAbstain: 0,
            voters: {},
            status: status,
            createdAt: Number(p.deadline) * 1000
        });
    }
    dao.proposals = proposals;
    dao.nextProposalId = proposalCount + 1;

    updateDAOUI();
}

function buildWeb3DaoProposalDescription() {
    var title = document.getElementById('daoPropTitle').value.trim();
    var desc = document.getElementById('daoPropDesc').value.trim();
    var type = document.getElementById('daoPropType').value;
    var amount = document.getElementById('daoPropAmount').value;
    var target = document.getElementById('daoPropTarget').value;
    var parts = [];
    if (title) parts.push(title);
    if (desc) parts.push(desc);
    if (type && type !== 'general') parts.push('Type: ' + type);
    if (amount) parts.push('Amount: ' + amount);
    if (target) parts.push('Target: ' + target);
    return parts.join(' | ');
}

var daoBrowserActions = {
    createProposal: window.daoCreateProposal,
    vote: window.daoVote,
    checkProposal: window.daoCheckProposal,
    simulateVoting: window.daoSimulateVoting
};

window.daoCreateProposal = async function daoCreateProposalUnified() {
    if (dao.mode !== 'web3') return daoBrowserActions.createProposal();
    if (!daoWeb3Ready()) return;

    var description = buildWeb3DaoProposalDescription();
    if (!description) { showToast('Enter proposal title or description'); return; }
    if ((dao.web3.userVotes || 0n) === 0n) {
        showToast('No voting power. Mint GOV first.');
        return;
    }

    try {
        showToast('Creating proposal on-chain...');
        var tx = await dao.web3.daoContract.createProposal(description);
        await tx.wait();
        document.getElementById('daoPropTitle').value = '';
        document.getElementById('daoPropDesc').value = '';
        document.getElementById('daoPropAmount').value = '';
        await web3DaoRefreshMemberInfo();
        daoLog('propose', 'On-chain proposal submitted');
        updateDAOUI();
        syncDaoSharedFromWeb3();
        showToast('Proposal created!');
    } catch (e) {
        console.error(e);
        showToast('Failed: ' + (e.reason || e.message));
    }
};

window.daoVote = async function daoVoteUnified(proposalId, voterAddr, vote) {
    if (dao.mode !== 'web3' || !dao.web3.daoContract || voterAddr !== '0xYou') {
        return daoBrowserActions.vote(proposalId, voterAddr, vote);
    }
    if (vote === 'abstain') {
        showToast('The on-chain DAO supports For/Against votes only.');
        return;
    }

    try {
        showToast('Submitting vote...');
        var tx = await dao.web3.daoContract.castVote(proposalId, vote === 'for');
        await tx.wait();
        await web3DaoRefreshMemberInfo();
        daoLog('vote', 'You voted ' + vote.toUpperCase() + ' on-chain on Proposal #' + proposalId);
        updateDAOUI();
        syncDaoSharedFromWeb3();
        showToast('Vote cast successfully!');
    } catch (e) {
        console.error(e);
        showToast('Vote failed: ' + (e.reason || e.message));
    }
};

window.daoCheckProposal = async function daoCheckProposalUnified(proposalId) {
    if (dao.mode !== 'web3' || !dao.web3.daoContract) {
        return daoBrowserActions.checkProposal(proposalId);
    }

    try {
        showToast('Executing proposal...');
        var tx = await dao.web3.daoContract.executeProposal(proposalId);
        await tx.wait();
        await web3DaoRefreshMemberInfo();
        daoLog('execute', 'Proposal #' + proposalId + ' executed on-chain');
        updateDAOUI();
        syncDaoSharedFromWeb3();
        showToast('Proposal executed!');
    } catch (e) {
        console.error(e);
        showToast('Execution failed: ' + (e.reason || e.message));
    }
};

window.daoSimulateVoting = function daoSimulateVotingUnified(proposalId) {
    if (dao.mode === 'web3' && dao.web3.daoContract) {
        showToast('Simulating other voters locally; MetaMask signs only your vote.');
    }
    return daoBrowserActions.simulateVoting(proposalId);
};
