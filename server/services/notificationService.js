const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const TaskAssignment = require('../models/TaskAssignment');

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const toObjectId = (value) => new mongoose.Types.ObjectId(value);

const toInt = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const mapNotification = (doc) => ({
  id: doc._id.toString(),
  userId: doc.userId.toString(),
  type: doc.type || '',
  category: doc.category || 'general',
  title: doc.title || '',
  message: doc.message || '',
  link: doc.link || '/home/tasks',
  meta: doc.meta || {},
  dedupKey: doc.dedupKey || '',
  isRead: Boolean(doc.isRead),
  readAt: doc.readAt ?? null,
  createdAt: toInt(doc.createdAt, Date.now()),
  updatedAt: toInt(doc.updatedAt, Date.now()),
});

const normalizeRecipientIds = (userIds = []) => {
  const unique = new Set();
  return userIds
    .map((id) => String(id || '').trim())
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .filter((id) => {
      if (unique.has(id)) return false;
      unique.add(id);
      return true;
    });
};

const createNotification = async ({
  userId,
  type,
  category = 'general',
  title,
  message,
  link = '/home/tasks',
  meta = {},
  dedupKey = '',
}) => {
  const normalizedUserId = String(userId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(normalizedUserId)) {
    return null;
  }
  if (!type || !String(type).trim()) {
    return null;
  }

  const normalizedDedupKey = String(dedupKey || '').trim();
  if (normalizedDedupKey) {
    const existing = await Notification.findOne({
      userId: toObjectId(normalizedUserId),
      dedupKey: normalizedDedupKey,
    }).lean();
    if (existing) {
      return mapNotification(existing);
    }
  }

  const now = Date.now();
  const created = await Notification.create({
    userId: toObjectId(normalizedUserId),
    type: String(type).trim(),
    category: category === 'message' ? 'message' : 'general',
    title: String(title || '').trim(),
    message: String(message || '').trim(),
    link: String(link || '/home/tasks').trim() || '/home/tasks',
    meta,
    dedupKey: normalizedDedupKey,
    isRead: false,
    readAt: null,
    createdAt: now,
    updatedAt: now,
  });

  return mapNotification(created);
};

const createNotificationsForUsers = async (userIds = [], payload = {}) => {
  const recipients = normalizeRecipientIds(userIds);
  if (!recipients.length) return [];

  const created = await Promise.all(
    recipients.map((recipientId) =>
      createNotification({
        ...payload,
        userId: recipientId,
      })
    )
  );

  return created.filter(Boolean);
};

const toUtcStartOfDay = (timestamp) => {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

const getDaysUntilDeadline = (deadline) => {
  const deadlineStart = toUtcStartOfDay(deadline);
  if (deadlineStart === null) return null;
  const now = Date.now();
  const todayStart = toUtcStartOfDay(now);
  if (todayStart === null) return null;
  return Math.floor((deadlineStart - todayStart) / DAY_IN_MS);
};

const ensureDeadlineReminderNotificationsForUser = async (userId) => {
  const normalizedUserId = String(userId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(normalizedUserId)) {
    return;
  }

  const assignments = await TaskAssignment.find({
    assignedTo: toObjectId(normalizedUserId),
    deadline: { $ne: null },
    status: { $ne: 'completed' },
  }).lean();

  const creations = [];
  assignments.forEach((assignment) => {
    const daysLeft = getDaysUntilDeadline(assignment.deadline);
    if (daysLeft !== 7 && daysLeft !== 1) return;

    const unitLabel = daysLeft === 7 ? '1 week' : '1 day';
    const type = daysLeft === 7 ? 'task_deadline_week' : 'task_deadline_day';
    const dedupKey = `task-deadline:${assignment._id.toString()}:${daysLeft}`;

    creations.push(
      createNotification({
        userId: normalizedUserId,
        type,
        category: 'general',
        title: 'Task deadline reminder',
        message: `"${assignment.title || 'Untitled task'}" is due in ${unitLabel}.`,
        link: '/home/tasks',
        meta: {
          assignmentId: assignment._id.toString(),
          cardId: assignment.cardId || null,
          projectId: assignment.projectId?.toString() || '',
          teamId: assignment.teamId?.toString() || '',
        },
        dedupKey,
      })
    );
  });

  if (creations.length) {
    await Promise.all(creations);
  }
};

const listNotificationsForUser = async ({ userId, limit = 80 }) => {
  const normalizedUserId = String(userId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(normalizedUserId)) {
    return { notifications: [], unreadCount: 0, messageUnreadCount: 0, chatUnreadCount: 0 };
  }

  await ensureDeadlineReminderNotificationsForUser(normalizedUserId);

  const safeLimit = Math.max(1, Math.min(Number(limit) || 80, 300));
  const [docs, unreadCount, messageUnreadCount, chatUnreadCount] = await Promise.all([
    Notification.find({ userId: toObjectId(normalizedUserId) })
      .sort({ createdAt: -1, _id: -1 })
      .limit(safeLimit)
      .lean(),
    Notification.countDocuments({
      userId: toObjectId(normalizedUserId),
      isRead: false,
    }),
    Notification.countDocuments({
      userId: toObjectId(normalizedUserId),
      isRead: false,
      category: 'message',
    }),
    Notification.countDocuments({
      userId: toObjectId(normalizedUserId),
      isRead: false,
      $or: [
        { category: 'message' },
        { type: 'channel_invite_received' },
      ],
    }),
  ]);

  return {
    notifications: docs.map(mapNotification),
    unreadCount,
    messageUnreadCount,
    chatUnreadCount,
  };
};

const markNotificationAsRead = async ({ userId, notificationId }) => {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(notificationId)) {
    return null;
  }

  const now = Date.now();
  const updated = await Notification.findOneAndUpdate(
    {
      _id: toObjectId(notificationId),
      userId: toObjectId(userId),
    },
    {
      isRead: true,
      readAt: now,
      updatedAt: now,
    },
    { new: true }
  ).lean();

  return updated ? mapNotification(updated) : null;
};

const markAllNotificationsAsRead = async ({ userId, category = '' }) => {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return { modifiedCount: 0 };
  }

  const filter = {
    userId: toObjectId(userId),
    isRead: false,
  };
  if (category === 'message' || category === 'general') {
    filter.category = category;
  }

  const now = Date.now();
  const result = await Notification.updateMany(filter, {
    isRead: true,
    readAt: now,
    updatedAt: now,
  });

  return { modifiedCount: result.modifiedCount || 0 };
};

const removeNotification = async ({ userId, notificationId }) => {
  if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(notificationId)) {
    return false;
  }

  const result = await Notification.deleteOne({
    _id: toObjectId(notificationId),
    userId: toObjectId(userId),
  });

  return result.deletedCount > 0;
};

module.exports = {
  createNotification,
  createNotificationsForUsers,
  listNotificationsForUser,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  removeNotification,
};
