# Günübirlik Mobil Uygulama

Web uygulamasının React Native (Expo) sürümü. Aynı backend'e bağlanır:
`https://gunubirlik.space-z.ai/api/v1`

## Hazır APK (Doğrudan Kurulum)

> ⚠️ **v1.0.0 APK'sında beyaz ekran sorunu vardı** (SDK 52 yeni mimarisi kaynaklı). v1.0.1'de `newArchEnabled: false` yapıldı + hata görünür hale getirildi.

**Yeni derleme (v1.0.2, versionCode 3) — çökme teşhis katmanı eklendi:**
- Build durumu: https://expo.dev/accounts/manahos/projects/gunubirlik/builds/e513f8ab-3101-4d06-9190-2645369ed94a
- Bu sürümde uygulama çökerse hata mesajı **ekranda Alert olarak görünür** (ekran görüntüsü alınabilir).
- Splash görseli de düzeltildi (önceki config'de splash resimsizdi).

v1.0.1 APK: https://expo.dev/artifacts/eas/73YnaUAyekAr-cVxyWdRSz5LXLRS8FHMvO58nIpg3B4.apk (açılışta çökme bildirildi)

Eski link (beyaz ekran sorunlu, kullanmayın): ~~https://expo.dev/artifacts/eas/0TbnaZKsUzSVNNTBJ2TcRz96ZJOb4GLkZllKvreGHTo.apk~~

- Android'de linke tıkla → indir → "Bilinmeyen kaynaklara izin ver" deyip kur. Önce eski sürümü kaldır (aynı package, versionCode 2 yüzeysel olarak üzerine kurar ama temiz kurulum garanti olur).
- Yeni derleme istersen: `cd mobile && EXPO_TOKEN=<token> bunx eas-cli@24.8.0 build --platform android --profile preview --non-interactive --no-wait`
- Derleme durumları: https://expo.dev/accounts/manahos/projects/gunubirlik/builds

## Expo Go ile Açma (En Hızlı Yol)

1. **Expo Go'yu indir** — App Store / Google Play'den "Expo Go" uygulamasını kur.

2. **Bağımlılıkları kur** (proje kökünde değil, `mobile/` klasöründe):
   ```bash
   cd mobile
   bun install        # veya npm install
   ```

3. **Geliştirme sunucusunu başlat:**
   ```bash
   # Aynı ağdaysan (telefon ve bilgisayar aynı Wi-Fi):
   bunx expo start --go

   # Ağ kısıtlıysa / VPN arkasındaysan (tunnel — en garantisi):
   bunx expo start --go --tunnel
   ```

4. **Telefonla aç:**
   - Terminalde çıkan **QR kodu** Expo Go ile okut, **veya**
   - Expo Go içinde "Enter URL manually" → `exp://<bilgisayar-IP>:8081` yaz.

5. Demo hesaplarla giriş:
   - İşçi: `worker1@example.com` / `123456`
   - İşveren: `ahmet@insaat.com` / `123456`

## Neler Var

- **Giriş/Kayıt:** e-posta+şifre, 2FA (authenticator kodu), şifremi unuttum + kodla sıfırlama
- **İşçi akışı:** ilan listesi (adres autocomplete, GPS konumum, 1–25 km yarıçap filtresi, mesafe/yeni sıralama), ilan detayı, başvuru (mesaj + ücret teklifi), kaydedilenler
- **İşveren akışı:** panel (istatistikler), ilan ver (**"📍 Konum Al"** → expo-location GPS + backend reverse geocoding ile il/ilçe/adres otomatik dolar), ilan aç/kapat/sil
- **Her ikisi:** başvurular (kabul/ret/tamamla + yıldızla puanlama), moderasyonlu mesajlaşma, bildirimler, profil düzenleme (PUT /auth/me), şifre değiştirme, 2FA kurulum (QR + secret + yedek kodlar) / kapatma, e-posta değiştirme
- Rol bazlı alt sekme çubuğu, okunmamış bildirim sayacı

## QR Kod Görünmüyor?

1. **Modu kontrol et** — Terminalde `Development build` yazıyorsa `s` tuşuna bas; `Expo Go` moduna geçsin. QR yalnızca Expo Go modunda çalışır.
2. **Terminal QR çizemiyor olabilir** — Klasik Windows cmd, bazı SSH ve dar pencereler QR çizemez. Windows Terminal / VS Code terminali / iTerm2 kullan ve pencereyi genişlet (QR en az ~33 sütun ister).
3. **URL'yi elle gir (QR'sız yöntem):**
   - Terminalde `› Metro waiting on exp://192.168.x.x:8081` satırındaki adresi kopyala
   - Expo Go'da **"Enter URL manually"** seçeneğine bu adresi yaz
4. **Tunnel modu URL verir:**
   ```bash
   bunx expo start --go --tunnel
   # İlk seferde @expo/ngrok kurulumu isterse "y" yaz.
   # Kurulum sorusu gelmezse önce: npm i -g @expo/ngrok@^4.1.0
   ```
   Çıkan `exp://....exp.direct` adresini Expo Go'da "Enter URL manually" ile gir.
5. **iPhone'da** Expo Go'nun kendi tarayıcısını değil, **Camera** uygulamasını aç; QR'yi okutunca çıkan banner'a dokun (Expo Go otomatik açılır). Android'de Expo Go ana ekranındaki **"Scan QR code"** düğmesini kullan.
6. **Kendi bilgisayarında çalıştır** — Freebuff web terminalinde değil; telefonun bilgisayara ulaşabilmesi için sunucu senin makinende ve aynı ağda (veya tunnel ile) olmalı.

## Konfigürasyon

| Ne | Nasıl |
|---|---|
| Backend URL | `mobile/src/lib/api.ts` → `API_BASE` sabiti |
| Google ile giriş | `expo-auth-session` Google sağlayıcısından `idToken` alıp `googleLogin(idToken)` çağırın (backend `/auth/google` hazır) |

## Notlar

- `--tunnel` modu ilk bağlantı biraz yavaş başlar ama kurumsal/şifreli ağlarda tek güvenilir seçenektir.
- Konum izni ilk "Konum Al"/"GPS" kullanımında istenir; reddederseniz Ayarlar → Expo Go → Konum'dan verebilirsiniz.
- Token `@react-native-async-storage/async-storage` ile kalıcı saklanır; uygulama kapanıp açıldığında oturum korunur.
- Bu proje yalnızca Expo Go içinde çalışır (development). Mağazaya yüklemek için `eas build` gerekir (bunun için ayrıca `eas-cli` kurulumu gerekir).
