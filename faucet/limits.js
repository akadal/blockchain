// In-memory abuse limits for the public faucet.
// State resets on restart; that is acceptable for an educational chain
// whose goal is to stop one client from draining the faucet, not accounting.

function envInt(name, fallback) {
    const value = parseInt(process.env[name], 10);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function createLimiter(options = {}) {
    const addressCooldownMs = (options.addressCooldownSeconds ?? envInt('FAUCET_ADDRESS_COOLDOWN_SECONDS', 3600)) * 1000;
    // A whole classroom usually shares one NAT address, so the IP limit is a
    // request budget per window, not a cooldown.
    const ipWindowMs = (options.ipWindowSeconds ?? envInt('FAUCET_IP_WINDOW_SECONDS', 3600)) * 1000;
    const ipMaxRequests = options.ipMaxRequests ?? envInt('FAUCET_IP_MAX_REQUESTS', 120);
    const now = options.now || Date.now;

    const lastByAddress = new Map(); // `${asset}:${address}` -> timestamp
    const hitsByIp = new Map();      // ip -> [timestamps]

    function prune(ip, t) {
        const hits = (hitsByIp.get(ip) || []).filter((ts) => t - ts < ipWindowMs);
        if (hits.length) hitsByIp.set(ip, hits); else hitsByIp.delete(ip);
        return hits;
    }

    // Returns null when allowed (and records the hit), otherwise
    // { reason, retryAfterSeconds }.
    function check(asset, address, ip) {
        const t = now();
        const key = `${asset}:${address.toLowerCase()}`;

        const last = lastByAddress.get(key);
        if (last !== undefined && t - last < addressCooldownMs) {
            return { reason: 'address', retryAfterSeconds: Math.ceil((addressCooldownMs - (t - last)) / 1000) };
        }

        const hits = prune(ip, t);
        if (ipMaxRequests > 0 && hits.length >= ipMaxRequests) {
            return { reason: 'ip', retryAfterSeconds: Math.ceil((ipWindowMs - (t - hits[0])) / 1000) };
        }

        lastByAddress.set(key, t);
        hits.push(t);
        hitsByIp.set(ip, hits);
        return null;
    }

    // Give the slot back when the transaction could not be sent.
    function release(asset, address, ip) {
        lastByAddress.delete(`${asset}:${address.toLowerCase()}`);
        const hits = hitsByIp.get(ip);
        if (hits && hits.length) hits.pop();
    }

    // Keep memory bounded on a long-running process.
    function sweep() {
        const t = now();
        for (const [key, ts] of lastByAddress) {
            if (t - ts >= addressCooldownMs) lastByAddress.delete(key);
        }
        for (const ip of hitsByIp.keys()) prune(ip, t);
    }

    return { check, release, sweep };
}

module.exports = { createLimiter, envInt };
