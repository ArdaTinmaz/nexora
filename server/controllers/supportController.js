const sendHelpEmails = require('../utils/sendHelpEmails');

exports.sendHelpRequest = async (req, res, next) => {
  try {
    const { email, comment } = req.body || {};

    if (!email || !comment) {
      return res.status(400).json({ message: 'Email and message are required' });
    }

    await sendHelpEmails({ fromEmail: email.trim(), message: comment.trim() });

    res.json({ message: 'Request received. We have emailed you a confirmation.' });
  } catch (error) {
    next(error);
  }
};
