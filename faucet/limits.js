// In-memory abuse limits for the public faucet.
// State resets on restart; that is acceptable for an educational chain
// whose goal is to stop one client from draining the faucet, not accounting.

function envInt(name, fallback) {
    const value = parseInt(process.env[name], 10);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function createLimiter(options = {}) {
    // A per-address budget, not a cooldown. One drip an hour was unusable in
    // class: a student who mistypes an address, or needs gas twice in one lab,
    // is locked out for the rest of the session. [2026-10-13]
    const addressWindowMs = (options.addressWindowSeconds ?? envInt('FAUCET_ADDRESS_WINDOW_SECONDS', 3600)) * 1000;
    const addressMaxRequests = options.addressMaxRequests ?? envInt('FAUCET_ADDRESS_MAX_REQUESTS', 10);
    // A whole classroom usually shares one NAT address, so the IP limit is a
    // request budget per window, not a cooldown.
    const ipWindowMs = (options.ipWindowSeconds ?? envInt('FAUCET_IP_WINDOW_SECONDS', 3600)) * 1000;
    const ipMaxRequests = options.ipMaxRequests ?? envInt('FAUCET_IP_MAX_REQUESTS', 120);
    const now = options.now || Date.now;

    const hitsByAddress = new Map(); // `${asset}:${address}` -> [timestamps]
    const hitsByIp = new Map();      // ip -> [timestamps]

    function pruneList(map, key, t, windowMs) {
        const hits = (map.get(key) || []).filter((ts) => t - ts < windowMs);
        if (hits.length) map.set(key, hits); else map.delete(key);
        return hits;
    }

    function prune(ip, t) {
        return pruneList(hitsByIp, ip, t, ipWindowMs);
    }

    // Returns null when allowed (and records the hit), otherwise
    // { reason, retryAfterSeconds }.
    function check(asset, address, ip) {
        const t = now();
        const key = `${asset}:${address.toLowerCase()}`;

        const addressHits = pruneList(hitsByAddress, key, t, addressWindowMs);
        if (addressMaxRequests > 0 && addressHits.length >= addressMaxRequests) {
            return { reason: 'address', retryAfterSeconds: Math.ceil((addressWindowMs - (t - addressHits[0])) / 1000) };
        }

        const hits = prune(ip, t);
        if (ipMaxRequests > 0 && hits.length >= ipMaxRequests) {
            return { reason: 'ip', retryAfterSeconds: Math.ceil((ipWindowMs - (t - hits[0])) / 1000) };
        }

        addressHits.push(t);
        hitsByAddress.set(key, addressHits);
        hits.push(t);
        hitsByIp.set(ip, hits);
        return null;
    }

    // Give the slot back when the transaction could not be sent.
    function release(asset, address, ip) {
        const addressHits = hitsByAddress.get(`${asset}:${address.toLowerCase()}`);
        if (addressHits && addressHits.length) addressHits.pop();
        const hits = hitsByIp.get(ip);
        if (hits && hits.length) hits.pop();
    }

    // Keep memory bounded on a long-running process.
    function sweep() {
        const t = now();
        for (const key of hitsByAddress.keys()) pruneList(hitsByAddress, key, t, addressWindowMs);
        for (const ip of hitsByIp.keys()) prune(ip, t);
    }

    return { check, release, sweep };
}

module.exports = { createLimiter, envInt };
