# GYS 85+ · Şube Müdürü (Teknik)

ÇŞİDB 2027 sınavı için mobil öncelikli hazırlık uygulaması. **Durum: Faz 0 / Prototip. MVP ve içerik kabulü tamamlanmadı.**

Mevcut `Celal84/gys-app` uygulaması korunarak geliştirilmiştir. Alpine.js sürdürülmüş, CDN bağımlılıkları yerel Vite derlemesine taşınmıştır. React'e geçiş için çalışan uygulamayı yeniden yazmak gerekmemektedir. Yeni güvenilirlik katmanı TypeScript'tir; mevcut motor JavaScript'tir.

## Çalıştırma

Node.js 24 ve npm gereklidir.

```sh
npm ci
npm run dev
```

Vite çıktısındaki yerel adresi açın. Üretim derlemesi ve çevrimdışı kontrol için:

```sh
npm run build
npm run preview
```

Service worker üretim derlemesinde çalışır; ilk başarılı çevrimiçi açılış gerekir. Gerçek telefonda kurulum/çevrimdışı kullanım için HTTPS gerekir (`localhost` geliştirme istisnasıdır). İlk açılışta bağlantısız yüklenebileceği veya PWA kapalıyken mevzuat tarayacağı iddia edilmez. iPhone Safari cihaz kabulü henüz yapılmadı. Kullanıcı onayı olmadan canlı yayına çıkılmadı.

## Kontroller

```sh
npm run lint
npm run typecheck
npm run test
npm run build
npm run audit:content
npm run test:e2e
```

Yerelde `/usr/bin/chromium` kullanılır; başka sistemde Playwright yapılandırmasındaki tarayıcı yolunu ayarlayın. CI, Playwright Chromium'u kurar. `.github/workflows/ci.yml` tanımlandı; uzak GitHub Actions çalışması bu oturumda yapılmadı.

## İçerik durumu

Eski dosyalarda 24 gömülü + 26 JSON = 50 kayıt var; bunlar **50 özgün/onaylı soru değildir**. 16 tekrar adayı kümesi bulundu; anlamsal denetim tamamlanmadı. 5.400 özgün soru hedefi korunuyor; bu fazda üretilen ve onaylanan soru 0.

`data/approved-content.json` yalnız onay sürecini geçmiş içerik ve kaynak snapshot'ları içindir; şu anda boştur. Eski/import edilen sorular inceleme verisidir. JSON dosyasındaki `Approved` yazısı yayın yetkisi oluşturmaz. Kaynak kanıtı ve bağımsız kontrol kaydı olmadan yayın kapısı açılmaz. Faz 0'da konu testleri ve tam deneme bu nedenle başlatılmaz. Testlerde kullanılan sentetik sorular uygulama içerik paketine dahil değildir.

## İlerleme güvenliği

`gys_duo_state_v1` ve `gys_duo_questions_v1` eski anahtarlarına yazılmaz/silinmez. Yeni kayıt `gys_v4_workspace_v1` içinde tek sürümlü zarfla tutulur. Geri yüklemeden önce şema ve çakışmalar doğrulanır, kullanıcıya kayıt sayıları gösterilir; önceki yeni kayıt kurtarma kopyasında tutulur. Bozuk kayıtlar otomatik düzeltilip üzerine yazılmaz. Tarayıcı depolaması işletim sistemi/tarayıcı tarafından temizlenebilir; düzenli JSON yedeği alın. Aynı origin'de eski ilerleme okunur; farklı origin/cihazdan otomatik taşınmaz.

## Kaynaklar ve devam

- [Faz 0 bulguları ve plan](docs/PHASE_0_REPORT.md)
- [Test raporu](docs/QA_REPORT.md)
- [Kayıtlı proje durumu](docs/PROJECT_STATE.json)
- [V4 uygulama sözleşmesi özeti](docs/IMPLEMENTATION_CONTRACT_V4.md)
- [Resmî parametre doğrulaması](data/official-verification.json)

Özel Drive ham dosyaları ve ayrıntılı envanter `.local-sources/` altında, Git dışında tutulur. İstemciye veya depoya erişim sırrı eklenmez. `.local-sources` kalıcı uzak yedek değildir; ortam kaybolursa yetkili Drive bağlantısından tekrar alınmalıdır. İlerleme klasörü ID bazında tarama dışıdır. Drive dosyaları değiştirilmedi.
