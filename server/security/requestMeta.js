const trimString = (value) => String(value || '').trim();

const pickForwardedIp = (forwardedForValue) => {
  const first = trimString(forwardedForValue).split(',')[0] || '';
  return first.replace(/^::ffff:/, '');
};

const extractClientIpFromRequest = (req) => {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (forwarded) return pickForwardedIp(forwarded);

  const realIp = req?.headers?.['x-real-ip'];
  if (realIp) return pickForwardedIp(realIp);

  return (
    trimString(req?.ip) ||
    trimString(req?.socket?.remoteAddress).replace(/^::ffff:/, '') ||
    trimString(req?.connection?.remoteAddress).replace(/^::ffff:/, '') ||
    ''
  );
};

const extractClientIpFromSocket = (socket) => {
  const forwarded = socket?.handshake?.headers?.['x-forwarded-for'];
  if (forwarded) return pickForwardedIp(forwarded);

  const realIp = socket?.handshake?.headers?.['x-real-ip'];
  if (realIp) return pickForwardedIp(realIp);

  return (
    trimString(socket?.handshake?.address).replace(/^::ffff:/, '') ||
    trimString(socket?.request?.socket?.remoteAddress).replace(/^::ffff:/, '') ||
    ''
  );
};

const getUserAgentFromRequest = (req) => trimString(req?.headers?.['user-agent']).slice(0, 512);

const getUserAgentFromSocket = (socket) =>
  trimString(socket?.handshake?.headers?.['user-agent']).slice(0, 512);

module.exports = {
  extractClientIpFromRequest,
  extractClientIpFromSocket,
  getUserAgentFromRequest,
  getUserAgentFromSocket,
};
