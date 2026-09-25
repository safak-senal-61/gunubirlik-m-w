# Günübirlik Mobil Uygulama

Web uygulamasının React Native (Expo) sürümü. Aynı backend'e bağlanır:
`https://gunubirlik.space-z.ai/api/v1`

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
