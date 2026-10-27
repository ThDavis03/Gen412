const { gameManager } = require('../../managers/GameManager');

/**
 * Registra el manejador de ciclo de vida ante desconexiones de sockets.
 *
 * @param {Object} io - Instancia del servidor Socket.io
 * @param {Object} socket - Socket del cliente conectado
 */
function registerDisconnectHandler(io, socket) {
  socket.on('disconnect', (reason) => {
    // Delega el ciclo de vida al GameManager de manera segura
    gameManager.handleDisconnect(socket.id, io);
  });
}

module.exports = registerDisconnectHandler;
