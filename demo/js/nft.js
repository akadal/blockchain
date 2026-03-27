/* ========================================
   Section 12 — NFT & Real World Assets
   In-browser NFT simulation
   ======================================== */

var nftEngine = {
    initialized: false,
    nextId: 1,
    nfts: [],           // { id, name, desc, image, attrs, owner, forSale, price, fractional, shares, history }
    collections: {},    // collectionName -> [nftIds]
    accounts: {
        '0xYou': { name: 'You', balance: 100, nfts: [] },
        '0xAlice': { name: 'Alice', balance: 50, nfts: [] },
        '0xBob': { name: 'Bob', balance: 50, nfts: [] },
        '0xGallery': { name: 'Gallery', balance: 200, nfts: [] }
    },
    eventLog: [],
    colors: ['#58a6ff', '#f0b429', '#3fb950', '#f47067', '#bc8cff', '#39d2c0', '#ff7eb6', '#ffa657']
};

// ==========================================
// INIT & MODE TOGGLE
// ==========================================

function initNFT() {
    if (nftEngine.initialized) return;
    nftEngine.initialized = true;
    populateNFTSelects();
    updateNFTGallery();
    updateNFTStats();
    updateNFTLog();
}

window.setNftMode = function setNftMode(mode) {
    document.getElementById('nftModeSimulated').classList.toggle('active', mode === 'simulated');
    document.getElementById('nftModeWeb3').classList.toggle('active', mode === 'web3');
    document.getElementById('nftSimulatedContainer').style.display = mode === 'simulated' ? 'block' : 'none';
    document.getElementById('nftWeb3Container').style.display = mode === 'web3' ? 'block' : 'none';
}

// ==========================================
// WEB3 NFT LOGIC (MetaMask & Smart Contracts)
// ==========================================

var web3NftState = {
    provider: null,
    signer: null,
    address: null,
    contractAddress: null,
    contract: null,
    events: []
};

function web3NftLog(type, msg) {
    web3NftState.events.push({ type: type, msg: msg, time: timeStr() });
    updateWeb3NftLog();
}

function updateWeb3NftLog() {
    var container = document.getElementById('web3NftEventLog');
    if (!container) return;
    container.innerHTML = '';
    if (web3NftState.events.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No events yet.</p>';
        return;
    }
    web3NftState.events.slice().reverse().forEach(function (ev) {
        var div = document.createElement('div');
        div.className = 'te-event';
        var icons = { mint: '🎨', rwa: '🏠', transfer: '↔️', list: '🏷️', delist: '❌', buy: '💰', fraction: '🧩' };
        div.innerHTML = '<span class="te-event-badge">' + (icons[ev.type] || '📋') + '</span>' +
            '<span class="te-event-msg">' + ev.msg + '</span>' +
            '<span class="te-event-time">' + ev.time + '</span>';
        container.appendChild(div);
    });
}

window.web3NftConnectWallet = async function web3NftConnectWallet() {
    if (typeof window.ethereum === 'undefined') {
        showToast('MetaMask is not installed!');
        return;
    }
    try {
        let providerSource = window.ethereum;
        if (providerSource.providers) {
            const mm = providerSource.providers.find(p => p.isMetaMask && !p.isBraveWallet);
            if (mm) providerSource = mm;
        }

        const accounts = await providerSource.request({ method: 'eth_requestAccounts' });
        web3NftState.provider = new ethers.BrowserProvider(providerSource, "any");
        web3NftState.signer = await web3NftState.provider.getSigner();
        web3NftState.address = accounts[0];
        const network = await web3NftState.provider.getNetwork();

        document.getElementById('web3NftWalletSection').style.display = 'none';
        document.getElementById('web3NftContractSection').style.display = 'block';
        document.getElementById('web3NftWalletAddr').textContent = shortAddr(web3NftState.address);
        document.getElementById('web3NftNetwork').textContent = 'Chain ID: ' + network.chainId;
        showToast('MetaMask connected!');
    } catch (e) {
        showToast('Connection failed: ' + e.message);
    }
}

window.web3NftDeployContract = async function web3NftDeployContract(templateKey) {
    if (!web3NftState.signer) { showToast('Connect wallet first'); return; }

    var name = document.getElementById('web3DeployName').value.trim() || "My Web3 NFT";
    var symbol = document.getElementById('web3DeploySymbol').value.trim() || "W3NFT";

    var template = CONTRACT_TEMPLATES[templateKey];
    var btn = document.getElementById('web3NftDeployBtn');
    btn.disabled = true;
    btn.textContent = 'Deploying...';

    try {
        var factory = new ethers.ContractFactory(template.abi, template.bytecode, web3NftState.signer);
        // Provide maximum block gas limit for testnet to bypass estimation failures
        var contract = await factory.deploy(name, symbol, { gasLimit: 30000000 });
        showToast('Waiting for deployment confirmation...');
        await contract.waitForDeployment();

        document.getElementById('web3NftContractAddr').value = contract.target;
        await web3NftLoadContract();
        showToast('NFT Contract Deployed!');
    } catch (e) {
        showToast('Deploy failed: ' + e.message);
    }
    btn.disabled = false;
    btn.textContent = 'Deploy New NFT 🚀';
}

window.web3NftLoadContract = async function web3NftLoadContract() {
    var addr = document.getElementById('web3NftContractAddr').value.trim();
    if (!addr) { showToast('Enter contract address'); return; }
    if (!web3NftState.signer) { showToast('Connect wallet first'); return; }

    try {
        var template = CONTRACT_TEMPLATES['advancednft'];
        web3NftState.contract = new ethers.Contract(addr, template.abi, web3NftState.signer);
        web3NftState.contractAddress = addr;

        var name = await web3NftState.contract.name();
        var symbol = await web3NftState.contract.symbol();
        var totalSupply = await web3NftState.contract.tokenCounter();

        document.getElementById('web3NftContractInfo').style.display = 'block';
        document.getElementById('web3NftName').textContent = name;
        document.getElementById('web3NftSymbol').textContent = symbol;
        document.getElementById('web3NftTotalSupply').textContent = totalSupply.toString();

        document.getElementById('web3NftInteractionContainer').style.display = 'block';
        updateWeb3NftGallery();
        web3NftLog('mint', 'Contract loaded: ' + name);
        showToast('Contract Loaded!');
    } catch (e) {
        showToast('Failed to load contract: ' + e.message);
    }
}

window.web3NftMint = async function web3NftMint() {
    if (!web3NftState.contract) return;
    var name = document.getElementById('web3MintName').value.trim() || 'Untitled NFT';
    var desc = document.getElementById('web3MintDesc').value.trim() || 'A Web3 NFT';
    var category = document.getElementById('web3MintCategory').value;
    var rarity = document.getElementById('web3MintRarity').value;
    var fileInput = document.getElementById('web3MintFile');
    var btn = document.getElementById('web3NftMintBtn');

    btn.disabled = true;
    btn.textContent = 'Processing...';

    const performMint = async (imageURI) => {
        try {
            btn.textContent = 'Minting...';

            var metadata = {
                name: name,
                description: desc,
                image: imageURI,
                attributes: [
                    { trait_type: "Category", value: category },
                    { trait_type: "Rarity", value: rarity }
                ]
            };
            var jsonStr = JSON.stringify(metadata);
            var jsonBase64 = ethers.encodeBase64(ethers.toUtf8Bytes(jsonStr));
            var tokenURI = 'data:application/json;base64,' + jsonBase64;

            var tx = await web3NftState.contract.mintNFT(web3NftState.address, tokenURI, { gasLimit: 30000000 });
            showToast('Mint transaction submitted. Waiting...');
            await tx.wait();

            document.getElementById('web3MintName').value = '';
            document.getElementById('web3MintDesc').value = '';
            if (fileInput) fileInput.value = '';
            showToast('NFT Minted Successfully!');
            web3NftLog('mint', 'Minted NFT "' + name + '" (' + rarity + ' ' + category + ')');
            updateWeb3NftGallery();
        } catch(e) {
            console.error(e);
            showToast('Mint failed: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Mint to My Address 🎨';
        }
    };

    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        var file = fileInput.files[0];
        var reader = new FileReader();

        reader.onload = function(event) {
            var img = new Image();
            img.onload = async function() {
                // Resize logic
                var canvas = document.createElement('canvas');
                var max_size = 120;
                var width = img.width;
                var height = img.height;

                if (width > height) {
                    if (width > max_size) {
                        height *= max_size / width;
                        width = max_size;
                    }
                } else {
                    if (height > max_size) {
                        width *= max_size / height;
                        height = max_size;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress to JPEG
                var imageURI = canvas.toDataURL("image/jpeg", 0.4);
                performMint(imageURI);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    } else {
        // Auto-generate image if none provided
        var tempId = Date.now();
        var c1 = nftEngine.colors[tempId % nftEngine.colors.length];
        var c2 = nftEngine.colors[(tempId * 3 + 2) % nftEngine.colors.length];
        var autoImg = generateNFTArt(Math.floor(Math.random() * 1000), c1, c2);
        performMint(autoImg);
    }
}

window.web3NftMintRWA = async function web3NftMintRWA() {
    if (!web3NftState.contract) return;
    var assetType = document.getElementById('web3RwaType').value;
    var assetName = document.getElementById('web3RwaName').value.trim();
    var assetValue = document.getElementById('web3RwaValue').value.trim();
    var assetDoc = document.getElementById('web3RwaDoc').value.trim();
    if (!assetName) { showToast('Enter asset name'); return; }

    var btn = document.getElementById('web3NftMintRWABtn');
    btn.disabled = true;
    btn.textContent = 'Tokenizing...';

    try {
        var c1 = '#f0b429'; var c2 = '#ff7eb6';
        var autoImg = generateNFTArt(Math.floor(Math.random() * 1000), c1, c2);

        var metadata = {
            name: 'RWA: ' + assetName,
            description: assetType + ' \u2014 Appraised at $' + (assetValue || '0') + (assetDoc ? '\\nDoc: ' + assetDoc : ''),
            image: autoImg,
            attributes: [
                { trait_type: "Category", value: "RWA" },
                { trait_type: "Rarity", value: "Unique" },
                { trait_type: "Asset Type", value: assetType },
                { trait_type: "Appraised Value", value: assetValue },
                { trait_type: "Document", value: assetDoc }
            ]
        };

        var jsonStr = JSON.stringify(metadata);
        var jsonBase64 = ethers.encodeBase64(ethers.toUtf8Bytes(jsonStr));
        var tokenURI = 'data:application/json;base64,' + jsonBase64;

        var tx = await web3NftState.contract.mintNFT(web3NftState.address, tokenURI, { gasLimit: 30000000 });
        showToast('RWA Mint transaction submitted. Waiting...');
        await tx.wait();

        document.getElementById('web3RwaName').value = '';
        document.getElementById('web3RwaValue').value = '';
        document.getElementById('web3RwaDoc').value = '';
        showToast('RWA Tokenized Successfully!');
        web3NftLog('rwa', 'Tokenized RWA: "' + assetName + '" (' + assetType + ', $' + (assetValue || '0') + ')');
        updateWeb3NftGallery();
    } catch(e) {
        console.error(e);
        showToast('RWA Mint failed: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Tokenize Asset 🏠';
    }
}




var currentWeb3GalleryTab = 'market';


window.web3NftBuy = async function web3NftBuy(tokenId, priceWei) {
    if (!web3NftState.contract) return;
    try {
        var tx = await web3NftState.contract.buyNFT(tokenId, { value: priceWei, gasLimit: 3000000 });
        showToast('Buy transaction submitted...');
        await tx.wait();
        showToast('NFT Purchased Successfully!');
        web3NftLog('buy', 'Bought NFT #' + tokenId + ' for ' + ethers.formatEther(priceWei) + ' ETH');
        updateWeb3NftGallery();
    } catch(e) {
        showToast('Buy failed: ' + e.message);
    }
}


window.web3NftCancelListing = async function web3NftCancelListing(tokenId) {
    if (!web3NftState.contract) return;
    try {
        var tx = await web3NftState.contract.cancelListing(tokenId, { gasLimit: 1000000 });
        showToast('Cancel transaction submitted...');
        await tx.wait();
        showToast('Listing Canceled Successfully!');
        web3NftLog('delist', 'Delisted NFT #' + tokenId);
        updateWeb3NftGallery();
    } catch(e) {
        showToast('Cancel failed: ' + e.message);
    }
}

window.setWeb3GalleryTab = function setWeb3GalleryTab(tab) {
    currentWeb3GalleryTab = tab;
    document.getElementById('web3GalleryTabMarket').classList.toggle('active', tab === 'market');
    document.getElementById('web3GalleryTabMy').classList.toggle('active', tab === 'my');
    updateWeb3NftGallery();
}

window.openWeb3NftActionSection = function openWeb3NftActionSection(tokenId) {
    document.getElementById('web3ActionTokenId').textContent = tokenId;
    document.getElementById('web3NftActionSection').style.display = 'block';
    document.getElementById('web3NftActionSection').scrollIntoView({ behavior: 'smooth' });
}

window.closeWeb3NftActionSection = function closeWeb3NftActionSection() {
    document.getElementById('web3NftActionSection').style.display = 'none';
}

// Ensure the new list function uses the new modal
window.web3NftList = async function web3NftList() {
    if (!web3NftState.contract) return;
    var id = document.getElementById('web3ActionTokenId').textContent;
    var priceEth = document.getElementById('web3ListPrice').value.trim();
    if (!id || !priceEth) return;

    try {
        var priceWei = ethers.parseEther(priceEth);
        var tx = await web3NftState.contract.listForSale(id, priceWei, { gasLimit: 1000000 });
        showToast('Listing transaction submitted...');
        await tx.wait();
        showToast('NFT Listed for sale!');
        web3NftLog('list', 'Listed NFT #' + id + ' for ' + priceEth + ' ETH');
        closeWeb3NftActionSection();
        updateWeb3NftGallery();
    } catch(e) {
        showToast('List failed: ' + e.message);
    }
}

window.web3NftTransfer = async function web3NftTransfer() {
    if (!web3NftState.contract) return;
    var id = document.getElementById('web3TransferId').value;
    var to = document.getElementById('web3TransferTo').value.trim();
    if (!id || !to) { showToast('Select NFT and recipient'); return; }

    try {
        var tx = await web3NftState.contract.transferFrom(web3NftState.address, to, id, { gasLimit: 1000000 });
        showToast('Transfer transaction submitted...');
        await tx.wait();
        showToast('NFT Transferred!');
        web3NftLog('transfer', 'Transferred NFT #' + id + ' to ' + shortAddr(to));
        updateWeb3NftGallery();
    } catch(e) {
        showToast('Transfer failed: ' + e.message);
    }
}

window.web3NftList = async function web3NftList() {
    if (!web3NftState.contract) return;
    var id = document.getElementById('web3SellId').value;
    var priceEth = document.getElementById('web3SellPrice').value.trim();
    if (!id || !priceEth) { showToast('Select NFT and enter price'); return; }

    try {
        var priceWei = ethers.parseEther(priceEth);
        var tx = await web3NftState.contract.listForSale(id, priceWei, { gasLimit: 1000000 });
        showToast('Listing transaction submitted...');
        await tx.wait();
        showToast('NFT Listed for sale!');
        web3NftLog('list', 'Listed NFT #' + id + ' for ' + priceEth + ' ETH');
        updateWeb3NftGallery();
    } catch(e) {
        showToast('List failed: ' + e.message);
    }
}

window.web3NftFractionalize = async function web3NftFractionalize() {
    if (!web3NftState.contract) return;
    var id = document.getElementById('web3FracId').value;
    var shares = document.getElementById('web3FracShares').value.trim();
    if (!id || !shares || parseInt(shares) < 2) { showToast('Select NFT and enter valid shares (min 2)'); return; }

    try {
        var tx = await web3NftState.contract.fractionalize(id, shares, { gasLimit: 2000000 });
        showToast('Fractionalize transaction submitted...');
        await tx.wait();
        showToast('NFT split into shares!');
        web3NftLog('fraction', 'NFT #' + id + ' fractionalized into ' + shares + ' shares');
        updateWeb3NftGallery();
    } catch(e) {
        showToast('Fractionalize failed: ' + e.message);
    }
}

window.web3NftTransferShares = async function web3NftTransferShares() {
    if (!web3NftState.contract) return;
    var id = document.getElementById('web3ShareNftId').value;
    var to = document.getElementById('web3ShareTo').value.trim();
    var amount = document.getElementById('web3ShareAmount').value.trim();
    if (!id || !to || !amount) { showToast('Fill all fields'); return; }

    try {
        var tx = await web3NftState.contract.transferShares(id, to, amount, { gasLimit: 1000000 });
        showToast('Share transfer submitted...');
        await tx.wait();
        showToast('Shares transferred!');
        web3NftLog('fraction', 'Transferred ' + amount + ' shares of NFT #' + id + ' to ' + shortAddr(to));
        updateWeb3NftGallery();
    } catch(e) {
        showToast('Share transfer failed: ' + e.message);
    }
}

window.updateWeb3NftGallery = async function updateWeb3NftGallery() {
    if (!web3NftState.contract) return;
    var grid = document.getElementById('web3NftGalleryGrid');
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;">Loading on-chain data...</p>';

    try {
        var totalSupply = await web3NftState.contract.tokenCounter();
        document.getElementById('web3NftTotalSupply').textContent = totalSupply.toString();

        if (totalSupply == 0) {
            grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;">No NFTs minted yet on this contract.</p>';
            return;
        }

        grid.innerHTML = '';
        var countFound = 0;
        var totalForSale = 0;
        var uniqueOwners = new Set();
        var totalVolume = 0; // Not easily calculated from simple RPC without events, but we'll leave it as 0 for now or estimate.

        // We will fetch concurrently for speed
        var promises = [];
        for (let i = 0; i < totalSupply; i++) {
            promises.push((async () => {
                try {
                    let owner = await web3NftState.contract.ownerOf(i);
                    let uri = await web3NftState.contract.tokenURI(i);
                    let listing = await web3NftState.contract.listings(i);
                    let isFrac = await web3NftState.contract.isFractionalized(i);
                    let myShares = 0;
                    let totShares = 0;
                    if (isFrac) {
                        totShares = await web3NftState.contract.totalShares(i);
                        myShares = await web3NftState.contract.tokenShares(i, web3NftState.address);
                    }

                    return { i, owner, uri, listing, isFrac, myShares, totShares };
                } catch(e) {
                    console.error("Error fetching NFT #", i, e);
                    return null;
                }
            })());
        }

        var results = await Promise.all(promises);

        for (let res of results) {
            if (!res) continue;
            let { i, owner, uri, listing, isFrac, myShares, totShares } = res;

            uniqueOwners.add(owner);

            let isOwner = owner.toLowerCase() === web3NftState.address.toLowerCase();
            let isForSale = listing.isForSale;
            if (isForSale) totalForSale++;

            // Filter logic
            if (currentWeb3GalleryTab === 'market' && !isForSale) continue;
            // Also show if user has shares even if not the main owner
            if (currentWeb3GalleryTab === 'my' && !isOwner && myShares == 0) continue;

            countFound++;

            // Parse base64 JSON tokenURI
            let metadata = { name: "Unknown", description: "", image: "", attributes: [] };
            if (uri.startsWith('data:application/json;base64,')) {
                try {
                    let base64Part = uri.split(',')[1];
                    let jsonStr = ethers.toUtf8String(ethers.decodeBase64(base64Part));
                    metadata = JSON.parse(jsonStr);
                } catch(e) {
                    console.error("Error parsing metadata for NFT #", i, e);
                }
            }

            let priceEth = isForSale ? ethers.formatEther(listing.price) : "0";

            var card = document.createElement('div');
            card.className = 'nft-card' + (isForSale ? ' nft-for-sale' : '');

            var badgeHtml = isForSale ? '<span class="nft-sale-badge">' + priceEth + ' ETH</span>' : '';
            if (isFrac) badgeHtml += '<span class="nft-frac-badge">🧩 ' + myShares + '/' + totShares + ' shares</span>';

            var attrsHtml = '';
            if (metadata.attributes) {
                metadata.attributes.forEach(attr => {
                    if (attr.trait_type === "Category" || attr.trait_type === "Rarity") {
                        let className = attr.trait_type === "Rarity" ? 'nft-rarity-' + attr.value.toLowerCase() : '';
                        attrsHtml += '<span class="nft-attr ' + className + '">' + attr.value + '</span>';
                    }
                });
            }

            var actionBtn = '';
            if (isForSale && !isOwner) {
                actionBtn = `<button class="btn btn-sm btn-green" style="margin-top: 8px; width: 100%;" onclick="web3NftBuy(${i}, '${listing.price}')">Buy for ${priceEth} ETH</button>`;
            } else if (isOwner && isForSale) {
                actionBtn = `<button class="btn btn-sm btn-red" style="margin-top: 8px; width: 100%;" onclick="web3NftCancelListing(${i})">Cancel Listing</button>`;
            }

            card.innerHTML =
                '<div class="nft-image"><img src="' + metadata.image + '" alt="NFT #' + i + '" style="background: var(--bg-card);">' + badgeHtml + '</div>' +
                '<div class="nft-info">' +
                '<div class="nft-title">#' + i + ' ' + escapeHtmlNft(metadata.name) + '</div>' +
                '<div class="nft-owner">Owner: ' + shortAddr(owner) + '</div>' +
                '<div class="nft-attrs">' + attrsHtml + '</div>' +
                '<div class="nft-desc">' + escapeHtmlNft(metadata.description) + '</div>' +
                actionBtn +
                '</div>';

            grid.appendChild(card);
        }

        if (countFound === 0) {
            grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;">No NFTs found in this category.</p>';
        }

        // Update selects for forms
        var myNfts = results.filter(r => r && r.owner.toLowerCase() === web3NftState.address.toLowerCase() && !r.isFrac);
        var myFracNfts = results.filter(r => r && r.isFrac && r.myShares > 0);

        ['web3TransferId', 'web3SellId', 'web3FracId'].forEach(function(selId) {
            var sel = document.getElementById(selId);
            if (!sel) return;
            sel.innerHTML = '<option value="">Select NFT...</option>';
            myNfts.forEach(function(n) {
                var opt = document.createElement('option');
                opt.value = n.i;
                opt.textContent = '#' + n.i;
                sel.appendChild(opt);
            });
        });

        var shareSel = document.getElementById('web3ShareNftId');
        if (shareSel) {
            shareSel.innerHTML = '<option value="">Select NFT...</option>';
            myFracNfts.forEach(function(n) {
                var opt = document.createElement('option');
                opt.value = n.i;
                opt.textContent = '#' + n.i + ' (' + n.myShares + ' shares)';
                shareSel.appendChild(opt);
            });
        }

        // Update stats
        let el = document.getElementById('web3NftStatsTotal'); if (el) el.textContent = totalSupply.toString();
        el = document.getElementById('web3NftStatsForSale'); if (el) el.textContent = totalForSale;
        el = document.getElementById('web3NftStatsOwners'); if (el) el.textContent = uniqueOwners.size;

    } catch (e) {
        grid.innerHTML = '<p style="color:var(--text-red);grid-column:1/-1;text-align:center;">Error loading gallery: ' + e.message + '</p>';
    }
}

// ==========================================
// MINT NFT
// ==========================================

window.nftMint = function nftMint() {
    var name = document.getElementById('nftName').value.trim();
    var desc = document.getElementById('nftDesc').value.trim();
    var category = document.getElementById('nftCategory').value;
    var rarity = document.getElementById('nftRarity').value;
    if (!name) { showToast('Enter NFT name'); return; }

    var id = nftEngine.nextId++;
    var color1 = nftEngine.colors[id % nftEngine.colors.length];
    var color2 = nftEngine.colors[(id * 3 + 2) % nftEngine.colors.length];

    var nft = {
        id: id,
        name: name,
        desc: desc || 'No description',
        image: generateNFTArt(id, color1, color2),
        attrs: { category: category, rarity: rarity, created: new Date().toLocaleDateString() },
        owner: '0xYou',
        forSale: false,
        price: 0,
        fractional: false,
        shares: {},
        totalShares: 0,
        history: [{ action: 'Minted', by: 'You', time: timeStr() }]
    };

    nftEngine.nfts.push(nft);
    nftEngine.accounts['0xYou'].nfts.push(id);

    nftLog('mint', 'Minted NFT #' + id + ' "' + name + '" (' + rarity + ' ' + category + ')');
    document.getElementById('nftName').value = '';
    document.getElementById('nftDesc').value = '';
    updateNFTGallery();
    updateNFTStats();
    updateNFTLog();
    populateNFTSelects();
    showToast('NFT #' + id + ' minted!');
}

function generateNFTArt(id, c1, c2) {
    var canvas = document.createElement('canvas');
    canvas.width = 120; canvas.height = 120;
    var ctx = canvas.getContext('2d');

    // Background gradient
    var grad = ctx.createLinearGradient(0, 0, 120, 120);
    grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 120, 120);

    // Geometric shapes based on ID
    ctx.globalAlpha = 0.3;
    var seed = id * 7;
    for (var i = 0; i < 5; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#fff' : '#000';
        var x = (seed * (i + 1) * 37) % 100 + 10;
        var y = (seed * (i + 1) * 53) % 100 + 10;
        var r = (seed * (i + 1) * 11) % 20 + 5;
        ctx.beginPath();
        if (i % 3 === 0) {
            ctx.arc(x, y, r, 0, Math.PI * 2);
        } else if (i % 3 === 1) {
            ctx.rect(x - r, y - r, r * 2, r * 1.5);
        } else {
            ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r); ctx.lineTo(x - r, y + r); ctx.closePath();
        }
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ID label
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('#' + id, 60, 110);

    return canvas.toDataURL('image/jpeg', 0.4);
}

// ==========================================
// RWA TOKENIZATION
// ==========================================

window.nftMintRWA = function nftMintRWA() {
    var assetType = document.getElementById('rwaType').value;
    var assetName = document.getElementById('rwaName').value.trim();
    var assetValue = document.getElementById('rwaValue').value.trim();
    var assetDoc = document.getElementById('rwaDoc').value.trim();
    if (!assetName) { showToast('Enter asset name'); return; }

    var id = nftEngine.nextId++;
    var c1 = '#f0b429'; var c2 = '#ff7eb6';

    var nft = {
        id: id,
        name: 'RWA: ' + assetName,
        desc: assetType + ' — Appraised at $' + (assetValue || '0') + (assetDoc ? '\nDoc: ' + assetDoc : ''),
        image: generateNFTArt(id, c1, c2),
        attrs: { category: 'RWA', rarity: 'Unique', type: assetType, value: assetValue, document: assetDoc, created: new Date().toLocaleDateString() },
        owner: '0xYou',
        forSale: false,
        price: 0,
        fractional: false,
        shares: {},
        totalShares: 0,
        history: [{ action: 'Tokenized RWA', by: 'You', time: timeStr() }]
    };

    nftEngine.nfts.push(nft);
    nftEngine.accounts['0xYou'].nfts.push(id);
    nftLog('rwa', 'Tokenized RWA: "' + assetName + '" (' + assetType + ', $' + (assetValue || '0') + ')');
    document.getElementById('rwaName').value = '';
    document.getElementById('rwaValue').value = '';
    document.getElementById('rwaDoc').value = '';
    updateNFTGallery();
    updateNFTStats();
    updateNFTLog();
    populateNFTSelects();
    showToast('RWA tokenized as NFT #' + id + '!');
}

// ==========================================
// TRANSFER
// ==========================================

window.nftTransfer = function nftTransfer() {
    var nftId = parseInt(document.getElementById('nftTransferId').value);
    var to = document.getElementById('nftTransferTo').value;
    if (!nftId || !to) { showToast('Select NFT and recipient'); return; }

    var nft = nftEngine.nfts.find(function (n) { return n.id === nftId; });
    if (!nft) { showToast('NFT not found'); return; }
    if (nft.owner !== '0xYou') { showToast('You don\'t own this NFT'); return; }
    if (to === '0xYou') { showToast('Cannot transfer to yourself'); return; }

    // Remove from current owner
    var idx = nftEngine.accounts['0xYou'].nfts.indexOf(nftId);
    if (idx > -1) nftEngine.accounts['0xYou'].nfts.splice(idx, 1);

    nft.owner = to;
    nft.forSale = false;
    nftEngine.accounts[to].nfts.push(nftId);
    nft.history.push({ action: 'Transferred to ' + nftEngine.accounts[to].name, by: 'You', time: timeStr() });

    nftLog('transfer', 'Transferred NFT #' + nftId + ' to ' + nftEngine.accounts[to].name);
    updateNFTGallery();
    updateNFTStats();
    updateNFTLog();
    populateNFTSelects();
    showToast('NFT #' + nftId + ' transferred!');
}

// ==========================================
// MARKETPLACE
// ==========================================

window.nftListForSale = function nftListForSale() {
    var nftId = parseInt(document.getElementById('nftSellId').value);
    var price = parseFloat(document.getElementById('nftSellPrice').value);
    if (!nftId || !price || price <= 0) { showToast('Select NFT and enter price'); return; }

    var nft = nftEngine.nfts.find(function (n) { return n.id === nftId; });
    if (!nft || nft.owner !== '0xYou') { showToast('You don\'t own this NFT'); return; }

    nft.forSale = true;
    nft.price = price;
    nft.history.push({ action: 'Listed for ' + price + ' ETH', by: 'You', time: timeStr() });
    nftLog('list', 'Listed NFT #' + nftId + ' "' + nft.name + '" for ' + price + ' ETH');
    updateNFTGallery();
    updateNFTLog();
    showToast('NFT #' + nftId + ' listed for ' + price + ' ETH!');
}

window.nftBuy = function nftBuy(nftId, buyerAddr) {
    var nft = nftEngine.nfts.find(function (n) { return n.id === nftId; });
    if (!nft || !nft.forSale) return;

    var buyer = nftEngine.accounts[buyerAddr];
    var seller = nftEngine.accounts[nft.owner];
    if (buyer.balance < nft.price) { showToast(buyer.name + ' cannot afford ' + nft.price + ' ETH'); return; }

    buyer.balance -= nft.price;
    seller.balance += nft.price;

    var idx = seller.nfts.indexOf(nftId);
    if (idx > -1) seller.nfts.splice(idx, 1);
    buyer.nfts.push(nftId);

    nft.history.push({ action: 'Bought by ' + buyer.name + ' for ' + nft.price + ' ETH', by: buyer.name, time: timeStr() });
    nftLog('buy', buyer.name + ' bought NFT #' + nftId + ' "' + nft.name + '" for ' + nft.price + ' ETH from ' + seller.name);

    nft.owner = buyerAddr;
    nft.forSale = false;

    updateNFTGallery();
    updateNFTStats();
    updateNFTLog();
    populateNFTSelects();
    showToast(buyer.name + ' bought NFT #' + nftId + '!');
}

// ==========================================
// FRACTIONAL OWNERSHIP
// ==========================================

window.nftFractionalize = function nftFractionalize() {
    var nftId = parseInt(document.getElementById('nftFracId').value);
    var shares = parseInt(document.getElementById('nftFracShares').value);
    if (!nftId || !shares || shares < 2) { showToast('Select NFT and enter shares (min 2)'); return; }

    var nft = nftEngine.nfts.find(function (n) { return n.id === nftId; });
    if (!nft || nft.owner !== '0xYou') { showToast('You don\'t own this NFT'); return; }
    if (nft.fractional) { showToast('Already fractionalized'); return; }

    nft.fractional = true;
    nft.totalShares = shares;
    nft.shares = { '0xYou': shares };
    nft.history.push({ action: 'Fractionalized into ' + shares + ' shares', by: 'You', time: timeStr() });
    nftLog('fraction', 'NFT #' + nftId + ' fractionalized into ' + shares + ' shares');
    updateNFTGallery();
    updateNFTLog();
    showToast('NFT #' + nftId + ' split into ' + shares + ' shares!');
}

window.nftTransferShares = function nftTransferShares() {
    var nftId = parseInt(document.getElementById('nftShareNftId').value);
    var to = document.getElementById('nftShareTo').value;
    var amount = parseInt(document.getElementById('nftShareAmount').value);
    if (!nftId || !to || !amount || amount <= 0) { showToast('Fill all fields'); return; }

    var nft = nftEngine.nfts.find(function (n) { return n.id === nftId; });
    if (!nft || !nft.fractional) { showToast('NFT not fractionalized'); return; }

    var myShares = nft.shares['0xYou'] || 0;
    if (myShares < amount) { showToast('You only have ' + myShares + ' shares'); return; }

    nft.shares['0xYou'] -= amount;
    nft.shares[to] = (nft.shares[to] || 0) + amount;
    nft.history.push({ action: amount + ' shares → ' + nftEngine.accounts[to].name, by: 'You', time: timeStr() });
    nftLog('fraction', 'Transferred ' + amount + ' shares of NFT #' + nftId + ' to ' + nftEngine.accounts[to].name);
    updateNFTGallery();
    updateNFTLog();
    showToast(amount + ' shares transferred!');
}

// ==========================================
// UI UPDATES
// ==========================================

function updateNFTGallery() {
    var grid = document.getElementById('nftGalleryGrid');
    if (!grid) return;
    grid.innerHTML = '';

    if (nftEngine.nfts.length === 0) {
        grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;">No NFTs minted yet. Create your first NFT above!</p>';
        return;
    }

    nftEngine.nfts.forEach(function (nft) {
        var ownerName = nftEngine.accounts[nft.owner] ? nftEngine.accounts[nft.owner].name : nft.owner;
        var card = document.createElement('div');
        card.className = 'nft-card' + (nft.forSale ? ' nft-for-sale' : '');
        var badgeHtml = '';
        if (nft.forSale) badgeHtml = '<span class="nft-sale-badge">' + nft.price + ' ETH</span>';
        if (nft.fractional) badgeHtml += '<span class="nft-frac-badge">🧩 ' + nft.totalShares + ' shares</span>';

        var attrsHtml = '';
        if (nft.attrs.rarity) attrsHtml += '<span class="nft-attr nft-rarity-' + nft.attrs.rarity.toLowerCase() + '">' + nft.attrs.rarity + '</span>';
        if (nft.attrs.category) attrsHtml += '<span class="nft-attr">' + nft.attrs.category + '</span>';

        card.innerHTML =
            '<div class="nft-image"><img src="' + nft.image + '" alt="NFT #' + nft.id + '">' + badgeHtml + '</div>' +
            '<div class="nft-info">' +
            '<div class="nft-title">' + escapeHtmlNft(nft.name) + '</div>' +
            '<div class="nft-owner">Owner: ' + ownerName + '</div>' +
            '<div class="nft-attrs">' + attrsHtml + '</div>' +
            '<div class="nft-desc">' + escapeHtmlNft(nft.desc).substring(0, 80) + '</div>' +
            (nft.forSale && nft.owner !== '0xYou' ?
                '<button class="btn btn-sm btn-green" onclick="nftBuy(' + nft.id + ',\'0xYou\')">Buy for ' + nft.price + ' ETH</button>' : '') +
            (nft.forSale && nft.owner === '0xYou' ?
                '<button class="btn btn-sm btn-ghost" onclick="nftCancelSale(' + nft.id + ')">Cancel Listing</button>' : '') +
            '<button class="btn btn-sm btn-ghost" onclick="showNFTDetails(' + nft.id + ')" style="margin-top:4px;">Details</button>' +
            '</div>';
        grid.appendChild(card);
    });

    // Update marketplace
    updateMarketplace();
}

function updateMarketplace() {
    var list = document.getElementById('nftMarketList');
    if (!list) return;
    var forSale = nftEngine.nfts.filter(function (n) { return n.forSale; });
    if (forSale.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">No NFTs listed for sale.</p>';
        return;
    }
    list.innerHTML = '';
    forSale.forEach(function (nft) {
        var ownerName = nftEngine.accounts[nft.owner] ? nftEngine.accounts[nft.owner].name : nft.owner;
        var div = document.createElement('div');
        div.className = 'nft-market-item';
        div.innerHTML =
            '<img src="' + nft.image + '" style="width:48px;height:48px;border-radius:8px;">' +
            '<div style="flex:1;"><strong>#' + nft.id + ' ' + escapeHtmlNft(nft.name) + '</strong><br><span style="color:var(--text-muted);font-size:12px;">Seller: ' + ownerName + '</span></div>' +
            '<div style="text-align:right;"><div style="color:var(--accent-gold);font-weight:700;">' + nft.price + ' ETH</div>' +
            (nft.owner !== '0xYou' ? '<button class="btn btn-sm btn-green" onclick="nftBuy(' + nft.id + ',\'0xYou\')">Buy</button>' : '<span class="badge">Your listing</span>') +
            '</div>';
        list.appendChild(div);
    });
}

window.nftCancelSale = function nftCancelSale(nftId) {
    var nft = nftEngine.nfts.find(function (n) { return n.id === nftId; });
    if (!nft) return;
    nft.forSale = false; nft.price = 0;
    nftLog('delist', 'Delisted NFT #' + nftId);
    updateNFTGallery(); updateNFTLog();
    showToast('Listing cancelled');
}

window.showNFTDetails = function showNFTDetails(nftId) {
    var nft = nftEngine.nfts.find(function (n) { return n.id === nftId; });
    if (!nft) return;
    var modal = document.getElementById('nftDetailModal');
    var ownerName = nftEngine.accounts[nft.owner] ? nftEngine.accounts[nft.owner].name : nft.owner;

    var histHtml = nft.history.map(function (h) {
        return '<div class="nft-history-item"><span>' + h.action + '</span><span style="color:var(--text-muted);font-size:11px;">' + h.time + '</span></div>';
    }).join('');

    var sharesHtml = '';
    if (nft.fractional) {
        sharesHtml = '<div class="card-title" style="font-size:13px;margin-top:var(--space-sm);">Share Distribution</div>';
        Object.keys(nft.shares).forEach(function (addr) {
            if (nft.shares[addr] > 0) {
                var accName = nftEngine.accounts[addr] ? nftEngine.accounts[addr].name : addr;
                var pct = ((nft.shares[addr] / nft.totalShares) * 100).toFixed(1);
                sharesHtml += '<div style="display:flex;justify-content:space-between;font-size:13px;padding:2px 0;"><span>' + accName + '</span><span>' + nft.shares[addr] + ' / ' + nft.totalShares + ' (' + pct + '%)</span></div>';
            }
        });
    }

    var attrsHtml = Object.keys(nft.attrs).map(function (k) {
        return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:2px 0;"><span style="color:var(--text-muted);">' + k + '</span><span>' + nft.attrs[k] + '</span></div>';
    }).join('');

    document.getElementById('nftDetailContent').innerHTML =
        '<div style="text-align:center;"><img src="' + nft.image + '" style="width:160px;height:160px;border-radius:12px;margin-bottom:var(--space-sm);"></div>' +
        '<h3 style="margin:0;color:var(--accent-blue);">#' + nft.id + ' — ' + escapeHtmlNft(nft.name) + '</h3>' +
        '<p style="color:var(--text-secondary);font-size:13px;">' + escapeHtmlNft(nft.desc) + '</p>' +
        '<p style="font-size:14px;">Owner: <strong>' + ownerName + '</strong></p>' +
        '<div class="card-title" style="font-size:13px;">Attributes</div>' + attrsHtml +
        sharesHtml +
        '<div class="card-title" style="font-size:13px;margin-top:var(--space-sm);">History</div>' + histHtml;

    modal.style.display = 'flex';
}

window.closeNFTModal = function closeNFTModal() {
    document.getElementById('nftDetailModal').style.display = 'none';
}

function updateNFTStats() {
    var total = nftEngine.nfts.length;
    var forSale = nftEngine.nfts.filter(function (n) { return n.forSale; }).length;
    var owners = {};
    nftEngine.nfts.forEach(function (n) { owners[n.owner] = true; });
    var uniqueOwners = Object.keys(owners).length;
    var totalVolume = 0;
    nftEngine.nfts.forEach(function (n) {
        n.history.forEach(function (h) {
            var m = h.action.match(/(\d+\.?\d*) ETH/);
            if (m) totalVolume += parseFloat(m[1]);
        });
    });

    var el = document.getElementById('nftStatsTotal'); if (el) el.textContent = total;
    el = document.getElementById('nftStatsForSale'); if (el) el.textContent = forSale;
    el = document.getElementById('nftStatsOwners'); if (el) el.textContent = uniqueOwners;
    el = document.getElementById('nftStatsVolume'); if (el) el.textContent = totalVolume.toFixed(1) + ' ETH';
}

function updateNFTLog() {
    var container = document.getElementById('nftEventLog');
    if (!container) return;
    container.innerHTML = '';
    nftEngine.eventLog.slice().reverse().forEach(function (ev) {
        var div = document.createElement('div');
        div.className = 'te-event';
        var icons = { mint: '🎨', rwa: '🏠', transfer: '↔️', list: '🏷️', delist: '❌', buy: '💰', fraction: '🧩' };
        div.innerHTML = '<span class="te-event-badge">' + (icons[ev.type] || '📋') + '</span>' +
            '<span class="te-event-msg">' + ev.msg + '</span>' +
            '<span class="te-event-time">' + ev.time + '</span>';
        container.appendChild(div);
    });
}

function populateNFTSelects() {
    // My NFTs for transfer/sell/fractionalize
    var myNfts = nftEngine.nfts.filter(function (n) { return n.owner === '0xYou'; });
    ['nftTransferId', 'nftSellId', 'nftFracId', 'nftShareNftId'].forEach(function (selId) {
        var sel = document.getElementById(selId);
        if (!sel) return;
        sel.innerHTML = '<option value="">Select NFT...</option>';
        var list = selId === 'nftShareNftId' ? nftEngine.nfts.filter(function (n) { return n.fractional && (n.shares['0xYou'] || 0) > 0; }) : myNfts;
        list.forEach(function (n) {
            var opt = document.createElement('option');
            opt.value = n.id;
            opt.textContent = '#' + n.id + ' — ' + n.name;
            sel.appendChild(opt);
        });
    });

    // Recipients
    ['nftTransferTo', 'nftShareTo'].forEach(function (selId) {
        var sel = document.getElementById(selId);
        if (!sel) return;
        sel.innerHTML = '';
        Object.keys(nftEngine.accounts).forEach(function (addr) {
            if (addr === '0xYou') return;
            var opt = document.createElement('option');
            opt.value = addr;
            opt.textContent = nftEngine.accounts[addr].name;
            sel.appendChild(opt);
        });
    });
}

// ==========================================
// HELPERS
// ==========================================

function nftLog(type, msg) {
    nftEngine.eventLog.push({ type: type, msg: msg, time: timeStr() });
}

function timeStr() { return new Date().toLocaleTimeString(); }

window.escapeHtmlNft = function escapeHtmlNft(t) {
    if (t === undefined || t === null) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(t));
    return d.innerHTML;
}
