/* ========================================
   Section 7 — Wallet (Mnemonic / BIP39)
   Step-by-step wallet generation
   ======================================== */

var currentWallet = null;

async function generateWallet() {
    var btn = document.getElementById('walletGenBtn');
    btn.textContent = 'Generating...';
    btn.disabled = true;

    try {
        // Step 1: Generate Entropy (128 bits = 16 bytes)
        var entropy = new Uint8Array(16);
        window.crypto.getRandomValues(entropy);
        var entropyHex = bytesToHex(entropy);
        document.getElementById('walletEntropy').textContent = entropyHex;

        // Step 2: Convert entropy to mnemonic words
        var entropyBits = '';
        for (var i = 0; i < entropy.length; i++) {
            entropyBits += entropy[i].toString(2).padStart(8, '0');
        }

        // Calculate checksum (SHA-256 of entropy, take first 4 bits for 128-bit entropy)
        var hashBuffer = await crypto.subtle.digest('SHA-256', entropy);
        var hashArray = new Uint8Array(hashBuffer);
        var checksumBits = hashArray[0].toString(2).padStart(8, '0').substring(0, 4);
        var allBits = entropyBits + checksumBits;

        // Split into 12 groups of 11 bits
        var words = [];
        for (var i = 0; i < 12; i++) {
            var idx = parseInt(allBits.substring(i * 11, (i + 1) * 11), 2);
            words.push(BIP39_WORDLIST[idx]);
        }

        var mnemonicEl = document.getElementById('walletMnemonic');
        mnemonicEl.innerHTML = '';
        for (var i = 0; i < words.length; i++) {
            var wordEl = document.createElement('div');
            wordEl.className = 'mnemonic-word';
            wordEl.innerHTML = '<span class="word-index">' + (i + 1) + '</span>' + words[i];
            mnemonicEl.appendChild(wordEl);
        }

        var mnemonic = words.join(' ');

        // Step 3: Seed (simplified — SHA-256 of mnemonic phrase)
        var seed = await sha256(mnemonic);
        document.getElementById('walletSeed').textContent = seed;

        // Step 4: Private Key (derive from seed — take first 32 bytes of another hash)
        var privKeyHex = await sha256('privkey:' + seed);
        document.getElementById('walletPrivKey').textContent = privKeyHex;

        // Step 5: Public Key (simulated derivation — in real life this would be ECDSA point multiplication)
        var pubKeyHex = await sha256('pubkey:' + privKeyHex);
        document.getElementById('walletPubKey').textContent = '04' + pubKeyHex;

        // Step 6: Address (hash of public key, take last 40 chars, add 0x prefix)
        var addrHash = await sha256('04' + pubKeyHex);
        var address = '0x' + addrHash.substring(addrHash.length - 40);
        document.getElementById('walletAddress').textContent = address;

        // Store wallet state for Transaction section
        currentWallet = {
            mnemonic: mnemonic,
            privateKey: privKeyHex,
            publicKey: '04' + pubKeyHex,
            address: address
        };

        btn.textContent = 'Generate New Wallet 🎲';
        btn.disabled = false;
        showToast('Wallet generated! 12 mnemonic words created.');

    } catch (e) {
        btn.textContent = 'Generate New Wallet 🎲';
        btn.disabled = false;
        showToast('Error: ' + e.message);
    }
}
