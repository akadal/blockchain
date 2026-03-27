/* ========================================
   Section 5 — Consensus Mechanisms
   (Thematic: The King's Generals)
   ======================================== */

// --- 1. Proof of Work (PoW) - Seal the Order ---
let powDecision = null;
let powMining = false;

window.setDecisionPoW = function(dec) {
    powDecision = dec;
    const btnA = document.getElementById('btn-pow-attack');
    const btnR = document.getElementById('btn-pow-retreat');

    if (dec === 'ATTACK') {
        btnA.className = "btn btn-red";
        btnR.className = "btn btn-ghost";
    } else {
        btnR.className = "btn btn-blue";
        btnA.className = "btn btn-ghost";
    }
    updatePowPreview();
}

window.updatePowPreview = function() {
    const id = document.getElementById('powStudentId').value;
    const btn = document.getElementById('powMineBtn');
    if (id && powDecision) {
        btn.disabled = false;
        btn.innerText = "START MINING 🔨";
        btn.className = "btn btn-orange btn-full";
    } else {
        btn.disabled = true;
        btn.innerText = "ENTER ID & ORDER FIRST";
        btn.className = "btn btn-ghost btn-full";
    }
}

window.toggleMining = async function() {
    if (powMining) {
        powMining = false;
        updatePowPreview();
        return;
    }

    const id = document.getElementById('powStudentId').value;
    const baseData = `${powDecision}:${id}`;
    const target = "0000";

    powMining = true;
    let nonce = 0;
    const btn = document.getElementById('powMineBtn');
    const box = document.getElementById('powMiningBox');
    const hashDisplay = document.getElementById('powHashDisplay');
    const nonceDisplay = document.getElementById('powNonceDisplay');

    btn.innerText = "STOP MINING 🛑";
    btn.className = "btn btn-red btn-full";
    box.classList.remove('success');
    hashDisplay.classList.remove('success-text');

    async function loop() {
        if (!powMining) return;

        // Batch for performance
        for(let i = 0; i < 500; i++) {
            nonce++;
            const hash = await sha256(baseData + nonce);

            if(i === 0) {
                nonceDisplay.innerText = nonce;
                hashDisplay.innerText = hash;
            }

            if(hash.startsWith(target)) {
                powMining = false;
                nonceDisplay.innerText = nonce;
                hashDisplay.innerHTML = `<span style="color: var(--accent-green); font-weight: bold;">${target}</span>${hash.substring(4)}`;
                box.classList.add('success');
                btn.innerText = "ORDER SEALED! ✅";
                btn.className = "btn btn-green btn-full";
                return;
            }
        }
        requestAnimationFrame(loop);
    }
    loop();
}

// --- 2. Proof of Stake (PoS) - Troop Deployment ---
let posDecision = null;
let posGenerals = [];

window.setDecisionPoS = function(dec) {
    posDecision = dec;
    const btnA = document.getElementById('btn-pos-attack');
    const btnR = document.getElementById('btn-pos-retreat');

    if (dec === 'ATTACK') {
        btnA.className = "btn btn-red";
        btnR.className = "btn btn-ghost";
    } else {
        btnR.className = "btn btn-blue";
        btnA.className = "btn btn-ghost";
    }

    updatePosNetworkState();

    const voteBtn = document.getElementById('posVoteBtn');
    if(posDecision) {
        voteBtn.disabled = false;
    }
}

window.updatePosNetworkState = function() {
    // 1. Get User Input
    const userStake = parseInt(document.getElementById('posStakeSlider').value);
    document.getElementById('posStakeValueDisplay').innerText = userStake + "%";

    // 2. Simulate Bot Generals (Rest of the 100%)
    const remaining = 100 - userStake;
    const bot1Stake = Math.floor(remaining * 0.6); // Bot 1 takes 60% of remainder
    const bot2Stake = remaining - bot1Stake;       // Bot 2 takes the rest

    posGenerals = [
        { id: 'user', name: 'YOU (General)', stake: userStake, decision: posDecision || '?', color: 'var(--accent-purple)' },
        { id: 'bot1', name: 'General Alaric', stake: bot1Stake, decision: Math.random() > 0.5 ? 'ATTACK' : 'RETREAT', color: 'var(--text-muted)' },
        { id: 'bot2', name: 'General Belisarius', stake: bot2Stake, decision: Math.random() > 0.5 ? 'ATTACK' : 'RETREAT', color: 'var(--text-secondary)' }
    ];

    // 3. Render List
    const list = document.getElementById('posNetworkList');
    list.innerHTML = "";

    posGenerals.forEach(g => {
        const decisionColor = g.decision === 'ATTACK' ? 'var(--accent-red)' : (g.decision === 'RETREAT' ? 'var(--accent-blue)' : 'var(--text-muted)');
        const decisionText = g.decision === '?' ? 'PENDING...' : g.decision;

        const html = `
            <div id="card-${g.id}" class="general-card">
                <div style="flex: 1;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-weight: bold; font-size: 13px;">${g.name}</span>
                        <span style="color: ${decisionColor}; font-weight: bold; font-size: 11px;">${decisionText}</span>
                    </div>
                    <div class="troop-bar">
                        <div class="troop-fill" style="width: ${g.stake}%; background: ${g.color};"></div>
                    </div>
                </div>
                <div style="margin-left: 12px; font-family: var(--font-mono); font-size: 11px; color: var(--text-secondary); width: 30px; text-align: right;">
                    ${g.stake}%
                </div>
            </div>
        `;
        list.innerHTML += html;
    });
}

window.startPosElection = function() {
    const btn = document.getElementById('posVoteBtn');
    const resultArea = document.getElementById('posElectionArea');
    const winnerName = document.getElementById('posWinnerName');
    const finalConsensus = document.getElementById('posFinalConsensus');

    if(!posDecision) {
        showToast("Please make a decision (Attack/Retreat) first!");
        return;
    }

    btn.disabled = true;
    btn.innerText = "ELECTING LEADER...";
    resultArea.style.display = 'block';

    // Reset highlights
    document.querySelectorAll('.general-card').forEach(el => el.classList.remove('winner-highlight'));

    // Animation Loop
    let counter = 0;
    const interval = setInterval(() => {
        const randGen = posGenerals[Math.floor(Math.random() * posGenerals.length)];
        winnerName.innerText = randGen.name;
        winnerName.style.color = "var(--text-secondary)";
        counter++;

        if(counter > 15) { // Stop after 15 ticks
            clearInterval(interval);
            determineWinner();
        }
    }, 100);

    function determineWinner() {
        // Weighted Random Selection
        const rand = Math.random() * 100;
        let cumulative = 0;
        let winner = null;

        for(let g of posGenerals) {
            cumulative += g.stake;
            if(rand <= cumulative) {
                winner = g;
                break;
            }
        }

        // Show Result
        winnerName.innerText = winner.name + " WON!";
        winnerName.style.color = "var(--accent-gold)";

        // Update final consensus text
        if (winner.id === 'user') {
            finalConsensus.innerHTML = `Your decision rules! We all <span style="color: ${winner.decision === 'ATTACK' ? 'var(--accent-red)' : 'var(--accent-blue)'}; font-weight: bold;">${winner.decision}</span>.`;
        } else {
            finalConsensus.innerHTML = `They have more troops. We must obey and <span style="color: ${winner.decision === 'ATTACK' ? 'var(--accent-red)' : 'var(--accent-blue)'}; font-weight: bold;">${winner.decision}</span>.`;
        }

        // Highlight winner card
        document.getElementById(`card-${winner.id}`).classList.add('winner-highlight');

        // Reset button
        btn.innerText = "RESTART ELECTION 🎲";
        btn.disabled = false;
    }
}


// --- 3. Proof of Authority (PoA) Round Robin ---
const poaAuthorities = ['Council A', 'Council B', 'Council C'];
let poaCurrentTurn = 0;

window.poaSimulateRound = function() {
    const container = document.getElementById('poaNodes');
    container.innerHTML = '';

    poaAuthorities.forEach((auth, idx) => {
        const isActive = idx === poaCurrentTurn;
        const div = document.createElement('div');
        div.className = `poa-node ${isActive ? 'active' : ''}`;
        div.innerHTML = `
            <div style="font-size: 20px;">🏛️</div>
            <div style="font-size: 11px; font-weight: bold;">${auth}</div>
            ${isActive ? '<div class="badge badge-valid" style="margin-top: 4px;">Validating</div>' : ''}
        `;
        container.appendChild(div);
    });

    document.getElementById('poaResult').innerHTML = `Block #100${poaCurrentTurn} validated by <strong>${poaAuthorities[poaCurrentTurn]}</strong>.`;

    poaCurrentTurn = (poaCurrentTurn + 1) % poaAuthorities.length;
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    updatePosNetworkState();
    poaSimulateRound();
});