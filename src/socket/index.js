const { Server } = require('socket.io');
const config = require('../config');
const registerRoomHandlers = require('./handlers/roomHandler');
const registerGameHandlers = require('./handlers/gameHandler');
const registerDisconnectHandler = require('./handlers/disconnectHandler');

/**
 * Inicializa Socket.io sobre el servidor HTTP con políticas de CORS restrictivas
 * y optimizaciones para soportar alta concurrencia.
 *
 * @param {import('http').Server} httpServer
 * @returns {Server}
 */
function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // En desarrollo o si corsOrigin es '*', permitir
        if (config.corsOrigin === '*' || !origin) {
          return callback(null, true);
        }

        // Si se especificó una lista de orígenes permitidos
        if (Array.isArray(config.corsOrigin)) {
          if (config.corsOrigin.includes(origin)) {
            return callback(null, true);
          }
          return callback(new Error(`Origen ${origin} no permitido por políticas CORS.`));
        }

        return callback(null, config.corsOrigin === origin);
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Optimizaciones para más de 150 conexiones concurrentes
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    // Registrar handlers modulares
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerDisconnectHandler(io, socket);
  });

  return io;
}

module.exports = {
  initSocketServer,
};
