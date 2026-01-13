const mongoose = require('mongoose');

const connectDatabase = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI tanımlı değil');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(mongoUri);

  // eslint-disable-next-line no-console
  console.log('MongoDB bağlantısı hazır');

  return mongoose.connection;
};

module.exports = connectDatabase;
