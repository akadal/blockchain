/* ========================================
   Section 7 — Distributed Blockchain
   Fork simulation & longest-chain-wins
   ======================================== */

var distributed = {
    initialized: false,
    peers: {},       // peerId -> { chain: [...blocks], color }
    peerIds: ['A', 'B', 'C'],
    peerNames: { A: 'Node Alpha', B: 'Node Beta', C: 'Node Gamma' },
    peerColors: { A: 'var(--accent-blue)', B: 'var(--accent-green)', C: 'var(--accent-purple)' },
    blockCounter: 0,
    difficulty: '000',
    genesisHash: '0'.repeat(64)
};

// ==========================================
// INIT
// ==========================================

function initDistributed() {
    if (distributed.initialized) return;
    distributed.initialized = true;
    resetDistributed();
}

function resetDistributed() {
    distributed.blockCounter = 0;
    distributed.peers = {};

    // All peers start with same genesis block
    var genesis = makeBlock(0, 'Genesis Block', distributed.genesisHash);
    distributed.peerIds.forEach(function (id) {
        distributed.peers[id] = { chain: [genesis], pendingData: '' };
    });

    renderDistributed();
    logDist('All nodes initialized with genesis block');
}

// ==========================================
// BLOCK CREATION
// ==========================================

function makeBlock(index, data, prevHash) {
    distributed.blockCounter++;
    return {
        id: distributed.blockCounter,
        index: index,
        data: data || 'Block ' + index,
        prevHash: prevHash,
        nonce: 0,
        hash: '',
        mined: false,
        orphaned: false,
        minedBy: null,
        timestamp: Date.now()
    };
}

async function hashBlock(block) {
    var text = block.index + '' + block.nonce + block.data + block.prevHash;
    return await sha256(text);
}

async function mineBlockObj(block) {
    var nonce = 0;
    while (true) {
        block.nonce = nonce;
        var hash = await hashBlock(block);
        if (hash.startsWith(distributed.difficulty)) {
            block.hash = hash;
            block.mined = true;
            return block;
        }
        nonce++;
        if (nonce > 500000) break; // safety
    }
    return block;
}

// ==========================================
// ACTIONS
// ==========================================

async function distMineBlock(peerId) {
    var peer = distributed.peers[peerId];
    var lastBlock = peer.chain[peer.chain.length - 1];
    var dataInput = document.getElementById('distData_' + peerId);
    var data = dataInput ? dataInput.value.trim() : '';
    if (!data) data = distributed.peerNames[peerId] + ' Block ' + (lastBlock.index + 1);

    // Disable button while mining
    var btn = document.getElementById('distMineBtn_' + peerId);
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="mining-spinner"></span> Mining...'; }

    var newBlock = makeBlock(lastBlock.index + 1, data, lastBlock.hash);
    newBlock.minedBy = peerId;

    // Mine in chunks for UI responsiveness
    await mineBlockAsync(newBlock, btn, peerId);
}

async function mineBlockAsync(block, btn, peerId) {
    var nonce = 0;
    var batchSize = 500;

    async function loop() {
        for (var i = 0; i < batchSize; i++) {
            block.nonce = nonce;
            var text = block.index + '' + nonce + block.data + block.prevHash;
            var hash = await sha256(text);
            if (hash.startsWith(distributed.difficulty)) {
                block.hash = hash;
                block.mined = true;

                distributed.peers[peerId].chain.push(block);
                if (btn) { btn.disabled = false; btn.textContent = 'Mine Block ⛏️'; }
                renderDistributed();
                logDist(distributed.peerNames[peerId] + ' mined Block #' + block.index + ' (nonce: ' + nonce + ')');
                var dataInput = document.getElementById('distData_' + peerId);
                if (dataInput) dataInput.value = '';
                return;
            }
            nonce++;
        }
        requestAnimationFrame(loop);
    }
    loop();
}

function distPropagate(peerId) {
    var sourcePeer = distributed.peers[peerId];
    var sourceLen = sourcePeer.chain.length;

    var updated = [];
    distributed.peerIds.forEach(function (targetId) {
        if (targetId === peerId) return;
        var targetPeer = distributed.peers[targetId];

        if (sourceLen > targetPeer.chain.length) {
            // Longest chain wins — replace target's chain
            // Mark old unique blocks as orphaned for animation
            var oldChain = targetPeer.chain.slice();
            targetPeer.chain = sourcePeer.chain.map(function (b) {
                return Object.assign({}, b); // deep copy
            });
            updated.push(targetId);
        }
    });

    if (updated.length > 0) {
        renderDistributed();
        logDist(distributed.peerNames[peerId] + '\'s chain propagated to ' +
            updated.map(function (id) { return distributed.peerNames[id]; }).join(', ') +
            ' (longest chain wins!)');
    } else {
        logDist(distributed.peerNames[peerId] + ' tried to propagate, but other nodes have equal or longer chains');
    }
}

function distForkScenario() {
    // Reset to fresh state with genesis
    resetDistributed();

    // Auto-mine 2 blocks on Node A for base chain
    logDist('🔀 Fork scenario: mining a common base on Node A...');

    (async function () {
        // Mine 2 base blocks on A
        var peer = distributed.peers['A'];
        for (var i = 0; i < 2; i++) {
            var lastBlock = peer.chain[peer.chain.length - 1];
            var block = makeBlock(lastBlock.index + 1, 'Shared Block ' + (i + 1), lastBlock.hash);
            block.minedBy = 'A';
            await mineBlockObj(block);
            peer.chain.push(block);
        }

        // Copy chain to B and C
        distributed.peerIds.forEach(function (id) {
            if (id !== 'A') {
                distributed.peers[id].chain = peer.chain.map(function (b) {
                    return Object.assign({}, b);
                });
            }
        });
        renderDistributed();
        logDist('Base chain (3 blocks) shared to all nodes');

        // Now mine different blocks on A and B (fork!)
        var peerA = distributed.peers['A'];
        var peerB = distributed.peers['B'];
        var lastA = peerA.chain[peerA.chain.length - 1];
        var lastB = peerB.chain[peerB.chain.length - 1];

        var forkA = makeBlock(lastA.index + 1, '🅰️ Alice pays Bob 5 ETH', lastA.hash);
        forkA.minedBy = 'A';
        await mineBlockObj(forkA);
        peerA.chain.push(forkA);

        var forkB = makeBlock(lastB.index + 1, '🅱️ Charlie pays Dave 3 ETH', lastB.hash);
        forkB.minedBy = 'B';
        await mineBlockObj(forkB);
        peerB.chain.push(forkB);

        renderDistributed();
        logDist('⚠️ FORK! Node A and Node B mined different Block #3');
        logDist('Node A: "Alice pays Bob 5 ETH" | Node B: "Charlie pays Dave 3 ETH"');
        logDist('Now mine more blocks on one node, then propagate to see longest-chain-wins!');
    })();
}

function distResolve() {
    // Add one more block to Node A to make it longer, then propagate
    var peerA = distributed.peers['A'];
    var peerB = distributed.peers['B'];

    // Find longer chain or make A longer
    if (peerA.chain.length <= peerB.chain.length) {
        logDist('Mining extra block on Node A to create longer chain...');
        (async function () {
            var last = peerA.chain[peerA.chain.length - 1];
            var extra = makeBlock(last.index + 1, '🅰️ Extra Block (making A longer)', last.hash);
            extra.minedBy = 'A';
            await mineBlockObj(extra);
            peerA.chain.push(extra);
            renderDistributed();
            logDist('Node A now has ' + peerA.chain.length + ' blocks — longest chain!');

            // Propagate
            setTimeout(function () {
                distPropagate('A');
                logDist('✅ Fork resolved! Longest chain (Node A) overwrites shorter chains.');
            }, 500);
        })();
    } else {
        distPropagate('A');
        logDist('✅ Fork resolved! Longest chain (Node A) overwrites shorter chains.');
    }
}

// ==========================================
// 51% ATTACK SIMULATION
// ==========================================

async function distAttackScenario() {
    resetDistributed();

    // Auto-mine 1 block on Node A for base chain
    logDist('🚨 51% Attack Simulation started...');
    logDist('Node A (Honest Network) vs Node C (Malicious Attacker with 51% Hashpower)');

    var peerA = distributed.peers['A'];
    var peerC = distributed.peers['C'];

    var lastA = peerA.chain[peerA.chain.length - 1];
    var blockA1 = makeBlock(lastA.index + 1, 'Honest Tx: Alice sends 10 ETH to Bob', lastA.hash);
    blockA1.minedBy = 'A';
    await mineBlockObj(blockA1);
    peerA.chain.push(blockA1);

    // B follows A
    distributed.peers['B'].chain = peerA.chain.map(b => Object.assign({}, b));

    renderDistributed();
    logDist('Network accepts Honest Tx (Block #1). Bob ships the product.');

    // Node C secretly mines a conflicting block AND another block to outpace the network
    logDist('😈 Node C is secretly mining an alternate history to double-spend...');

    var lastC = peerC.chain[0]; // C forks from Genesis
    var blockC1 = makeBlock(lastC.index + 1, 'Malicious Tx: Alice sends 10 ETH to Herself (Double Spend)', lastC.hash);
    blockC1.minedBy = 'C';
    await mineBlockObj(blockC1);
    peerC.chain.push(blockC1);

    var blockC2 = makeBlock(blockC1.index + 1, 'Attacker Block 2', blockC1.hash);
    blockC2.minedBy = 'C';
    await mineBlockObj(blockC2);
    peerC.chain.push(blockC2);

    renderDistributed();
    logDist('😈 Node C now has a LONGER chain (2 blocks) than the honest network (1 block).');

    setTimeout(() => {
        logDist('📡 Node C broadcasts its longer chain to the network...');
        distPropagate('C');
        logDist('💀 Attack Successful! The network drops the Honest Tx and accepts the Malicious Tx because of the longest-chain rule. Bob loses his money and the product.');
    }, 2000);
}

// ==========================================
// RENDER
// ==========================================

function renderDistributed() {
    var container = document.getElementById('distContainer');
    if (!container) return;
    container.innerHTML = '';

    distributed.peerIds.forEach(function (peerId) {
        var peer = distributed.peers[peerId];

        var peerRow = document.createElement('div');
        peerRow.className = 'dist-peer';

        // Peer header
        var header = document.createElement('div');
        header.className = 'dist-peer-header';
        header.innerHTML =
            '<div class="dist-peer-name" style="color:' + distributed.peerColors[peerId] + ';">' +
            '<span class="dist-peer-icon">🖥️</span> ' + distributed.peerNames[peerId] +
            ' <span class="badge" style="font-size:10px;">' + peer.chain.length + ' blocks</span>' +
            '</div>' +
            '<div class="dist-peer-actions">' +
            '<input type="text" id="distData_' + peerId + '" class="form-input form-input-sm" ' +
            'placeholder="Block data..." style="width: 160px; display: inline-block;">' +
            '<button id="distMineBtn_' + peerId + '" onclick="distMineBlock(\'' + peerId + '\')" ' +
            'class="btn btn-sm btn-orange">Mine Block ⛏️</button>' +
            '<button onclick="distPropagate(\'' + peerId + '\')" ' +
            'class="btn btn-sm btn-blue">Propagate 📡</button>' +
            '</div>';
        peerRow.appendChild(header);

        // Chain blocks
        var chainDiv = document.createElement('div');
        chainDiv.className = 'dist-chain';

        peer.chain.forEach(function (block, idx) {
            if (idx > 0) {
                var arrow = document.createElement('div');
                arrow.className = 'dist-arrow';
                arrow.textContent = '→';
                chainDiv.appendChild(arrow);
            }

            var blockEl = document.createElement('div');
            var isGenesis = block.index === 0;
            var classes = 'dist-block';
            if (isGenesis) classes += ' dist-block-genesis';
            else if (block.mined) classes += ' dist-block-mined';
            if (block.orphaned) classes += ' dist-block-orphaned';
            blockEl.className = classes;

            var hashDisplay = block.hash || '—';
            var shortHash = hashDisplay.length > 12 ? hashDisplay.substring(0, 8) + '…' + hashDisplay.substring(hashDisplay.length - 4) : hashDisplay;
            var prevShort = block.prevHash ? block.prevHash.substring(0, 8) + '…' : '—';

            blockEl.innerHTML =
                '<div class="dist-block-num">#' + block.index + '</div>' +
                '<div class="dist-block-data">' + escapeHtml(block.data || '') + '</div>' +
                '<div class="dist-block-hash" title="' + hashDisplay + '">' + shortHash + '</div>' +
                (block.minedBy ? '<div class="dist-block-miner" style="color:' + distributed.peerColors[block.minedBy] + ';">⛏ ' + distributed.peerNames[block.minedBy] + '</div>' : '');
            chainDiv.appendChild(blockEl);
        });

        peerRow.appendChild(chainDiv);
        container.appendChild(peerRow);
    });

    // Highlight forks
    highlightForks();
}

function highlightForks() {
    // Compare chains — if they diverge, add visual indicator
    var chains = distributed.peerIds.map(function (id) { return distributed.peers[id].chain; });
    var maxLen = Math.max.apply(null, chains.map(function (c) { return c.length; }));
    var statusEl = document.getElementById('distStatus');
    if (!statusEl) return;

    var forked = false;
    for (var i = 1; i < maxLen; i++) {
        var hashes = chains.map(function (c) { return c[i] ? c[i].hash : null; }).filter(Boolean);
        var unique = hashes.filter(function (v, idx, self) { return self.indexOf(v) === idx; });
        if (unique.length > 1) { forked = true; break; }
    }

    if (forked) {
        statusEl.innerHTML = '<span class="badge" style="background: rgba(248,81,73,0.15); color: var(--accent-red);">⚠️ Fork Detected — Chains Diverged!</span>';
    } else {
        var lengths = chains.map(function (c) { return c.length; });
        var allSame = lengths.every(function (l) { return l === lengths[0]; });
        if (allSame) {
            statusEl.innerHTML = '<span class="badge badge-valid">✔ All nodes in consensus</span>';
        } else {
            statusEl.innerHTML = '<span class="badge" style="background: rgba(210,153,34,0.15); color: var(--accent-orange);">⏳ Chains out of sync — propagate to resolve</span>';
        }
    }
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

// ==========================================
// LOG
// ==========================================

var distLog = [];

function logDist(msg) {
    var now = new Date();
    distLog.push({ time: now.toLocaleTimeString(), msg: msg });
    var logEl = document.getElementById('distLog');
    if (!logEl) return;
    logEl.innerHTML = '';
    distLog.slice().reverse().forEach(function (entry) {
        var div = document.createElement('div');
        div.className = 'dist-log-entry';
        div.innerHTML = '<span class="dist-log-time">' + entry.time + '</span> ' + entry.msg;
        logEl.appendChild(div);
    });
}
