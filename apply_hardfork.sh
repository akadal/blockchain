#!/bin/bash
set -e

# Node.js kullanarak genesis json dosyalarına güncel zamanın 2 dakika sonrasını yazar.
# Bu sayede geçmiş blokların doğrulamasına (rewind error) takılmadan ağın konfigürasyonu LevelDB üzerinde güncellenir.
node -e "
const fs = require('fs');
const files = ['genesis.json', 'geth-config/genesis.json'];
const activationTime = Math.floor(Date.now() / 1000) + 180; // 3 dakika sonrası
files.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file, 'utf8');
        let data = JSON.parse(content);
        data.config.shanghaiTime = activationTime;
        data.config.cancunTime = activationTime;
        fs.writeFileSync(file, JSON.stringify(data, null, 4) + '\n');
    }
});
console.log('✅ Shanghai & Cancun Hardfork timestamp scheduled for: ' + activationTime + ' (in 3 minutes).');
"

echo "🔄 Rebuilding and starting the local geth node to parse the scheduled fork..."
docker compose up -d --build geth
echo ""
echo "🚀 DONE! Please wait 3 minutes for the network time to pass the scheduled timestamp,"
echo "and then deploy your OpenZeppelin contracts again!"
