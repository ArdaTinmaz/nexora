## Socket.io server

- Ortam değişkenleri `server/.env` içinde; `socketServer.js` otomatik olarak bu dosyayı yüklüyor.
- Sadece Socket.io sunucusunu çalıştırmak için: `npm --prefix server run start:socket`
- Nodemon ile canlı yenileme: `npm --prefix server run dev:socket`
- Alternatif: `cd server && npm run start:socket` (veya `npm run dev:socket`)
