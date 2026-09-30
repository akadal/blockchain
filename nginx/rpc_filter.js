// JSON-RPC method filter for the public RPC endpoint.
//
// The signer account is unlocked inside Geth so it can seal Clique blocks.
// Anything that would let an outside caller use that unlocked account, or
// control the node (miner_stop, debug_setHead, ...), must never reach Geth.
// Students sign their own transactions and send them with eth_sendRawTransaction.

function set(names) {
    var out = Object.create(null);
    for (var i = 0; i < names.length; i++) out[names[i]] = true;
    return out;
}

var DENIED_ETH = set([
    'eth_sendTransaction',
    'eth_resend',
    'eth_sign',
    'eth_signTransaction',
    'eth_signTypedData',
    'eth_signTypedData_v3',
    'eth_signTypedData_v4'
]);

// Read-only helpers used by Remix's debugger. Other tracing entry points
// (traceCall, traceBlock*) are left out: they are cheap ways to pin the CPU
// or exhaust memory on a small node.
var ALLOWED_OTHER = set([
    'debug_traceTransaction',
    'debug_storageRangeAt',
    'txpool_status',
    'txpool_content',
    'txpool_inspect'
]);

// Built-in tracers only; a custom JS tracer or a caller-chosen timeout can
// keep Geth busy for as long as the caller likes.
var ALLOWED_TRACERS = set(['callTracer', 'prestateTracer', '4byteTracer']);

var MAX_BATCH = 100;

function isAllowed(method) {
    if (typeof method !== 'string') return false;
    if (ALLOWED_OTHER[method]) return true;
    if (method.indexOf('eth_') === 0) return !DENIED_ETH[method];
    return method.indexOf('net_') === 0 || method.indexOf('web3_') === 0;
}

function traceOptionsAllowed(call) {
    if (call.method !== 'debug_traceTransaction') return true;
    var opts = Array.isArray(call.params) ? call.params[1] : undefined;
    if (opts === undefined || opts === null) return true;
    if (typeof opts !== 'object' || Array.isArray(opts)) return false;
    if (opts.timeout !== undefined) return false;
    return opts.tracer === undefined || (typeof opts.tracer === 'string' && ALLOWED_TRACERS[opts.tracer] === true);
}

function rpcError(id, code, message) {
    return { jsonrpc: '2.0', id: id === undefined ? null : id, error: { code: code, message: message } };
}

// Returns a local reply for a call that must not be forwarded, or null.
function localReply(call) {
    if (!call || typeof call !== 'object' || Array.isArray(call)) {
        return rpcError(null, -32600, 'invalid request');
    }
    // Hide the node's unlocked account; wallets manage their own accounts.
    if (call.method === 'eth_accounts') {
        return { jsonrpc: '2.0', id: call.id === undefined ? null : call.id, result: [] };
    }
    if (!isAllowed(call.method)) {
        return rpcError(call.id, -32601, 'the method ' + call.method + ' is not available on the public RPC');
    }
    if (!traceOptionsAllowed(call)) {
        return rpcError(call.id, -32602, 'custom tracers and trace timeouts are not available on the public RPC');
    }
    return null;
}

function send(r, status, body) {
    r.headersOut['Content-Type'] = 'application/json';
    r.return(status, typeof body === 'string' ? body : JSON.stringify(body));
}

async function filter(r) {
    if (r.method === 'GET' || r.method === 'HEAD') {
        send(r, 200, { status: 'ok', hint: 'POST JSON-RPC requests to this URL' });
        return;
    }
    if (r.method !== 'POST') {
        send(r, 405, rpcError(null, -32600, 'only POST is supported'));
        return;
    }

    var parsed;
    try {
        parsed = JSON.parse(r.requestText || '');
    } catch (e) {
        send(r, 200, rpcError(null, -32700, 'parse error'));
        return;
    }

    if (!Array.isArray(parsed)) {
        var single = localReply(parsed);
        if (single) {
            send(r, 200, single);
        } else {
            // Nothing to answer locally: hand the already-read body to the
            // proxy location so large responses (traces, getLogs) stream
            // instead of filling the subrequest buffer.
            r.internalRedirect('/_geth');
        }
        return;
    }

    if (parsed.length === 0 || parsed.length > MAX_BATCH) {
        send(r, 200, rpcError(null, -32600, 'batch must contain 1-' + MAX_BATCH + ' calls'));
        return;
    }

    // Answer denied calls locally, forward the rest as one batch, and put the
    // responses back in the original order.
    var results = new Array(parsed.length);
    var toForward = [];
    var positions = [];
    for (var i = 0; i < parsed.length; i++) {
        var local = localReply(parsed[i]);
        if (local) {
            results[i] = local;
        } else {
            toForward.push(parsed[i]);
            positions.push(i);
        }
    }

    if (toForward.length === parsed.length) {
        r.internalRedirect('/_geth');
        return;
    }

    if (toForward.length) {
        var upstream = await r.subrequest('/_geth', { method: 'POST', body: JSON.stringify(toForward) });
        var answers;
        try {
            answers = JSON.parse(upstream.responseText);
        } catch (e) {
            send(r, 502, rpcError(null, -32603, 'upstream error'));
            return;
        }
        if (!Array.isArray(answers)) {
            send(r, upstream.status, upstream.responseText);
            return;
        }
        var byId = {};
        for (var j = 0; j < answers.length; j++) {
            if (answers[j] && answers[j].id !== undefined) byId[JSON.stringify(answers[j].id)] = answers[j];
        }
        for (var k = 0; k < positions.length; k++) {
            var call = toForward[k];
            // Notifications (no id) get no response entry.
            if (call.id === undefined) continue;
            var key = JSON.stringify(call.id);
            var positional = answers[k];
            results[positions[k]] = (positional && JSON.stringify(positional.id) === key)
                ? positional
                : (byId[key] || rpcError(call.id, -32603, 'missing response'));
        }
    }

    var out = [];
    for (var m = 0; m < results.length; m++) {
        if (results[m] !== undefined) out.push(results[m]);
    }
    send(r, 200, out);
}

export default { filter, isAllowed };
