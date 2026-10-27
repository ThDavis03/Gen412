const config = require('../../config');
const { gameManager } = require('../../managers/GameManager');
const { AVATARS } = require('../../config/themes');

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
 * Registra los eventos relacionados con la creación y unión a salas,
 * incluyendo validación de administrador para 'create_game' (hostear)
 * y selección/asignación de avatares.
 *
 * @param {Object} io - Servidor Socket.io
 * @param {Object} socket - Socket individual del cliente
 */
function registerRoomHandlers(io, socket) {
  /**
   * Evento protegido: 'create_game'
   * Solo el administrador autenticado puede emitir 'create_game' (hostear).
   */
  socket.on('create_game', (data, callback) => {
    try {
      const payload = data || {};

      if (!isSocketAdminAuthenticated(socket, payload)) {
        const unauthorizedError = {
          success: false,
          code: 'UNAUTHORIZED_ADMIN',
          message: 'No autorizado: Solo el administrador puede crear y hostear una partida.',
        };
        if (typeof callback === 'function') {
          return callback(unauthorizedError);
        }
        return socket.emit('error_message', unauthorizedError);
      }

      // Actualizar configuraciones globales si se enviaron en el payload
      gameManager.updateAdminSettings(payload);

      const room = gameManager.createRoom(socket.id, payload);
      socket.join(room.roomId);

      const durationSeconds = Math.round(room.questionDurationMs / 1000);
      const response = {
        success: true,
        roomId: room.roomId,
        status: room.status,
        gameMode: room.gameMode,
        totalQuestions: room.questions.length,
        questionsPerTheme: room.questionsPerTheme,
        durationMs: room.questionDurationMs,
        durationSeconds,
        config: {
          durationSeconds,
          questionsPerTheme: room.questionsPerTheme,
          gameMode: room.gameMode,
          totalQuestions: room.questions.length,
        },
      };

      if (typeof callback === 'function') {
        callback(response);
      } else {
        socket.emit('room_created', response);
      }
    } catch (err) {
      console.error('[roomHandler] Error en create_game:', err);
      const errorResponse = { success: false, message: 'Error interno al iniciar el host de la partida.' };
      if (typeof callback === 'function') {
        callback(errorResponse);
      } else {
        socket.emit('error_message', errorResponse);
      }
    }
  });

  /**
   * Evento: 'create_room'
   * Compatible con la suite de pruebas de carga y creación de sala con opciones de host.
   */
  socket.on('create_room', (data, callback) => {
    try {
      const payload = data || {};
      if (payload.requireAdmin && !isSocketAdminAuthenticated(socket, payload)) {
        const unauthorizedError = {
          success: false,
          code: 'UNAUTHORIZED_ADMIN',
          message: 'No autorizado: Solo el administrador puede hostear una partida.',
        };
        return typeof callback === 'function'
          ? callback(unauthorizedError)
          : socket.emit('error_message', unauthorizedError);
      }

      const room = gameManager.createRoom(socket.id, payload);
      socket.join(room.roomId);

      const durationSeconds = Math.round(room.questionDurationMs / 1000);
      const response = {
        success: true,
        roomId: room.roomId,
        status: room.status,
        gameMode: room.gameMode,
        totalQuestions: room.questions.length,
        questionsPerTheme: room.questionsPerTheme,
        durationMs: room.questionDurationMs,
        durationSeconds,
        config: {
          durationSeconds,
          questionsPerTheme: room.questionsPerTheme,
          gameMode: room.gameMode,
          totalQuestions: room.questions.length,
        },
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

  /**
   * Evento: 'update_avatar'
   * Recibe un nuevo seed de DiceBear (ej. 'avatar1'...'avatar20' o un objeto { seed })
   * y actualiza el avatar del jugador en tiempo real en la pantalla del Host.
   */
  socket.on('update_avatar', (payloadOrSeed, callback) => {
    try {
      let newSeed = null;
      let explicitRoomId = null;

      if (typeof payloadOrSeed === 'string' || typeof payloadOrSeed === 'number') {
        newSeed = String(payloadOrSeed).trim();
      } else if (payloadOrSeed && typeof payloadOrSeed === 'object') {
        newSeed = String(payloadOrSeed.seed || payloadOrSeed.avatarId || payloadOrSeed.newSeed || '').trim();
        explicitRoomId = payloadOrSeed.roomId || null;
      }

      if (!newSeed) {
        const err = { success: false, message: 'El seed del avatar es requerido.' };
        return typeof callback === 'function' ? callback(err) : socket.emit('avatar_update_error', err);
      }

      const result = gameManager.updatePlayerAvatar(socket.id, newSeed, explicitRoomId);
      if (!result.success) {
        const err = { success: false, message: result.error };
        return typeof callback === 'function' ? callback(err) : socket.emit('avatar_update_error', err);
      }

      const updatePayload = {
        success: true,
        roomId: result.roomId,
        socketId: socket.id,
        avatarId: result.player.avatarId,
        avatarMeta: result.player.avatarMeta,
        player: {
          socketId: result.player.socketId,
          name: result.player.name,
          avatarId: result.player.avatarId,
          avatarMeta: result.player.avatarMeta,
          score: result.player.score,
          streak: result.player.streak,
        },
        players: result.players,
      };

      if (typeof callback === 'function') {
        callback(updatePayload);
      }

      // Notificar en tiempo real al Host y demás clientes de la sala
      io.to(result.roomId).emit('avatar_updated', updatePayload);
    } catch (err) {
      console.error('[roomHandler] Error en update_avatar:', err);
      const error = { success: false, message: 'Error al actualizar el avatar.' };
      if (typeof callback === 'function') {
        callback(error);
      }
    }
  });
}

module.exports = registerRoomHandlers;

