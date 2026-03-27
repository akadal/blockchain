/* ========================================
   Section 5 — Block (Single Block Mining)
   ======================================== */

var DIFFICULTY = '0000';

async function updateSingleBlock() {
    var blockNum = document.getElementById('singleBlockNumber').value;
    var nonce = document.getElementById('singleBlockNonce').value;
    var data = document.getElementById('singleBlockData').value;
    var hashEl = document.getElementById('singleBlockHash');
    var blockCard = document.getElementById('singleBlock');
    var statusEl = document.getElementById('singleBlockStatus');

    var text = blockNum + nonce + data;
    var hash = await sha256(text);

    hashEl.textContent = hash;

    if (hash.startsWith(DIFFICULTY)) {
        blockCard.className = 'block-card valid pulse-valid';
        statusEl.textContent = '✔ Valid';
        hashEl.innerHTML = '<span style="color: var(--accent-green); font-weight: 700;">' + DIFFICULTY + '</span>' + hash.substring(DIFFICULTY.length);
    } else {
        blockCard.className = 'block-card invalid';
        statusEl.textContent = '⚠ Invalid';
    }
}

async function mineSingleBlock() {
    var blockNum = document.getElementById('singleBlockNumber').value;
    var data = document.getElementById('singleBlockData').value;
    var nonceEl = document.getElementById('singleBlockNonce');
    var btn = document.getElementById('singleMineBtn');

    btn.disabled = true;
    btn.innerHTML = '<span class="mining-spinner"></span> Mining...';

    var nonce = 0;
    var found = false;

    async function mineLoop() {
        var batchSize = 200;
        for (var i = 0; i < batchSize; i++) {
            var text = blockNum + nonce + data;
            var hash = await sha256(text);

            if (hash.startsWith(DIFFICULTY)) {
                nonceEl.value = nonce;
                await updateSingleBlock();
                btn.disabled = false;
                btn.textContent = 'Mine ⛏️';
                showToast('Block mined! Nonce: ' + nonce);
                found = true;
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
