const config = require('../config');

/**
 * Extrae una cookie específica desde el header Cookie del handshake.
 * @param {string} cookieHeader
 * @param {string} name
 * @returns {string|null}
 */
function parseCookie(cookieHeader, name) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Verifica si el socket o el payload cuentan con credenciales válidas de Administrador.
 * @param {Object} socket
 * @param {Object} [data]
 * @returns {boolean}
 */
function isSocketAdminAuthenticated(socket, data = {}) {
  const expectedPass = config.admin.password;
  if (!expectedPass) return true;

  if (socket.data && socket.data.isAdmin === true) return true;
  if (data && (data.adminPassword === expectedPass || data.password === expectedPass || data.token === expectedPass)) {
    socket.data = socket.data || {};
    socket.data.isAdmin = true;
    return true;
  }

  const handshakeAuth = (socket.handshake && socket.handshake.auth) || {};
  if (handshakeAuth.adminPassword === expectedPass || handshakeAuth.token === expectedPass) {
    socket.data = socket.data || {};
    socket.data.isAdmin = true;
    return true;
  }

  const cookieHeader = socket.handshake && socket.handshake.headers && socket.handshake.headers.cookie;
  const cookieToken = parseCookie(cookieHeader, 'admin_session');
  if (cookieToken === expectedPass) {
    socket.data = socket.data || {};
    socket.data.isAdmin = true;
    return true;
  }

  return false;
}

/**
 * Indica si el socket puede controlar una sala: es su anfitrión o un administrador autenticado.
 * @param {Object} socket
 * @param {Object} room
 * @returns {boolean}
 */
function canControlRoom(socket, room) {
  if (!room) return false;
  return room.hostSocketId === socket.id || isSocketAdminAuthenticated(socket);
}

module.exports = {
  parseCookie,
  isSocketAdminAuthenticated,
  canControlRoom,
};
