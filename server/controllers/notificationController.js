const {
  listNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  removeNotification,
} = require('../services/notificationService');

exports.getNotifications = async (req, res, next) => {
  try {
    const limit = Number(req.query.limit) || 80;
    const result = await listNotificationsForUser({
      userId: req.user.id,
      limit,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const updated = await markNotificationAsRead({
      userId: req.user.id,
      notificationId: req.params.notificationId,
    });

    if (!updated) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    const { category = '' } = req.body || {};
    const result = await markAllNotificationsAsRead({
      userId: req.user.id,
      category,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const deleted = await removeNotification({
      userId: req.user.id,
      notificationId: req.params.notificationId,
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
