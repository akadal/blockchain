# Akadal Chain - Sistem Analizi ve Yenileme Stratejisi

## 1. Problem Tanımı ve Log Analizi

Sistemin sunduğu logları incelediğimizde şu ana sorunlar tespit edilmiştir:
- **Geth Çökmesi (Segmentation Fault):** Geth düğümü, özellikle `vm.opRandom` ve EVM işlemcisi seviyesinde, tahsis edilmemiş veya bozulmuş belleğe (nil pointer) erişmeye çalışırken `SIGSEGV` hatası vererek kapanıyor. Bu, mevcut zincir verilerinin (chaindata) bozulmuş olduğunu ve eski bir işlemin yeniden çalıştırılmaya çalışıldığını gösterir.
- **RPC Bağlantı Hataları (502 Bad Gateway):** Geth düğümünün saniyeler içinde çöküp yeniden başlaması (loglardaki "Unclean shutdown detected" mesajları bunun kanıtıdır), RPC sunucusunun (Nginx) ve Faucet'in ona bağlanamamasına yol açıyor.
- **Sürekli Yeniden Başlama Döngüsü (Crash Loop):** Faucet loglarındaki `ECONNRESET` ve Nginx'teki `geth could not be resolved` hataları, Geth'in sürekli çöküp kalkmasından kaynaklanmaktadır.

## 2. Çözüm Yaklaşımı ve Hedefler

"Sisteme format atma", "sıfırdan maksimum uyumlulukta bir ağ kurma" ve "eğitim ortamı için kararlı yapı sağlama" taleplerinize istinaden şu strateji izlenecektir:

### 2.1. Temiz Bir Sayfa (Format Atma)
Mevcut bozuk veri yığınından kurtulmak için en kesin ve güvenli yol, veritabanını tutan Docker Volume'unu sıfırlamaktır.
- **Aksiyon:** `docker-compose.yml` içindeki `geth_data_stable` birimi iptal edilip yerine `geth_data_v2` gibi yeni bir volume tanımlanacak. Bu sayede, Geth ilk defa çalışıyormuş gibi taze ve sorunsuz bir genesis bloğuyla başlayacak.

### 2.2. Geth Sürüm Güncellemesi ve Kararlılık
- Mevcut Sürüm: `v1.12.2`
- Hedef Sürüm: `v1.13.15`
- **Neden v1.13.15?** Bu sürüm, Proof-of-Authority (Clique) ağları için Merge (PoS) zorunluluğu getirmeden en güncel EVM opcode'larını (örneğin PUSH0 gibi Solidity'nin en son sürümlerinde kullanılan özellikler) destekler. Yani akıllı sözleşmeleriniz ve NFT'leriniz tam uyumlulukla çalışır. v1.14 ve sonrası Clique desteğini kaldırdığı için eğitim ağları için v1.13.15 "altın standart"tır.

### 2.3. Kaynak Yönetimi (RAM)
- Loglardaki bellek hatasının (SIGSEGV) ve ani çökmelerin bir nedeni de kaynak yetersizliği olabilir.
- **Aksiyon:** Geth düğümüne tahsis edilen 1GB RAM sınırı, Hetzner VPS'in 4GB kapasitesi göz önüne alınarak 1.5GB'a (veya Docker'ın dinamik kullanımına) yükseltilecek.

### 2.4. Blok Süresi ve Boyutu (Gas Limit) Ayarları
- **Blok Süresi:** Sıkışmayı önlemek ve daha gerçekçi bir ağ simülasyonu sunmak için blok süresi (Clique `period` değeri) 5 saniyeden 15 saniyeye çıkarılacaktır.
- **Blok Boyutu (Gas Limit):** Büyük akıllı sözleşmelerin tek işlemde rahatça yüklenebilmesi için `genesis.json`'daki mevcut yüksek gas limiti (`800000000`) korunacak, hatta gerekirse daha da sağlamlaştırılacaktır. `--miner.gaslimit 800000000` bayrağı Geth başlatma betiğine eklenecek.
- **Sınırsız Bakiye:** Genesis bloğundaki Faucet ana hesabı, daha önce olduğu gibi astronomik bir bakiye (`1000000000000000000000000` Wei) ile tanımlı kalacaktır.

## 3. Adım Adım Uygulama Planı

1. **Docker İmajı Güncellemesi:** `geth-config/Dockerfile` içindeki sürüm `v1.13.15` olarak değiştirilecek.
2. **Genesis Ayarları:** `genesis.json` içindeki `period` değeri 15 yapılacak. Ayrıca, EVM özelliklerinin eksiksiz çalışması için `shanghaiTime` (ve eğer destekleniyorsa Paris) kuralları kalıcı hale getirilecek.
3. **Başlatma Betiği Optimizasyonu:** `geth-boot.sh` incelenip `v1.13.15` ile uyumsuz olabilecek eski bayraklar (flags) temizlenecek ve gas limiti açıkça belirtilecek.
4. **Volume Değişikliği:** `docker-compose.yml` dosyasında veritabanı volume'u `geth_data_v2` olarak adlandırılarak sistemin tam bir "format" alması sağlanacak. Geth servisine `1.5G` bellek sınırı tanınacak.
5. **Belge Güncellemesi:** Sistem değişikliklerini yansıtmak üzere `README.md` ve özellikle AI bağlam dosyası olan `GEMINI.md` güncellenecek.
6. **Test ve Doğrulama:** Tüm bu işlemler sonrasında ağın ayağa kalktığı, Faucet'in çalıştığı ve akıllı sözleşme dağıtımının yapılabildiği test edilecek.

Bu strateji, karmaşıklığı artırmadan, eğitim amaçlı ve son derece kararlı bir "Akadal Chain" elde etmemizi sağlayacaktır.