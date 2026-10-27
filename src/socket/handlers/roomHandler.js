const { gameManager } = require('../../managers/GameManager');
const { AVATARS } = require('../../config/themes');

/**
 * Registra los eventos relacionados con la creación y unión a salas,
 * incluyendo pre-configuración del host y selección/asignación de avatares.
 *
 * @param {Object} io - Servidor Socket.io
 * @param {Object} socket - Socket individual del cliente
 */
function registerRoomHandlers(io, socket) {
  /**
   * Evento: 'create_room'
   * El host configura tiempo por pregunta y preguntas por bloque temático.
   */
  socket.on('create_room', (data, callback) => {
    try {
      const room = gameManager.createRoom(socket.id, data);
      socket.join(room.roomId);

      const response = {
        success: true,
        roomId: room.roomId,
        status: room.status,
        totalQuestions: room.questions.length,
        questionsPerTheme: room.questionsPerTheme,
        durationMs: room.questionDurationMs,
        durationSeconds: Math.round(room.questionDurationMs / 1000),
      };

      if (typeof callback === 'function') {
        callback(response);
      } else {
        socket.emit('room_created', response);
      }
    } catch (err) {
      console.error('[roomHandler] Error creando sala:', err);
      const errorResponse = { success: false, message: 'Error interno al crear la sala.' };
      if (typeof callback === 'function') {
        callback(errorResponse);
      } else {
        socket.emit('error_message', errorResponse);
      }
    }
  });

  /**
   * Evento: 'get_avatars'
   * Permite al cliente obtener la lista de avatares disponibles.
   */
  socket.on('get_avatars', (callback) => {
    if (typeof callback === 'function') {
      callback({ success: true, avatars: AVATARS });
    } else {
      socket.emit('avatars_list', { avatars: AVATARS });
    }
  });

  /**
   * Evento: 'join_room'
   * Valida roomId, unicidad de nombre y asigna un avatar al jugador.
   */
  socket.on('join_room', ({ roomId, name, avatarId }, callback) => {
    try {
      if (!roomId || typeof roomId !== 'string') {
        const error = { success: false, code: 'INVALID_ROOM_ID', message: 'El código de sala es requerido.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('join_error', error);
      }

      const formattedRoomId = roomId.trim().toUpperCase();
      const room = gameManager.getRoom(formattedRoomId);

      // 1. Validar que el roomId exista
      if (!room) {
        const error = {
          success: false,
          code: 'ROOM_NOT_FOUND',
          message: `La sala con código "${formattedRoomId}" no existe.`,
        };
        return typeof callback === 'function' ? callback(error) : socket.emit('join_error', error);
      }

      // 2. Validar que la sala esté en LOBBY
      if (room.status !== 'LOBBY') {
        const error = {
          success: false,
          code: 'GAME_ALREADY_STARTED',
          message: 'No es posible unirse a una partida que ya ha comenzado.',
        };
        return typeof callback === 'function' ? callback(error) : socket.emit('join_error', error);
      }

      // 3. Validar nombre no vacío
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        const error = {
          success: false,
          code: 'INVALID_NAME',
          message: 'Debe ingresar un nombre de usuario válido.',
        };
        return typeof callback === 'function' ? callback(error) : socket.emit('join_error', error);
      }

      const trimmedName = name.trim();

      // 4. Validar que el nombre no esté duplicado en esa sala
      if (gameManager.isNameTaken(formattedRoomId, trimmedName)) {
        const error = {
          success: false,
          code: 'DUPLICATE_NAME',
          message: `El nombre "${trimmedName}" ya está en uso en esta sala. Elige otro.`,
        };
        return typeof callback === 'function' ? callback(error) : socket.emit('join_error', error);
      }

      // Agregar jugador con asignación de avatar y racha inicial
      const result = gameManager.addPlayer(formattedRoomId, socket.id, trimmedName, avatarId);
      if (!result.success) {
        const error = { success: false, code: 'ADD_PLAYER_FAILED', message: result.error };
        return typeof callback === 'function' ? callback(error) : socket.emit('join_error', error);
      }

      // Unir socket a la sala de Socket.io
      socket.join(formattedRoomId);

      const successPayload = {
        success: true,
        roomId: formattedRoomId,
        player: {
          socketId: socket.id,
          name: result.player.name,
          avatarId: result.player.avatarId,
          avatarMeta: result.player.avatarMeta,
          score: result.player.score,
          streak: result.player.streak,
        },
      };

      if (typeof callback === 'function') {
        callback(successPayload);
      } else {
        socket.emit('join_success', successPayload);
      }

      // Emisión optimizada a los miembros de la sala
      io.to(formattedRoomId).emit('player_joined', {
        player: {
          socketId: socket.id,
          name: result.player.name,
          avatarId: result.player.avatarId,
          avatarMeta: result.player.avatarMeta,
          score: result.player.score,
          streak: result.player.streak,
        },
        totalPlayers: room.players.size,
        players: gameManager.getSanitizedPlayers(room),
      });
    } catch (err) {
      console.error('[roomHandler] Error uniendo a sala:', err);
      const error = { success: false, code: 'SERVER_ERROR', message: 'Error procesando la solicitud de unión.' };
      if (typeof callback === 'function') {
        callback(error);
      } else {
        socket.emit('join_error', error);
      }
    }
  });
}

module.exports = registerRoomHandlers;
