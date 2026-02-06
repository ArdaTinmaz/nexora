const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const boardRoutes = require('./routes/boardRoutes');
const userRoutes = require('./routes/userRoutes');
const supportRoutes = require('./routes/supportRoutes');
const channelRoutes = require('./routes/channelRoutes');
const teamRoutes = require('./routes/teamRoutes');
const projectRoutes = require('./routes/projectRoutes');
const adminRoutes = require('./routes/adminRoutes');
const taskRoutes = require('./routes/taskRoutes');
const path = require('path');

const app = express();

const parseAllowedOrigins = () => {
  if (!process.env.CLIENT_URL) {
    return [];
  }

  return process.env.CLIENT_URL.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const buildCorsConfig = () => {
  const allowedOrigins = parseAllowedOrigins();

  if (!allowedOrigins.length) {
    return {};
  }

  return {
    origin: allowedOrigins,
    credentials: true,
  };
};

app.use(cors(buildCorsConfig()));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tasks', taskRoutes);

app.use((req, res, next) => {
  const error = new Error('Kaynak bulunamadı');
  error.statusCode = 404;
  next(error);
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const response = {
    message: err.message || 'Sunucuda beklenmeyen bir hata oluştu',
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
});

module.exports = app;
