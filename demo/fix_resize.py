import re

with open("js/nft.js", "r") as f:
    content = f.read()

replacement_code = """
    btn.textContent = 'Processing Image...';

    var file = fileInput.files[0];
    var reader = new FileReader();

    reader.onload = function(event) {
        var img = new Image();
        img.onload = async function() {
            try {
                // Resize logic
                var canvas = document.createElement('canvas');
                var max_size = 500;
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

                // Compress to JPEG with 0.6 quality (significant reduction)
                var imageURI = canvas.toDataURL("image/jpeg", 0.6);

                btn.textContent = 'Minting...';

                var metadata = {
                    name: name,
                    description: desc,
                    image: imageURI
                };
                var jsonStr = JSON.stringify(metadata);
                // Use ethers to encode safely to Base64 (MetaMask compatible)
                var jsonBase64 = ethers.encodeBase64(ethers.toUtf8Bytes(jsonStr));
                var tokenURI = 'data:application/json;base64,' + jsonBase64;

                // Removed explicit gasLimit to avoid Out-of-Gas errors on large payloads
                var tx = await web3NftState.contract.mintNFT(web3NftState.address, tokenURI);
                showToast('Mint transaction submitted. Waiting...');
                await tx.wait();

                document.getElementById('web3MintName').value = '';
                document.getElementById('web3MintDesc').value = '';
                fileInput.value = '';
                showToast('NFT Minted Successfully!');
                updateWeb3NftGallery();
            } catch(e) {
                console.error(e);
                showToast('Mint failed: ' + e.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Mint Web3 NFT';
            }
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
"""

# Regex substitution
old_code_pattern = r"    var file = fileInput\.files\[0\];.*?reader\.readAsDataURL\(file\);"
content = re.sub(old_code_pattern, replacement_code.strip(), content, flags=re.DOTALL)

with open("js/nft.js", "w") as f:
    f.write(content)
