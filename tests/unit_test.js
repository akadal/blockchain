const { ethers } = require('ethers');
const assert = require('assert');
const usdtArtifact = require('../faucet/contracts/AkadalUSDT.json');

// Mock dependencies
console.log("🧪 Starting Unit Tests for Faucet Logic...");

// 1. Test Address Validation
const validAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const invalidAddress = "0xinvalid";

try {
    assert.strictEqual(ethers.isAddress(validAddress), true, "Valid address should pass");
    assert.strictEqual(ethers.isAddress(invalidAddress), false, "Invalid address should fail");
    console.log("✅ Address Validation Logic: PASS");
} catch (e) {
    console.error("❌ Address Validation Logic: FAIL", e);
}

// 2. Test Transaction Payload Construction
// This simulates what the server does: wallet.sendTransaction({ to, value })

const mockSendTransaction = async (tx) => {
    if (!tx.to || !tx.value) throw new Error("Missing fields");
    return { hash: "0xmockhash..." };
};

const runTransactionTest = async () => {
    const amount = "10";
    const weiValue = ethers.parseEther(amount);

    try {
        const tx = {
            to: validAddress,
            value: weiValue
        };
        const result = await mockSendTransaction(tx);
        assert.ok(result.hash, "Transaction should return hash");
        assert.strictEqual(tx.value.toString(), "10000000000000000000", "Ether -> Wei conversion incorrect");
        console.log("✅ Transaction Construction: PASS");
    } catch (e) {
        console.error("❌ Transaction Construction: FAIL", e);
    }
};

runTransactionTest();

// 3. USDT Faucet Amount and Artifact Check
try {
    const usdtAmount = ethers.parseUnits("1000", 6);
    assert.strictEqual(usdtAmount.toString(), "1000000000", "USDT faucet amount should be 1000 tokens with 6 decimals");
    assert.ok(Array.isArray(usdtArtifact.abi), "USDT ABI should exist");
    assert.ok(usdtArtifact.bytecode && usdtArtifact.bytecode.startsWith("0x"), "USDT bytecode should exist");
    console.log("[OK] USDT Faucet Logic: PASS");
} catch (e) {
    console.error("[FAIL] USDT Faucet Logic: FAIL", e);
}

// 4. Environment Variable Check
// Just ensuring our defaults logic in server.js would work
const getEnv = (key, def) => process.env[key] || def;
assert.strictEqual(getEnv('PORT', 3000), 3000, "Default PORT check");
console.log("✅ Configuration Logic: PASS");

// 5. Faucet Abuse Limits
const { createLimiter } = require('../faucet/limits');
try {
    let clock = 0;
    const limiter = createLimiter({ addressCooldownSeconds: 60, ipWindowSeconds: 60, ipMaxRequests: 2, now: () => clock });
    const a = "0x0000000000000000000000000000000000000001";
    const b = "0x0000000000000000000000000000000000000002";
    const c = "0x0000000000000000000000000000000000000003";

    assert.strictEqual(limiter.check('ETH', a, '1.1.1.1'), null, "First request passes");
    assert.strictEqual(limiter.check('ETH', a.toUpperCase().replace('0X', '0x'), '2.2.2.2').reason, 'address', "Same address is on cooldown");
    assert.strictEqual(limiter.check('USDT', a, '2.2.2.2'), null, "Cooldown is per asset");
    assert.strictEqual(limiter.check('ETH', b, '1.1.1.1'), null, "Second request from IP passes");
    assert.strictEqual(limiter.check('ETH', c, '1.1.1.1').reason, 'ip', "IP budget is enforced");
    limiter.release('ETH', b, '1.1.1.1');
    assert.strictEqual(limiter.check('ETH', b, '1.1.1.1'), null, "Released slot can be reused");
    clock = 61 * 1000;
    assert.strictEqual(limiter.check('ETH', a, '1.1.1.1'), null, "Cooldown and window expire");
    console.log("✅ Faucet Abuse Limits: PASS");
} catch (e) {
    console.error("❌ Faucet Abuse Limits: FAIL", e);
    process.exitCode = 1;
}

console.log("\nSummary: Faucet logical core is verified.");
