/* ========================================
   Section 8 — Transaction
   ======================================== */

function loadWalletForTx() {
    if (!currentWallet) {
        showToast('Generate a wallet in Step 7 first!');
        return;
    }
    document.getElementById('txFrom').value = currentWallet.address;
    showToast('Wallet loaded!');
}

async function signTransaction() {
    var from = document.getElementById('txFrom').value;
    var to = document.getElementById('txTo').value;
    var amount = document.getElementById('txAmount').value;

    if (!from || !to || !amount) {
        showToast('Please fill in all transaction fields.');
        return;
    }

    var btn = document.getElementById('txSignBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="mining-spinner"></span> Signing...';

    try {
        // Create transaction data
        var txData = JSON.stringify({
            from: from,
            to: to,
            amount: parseFloat(amount),
            timestamp: Date.now(),
            nonce: Math.floor(Math.random() * 100000)
        });

        // Hash the transaction
        var txHash = await sha256(txData);

        // Sign (simulated — HMAC with private key as key)
        var privKey = currentWallet ? currentWallet.privateKey : await sha256('default-key');
        var signature = CryptoJS.HmacSHA256(txHash, privKey).toString();

        // Display result
        var resultEl = document.getElementById('txResult');
        resultEl.style.display = 'block';

        var detailsEl = document.getElementById('txDetails');
        detailsEl.innerHTML =
            '<div class="tx-row"><span class="tx-label">From</span><span class="tx-value">' + shortAddr(from) + '</span></div>' +
            '<div class="tx-row"><span class="tx-label">To</span><span class="tx-value">' + shortAddr(to) + '</span></div>' +
            '<div class="tx-row"><span class="tx-label">Amount</span><span class="tx-value" style="color: var(--accent-green);">' + amount + ' TOKEN</span></div>' +
            '<div class="tx-row"><span class="tx-label">Tx Hash</span><span class="tx-value" style="font-size:9px; word-break:break-all;">' + txHash + '</span></div>' +
            '<div class="tx-row"><span class="tx-label">Signature</span><span class="tx-value" style="font-size:9px; color: var(--accent-orange); word-break:break-all;">' + signature + '</span></div>';

        document.getElementById('txVerifyResult').style.display = 'block';
        document.getElementById('txMinedResult').style.display = 'none';

        // Store for mining
        window._lastTx = { data: txData, hash: txHash, signature: signature };

        btn.disabled = false;
        btn.textContent = 'Sign & Create Transaction ✍️';
        showToast('Transaction signed!');
    } catch (e) {
        btn.disabled = false;
        btn.textContent = 'Sign & Create Transaction ✍️';
        showToast('Error: ' + e.message);
    }
}

async function mineTransaction() {
    if (!window._lastTx) return;

    var btn = document.getElementById('txMineBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="mining-spinner"></span> Mining...';

    var tx = window._lastTx;
    var blockNum = Math.floor(Math.random() * 9000) + 1000;
    var nonce = 0;
    var found = false;

    async function mineLoop() {
        var batchSize = 200;
        for (var i = 0; i < batchSize; i++) {
            var text = blockNum.toString() + nonce + tx.hash;
            var hash = await sha256(text);

            if (hash.startsWith(DIFFICULTY)) {
                found = true;
                document.getElementById('txMinedResult').style.display = 'block';
                document.getElementById('txMinedBlockNum').textContent = 'Block #' + blockNum;
                document.getElementById('txMinedHash').innerHTML =
                    '<span style="color: var(--accent-green); font-weight: 700;">' + DIFFICULTY + '</span>' + hash.substring(DIFFICULTY.length);
                document.getElementById('txMinedNonce').textContent = nonce;

                btn.disabled = false;
                btn.textContent = 'Mine into Block ⛏️';
                showToast('Transaction mined into Block #' + blockNum + '!');
                return;
            }
            nonce++;
        }

        if (!found) {
            requestAnimationFrame(mineLoop);
        }
    }

    mineLoop();
}

function shortAddr(addr) {
    if (!addr) return '—';
    return addr;
}
