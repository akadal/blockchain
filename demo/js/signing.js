/* ========================================
   Section 4 — Digital Signatures (ECDSA)
   Uses Web Crypto API for real ECDSA P-256
   ======================================== */

var signingKeyPair = null;

async function generateSigningKeys() {
    var btn = document.getElementById('sigGenBtn');
    btn.textContent = 'Generating...';
    btn.disabled = true;

    try {
        signingKeyPair = await window.crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-256' },
            true,
            ['sign', 'verify']
        );

        // Export keys to display
        var pubKeyRaw = await window.crypto.subtle.exportKey('raw', signingKeyPair.publicKey);
        var privKeyJwk = await window.crypto.subtle.exportKey('jwk', signingKeyPair.privateKey);

        document.getElementById('sigPubKey').textContent = bytesToHex(new Uint8Array(pubKeyRaw));
        document.getElementById('sigPrivKey').textContent = privKeyJwk.d;

        btn.textContent = 'Generate Key Pair 🎲';
        btn.disabled = false;
        showToast('ECDSA key pair generated!');
    } catch (e) {
        btn.textContent = 'Generate Key Pair 🎲';
        btn.disabled = false;
        showToast('Key generation failed: ' + e.message);
    }
}

async function signMessage() {
    if (!signingKeyPair) {
        showToast('Generate a key pair first!');
        return;
    }

    var message = document.getElementById('sigMessage').value;
    if (!message) {
        showToast('Enter a message to sign.');
        return;
    }

    try {
        var encoded = new TextEncoder().encode(message);
        var signature = await window.crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' },
            signingKeyPair.privateKey,
            encoded
        );

        var sigHex = bytesToHex(new Uint8Array(signature));
        document.getElementById('sigSignature').textContent = sigHex;

        // Auto-fill verify section
        document.getElementById('sigVerifyMessage').value = message;
        document.getElementById('sigVerifySignature').value = sigHex;
        var pubKeyRaw = await window.crypto.subtle.exportKey('raw', signingKeyPair.publicKey);
        document.getElementById('sigVerifyPubKey').value = bytesToHex(new Uint8Array(pubKeyRaw));

        showToast('Message signed!');
    } catch (e) {
        showToast('Signing failed: ' + e.message);
    }
}

async function verifySignature() {
    var message = document.getElementById('sigVerifyMessage').value;
    var sigHex = document.getElementById('sigVerifySignature').value;
    var pubKeyHex = document.getElementById('sigVerifyPubKey').value;
    var resultEl = document.getElementById('sigVerifyResult');

    if (!message || !sigHex || !pubKeyHex) {
        showToast('Please fill in all verify fields.');
        return;
    }

    try {
        var pubKeyBytes = hexToBytes(pubKeyHex);
        var pubKey = await window.crypto.subtle.importKey(
            'raw',
            pubKeyBytes,
            { name: 'ECDSA', namedCurve: 'P-256' },
            false,
            ['verify']
        );

        var sigBytes = hexToBytes(sigHex);
        var encoded = new TextEncoder().encode(message);

        var isValid = await window.crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            pubKey,
            sigBytes,
            encoded
        );

        resultEl.style.display = 'block';
        if (isValid) {
            resultEl.className = 'signature-result verified';
            resultEl.textContent = '✔ Signature Valid — Message is authentic!';
        } else {
            resultEl.className = 'signature-result failed';
            resultEl.textContent = '✘ Signature Invalid — Message was tampered with!';
        }
    } catch (e) {
        resultEl.style.display = 'block';
        resultEl.className = 'signature-result failed';
        resultEl.textContent = '✘ Verification Error: ' + e.message;
    }
}
