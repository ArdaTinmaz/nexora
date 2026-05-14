# Nexora

Nexora, ekiplerin proje, pano, gorev, kanal mesajlasmasi ve bildirim sureclerini tek masaustu uygulamasinda yonetmesi icin gelistirilmis bir is takip platformudur. Urun; React tabanli kullanici arayuzu, Node.js/Express API, Socket.io gercek zamanli servisleri ve Electron masaustu kabugu ile calisir.

## Urun Ozeti

Nexora'nin ana amaci, ekip calismasini daginik araclar yerine tek bir operasyon ekraninda toplamaktir.

- Proje ve pano yonetimi: Ekipler projeleri, panolari, kolonlari ve kartlari olusturup takip eder.
- Gorev atama: Kartlar kullanicilara atanir, durum degisiklikleri gercek zamanli izlenir.
- Kanal mesajlasmasi: Takim veya proje odakli kanallar uzerinden iletisim kurulur.
- Bildirimler: Gorev atamalari ve onemli olaylar kullaniciya anlik olarak iletilir.
- Admin konsolu: Kullanici, guvenlik, destek ve yonetim islemleri ayrilmis admin ekranindan yapilir.
- Masaustu deneyimi: Electron ile paketlenebilir, deep link ve yerel oturum yonetimi desteklenir.

## Urun Akisi

```mermaid
flowchart TD
  A[Kullanici Nexora'yi acar] --> B{Oturum var mi?}
  B -- Hayir --> C[Welcome / Giris / Kayit]
  C --> D[Kimlik dogrulama]
  D --> E[Home]
  B -- Evet --> E

  E --> F[Projeler ve Panolar]
  E --> G[Gorevler]
  E --> H[Kanallar ve Sohbet]
  E --> I[Bildirimler]
  E --> J[Destek]

  F --> K[Board, kolon ve kart yonetimi]
  G --> L[Gorev atama ve durum takibi]
  H --> M[Gercek zamanli mesajlar]
  I --> N[Kullanici bazli anlik bildirim]
  J --> O[Yardim talebi / destek e-postasi]

  P[Admin] --> Q[Admin Login]
  Q --> R[Admin Console]
  R --> S[Kullanici, guvenlik ve operasyon yonetimi]

  classDef entry fill:#e0f2fe,stroke:#0284c7,color:#0f172a
  classDef auth fill:#fef3c7,stroke:#d97706,color:#111827
  classDef product fill:#dcfce7,stroke:#16a34a,color:#052e16
  classDef realtime fill:#ede9fe,stroke:#7c3aed,color:#1e1b4b
  classDef admin fill:#fee2e2,stroke:#dc2626,color:#450a0a

  class A,B,C,D entry
  class E,F,G,J,K,L,O product
  class H,I,M,N realtime
  class P,Q,R,S admin
```

## Sistem Topolojisi

```mermaid
flowchart LR
  subgraph Desktop["Electron Desktop App"]
    Shell[Electron Main Process]
    Preload[Preload Bridge]
    UI[React Client]
    Session[Local Session Store]
  end

  subgraph Backend["Node.js Backend"]
    API[Express REST API<br/>Port 5001]
    Socket[Socket.io Server<br/>Port 5002]
    Security[Security Middleware<br/>Validation, Rate Limit, Cookies]
    Uploads[Uploads Storage]
  end

  subgraph Data["Data & External Services"]
    Mongo[(MongoDB)]
    Brevo[Brevo Email API]
  end

  User[Kullanici] --> Shell
  Shell --> UI
  Shell --> Session
  Shell -->|managed backend| API
  Shell -->|managed backend| Socket
  Preload <--> UI
  UI -->|HTTP /api| API
  UI <-->|WebSocket events| Socket
  API --> Security
  Socket --> Security
  API --> Mongo
  Socket --> Mongo
  API --> Uploads
  API --> Brevo
  Socket -->|room/user/team events| UI

  classDef desktop fill:#dbeafe,stroke:#2563eb,color:#0f172a
  classDef backend fill:#dcfce7,stroke:#16a34a,color:#052e16
  classDef data fill:#fae8ff,stroke:#a21caf,color:#3b0764
  classDef actor fill:#fef9c3,stroke:#ca8a04,color:#422006

  class Shell,Preload,UI,Session desktop
  class API,Socket,Security,Uploads backend
  class Mongo,Brevo data
  class User actor
```

## Modul Haritasi

| Katman | Klasor | Sorumluluk |
| --- | --- | --- |
| Masaustu kabugu | `electron/` | Pencere yonetimi, deep link, IPC, backend servislerini baslatma, yerel oturum ve Socket baglantisi |
| Web istemci | `client/src/` | React sayfalari, formlar, panolar, gorevler, kanallar, bildirimler ve desktop bridge entegrasyonu |
| API sunucusu | `server/app.js`, `server/routes/`, `server/controllers/` | REST endpointleri, request dogrulama, CORS, upload servisleri ve hata yonetimi |
| Gercek zamanli servis | `server/realtime/` | Socket.io kimlik dogrulama, oda yetkilendirme, mesaj, kanal ve gorev olaylari |
| Is kurallari | `server/services/` | Proje, kanal, bildirim, audit log ve guvenlik servisleri |
| Veri modeli | `server/models/` | MongoDB/Mongoose modelleri |
| Guvenlik | `server/security/`, `server/middleware/` | Cookie ayarlari, payload validasyonu, rate limit, admin/user auth middleware |

## Temel Ozellikler

### Kullanici deneyimi

- Welcome, giris, kayit ve sifre sifirlama akislari
- Home altinda dashboard, proje, pano, gorev ve ekran sayfalari
- Son ziyaret edilen alanlar ve desktop route handler destegi
- Profil, kullanici bilgisi, filtre, kart detay ve onay modallari

### Ekip ve is yonetimi

- Proje, takim ve pano olusturma
- Kolon ve kart bazli is takibi
- Kart detaylari, kart tasima, kart/gorev duzenleme
- Kullaniciya gorev atama ve gorev durumunu guncelleme

### Gercek zamanli iletisim

- Socket.io ile oda bazli mesajlasma
- Kanal olusturma, davet, katilma ve kanal mesajlari
- Kullanici ve takim bazli anlik gorev olaylari
- Bildirim kaydi ve kullaniciya anlik iletim

### Admin ve guvenlik

- Ayrilmis admin girisi ve admin konsolu
- Login, refresh ve destek endpointleri icin rate limit
- Socket event rate limit ve payload sema dogrulamasi
- Security audit log ve admin action audit altyapisi
- JWT, refresh token ve cookie tabanli oturum destegi

## Teknoloji Stack'i

- React 18 ve React Router
- Electron 29
- Node.js, Express 5
- Socket.io 4
- MongoDB ve Mongoose
- React Hook Form ve Yup
- Electron Builder
- Brevo e-posta entegrasyonu

## Kurulum

Kok dizinde bagimliliklari yukleyin:

```bash
npm install
npm --prefix client install
npm --prefix server install
```

`server/.env` dosyasinda en az su degerler tanimli olmalidir:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/nexora
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me-refresh
CLIENT_URL=http://localhost:3000,http://127.0.0.1:3000
PORT=5001
SOCKET_PORT=5002
```

E-posta, admin ve paketli masaustu davranislari icin kullanilabilecek ek degiskenler:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me
ADMIN_EMAIL=admin@example.com
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=Nexora
DATA_ENCRYPTION_KEY=
DESKTOP_PROTOCOL_URL=nexora://
```

## Gelistirme

React istemci ve Electron uygulamasini birlikte baslatmak:

```bash
npm run dev
```

Sadece API sunucusunu calistirmak:

```bash
npm run start:server
```

Sadece Socket.io sunucusunu calistirmak:

```bash
npm --prefix server run dev:socket
```

Sadece React istemciyi calistirmak:

```bash
npm run start:client
```

Varsayilan yerel adresler:

| Servis | Adres |
| --- | --- |
| React client | `http://localhost:3000` |
| REST API | `http://127.0.0.1:5001/api` |
| Socket.io | `http://127.0.0.1:5002` |

## Paketleme

Client build ve server kaynaklarini hazirlayarak Electron paketi almak:

```bash
npm run pack
```

Platform bazli dagitim:

```bash
npm run dist:mac
npm run dist:win
npm run dist:all
```

Paketli uygulamada Electron, `server/server.js` ve `server/realtime/socketServer.js` servislerini managed backend olarak baslatir. Upload dosyalari paketli ortamda kullanici veri dizinine yonlendirilir.

## API Yuzeyi

| Endpoint grubu | Amac |
| --- | --- |
| `/api/auth` | Kullanici girisi, kayit, refresh token, sifre sifirlama ve dogrulama |
| `/api/admin` | Admin girisi, admin profili ve yonetim islemleri |
| `/api/users` | Kullanici bilgileri ve profil islemleri |
| `/api/projects` | Proje yonetimi |
| `/api/teams` | Takim yonetimi |
| `/api/boards` | Pano, kolon ve kart operasyonlari |
| `/api/tasks` | Gorev atama ve durum takibi |
| `/api/channels` | Kanal, davet ve kanal uyeligi islemleri |
| `/api/notifications` | Bildirim listesi ve durumlari |
| `/api/support` | Yardim ve destek talepleri |

## Socket Olaylari

| Olay | Amac |
| --- | --- |
| `joinRoom`, `leaveRoom` | Yetkili oda katilimi ve odadan ayrilma |
| `sendMessage`, `receiveMessage` | Oda bazli mesajlasma |
| `assignTask`, `taskAssigned` | Gorev atama ve anlik gorev bildirimi |
| `updateTaskStatus`, `taskStatusUpdated` | Gorev durumunu guncelleme |
| `listChannels`, `createChannel` | Kanal listeleme ve kanal olusturma |
| `inviteToChannel`, `acceptChannelInvite` | Kanal davet akisi |
| `joinChannel`, `leaveChannel` | Kanal odasi uyeligi |
| `sendChannelMessage`, `updateChannelMessage`, `deleteChannelMessage` | Kanal mesaj yasam dongusu |

## Proje Yapisi

```text
.
|-- client/              React istemci uygulamasi
|-- electron/            Electron main, preload ve desktop servisleri
|-- server/              Express API, Socket.io, modeller ve servisler
|-- installer/           Mac/Windows kurulum metinleri
|-- scripts/             Dagitim yardimci scriptleri
|-- package.json         Kok Electron ve dagitim komutlari
```

## Notlar

- README icindeki diyagramlar Mermaid destekleyen GitHub, GitLab ve modern Markdown araclarinda renkli gorunur.
- `server/.env` dosyasi hem REST API hem de Socket.io sunucusu tarafindan yuklenir.
- Masaustu uygulamada deep link semasi `nexora://` olarak tanimlidir.
- Socket servisleri kimlik dogrulamasi, oda yetkilendirmesi ve event bazli rate limit uygular.
