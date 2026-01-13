const jwt = require('jsonwebtoken');

const getAdminCredentials = () => ({
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123',
});

exports.login = async (req, res) => {
  const { username, password } = req.body || {};
  const creds = getAdminCredentials();

  if (!username || !password) {
    return res.status(400).json({ message: 'Kullanıcı adı ve şifre zorunlu' });
  }

  if (username !== creds.username || password !== creds.password) {
    return res.status(401).json({ message: 'Geçersiz admin bilgisi' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: 'JWT_SECRET tanımlı değil' });
  }

  const token = jwt.sign({ username, isAdmin: true }, process.env.JWT_SECRET, {
    expiresIn: '12h',
  });

  return res.json({ token, username });
};
