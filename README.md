# Akadal Chain (Lite Version)

Bu proje, **Coolify** üzerinde çalışacak şekilde tasarlanmış, **düşük kaynak tüketimli** (Low Resource) bir Ethereum blokzincir ortamıdır.

## 🚀 Bileşenler
1.  **Geth Node**: Ethereum zinciri (Dev mode, ~256MB Cache limitli).
2.  **Otterscan Explorer**: Hafif, istemci tabanlı gezgin (Database gerektirmez).
3.  **Faucet**: Öğrenciler için test ETH dağıtıcısı (Node.js).

---

## 🔐 SSL ve HTTPS Kurulumu (ÖNEMLİ)

Bu altyapıda **SSL (HTTPS)** işlemleri tamamen **Coolify (veya Cloudflare)** tarafından yönetilir. Container'lar kendi içlerinde SSL sertifikası barındırmaz, HTTP konuşurlar.

### Coolify Üzerinden Yapılandırma
Sistemi deploy ettikten sonra Coolify panelinde servis ayarlarına gidin ve portları domainlere şu şekilde eşleştirin:

| Servis Parçası | Domain (Örnek) | Container Portu |
| :--- | :--- | :--- |
| **Geth (RPC)** | `https://rpc.blockchain.akadal.tr` | `8545` |
| **Faucet (Web)** | `https://blockchain.akadal.tr` | `3000` |
| **Otterscan** | `https://explorer.blockchain.akadal.tr` | `80` (Dikkat: 4000 değil, Coolify iç port olan 80'i görür) |

> **Not:** Eğer Coolify'da "Port Mapping" kısmında container adı seçiyorsanız, `otterscan` container'ı için port `80`, `faucet` için `3000`, `geth` için `8545` seçin.

### Cloudflare Kullanımı
Eğer DNS yönetiminiz Cloudflare'de ise iki seçeneğiniz var:
1.  **DNS Only (Gri Bulut)**: SSL sertifikasını Coolify (Let's Encrypt) otomatik üretir. **Önerilen.**
2.  **Proxied (Turuncu Bulut)**: Cloudflare SSL/TLS ayarınızı **"Full"** (Strict değil) yapın. Coolify yine HTTP/HTTPS karşılar.

---

## 🛠️ Kurulum Adımları

1.  **Coolify'a Ekle**: Bu repoyu "Docker Compose" projesi olarak ekleyin.
2.  **Environment Variables**:
    Hiçbir ayar gerekmez. Varsayılanlar:
    *   `CHAIN_ID`: 1337
    *   `RPC_URL`: Container içi iletişim otomatik.
3.  **Deploy**: Başlatın.

---

## 🧪 Sistemi Test Etme (Deploy Sonrası)

Deploy bittikten sonra şu adımları takip edin:

1.  **Explorer'ı Aç**: `https://explorer.blockchain.akadal.tr` adresine gidin.
    *   Sayfa açılıyorsa Explorer çalışıyordur.
    *   *İlk seferde bağlantı hatası verirse, sağ üstten RPC adresini kontrol edin.*
2.  **Faucet'i Aç**: `https://blockchain.akadal.tr` adresine gidin.
    *   Kendi cüzdan adresinizi yazın ve ETH isteyin.
    *   Transaction hash ("0x...") görürseniz sistem çalışıyor demektir.
3.  **MetaMask Bağla**:
    *   **RPC URL**: `https://rpc.blockchain.akadal.tr`
    *   **Chain ID**: 1337
    *   **Symbol**: ETH
    *   Bakiyenizin geldiğini görün.

---

## ⚠️ Düşük Kaynak Uyarısı (Low RAM VPS)

Sistem **1GB - 2GB RAM** aralığındaki sunucular için optimize edilmiştir:
- **Geth**: Ram usage ~500MB-1GB arasına sınırlandı.
- **Otterscan**: Sadece statik dosya sunar, RAM yemez.
- **Faucet**: ~50-100MB RAM.

Eğer sunucunuzda **Swap** alanı yoksa mutlaka oluşturun (Coolify genelde bunu yönetir ama manuel kontrol etmekte fayda var).
