/* ========================================
   Section 3 — Asymmetric Encryption (RSA)
   Uses JSEncrypt library for RSA-2048
   ======================================== */

var rsaCrypt = null;

function generateRSAKeys() {
    var btn = document.getElementById('rsaGenBtn');
    btn.textContent = 'Generating...';
    btn.disabled = true;

    setTimeout(function () {
        rsaCrypt = new JSEncrypt({ default_key_size: 2048 });
        rsaCrypt.getKey(function () {
            document.getElementById('rsaPubKey').value = rsaCrypt.getPublicKey();
            document.getElementById('rsaPrivKey').value = rsaCrypt.getPrivateKey();
            btn.textContent = 'Generate Key Pair 🎲';
            btn.disabled = false;
            showToast('RSA key pair generated!');
        });
    }, 100);
}

function rsaEncrypt() {
    var pubKey = document.getElementById('rsaEncPubKey').value;
    var msg = document.getElementById('rsaMsgToEncrypt').value;

    if (!pubKey || !msg) {
        showToast('Please provide a public key and a message.');
        return;
    }

    var encryptor = new JSEncrypt();
    encryptor.setPublicKey(pubKey);
    var encrypted = encryptor.encrypt(msg);

    if (!encrypted) {
        showToast('Encryption failed. Message may be too long for RSA.');
        return;
    }

    document.getElementById('rsaCipherText').value = encrypted;
    showToast('Message encrypted with public key!');
}

function rsaDecrypt() {
    var cipher = document.getElementById('rsaDecCipher').value;
    var resultEl = document.getElementById('rsaDecryptedMsg');

    if (!cipher) {
        showToast('Please paste an encrypted message.');
        return;
    }

    if (!rsaCrypt || !rsaCrypt.getPrivateKey()) {
        showToast('Generate a key pair first (Step 1).');
        return;
    }

    var decrypted = rsaCrypt.decrypt(cipher);

    if (!decrypted) {
        resultEl.textContent = '❌ Decryption Failed';
        resultEl.style.color = 'var(--accent-red)';
    } else {
        resultEl.textContent = decrypted;
        resultEl.style.color = 'var(--accent-green)';
        showToast('Message decrypted!');
    }
}
