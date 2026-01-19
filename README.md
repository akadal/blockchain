# Akadal Chain (Lite Version)

Bu proje, **aşırı düşük kaynaklı** sunucular için optimize edilmiş blokzincir ortamıdır.
- **Node**: Geth (`--cache 256` ile sınırlanmış)
- **Explorer**: Otterscan (Sadece static dosya sunar, sunucuyu yormaz)
- **Faucet**: Hafif Node.js uygulaması

## Kurulum (Coolify)

1.  **Environment Variables**:
    Herhangi bir ayar değiştirmenize gerek yok. `docker-compose.yml` her şeyi halleder.

2.  **Domain Ayarları**:
    Coolify'da servis deploy olduktan sonra portları şu şekilde bağlayın:
    
    *   `https://blockchain.akadal.tr` -> **Port 3000** (Faucet)
    *   `https://explorer.blockchain.akadal.tr` -> **Port 4000** (Otterscan)
    *   `https://rpc.blockchain.akadal.tr` -> **Port 8545** (RPC)

---

## Kullanım Notları

### Explorer (Otterscan) Hakkında
Otterscan bir **istemci taraflı** gezgindir. Tarayıcınız doğrudan RPC sunucusuna (`rpc.blockchain.akadal.tr`) bağlanır.
İlk açılışta Explorer sağ üst köşede bağlantı hatası verebilir veya "Connected" yazabilir.
Eğer bağlanmazsa, Otterscan ayarlarından RPC URL'sini `https://rpc.blockchain.akadal.tr` olarak girmeniz gerekebilir. Ancak biz bunu environment variable olarak ayarladık, otomatik bağlanması beklenir.

### Test Fonları
Faucet adresine gidin ve cüzdan adresinizi yapıştırarak test ETH alın.
