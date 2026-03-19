const SecurityAuditLog = require('../models/SecurityAuditLog');
const { sanitizePlainText, sanitizePayloadStrings } = require('../security/validation');

const ALERT_RULES = {
  'auth.login_failed': { threshold: 10, windowMs: 10 * 60 * 1000 },
  'auth.admin_login_failed': { threshold: 5, windowMs: 10 * 60 * 1000 },
  'auth.refresh_reuse_detected': { threshold: 1, windowMs: 5 * 60 * 1000 },
};

const sanitizeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object') return null;
  return sanitizePayloadStrings(metadata, { maxLength: 1000 });
};

const maybeEmitAlert = async (eventType) => {
  const rule = ALERT_RULES[eventType];
  if (!rule) return;

  const fromTs = Date.now() - rule.windowMs;
  const count = await SecurityAuditLog.countDocuments({
    eventType,
    createdAt: { $gte: fromTs },
  });

  if (count >= rule.threshold) {
    // eslint-disable-next-line no-console
    console.warn(
      `[SECURITY_ALERT] ${eventType} reached ${count} events in the last ${Math.round(
        rule.windowMs / 1000
      )}s`
    );
  }
};

const logSecurityEvent = async ({
  eventType,
  category = 'security',
  severity = 'medium',
  outcome = 'success',
  actorType = 'user',
  actorId = '',
  actorName = '',
  targetType = '',
  targetId = '',
  resource = '',
  ip = '',
  userAgent = '',
  message = '',
  metadata = null,
} = {}) => {
  if (!eventType) return null;

  try {
    const entry = await SecurityAuditLog.create({
      eventType: sanitizePlainText(eventType, { maxLength: 120 }),
      category: sanitizePlainText(category, { maxLength: 64 }),
      severity: sanitizePlainText(severity, { maxLength: 16 }),
      outcome: sanitizePlainText(outcome, { maxLength: 16 }),
      actorType: sanitizePlainText(actorType, { maxLength: 32 }),
      actorId: sanitizePlainText(actorId, { maxLength: 80 }),
      actorName: sanitizePlainText(actorName, { maxLength: 120 }),
      targetType: sanitizePlainText(targetType, { maxLength: 32 }),
      targetId: sanitizePlainText(targetId, { maxLength: 120 }),
      resource: sanitizePlainText(resource, { maxLength: 180 }),
      ip: sanitizePlainText(ip, { maxLength: 120 }),
      userAgent: sanitizePlainText(userAgent, { maxLength: 512 }),
      message: sanitizePlainText(message, { maxLength: 400 }),
      metadata: sanitizeMetadata(metadata),
      createdAt: Date.now(),
    });

    await maybeEmitAlert(entry.eventType);
    return entry;
  } catch (_error) {
    return null;
  }
};

module.exports = {
  logSecurityEvent,
};
