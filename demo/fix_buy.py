with open("js/nft.js", "r") as f:
    content = f.read()

buy_func = """
window.web3NftBuy = async function web3NftBuy(tokenId, priceWei) {
    if (!web3NftState.contract) return;
    try {
        var tx = await web3NftState.contract.buyNFT(tokenId, { value: priceWei });
        showToast('Buy transaction submitted...');
        await tx.wait();
        showToast('NFT Purchased Successfully!');
        updateWeb3NftGallery();
    } catch(e) {
        showToast('Buy failed: ' + e.message);
    }
}
"""

if "window.web3NftBuy" not in content:
    # Insert before the last setWeb3GalleryTab
    content = content.replace("function setWeb3GalleryTab", buy_func + "\nfunction setWeb3GalleryTab")
    with open("js/nft.js", "w") as f:
        f.write(content)
