const { logSecurityEvent } = require('../services/auditLogService');
const {
  extractClientIpFromRequest,
  getUserAgentFromRequest,
} = require('../security/requestMeta');

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

const adminActionAuditMiddleware = (req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) {
    return next();
  }

  const startedAt = Date.now();
  const ip = extractClientIpFromRequest(req);
  const userAgent = getUserAgentFromRequest(req);
  const actorName = req.admin?.username || 'admin';

  res.on('finish', () => {
    const success = res.statusCode < 400;
    logSecurityEvent({
      eventType: 'admin.action',
      category: 'admin',
      severity: success ? 'medium' : 'high',
      outcome: success ? 'success' : 'failure',
      actorType: 'admin',
      actorId: actorName,
      actorName,
      resource: `${req.method} ${req.originalUrl}`,
      ip,
      userAgent,
      message: success ? 'Admin action completed' : 'Admin action failed',
      metadata: {
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      },
    }).catch(() => {});
  });

  return next();
};

module.exports = adminActionAuditMiddleware;
