/* ========================================
   Section 2 — Symmetric Encryption (AES)
   ======================================== */

function aesEncrypt() {
    var msg = document.getElementById('aesInput').value;
    var key = document.getElementById('aesKey').value;
    var output = document.getElementById('aesOutput');

    if (!msg || !key) {
        showToast('Please enter both a message and a key.');
        return;
    }

    var encrypted = CryptoJS.AES.encrypt(msg, key).toString();
    output.value = encrypted;
    showToast('Message encrypted!');
}

function aesDecrypt() {
    var msg = document.getElementById('aesInput').value;
    var key = document.getElementById('aesKey').value;
    var output = document.getElementById('aesOutput');

    if (!msg || !key) {
        showToast('Please enter both a ciphertext and a key.');
        return;
    }

    try {
        var bytes = CryptoJS.AES.decrypt(msg, key);
        var decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (!decrypted) {
            output.value = '❌ Wrong key or invalid ciphertext';
        } else {
            output.value = decrypted;
            showToast('Message decrypted!');
        }
    } catch (e) {
        output.value = '❌ Decryption failed';
    }
}
