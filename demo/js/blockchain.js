/* ========================================
   Section 6 — Blockchain (Chain of Blocks)
   ======================================== */

var CHAIN_LENGTH = 5;
var chainInitialized = false;

var chainDefaults = [
    { block: 1, nonce: 11316, data: '', previous: '0000000000000000000000000000000000000000000000000000000000000000' },
    { block: 2, nonce: 35230, data: '', previous: '' },
    { block: 3, nonce: 12937, data: '', previous: '' },
    { block: 4, nonce: 35990, data: '', previous: '' },
    { block: 5, nonce: 56265, data: '', previous: '' }
];

function initBlockchain() {
    if (chainInitialized) return;
    chainInitialized = true;

    var container = document.getElementById('blockchainContainer');
    container.innerHTML = '';

    for (var i = 0; i < CHAIN_LENGTH; i++) {
        var def = chainDefaults[i];

        // Arrow between blocks
        if (i > 0) {
            var arrow = document.createElement('div');
            arrow.className = 'chain-arrow';
            arrow.textContent = '→';
            container.appendChild(arrow);
        }

        var blockEl = document.createElement('div');
        blockEl.className = 'block-card';
        blockEl.id = 'chainBlock' + def.block;

        blockEl.innerHTML =
            '<div class="block-header">' +
            '<span class="block-number">Block #' + def.block + '</span>' +
            '<span class="block-status" id="chainStatus' + def.block + '">—</span>' +
            '</div>' +
            '<div class="form-group">' +
            '<label class="form-label">Block #</label>' +
            '<input type="number" id="chainNum' + def.block + '" class="form-input form-input-sm" value="' + def.block + '" oninput="updateChainFromBlock(' + def.block + ')">' +
            '</div>' +
            '<div class="form-group">' +
            '<label class="form-label">Nonce</label>' +
            '<input type="text" id="chainNonce' + def.block + '" class="form-input form-input-sm" value="' + def.nonce + '" oninput="updateChainFromBlock(' + def.block + ')">' +
            '</div>' +
            '<div class="form-group">' +
            '<label class="form-label">Data</label>' +
            '<textarea id="chainData' + def.block + '" class="form-textarea" style="min-height:50px;" placeholder="Enter data..." oninput="updateChainFromBlock(' + def.block + ')"></textarea>' +
            '</div>' +
            '<div class="form-group">' +
            '<label class="form-label">Prev Hash</label>' +
            '<div id="chainPrev' + def.block + '" class="hash-output" style="font-size:10px;">' + def.previous + '</div>' +
            '</div>' +
            '<div class="form-group">' +
            '<label class="form-label">Hash</label>' +
            '<div id="chainHash' + def.block + '" class="hash-output" style="font-size:10px;"></div>' +
            '</div>' +
            '<button onclick="mineChainBlock(' + def.block + ')" id="chainMineBtn' + def.block + '" class="btn btn-orange btn-full btn-sm">Mine ⛏️</button>';

        container.appendChild(blockEl);
    }

    // Calculate all hashes
    updateChainFromBlock(1);
}

async function getChainBlockHash(blockNum) {
    var num = document.getElementById('chainNum' + blockNum).value;
    var nonce = document.getElementById('chainNonce' + blockNum).value;
    var data = document.getElementById('chainData' + blockNum).value;
    var prev = document.getElementById('chainPrev' + blockNum).textContent;
    var text = num + nonce + data + prev;
    return await sha256(text);
}

async function updateChainBlockState(blockNum) {
    var hash = await getChainBlockHash(blockNum);
    var hashEl = document.getElementById('chainHash' + blockNum);
    var blockCard = document.getElementById('chainBlock' + blockNum);
    var statusEl = document.getElementById('chainStatus' + blockNum);

    hashEl.textContent = hash;

    if (hash.startsWith(DIFFICULTY)) {
        blockCard.className = 'block-card valid';
        statusEl.textContent = '✔ Valid';
        hashEl.innerHTML = '<span style="color: var(--accent-green); font-weight: 700;">' + DIFFICULTY + '</span>' + hash.substring(DIFFICULTY.length);
    } else {
        blockCard.className = 'block-card invalid';
        statusEl.textContent = '⚠ Invalid';
    }

    return hash;
}

async function updateChainFromBlock(startBlock) {
    for (var i = startBlock; i <= CHAIN_LENGTH; i++) {
        if (i > 1) {
            var prevHash = document.getElementById('chainHash' + (i - 1)).textContent;
            document.getElementById('chainPrev' + i).textContent = prevHash;
        }
        await updateChainBlockState(i);
    }
}

async function mineChainBlock(blockNum) {
    var nonceEl = document.getElementById('chainNonce' + blockNum);
    var btn = document.getElementById('chainMineBtn' + blockNum);

    btn.disabled = true;
    btn.innerHTML = '<span class="mining-spinner"></span> Mining...';

    var blockNumVal = document.getElementById('chainNum' + blockNum).value;
    var data = document.getElementById('chainData' + blockNum).value;
    var prev = document.getElementById('chainPrev' + blockNum).textContent;

    var nonce = 0;
    var found = false;

    async function mineLoop() {
        var batchSize = 200;
        for (var i = 0; i < batchSize; i++) {
            var text = blockNumVal + nonce + data + prev;
            var hash = await sha256(text);

            if (hash.startsWith(DIFFICULTY)) {
                found = true;
                nonceEl.value = nonce;
                await updateChainFromBlock(blockNum);
                btn.disabled = false;
                btn.textContent = 'Mine ⛏️';
                showToast('Block ' + blockNum + ' mined!');
                return;
            }
            nonce++;
        }

        nonceEl.value = nonce;

        if (!found) {
            requestAnimationFrame(mineLoop);
        }
    }

    mineLoop();
}
