/* ========================================
   Section 1 — Hash Functions
   ======================================== */

async function updateHash() {
    var input = document.getElementById('hashInput').value;
    var output = document.getElementById('hashOutput');
    var hash = await sha256(input);
    output.textContent = hash;
}
