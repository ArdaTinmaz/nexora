const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const http = require('http');

const app = require('./app');
const connectDatabase = require('./config/db');

const PORT = process.env.PORT || 5001;

const startServer = async () => {
  try {
    await connectDatabase();

    const server = http.createServer(app);

    server.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Sunucu ${PORT} portunda çalışıyor`);
    });

    const gracefulShutdown = (signal) => {
      // eslint-disable-next-line no-console
      console.log(`${signal} sinyali alındı. Sunucu kapatılıyor...`);
      server.close(() => process.exit(0));
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Sunucu başlatma hatası:', error.message);
    process.exit(1);
  }
};

startServer();
