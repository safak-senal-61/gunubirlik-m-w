# Günübirlik Mobil Uygulama

Web uygulamasının React Native (Expo) sürümü. Aynı backend'e bağlanır:
`https://gunubirlik.space-z.ai/api/v1`

## Hazır APK (Doğrudan Kurulum)

**v1.4.0 (versionCode 16) — UX İYİLEŞTİRMELERİ + UYGULAMA İÇİ ROTA + DEEP LINK (en güncel):**
> 📥 **APK:** https://expo.dev/artifacts/eas/okA5DPxVEUKLvJPJaqzk0OsokrP1H9OhJNAZYAyMxks.apk
> Build: https://expo.dev/accounts/safak61s-team/projects/gunubirlik/builds/6929280b-74d9-4292-8392-afa7e41c6558
- 🔔 **Bildirimler otomatik okundu:** ekran açılır açılmaz tüm bildirimler sessizce okundu işaretlenir — "Tümünü okundu işaretle" butonu KALDIRILDI; rozet anında düşer
- ⚡ **Bildirim ayarları anında açılır:** sekme geçişinde circular spinner tamamen kaldırıldı (cache-first zaten vardı; bekletme ekranı da kaldırıldı)
- ✏️ **Profil düzenleme modern sheet:** ikon rozetli başlık + kapat butonu + bölümlere ayrılmış form (Kişisel bilgiler / İşçi profili / Hakkımda)
- 🔒 **Güvenlik sadeleşti:** yedek "Şifremi unuttum" kartı KALDIRILDI (şifre sıfırlama zaten giriş ekranında); "Şifre değiştir" kartı modern ikonlu tasarıma çevrildi (Google hesabında farklı ipucu)
- 🧭 **Yol tarifi UYGULAMA İÇİ:** Google Maps artık AÇILMAZ — cihaz konumu alınır, OSRM ile gerçek yol rotası hesaplanır ve haritanın ÜZERİNE çizilir (mesafe + süre bilgisiyle)
- 🔗 **Push deep link (api-doc uyumlu):** backend `app_url`/launchURL gönderirse (`gunubirlik://messages/{id}`, `jobs/{id}`, `applications`, `wallet`, `verification`, `profile`, `notifications`) bildirime dokunmak DOĞRUDAN ilgili ekrana açar; web sitesine yönlenme yok. `scheme: "gunubirlik"` app.json'a eklendi; `messages/{id}` hedefi konuşmayı doğrudan açar

**v1.3.1 (versionCode 15) — KAYIT EKRANI ÇÖKME DÜZELTMESİ:**
- 🐛 "Metin dizeleri <Text> bileşeni içinde oluşturulmalıdır" hatası: kayıt formunda Banner ile buton aynı JSX satırına alınmıştı (aradaki boşluk RN'de çıplak metin) → ayrı satırlara alındı
- Google girişi artık ilk açılışta hesap seçme diyaloğunu düzgün gösterir (v1.3.0'daki Google butonu çökmesi de bu sürümde çözülür)

**v1.3.0 (versionCode 14) — GOOGLE GİRİŞ + SOHBET/PUSH DÜZELTMELERİ:**
> 📥 **APK:** https://expo.dev/artifacts/eas/iQmwRVSvhrjIP6Bh5XYq8UjE4o_osiR6CM-A6FOD0JQ.apk
> Build: https://expo.dev/accounts/safak61s-team/projects/gunubirlik/builds/93809175-b31d-4592-90b3-74b1a1359c8f
> ⚠️ **Yeni EAS hesabı** (safak61s-team) + **yeni keystore** — eski v1.2.1 APK üstüne kurulamaz, önce kaldırın.
- 🐛 **"Sohbete başla" düzeltmesi:** karşılama mesajındaki "İlanınız" kelimesi backend spam filtresine takılıp mesajı engelliyordu → nötr karşılama ("Merhaba! Bu iş hakkında konuşmak istiyorum. 👋") + doc-exact payload (`type: "TEXT"`)
- 🔐 **Google ile giriş/kayıt:** `@react-native-google-signin/google-signin` → `POST /auth/google { idToken }`; hesabı olana otomatik kayıt, olana giriş
  - Web client ID: `411578437442-...googleusercontent.com` (`src/lib/google-auth.ts`)
  - Android OAuth client (aynı Google projesi): package `com.gunubirlik.app` + **YENİ keystore SHA-1** (safak61s-team hesabı): `AA:21:35:47:0B:E3:55:85:FF:B7:AB:54:26:B1:A7:AB:63:82:DB:9D`
  - ⚠️ Eski manahos hesabının SHA-1'i (`BB:24:49:...`) geçersiz — Google Cloud'da Android client'a yukarıdaki yeni SHA-1 girilmeli
- 🔔 **Push fallback tag:** backend push gönderirken external_id sonrası `tag: user_id` fallback'i kullanıyor → `identifyUser()` artık `user_id` tag'ini de yazıyor; çıkışta temizleniyor
- ✅ **Google Cloud kurulumu tamamlandı:** Web + Android OAuth client'ları oluşturuldu; Android client'a EAS keystore SHA-1 işlendi

### Google Sign-In kurulumu (referans)
1. [console.cloud.google.com](https://console.cloud.google.com) → proje aç/ seç
2. **APIs & Services → OAuth consent screen**: External, app adı + destek e-postası
3. **Credentials → Create Credentials → OAuth client ID**:
   - **Web application** → client ID → `src/lib/google-auth.ts` içindeki `GOOGLE_WEB_CLIENT_ID` değerine yazılır
   - **Android** → Package name: `com.gunubirlik.app` + SHA-1: EAS keystore parmak izi (yukarıda)
4. Native config değişirse yeni build al

**v1.2.1 (versionCode 13) — AYARLAR EKRANI ÇÖKME DÜZELTMESİ:**
> 📥 **APK:** https://expo.dev/artifacts/eas/Fmi8MDRu0ltCr-eU7tgwyhY4jCmBX4pfpadxy_Q6oeo.apk
> Build: https://expo.dev/accounts/manahos/projects/gunubirlik/builds/b5ce4b68-90ec-44b2-a2e3-aa95a28699aa

> ⚠️ **v1.0.0 APK'sında beyaz ekran sorunu vardı** (SDK 52 yeni mimarisi kaynaklı). v1.0.1'de `newArchEnabled: false` yapıldı + hata görünür hale getirildi.

**ÇÖZÜM SÜRÜMÜ (v1.0.4, versionCode 5):**
- Kök neden: `"main" has not been registered` — Android release'te root bileşen açıkça kaydedilmeliydi (`registerRootComponent`). Expo Go'da fark edilmiyordu.
- Build: https://expo.dev/accounts/manahos/projects/gunubirlik/builds/93dc1498-3b0a-4b41-87f2-fbc1f06668da
- APK: https://expo.dev/artifacts/eas/sRvJ-6x851GWn73wIroN-akMk0KvrGMRllWsM576f7A.apk
- `App.tsx` artık `registerRootComponent(RealApp)` çağırıyor; crash-reporter da korunuyor.

**v1.1.0 (versionCode 6) — BÜYÜK ÖZELLİK GÜNCELLEMESİ:**
- ⚙️ **Sekmeli Ayarlar:** Hesap / Cüzdan / Güvenlik / Bildirim / Politikalar / Hakkında sekmeleri
- 👛 **Cüzdan:** kazanılan/bekleyen ödeme özeti, ödeme kayıtları, 5 adımlı ödeme akışı açıklaması (backend akışına göre: COMPLETED → PENDING → admin onayı → PAID → RECEIVED)
- 💬 **Sohbet Et butonu:** ilan detayında ve kabul edilmiş başvurularda → `POST /conversations` ile nezaket mesajı gönderip Mesajlar sekmesine yönlendirir
- 🔔 **Bildirimler sekmesi:** her iki rolde ayrı sekme + okunmamış rozeti; bildirime dokun → okundu yap + ilgili işi aç; tümünü okundu işaretle / sil
- 📱 **QR kod:** İşe Başla / İşi Bitir / Ödemeyi Al modları — iş, kişi, tutar ve tarih bilgisi QR içinde; işveren ilan detayından, işçi kabul edilmiş başvurusundan gösterir
- 🖼️ **Profil fotoğrafı:** galeriden seç + `POST /auth/avatar` yükleme (expo-image-picker)
- 📊 **İş geçmişi:** tamamlanan işler, toplam kazanç ve istatistikler (Hesap sekmesi)
- 📜 **Politikalar:** moderasyon kuralları (LOW/HIGH/CRITICAL), yaptırım tablosu, ödeme/ilan onay/topluluk politikaları
- 🛠️ **Bakım modu kapısı:** Admin panelden bakıma alınınca (60 sn içinde) uygulamanın TAMAMI — giriş dahil — güzel temalı bakım ekranına döner: API'den başlık/mesaj, geri sayım, iletişim kanalları (WhatsApp/Ara/E-posta/Instagram), "Yeniden dene". Bakım durumu önbellekte tutulur; kapalıyken uygulama anında açılır.
- 💬 **QR Tara (işçi):** expo-camera ile işveren QR'ını okutur → check-in/check-out backend'e işlenir

**v1.2.1 (versionCode 13) — AYARLAR EKRANI ÇÖKME DÜZELTMESİ (en güncel):**
> 📥 **APK:** https://expo.dev/artifacts/eas/Fmi8MDRu0ltCr-eU7tgwyhY4jCmBX4pfpadxy_Q6oeo.apk
> Build: https://expo.dev/accounts/manahos/projects/gunubirlik/builds/b5ce4b68-90ec-44b2-a2e3-aa95a28699aa
- 🐛 **"Metin dizeleri <Text> bileşeni içinde oluşturulmalıdır" hatası düzeltildi:** Hesap (Ayarlar) sekmesinde `RatingSummarySection` ve `MyReviewsSection` JSX'i aynı satırda aralarında boşlukla render ediliyordu; RN bu boşluğu çıplak metin sayıp ekrani çökertiyordu. Bileşenler ayrı satırlara alındı.

**v1.2.0 (versionCode 12) — AKICI UI + YENİ API ENTEGRASYONLARI:**
> 📥 **APK:** https://expo.dev/artifacts/eas/Vc_fzZ6TCbp-iaUIrHuiO9VNv_ZN6rehYgiVKUiQwKg.apk
> Build: https://expo.dev/accounts/manahos/projects/gunubirlik/builds/d6a6b903-4b5c-41f6-8a71-ee4e6ca8ee12
- 📍 **İşler ana sayfası:** GPS ile konum alınca il · ilçe · mahalle · cadde detayı görünür; iskelet yükleme kartlarıyla akıcı ilk yükleme; kategori butonları şık ikon kartlarına dönüştü; pull-to-refresh + yeni ilan yayınlandığında liste kendini tazeler.
- 💬 **Başvuru mesajı spam filtresi dostu:** nötr hazır mesaj şablonları + "telefon/e-posta/IBAN paylaşımı otomatik engellenir" bilgi notu ("ilanınız" gibi ifadelerin yanlışlıkla yıldızlanması önlenir).
- ✏️ **Profil düzenleme modal sheet'e taşındı** — açılışta alanlar güncel verilerle dolar, kaydetme sonrası onay bildirimi çıkar.
- 📊 **İşçi istatistik kartları yenilendi:** tamamlanan iş / toplam kazanç / başvuru kartları renkli, taşmayan tipografili modern kartlar.
- ⭐ **Puan özeti + aldığım yorumlar** (Hesap sekmesi): ortalama, yıldız dağılım barları, son 30 gün trendi, son yorumlar (`GET /users/me/rating-summary`, `GET /users/me/reviews/received`).
- 🛡️ **Doğrulama & rozetler:** kimlik/şirket/vergi belgesi yükleme (galeriden seç → base64), PENDING/onay/ret durum kartları (`POST /users/me/verification-request`, `GET /users/me/verification-status`).
- 🎧 **Destek talepleri (Hakkında sekmesi):** kategori/öncelik seçimi + talep geçmişi ve admin yanıtları (`GET/POST /support/tickets`).
- 🗑️ **Hesap silme talebi (Hakkında sekmesi):** sebep/geri bildirim + onay diyaloğu + talep durumu (`GET/POST /auth/delete-account`).
- 💸 **Cüzdan bakiyesi artık cache'li:** sekmeye her girişte "yükleniyor" yok — son bakiye anında görünür, arka planda tazelenir.
- ⚡ **Bildirim ayarları cache-first:** sekme açılışında spinner yok, anahtarlar anında gelir.
- 🛡️ **Güvenlik sekmesi modernized:** koyu temalı güvenlik merkezi başlığı + ikonlu durum satırları.
- 📞 **Kayıt telefonu:** ülke kodu seçici (TR/US/DE/GB/FR/NL/AZ) + ülkeye göre maskeli giriş + kalan karakter sayacı; numara E.164 olarak gönderilir.
- 📅 **İş paylaşımı:** şık takvim ile gün + 30 dk aralıklı saat seçici (manuel giriş dahil) (`src/components/pickers.tsx`).
- 🗺️ **Harita:** tam ekran büyütme + Google Maps yol tarifi butonu.

**v1.1.5 (versionCode 11) — PUSH İZİN AKIŞI + API UYUMU + LOGO/SPLASH:**
> 📥 **APK:** https://expo.dev/artifacts/eas/rXFenYFWBgoZqbY1454YHTTZtRH6szgifcOmQ9jSXBk.apk
> Build: https://expo.dev/accounts/manahos/projects/gunubirlik/builds/c0504f0e-0290-40e6-8fbd-689c23bbdbee
- 🐛 **"Push bildirimleri hazır!" dialogu her uygulama açılışında tekrar çıkması düzeltildi:** "soruldu" bayrağı artık AsyncStorage'da kalıcı (`gb_onesignal_asked_v1`); bir kez izin verildikten (veya reddedildik) sonra diyalog bir daha ASLA çıkmaz.
- ✅ **İzin istemi artık yalnız giriş/kayıt BAŞARISINDA** isteniyor (login / kayıt / Google girişi sonrası abonelik doğrulanınca). Login-kayıt ekranında ve uygulamanın her açılışında çıkmaz.
- 🔕 **İzin zaten verilmişse diyalog hiç gösterilmez** (izin durumu dialog öncesi tekrar doğrulanır).
- 🔁 **İzin verilmemişse:** Ayarlar > Bildirim ekranındaki "Bildirimlere izin ver" butonuyla (ve sistem ayarlarıyla) her zaman tekrar izin istenebilir.
- 📌 **Bildirimler sekmesinde sabit uyarı bandı:** sistem bildirim izni kapalıysa listenin üstünde kaybolmayan turuncu bant: "🔔 Bildirimler kapalı, lütfen açın — Dokun → Bildirim Ayarları". Dokununca Ayarlar > Bildirim sekmesi açılır; izin verilince bant kendiliğinden kaybolur.
- 🔗 **API dokümanına göre uç nokta uyumu düzeltildi (api-doc kaynaklı):**
  - `POST /auth/reset-password` gövdesi `{ code, newPassword }` olarak düzeltildi (mobilde yanlışlıkla `email` de gönderiliyordu; dokümanda yok)
  - `POST /auth/avatar` multipart yerine **JSON `{ base64, mimeType }`** gönderiyor (expo-file-system ile dosya base64'e çevrilir) — profil fotoğrafı yükleme artık backend formatına tam uyumlu
  - **E-posta doğrulama eklendi:** `POST /auth/send-otp` (EMAIL_ACTIVATION), `POST /auth/verify-email`, `POST /auth/resend-activation`
  - **Kayıt sonrası aktivasyon ekranı:** hesap açılınca 6 haneli kod ekranı gelir (doğrula / tekrar gönder / sonra doğrula)
  - **Ayarlar > Güvenlik'e "📧 E-postanı doğrula" kartı:** emailVerified=false olan hesaplara turuncu vurgu kartı (e-posta değişikliği backend'de emailVerified ister)
  - E-posta değiştirme açıklaması düzeltildi: kod YENİ adrese gider (mevcut olana değil)
- 🎨 **Yeni logo + splash:** mavi "C" + turuncu konum pini markası `mobile/assets/generate-icons.mjs` betiğiyle SVG'den üretildi (icon 1024, adaptive-icon güvenli bölge paylı, splash-icon 512). **Boş mavi splash ekranı düzeltildi:** eski `splash.image` 2 KB'lık bozuk `icon.png`'yi işaret ediyordu → artık gerçek `splash-icon.png` (beyaz zemin), adaptive icon beyaz zeminli foreground görselle geliyor.

**v1.1.4 (versionCode 10) — ONESIGNAL PUSH + GENİŞ BİLDİRİM AYARLARI:**
> 📥 **APK:** https://expo.dev/artifacts/eas/bG8dbXfgD7F4KYNYDFDpqknh8mmRYe1j_7mG8rvwEtU.apk
> Build: https://expo.dev/accounts/manahos/projects/gunubirlik/builds/4795d747-3771-4bb5-bbdf-64a13f40b98d
- 🔔 **OneSignal SDK entegre edildi** (react-native-onesignal 5.4.0 Stable + onesignal-expo-plugin 2.4.0, App ID `6bddc78e-…`)
  - Girişte kullanıcı backend user id ile `OneSignal.login(externalId)` üzerinden eşleşir (+ `gbUserId` alias, e-posta, rol tag'i) → backend bildirimi `include_aliases: external_id` ile bu cihaza gönderebilir
  - Çıkışta oturum kapanır (`logout`), cihaz anonim abone olur
  - İlk sunucu kayıtlı abonelik doğrulandığında **bir kez** "Push bildirimleri hazır" dialogu gösterilir; sistem izni bu dialogun "Tamam" butonuna bağlıdır (açılışta otomatik izin istemi yok)
  - Bildirime dokununca backend `data` alanına göre doğru ekrana yönlendirme: chat bildirimi → Mesajlar, `jobId` → ilan, `applicationId` → Başvurular; uygulama kapalıyken dokunulan bildirim de (soğuk başlatma) doğru ekrana açar
  - Ön planda gelen bildirimler alt çubuktaki okunmamış rozetini anında günceller
  - Kullanıcının bildirim tercihleri OneSignal tag'lerine de yazılır (`gb_off_<kategori>`), dashboard'dan hedefleme yapılabilir
- ⚙️ **Ayarlar > Bildirim tamamen yenilendi ve API'ye bağlandı** (eski statik liste kaldırıldı):
  - `GET/PUT /notifications/settings` + `POST /notifications/settings/reset` uçları eklendi (canlı API'de doğrulandı)
  - **Ana anahtar:** Push bildirimleri — kapatınca tüm kategoriler sustar, OneSignal aboneliği `optOut` olur
  - **17 kategori 5 grupta:** İş ilanları & başvurular (yeni başvuru, kabul, ret, hatırlatma, yakındaki iş), Sohbet (yeni mesaj), Ödeme & cüzdan (5), İş süreci (başlangıç/tamamlanma/itiraz), Sistem (güncelleme/bakım/kampanya)
  - Optimistic anahtarlar + hata halinde geri alma + "✓ Kaydedildi" göstergesi, "Tümünü aç" / "Varsayılana sıfırla", sistem izni kartı (izin yoksa izin iste / cihaz ayarlarına git), OneSignal abonelik teşhisi, aşağı çekerek yenileme
  - Kapalı kategori için sunucu bildirimi hiç üretmez (`createNotification()` kontrolü); cihazda sadece gizlenmez
- ℹ️ Push yalnızca build edilmiş APK'da çalışır (Expo Go desteklemez). Backend'in OneSignal'a `include_aliases: { external_id: [userId] }` ile gönderim yapması ve App Auth anahtarını sunucuda tutması gerekir.
- 🔧 **Sürüm notu:** `react-native-onesignal@5.4.x` codegen spec'i RN 0.79+ gerektirdiğinden (ilk build `UnsupportedModulePropertyParserError` verdi) ve 5.3.x+ native OneSignal 5.7.x Kotlin 2.2 metadata taşıdığından (ikinci build `Incompatible classes` verdi), **5.2.17**'ye sabitlendi: native OneSignal 5.4.2 (Kotlin 1.9 uyumlu) + codegen yok + yeni JS API (login/logout, pushSubscription, Notifications.addEventListener) birebir aynı.

**v1.1.3 (versionCode 9) — CÜZDAN & ÖDEME SİSTEMİ + BUGFİXLER:**
> 📥 **APK:** https://expo.dev/artifacts/eas/_uqWTxf29D4YsyJFZaLqBd_9g_pr2AwOPcPMLDTqYhY.apk

- 💳 **Cüzdan ekranı gerçek backend'e bağlandı** (statik özet kaldırıldı): canlı bakiye kartı, bekleyen yatırma/çekme toplamları
- 💸 **Para Yatır:** `POST /wallet/deposit-request` — tutar + ad soyad + IBAN (TR+26 hane doğrulama, otomatik biçimlendirme) + banka/not; yönetim EFT/havale onayı sonrası bakiyeye işler
- 🏧 **Para Çek:** `POST /wallet/withdraw-request` — bakiye kontrolü, IBAN doğrulama; tutar emanete alınır, onaydan sonra IBAN'a gönderilir (3-5 iş günü)
- ↔️ **Para Gönder:** `POST /wallet/transfer` — başka kullanıcıya anında transfer (min 10 ₺)
- 📲 **QR ile Öde / QR ile Al:** `POST /wallet/qr-pay/generate` + `POST /wallet/qr-pay/scan` — gerçek base64 QR görseli, 5 dakikalık **canlı geri sayım**, tek kullanımlık token; alma ekranında kamera + manuel token doğrulama
- 🧾 **Hareket listesi:** `GET /wallet/transactions` — tip filtreleri (Tümü/Yatırma/Çekme/İş ödemesi/QR ödeme/Transfer), +/- renkli tutarlar, işlem sonrası bakiye
- 🗂️ **Talep geçmişi:** yatırma + çekme talepleri tek listede, durum rozeti (Onay bekliyor / Onaylandı / Tamamlandı / Reddedildi) ve ret gerekçesiyle
- 🐛 **Kaydetme (♡/✓) senkronu düzeltildi:** `fetchSavedJobIds()` `cachedFetch` sarmalayıcısını doğrudan döndürüyordu (`Array.isArray` hep `false` → kayıtlı ID'ler hep boş geliyordu). Artık `src/lib/saved-store.ts` tek kaynak: ana sayfada kaydedilen iş detay kartında da "✓ Kaydedildi" görünüyor (ve tersi). "Kaydedilenler" sekmesi de aynı store'u kullanıyor.
- 🐛 **Pull-to-refresh göstergesi çakışması giderildi:** native `RefreshControl` spinner'ı ile özel "Güncelleniyor…" şeridi üst üste biniyordu; şerit tüm ekranlardan kaldırıldı.
- 🐛 **"Puan Ver" butonu kalıcı kalmıyordu:** puan gönderildikten sonra sunucudan bayat liste döndüğü için buton görünmeye devam ediyordu. Artık puan lokalde tutuluyor → buton anında kayboluyor, `⭐ x/5` rozeti gösteriliyor.
- ✨ **Ayarlar profil kartı modernleşti:** indigo gradient'li kart, yuvarlak avatar halkası + kamera rozeti, cam efektli rol/doğrulama chip'leri, ikonlu bilgi hapları (e-posta/telefon/konum), 2 kolonlu istatistik bloğu (puan + üyelik tarihi)
- ✨ **Login / Register ekranları modernleşti:** parlak blob'lu marka header'ı, gölgeli logo kutusu + tagline, odak animasyonlu ikonlu input alanları, ikonlu "İşçiyim / İşverenim" rol kartları (ipucu metniyle), hata/başarı banner'ları, "veya" ayırıcı, yuvarlak köşeler ve yumuşak gölgeler
- ℹ️ Otomatik IBAN ödemesi (payout) yerine backend'in mevcut **elle talep + yönetim onayı** modeli birebir uygulandı; canlı API ile doğrulandı.
- Build: https://expo.dev/accounts/manahos/projects/gunubirlik/builds/370b03f8-330d-4a7f-ba81-55d3df23b40d
- APK: https://expo.dev/artifacts/eas/_uqWTxf29D4YsyJFZaLqBd_9g_pr2AwOPcPMLDTqYhY.apk

**v1.1.2 (versionCode 8) — ÇÖZÜM SÜRÜMÜ (Ayarlar çökmesi düzeltildi):**
- 🐛 **Ayarlar sekmesi çökmesi düzeltildi:** sekme butonunda aynı `Animated.View` üzerinde hem native (`transform`) hem JS (`backgroundColor`) driver'lı animasyon çalışıyordu → "Attempting to run JS driven animation on animated node that has been moved to native" hatası. Tüm animasyonlar artık tutarlı şekilde JS-driven.
- Aşağıdaki v1.1.1 değişikliklerinin TAMAMI bu sürümde de mevcut.
- Build: https://expo.dev/accounts/manahos/projects/gunubirlik/builds/33eb4483-4c0e-4099-953a-611cf25ff84c
- APK: https://expo.dev/artifacts/eas/_3CUDZHSnd8XGh97B2BY8LD-DJkaVxLFWIeFlkh0GB0.apk (bu sürümün arşivi; yerine v1.1.3'ü kur)

⚠️ **v1.1.1 (versionCode 7) KURMAYIN** — Ayarlar sekmesi bu sürümde çöker (build iptal edilemeyecek kadar hızlı bitmişti, bu yüzden v1.1.2 ile düzeltildi):
- Build: https://expo.dev/accounts/manahos/projects/gunubirlik/builds/2ad4b044-f95b-4a23-8662-8d9882c8a611
- APK (sorunlu, arşiv): https://expo.dev/artifacts/eas/_3CUDZHSnd8XGh97B2BY8LD-DJkaVxLFWIeFlkh0GB0.apk

**v1.1.1 (versionCode 7) — BUGFİX + HARİTA GÜNCELLEMESİ (çökmeli, v1.1.2'ye geçin):**
- 🐛 **Bildirim ekranı sonsuz yükleme döngüsü düzeltildi** (uygulama kilitleniyor, menülere geçilemiyordu)
- 🐛 **İş detay kartı açıkken alt menüye basınca** artık detay kapanıyor ve seçilen sekme açılıyor (önce arka planda değişiyor ama kart ekranda kalıyordu)
- 🐛 **QR Tara butonu** artık sadece İşler/Başvuru sekmelerinde; Mesajlar ekranında yazma alanını kapatmıyor
- 🐛 **İşi Kaydet (♡) butonu çalışıyor:** gerçek API toggle + optimistik ♡ ⇄ yeşil ✓ dönüşü (listede ve detayda); Kayıtlılar listesinde kalp ✓ görünür
- ✨ **İş yeri haritası:** Leaflet + OpenStreetMap interaktif harita — kategoriye uygun emoji pin, popup (iş adı + adres), 400 m çevre çemberi (react-native-webview)
- ✨ **"Başvurun kabul edildi"** çirkin badge yerine şık durum banner'ı: ikon kutusu (🎉/⏳/💔/🏁), bold başlık, açıklama, duruma göre renk
- ✨ **Manuel token doğrulama:** kamera bozuksa QR tarayıcıda token/QR içeriği yapıştırılıp doğrulanabiliyor
- ✨ **Ayarlar sekmeleri animasyonlu:** yay (spring) basış efekti, yumuşak renk geçişi, içerik fade+slide geçişi
- Build: https://expo.dev/accounts/manahos/projects/gunubirlik/builds/2ad4b044-f95b-4a23-8662-8d9882c8a611
- APK: (build bitince eklenir)

Önceki sürümler (sorunlu, kurmayın):
- v1.0.3: teşhis sürümü (modül listesi ekranı)
- v1.0.2: https://expo.dev/artifacts/eas/e5W2yrPyvpD5kYARij4BmHqjTt_aDXN2L9fWlBXmMNU.apk
- v1.0.1: https://expo.dev/artifacts/eas/73YnaUAyekAr-cVxyWdRSz5LXLRS8FHMvO58nIpg3B4.apk (açılışta çökme)
- v1.0.0: https://expo.dev/artifacts/eas/0TbnaZKsUzSVNNTBJ2TcRz96ZJOb4GLkZllKvreGHTo.apk (beyaz ekran)

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
- **Her ikisi:** başvurular (kabul/ret/tamamla + yıldızla puanlama), moderasyonlu mesajlaşma, bildirimler (ayrı sekme, rozet, dokun→okundu+ilişkili işi aç), sekmeli ayarlar (Hesap/Cüzdan/Güvenlik/Bildirim/Politikalar/Hakkında), QR gösterim (başlat/bitir/ödeme), profil fotoğrafı yükleme, şifre değiştirme, 2FA kurulum (QR + secret + yedek kodlar) / kapatma, e-posta değiştirme
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
