const { gameManager } = require('../../managers/GameManager');
const { canControlRoom } = require('../adminAuth');

/**
 * Registra los eventos de control de juego, envío de respuestas
 * y controles del anfitrión en partida (Pausar, Saltar, Forzar Cierre).
 *
 * @param {Object} io - Instancia del servidor Socket.io
 * @param {Object} socket - Socket del cliente conectado
 */
function registerGameHandlers(io, socket) {
  /**
   * Evento: 'start_game'
   * Solo el host puede iniciar la partida.
   */
  socket.on('start_game', ({ roomId }, callback) => {
    try {
      const room = gameManager.getRoom(roomId);
      if (!room) {
        const error = { success: false, message: 'Sala no encontrada.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('game_error', error);
      }

      if (!canControlRoom(socket, room)) {
        const error = { success: false, message: 'Solo el anfitrión puede iniciar la partida.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('game_error', error);
      }

      if (room.players.size === 0) {
        const error = { success: false, message: 'Debe haber al menos 1 jugador para iniciar.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('game_error', error);
      }

      // Iniciar primera pregunta
      room.currentQuestionIndex = 0;
      gameManager.startQuestion(room.roomId, io);

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    } catch (err) {
      console.error('[gameHandler] Error al iniciar partida:', err);
      const error = { success: false, message: 'Error al iniciar la partida.' };
      if (typeof callback === 'function') {
        callback(error);
      } else {
        socket.emit('game_error', error);
      }
    }
  });

  /**
   * Evento: 'submit_answer'
   * Implementa candado transaccional, función de decaimiento y cálculo de racha (streak).
   */
  socket.on('submit_answer', ({ roomId, answerIndex }, callback) => {
    try {
      if (!roomId || answerIndex === undefined || answerIndex === null) {
        const error = { success: false, message: 'Parámetros de respuesta incompletos.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('answer_rejected', error);
      }

      const result = gameManager.submitAnswer(roomId, socket.id, answerIndex);

      if (!result.success) {
        const errorPayload = { success: false, message: result.error };
        if (typeof callback === 'function') {
          callback(errorPayload);
        } else {
          socket.emit('answer_rejected', errorPayload);
        }
        return;
      }

      const successPayload = {
        success: true,
        pointsAwarded: result.pointsAwarded,
        isCorrect: result.isCorrect,
        streak: result.streak,
      };

      if (typeof callback === 'function') {
        callback(successPayload);
      } else {
        socket.emit('answer_accepted', successPayload);
      }

      // Notificación optimizada a la sala
      const room = gameManager.getRoom(roomId);
      if (room) {
        const answeredCount = Array.from(room.players.values()).filter((p) => p.hasAnswered).length;
        const totalActive = Array.from(room.players.values()).filter((p) => p.isActive).length;

        io.to(room.roomId).emit('answer_stats_update', {
          socketId: socket.id,
          answeredCount,
          totalActive,
        });

        // Si todos los activos ya contestaron, finalizar de inmediato la pregunta
        if (result.allAnswered) {
          gameManager.onAllAnswered(room.roomId, io);
        }
      }
    } catch (err) {
      console.error('[gameHandler] Error procesando respuesta:', err);
      const error = { success: false, message: 'Error interno al procesar la respuesta.' };
      if (typeof callback === 'function') {
        callback(error);
      } else {
        socket.emit('answer_rejected', error);
      }
    }
  });

  /**
   * Evento: 'next_question'
   * El anfitrión solicita avanzar a la siguiente pregunta.
   */
  socket.on('next_question', ({ roomId }, callback) => {
    try {
      const room = gameManager.getRoom(roomId);
      if (!room) {
        const error = { success: false, message: 'Sala no encontrada.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('game_error', error);
      }

      if (!canControlRoom(socket, room)) {
        const error = { success: false, message: 'Solo el anfitrión puede avanzar de pregunta.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('game_error', error);
      }

      const result = gameManager.advanceToNextQuestion(room.roomId, io);

      if (typeof callback === 'function') {
        callback({ success: true, finished: result.finished, questionIndex: result.questionIndex });
      }
    } catch (err) {
      console.error('[gameHandler] Error al avanzar de pregunta:', err);
      const error = { success: false, message: 'Error al avanzar de pregunta.' };
      if (typeof callback === 'function') {
        callback(error);
      } else {
        socket.emit('game_error', error);
      }
    }
  });

  // =========================================================================
  // Controles en partida (Host): Pausar, Reanudar, Saltar y Forzar Cierre
  // =========================================================================

  /**
   * Evento: 'pause_game'
   * El anfitrión pausa la pregunta actual congelando el temporizador.
   */
  socket.on('pause_game', ({ roomId }, callback) => {
    try {
      const room = gameManager.getRoom(roomId);
      if (!room) {
        const error = { success: false, message: 'Sala no encontrada.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('game_error', error);
      }

      if (!canControlRoom(socket, room)) {
        const error = { success: false, message: 'Solo el anfitrión puede pausar la partida.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('game_error', error);
      }

      const result = gameManager.pauseGame(roomId, io);
      if (typeof callback === 'function') callback(result);
    } catch (err) {
      console.error('[gameHandler] Error pausando partida:', err);
      const error = { success: false, message: 'Error al pausar la partida.' };
      if (typeof callback === 'function') callback(error);
    }
  });

  /**
   * Evento: 'resume_game'
   * El anfitrión reanuda la partida con el tiempo remanente.
   */
  socket.on('resume_game', ({ roomId }, callback) => {
    try {
      const room = gameManager.getRoom(roomId);
      if (!room) {
        const error = { success: false, message: 'Sala no encontrada.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('game_error', error);
      }

      if (!canControlRoom(socket, room)) {
        const error = { success: false, message: 'Solo el anfitrión puede reanudar la partida.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('game_error', error);
      }

      const result = gameManager.resumeGame(roomId, io);
      if (typeof callback === 'function') callback(result);
    } catch (err) {
      console.error('[gameHandler] Error reanudando partida:', err);
      const error = { success: false, message: 'Error al reanudar la partida.' };
      if (typeof callback === 'function') callback(error);
    }
  });

  /**
   * Evento: 'skip_question'
   * El anfitrión salta inmediatamente la pregunta actual y muestra resultados.
   */
  socket.on('skip_question', ({ roomId }, callback) => {
    try {
      const room = gameManager.getRoom(roomId);
      if (!room) {
        const error = { success: false, message: 'Sala no encontrada.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('game_error', error);
      }

      if (!canControlRoom(socket, room)) {
        const error = { success: false, message: 'Solo el anfitrión puede saltar preguntas.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('game_error', error);
      }

      const result = gameManager.skipQuestion(roomId, io);
      if (typeof callback === 'function') callback(result);
    } catch (err) {
      console.error('[gameHandler] Error saltando pregunta:', err);
      const error = { success: false, message: 'Error al saltar la pregunta.' };
      if (typeof callback === 'function') callback(error);
    }
  });

  /**
   * Evento: 'force_close_answers'
   * El anfitrión cierra de inmediato la recepción de respuestas sin esperar el temporizador.
   */
  socket.on('force_close_answers', ({ roomId }, callback) => {
    try {
      const room = gameManager.getRoom(roomId);
      if (!room) {
        const error = { success: false, message: 'Sala no encontrada.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('game_error', error);
      }

      if (!canControlRoom(socket, room)) {
        const error = { success: false, message: 'Solo el anfitrión puede forzar el cierre de respuestas.' };
        return typeof callback === 'function' ? callback(error) : socket.emit('game_error', error);
      }

      const result = gameManager.forceCloseAnswers(roomId, io);
      if (typeof callback === 'function') callback(result);
    } catch (err) {
      console.error('[gameHandler] Error forzando cierre de respuestas:', err);
      const error = { success: false, message: 'Error al forzar el cierre de respuestas.' };
      if (typeof callback === 'function') callback(error);
    }
  });
}

module.exports = registerGameHandlers;
