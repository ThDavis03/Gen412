const config = require('../config');
const { calculateDecayScore } = require('../utils/scoring');
const { globalLockManager } = require('../utils/lock');
const {
  ROUND_THEMES,
  THEMES,
  AVATARS,
  buildThematicRounds,
  generateThematicGameSequence,
  resolveAvatar,
} = require('../config/themes');

/**
 * Clase centralizada GameManager encargada de aislar y administrar el estado
 * en memoria de múltiples salas simultáneas, 4 rondas temáticas continuas,
 * avatares y controles del anfitrión en tiempo real.
 */
class GameManager {
  constructor() {
    /**
     * Mapa centralizado de salas: roomId -> Room
     * @type {Map<string, Object>}
     */
    this.rooms = new Map();

    /**
     * Mapeo rápido de socketId -> { roomId, isHost } para búsquedas O(1)
     * @type {Map<string, { roomId: string, isHost: boolean }>}
     */
    this.socketToRoom = new Map();
  }

  /**
   * Genera un identificador alfanumérico único para la sala (ej. 6 caracteres).
   * @returns {string}
   */
  generateRoomId() {
    let roomId;
    do {
      roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (this.rooms.has(roomId));
    return roomId;
  }

  /**
   * Crea una nueva sala de trivia dividida en 4 rondas temáticas continuas.
   * Por defecto cada ronda carga las 5 preguntas de su respectivo tema
   * ("Profesión", "Noviazgo", "Ministerio", "Emociones").
   *
   * @param {string} hostSocketId - ID del socket del anfitrión.
   * @param {Object|Array} [optionsOrQuestions] - Opciones de configuración o preguntas custom.
   * @returns {Object} La sala creada.
   */
  createRoom(hostSocketId, optionsOrQuestions = {}) {
    const roomId = this.generateRoomId();

    // Soporte retrocompatible si se pasa un array de preguntas directas
    let questions;
    let rounds = [];
    let durationMs = config.game.defaultDurationMs;
    let questionsPerTheme = 5;

    if (Array.isArray(optionsOrQuestions)) {
      questions = optionsOrQuestions;
      rounds = [
        {
          roundIndex: 0,
          roundNumber: 1,
          totalRounds: 1,
          theme: 'General',
          themeId: 'profesion',
          themeName: 'General',
          themeData: THEMES.profesion,
          questions,
        },
      ];
    } else {
      const opts = optionsOrQuestions || {};
      if (opts.durationSeconds) {
        durationMs = parseInt(opts.durationSeconds, 10) * 1000;
      } else if (opts.durationMs) {
        durationMs = parseInt(opts.durationMs, 10);
      }

      if (opts.questionsPerTheme) {
        questionsPerTheme = Math.max(1, parseInt(opts.questionsPerTheme, 10));
      }

      if (Array.isArray(opts.questions) && opts.questions.length > 0) {
        questions = opts.questions;
        rounds = [
          {
            roundIndex: 0,
            roundNumber: 1,
            totalRounds: 1,
            theme: 'General',
            themeId: 'profesion',
            themeName: 'General',
            themeData: THEMES.profesion,
            questions,
          },
        ];
      } else {
        // Construir las 4 rondas temáticas continuas ("Profesión", "Noviazgo", "Ministerio", "Emociones")
        rounds = buildThematicRounds(questionsPerTheme);
        questions = rounds.reduce((acc, round) => acc.concat(round.questions), []);
      }
    }

    // Estructura estricta de la Sala con soporte de 4 rondas continuas
    const room = {
      roomId,
      hostSocketId,
      status: config.roomStatus.LOBBY,
      rounds,
      totalRounds: rounds.length,
      currentRoundIndex: -1,
      currentRound: null,
      currentRoundQuestions: [],
      currentQuestionInRoundIndex: -1,
      questions,
      questionsPerTheme,
      currentQuestionIndex: -1,
      currentThemeId: null,
      timer: null,
      tickInterval: null,
      questionStartTime: null,
      questionDurationMs: durationMs,
      isPaused: false,
      pausedRemainingMs: null,
      optionCounts: [0, 0, 0, 0],
      players: new Map(), // socketId -> Player
    };

    this.rooms.set(roomId, room);
    this.socketToRoom.set(hostSocketId, { roomId, isHost: true });

    return room;
  }

  /**
   * Obtiene una sala por su roomId.
   * @param {string} roomId
   * @returns {Object|undefined}
   */
  getRoom(roomId) {
    if (!roomId) return undefined;
    return this.rooms.get(roomId.toUpperCase());
  }

  /**
   * Obtiene la información de la sala y rol asociados a un socketId.
   * @param {string} socketId
   * @returns {{ roomId: string, isHost: boolean }|undefined}
   */
  getSocketInfo(socketId) {
    return this.socketToRoom.get(socketId);
  }

  /**
   * Comprueba si un nombre de usuario ya está registrado en una sala específica (case-insensitive).
   * @param {string} roomId
   * @param {string} name
   * @returns {boolean}
   */
  isNameTaken(roomId, name) {
    const room = this.getRoom(roomId);
    if (!room) return false;

    const normalizedName = name.trim().toLowerCase();
    for (const player of room.players.values()) {
      if (player.name.trim().toLowerCase() === normalizedName) {
        return true;
      }
    }
    return false;
  }

  /**
   * Agrega un nuevo jugador a una sala con asignación de Avatar y racha.
   *
   * @param {string} roomId
   * @param {string} socketId
   * @param {string} name
   * @param {string|number} [avatarId]
   * @returns {{ success: boolean, error?: string, player?: Object, room?: Object }}
   */
  addPlayer(roomId, socketId, name, avatarId = null) {
    const room = this.getRoom(roomId);

    if (!room) {
      return { success: false, error: 'La sala especificada no existe.' };
    }

    if (room.status !== config.roomStatus.LOBBY) {
      return { success: false, error: 'No es posible unirse: la partida ya está en curso o finalizada.' };
    }

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName || trimmedName.length < 2 || trimmedName.length > 25) {
      return { success: false, error: 'El nombre debe tener entre 2 y 25 caracteres.' };
    }

    if (this.isNameTaken(roomId, trimmedName)) {
      return { success: false, error: `El nombre "${trimmedName}" ya está en uso en esta sala.` };
    }

    // Resolver avatar (elegido por cliente o aleatorio del catálogo)
    const avatar = resolveAvatar(avatarId);

    // Estructura de datos estricta del Jugador: { socketId, name, avatarId, score, streak }
    const player = {
      socketId,
      name: trimmedName,
      avatarId: avatar.id,
      avatarMeta: avatar, // icon, color, name
      score: 0,
      streak: 0,
      hasAnswered: false,
      lastAnswerTime: null,
      isActive: true,
    };

    room.players.set(socketId, player);
    this.socketToRoom.set(socketId, { roomId: room.roomId, isHost: false });

    return { success: true, player, room };
  }

  /**
   * Procesa la respuesta de un jugador de manera transaccional.
   *
   * @param {string} roomId
   * @param {string} socketId
   * @param {number} answerIndex
   * @returns {{ success: boolean, error?: string, pointsAwarded?: number, isCorrect?: boolean, streak?: number, allAnswered?: boolean }}
   */
  submitAnswer(roomId, socketId, answerIndex) {
    const room = this.getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Sala no encontrada.' };
    }

    if (room.status !== config.roomStatus.IN_PROGRESS) {
      return { success: false, error: 'La pregunta actual no está activa para recibir respuestas.' };
    }

    if (room.isPaused) {
      return { success: false, error: 'La partida se encuentra pausada por el anfitrión.' };
    }

    const player = room.players.get(socketId);
    if (!player) {
      return { success: false, error: 'Jugador no registrado en esta sala.' };
    }

    if (!player.isActive) {
      return { success: false, error: 'El jugador se encuentra inactivo.' };
    }

    // Candado de transacción para evitar "race conditions"
    const lockKey = `${room.roomId}:${socketId}:${room.currentQuestionIndex}`;
    const acquired = globalLockManager.acquire(lockKey);
    if (!acquired) {
      return { success: false, error: 'Transacción en proceso o respuesta duplicada bloqueada.' };
    }

    try {
      if (player.hasAnswered) {
        return { success: false, error: 'Ya has respondido a esta pregunta.' };
      }

      const serverNow = Date.now();
      const currentQuestion = room.questions[room.currentQuestionIndex];
      if (!currentQuestion) {
        return { success: false, error: 'No hay una pregunta activa.' };
      }

      // Cálculo de tiempo restante en el SERVIDOR
      const elapsedMs = serverNow - room.questionStartTime;
      const remainingMs = Math.max(0, room.questionDurationMs - elapsedMs);

      if (remainingMs <= 0) {
        player.hasAnswered = true;
        player.lastAnswerTime = serverNow;
        player.streak = 0; // Se corta la racha por tiempo expirado
        return {
          success: true,
          pointsAwarded: 0,
          isCorrect: false,
          streak: player.streak,
          error: 'El tiempo se ha agotado.',
          allAnswered: this.checkIfAllActiveAnswered(room),
        };
      }

      const isCorrect = Number(answerIndex) === Number(currentQuestion.correctAnswer);
      let pointsAwarded = 0;

      if (isCorrect) {
        pointsAwarded = calculateDecayScore(remainingMs, room.questionDurationMs);

        // Bonificación por racha
        player.streak = (player.streak || 0) + 1;
        const streakBonus = Math.min((player.streak - 1) * 50, 200);
        pointsAwarded += streakBonus;

        player.score += pointsAwarded;
      } else {
        player.streak = 0; // Reinicio de racha ante respuesta incorrecta
      }

      // Registrar opción elegida para estadísticas
      if (!room.optionCounts) {
        room.optionCounts = [0, 0, 0, 0];
      }
      const chosenIdx = Number(answerIndex);
      if (!isNaN(chosenIdx) && chosenIdx >= 0) {
        room.optionCounts[chosenIdx] = (room.optionCounts[chosenIdx] || 0) + 1;
      }

      player.hasAnswered = true;
      player.lastAnswerTime = serverNow;

      const allAnswered = this.checkIfAllActiveAnswered(room);

      return {
        success: true,
        pointsAwarded,
        isCorrect,
        streak: player.streak,
        allAnswered,
      };
    } finally {
      globalLockManager.release(lockKey);
    }
  }

  /**
   * Comprueba si todos los jugadores activos de la sala ya respondieron.
   * @param {Object} room
   * @returns {boolean}
   */
  checkIfAllActiveAnswered(room) {
    let activeCount = 0;
    let answeredCount = 0;

    for (const player of room.players.values()) {
      if (player.isActive) {
        activeCount++;
        if (player.hasAnswered) {
          answeredCount++;
        }
      }
    }

    return activeCount > 0 && answeredCount >= activeCount;
  }

  /**
   * Carga automáticamente una de las 4 rondas temáticas ("Profesión", "Noviazgo", "Ministerio", "Emociones")
   * junto con sus 5 preguntas correspondientes.
   *
   * @param {string} roomId
   * @param {number} roundIndex - Índice de la ronda (0 a 3)
   * @param {Object} [io] - Instancia de Socket.io para notificar cambio de ronda/tema
   * @returns {Object|null} La ronda cargada o null si no existe.
   */
  loadRound(roomId, roundIndex, io = null) {
    const room = this.getRoom(roomId);
    if (!room || !Array.isArray(room.rounds)) return null;

    const targetRound = room.rounds[roundIndex];
    if (!targetRound) return null;

    const isNewRound = room.currentRoundIndex !== roundIndex;
    room.currentRoundIndex = roundIndex;
    room.currentRound = targetRound;
    room.currentRoundQuestions = targetRound.questions || [];
    room.currentQuestionInRoundIndex = 0;

    // Emitir cambio de bloque temático al iniciar cada nueva ronda
    const isThemeChange = !room.currentThemeId || room.currentThemeId !== targetRound.themeId || isNewRound;
    if (isThemeChange && targetRound.themeId) {
      room.currentThemeId = targetRound.themeId;

      if (io) {
        const themePayload = {
          roundIndex: targetRound.roundIndex,
          roundNumber: targetRound.roundNumber,
          totalRounds: room.totalRounds,
          theme: targetRound.theme,
          themeId: targetRound.themeId,
          themeName: targetRound.themeName,
          themeData: targetRound.themeData || THEMES[targetRound.themeId],
          questionIndexInTheme: 1,
          totalQuestionsInTheme: room.currentRoundQuestions.length,
        };

        io.to(room.roomId).emit('round_started', themePayload);
        io.to(room.roomId).emit('theme_change', themePayload);
      }
    }

    return targetRound;
  }

  /**
   * Inicia la pregunta actual dentro de la ronda temática activa,
   * cargando automáticamente la ronda si corresponde y arrancando temporizadores.
   *
   * @param {string} roomId
   * @param {Object} io
   * @param {Function} [onTimeoutCallback]
   */
  startQuestion(roomId, io, onTimeoutCallback) {
    const room = this.getRoom(roomId);
    if (!room) return;

    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    if (room.tickInterval) {
      clearInterval(room.tickInterval);
      room.tickInterval = null;
    }

    room.status = config.roomStatus.IN_PROGRESS;
    room.isPaused = false;
    room.pausedRemainingMs = null;
    room.questionStartTime = Date.now();
    room.optionCounts = [0, 0, 0, 0];

    for (const player of room.players.values()) {
      player.hasAnswered = false;
      player.lastAnswerTime = null;
    }

    if (room.currentQuestionIndex < 0) {
      room.currentQuestionIndex = 0;
    }

    // Determinar ronda y posición dentro de la ronda según currentQuestionIndex
    if (Array.isArray(room.rounds) && room.rounds.length > 0) {
      let accumulated = 0;
      let resolvedRoundIdx = 0;
      let resolvedQInRoundIdx = 0;

      for (let r = 0; r < room.rounds.length; r++) {
        const rLen = room.rounds[r].questions.length;
        if (room.currentQuestionIndex < accumulated + rLen) {
          resolvedRoundIdx = r;
          resolvedQInRoundIdx = room.currentQuestionIndex - accumulated;
          break;
        }
        accumulated += rLen;
      }

      if (room.currentRoundIndex !== resolvedRoundIdx || !room.currentRound) {
        this.loadRound(room.roomId, resolvedRoundIdx, io);
      }
      room.currentQuestionInRoundIndex = resolvedQInRoundIdx;
    }

    const currentQuestion =
      (room.currentRoundQuestions && room.currentRoundQuestions[room.currentQuestionInRoundIndex]) ||
      room.questions[room.currentQuestionIndex];

    if (!currentQuestion) return;

    // Respaldo: si aún no se había emitido theme_change para este tema
    const isThemeChange = !room.currentThemeId || room.currentThemeId !== currentQuestion.themeId;
    if (isThemeChange && currentQuestion.themeId) {
      room.currentThemeId = currentQuestion.themeId;

      io.to(room.roomId).emit('theme_change', {
        roundIndex: currentQuestion.roundIndex ?? room.currentRoundIndex,
        roundNumber: currentQuestion.roundNumber ?? room.currentRoundIndex + 1,
        totalRounds: room.totalRounds || 4,
        theme: currentQuestion.theme || currentQuestion.themeName,
        themeId: currentQuestion.themeId,
        themeName: currentQuestion.themeName,
        themeData: currentQuestion.themeData || THEMES[currentQuestion.themeId],
        questionIndexInTheme: currentQuestion.questionIndexInTheme || room.currentQuestionInRoundIndex + 1,
        totalQuestionsInTheme: currentQuestion.totalQuestionsInTheme || room.questionsPerTheme,
      });
    }

    const questionPayload = {
      index: room.currentQuestionIndex,
      totalQuestions: room.questions.length,
      roundIndex: currentQuestion.roundIndex ?? room.currentRoundIndex,
      roundNumber: currentQuestion.roundNumber ?? room.currentRoundIndex + 1,
      totalRounds: room.totalRounds || 4,
      theme: currentQuestion.theme || currentQuestion.themeName,
      themeId: currentQuestion.themeId,
      themeName: currentQuestion.themeName,
      themeData: currentQuestion.themeData || (currentQuestion.themeId ? THEMES[currentQuestion.themeId] : null),
      questionIndexInTheme: currentQuestion.questionIndexInTheme || room.currentQuestionInRoundIndex + 1,
      totalQuestionsInTheme: currentQuestion.totalQuestionsInTheme || room.currentRoundQuestions.length || room.questionsPerTheme,
      question: currentQuestion.question,
      options: currentQuestion.options,
      durationMs: room.questionDurationMs,
      startTime: room.questionStartTime,
    };

    io.to(room.roomId).emit('question_started', questionPayload);

    // Ticks de sincronización cada 1s hacia los clientes
    room.tickInterval = setInterval(() => {
      if (room.isPaused) return;

      const elapsed = Date.now() - room.questionStartTime;
      const remainingMs = Math.max(0, room.questionDurationMs - elapsed);

      io.to(room.roomId).emit('timer_tick', {
        remainingMs,
        totalDurationMs: room.questionDurationMs,
        elapsedMs: elapsed,
      });

      if (remainingMs <= 0) {
        if (room.tickInterval) {
          clearInterval(room.tickInterval);
          room.tickInterval = null;
        }
      }
    }, 1000);

    room.timer = setTimeout(() => {
      this.finishCurrentQuestion(room.roomId, io, onTimeoutCallback);
    }, room.questionDurationMs);
  }

  /**
   * Finaliza la pregunta actual, detiene temporizadores y emite resultados.
   *
   * @param {string} roomId
   * @param {Object} io
   * @param {Function} [callback]
   */
  finishCurrentQuestion(roomId, io, callback) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== config.roomStatus.IN_PROGRESS) return;

    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    if (room.tickInterval) {
      clearInterval(room.tickInterval);
      room.tickInterval = null;
    }

    room.status = config.roomStatus.RESULTS;
    room.isPaused = false;
    room.pausedRemainingMs = null;

    const currentQuestion = room.questions[room.currentQuestionIndex];
    const leaderboard = this.getLeaderboard(room);

    const optionCounts = room.optionCounts || [0, 0, 0, 0];
    const totalAnswers = optionCounts.reduce((acc, curr) => acc + curr, 0);
    const optionPercentages = optionCounts.map((count) =>
      totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0
    );

    const isLastQuestionInRound =
      room.currentRoundQuestions &&
      room.currentQuestionInRoundIndex >= room.currentRoundQuestions.length - 1;

    io.to(room.roomId).emit('question_results', {
      questionIndex: room.currentQuestionIndex,
      roundIndex: room.currentRoundIndex,
      roundNumber: room.currentRoundIndex + 1,
      totalRounds: room.totalRounds || 4,
      theme: currentQuestion ? currentQuestion.theme : null,
      themeId: currentQuestion ? currentQuestion.themeId : null,
      themeName: currentQuestion ? currentQuestion.themeName : null,
      correctAnswer: currentQuestion ? currentQuestion.correctAnswer : 0,
      leaderboard,
      optionCounts,
      optionPercentages,
      totalAnswers,
      isLastQuestionInRound,
      isLastQuestion: room.currentQuestionIndex >= room.questions.length - 1,
    });

    if (typeof callback === 'function') {
      callback(room);
    }
  }

  /**
   * Avanza a la siguiente pregunta dentro de la ronda actual.
   * Cuando se completan las 5 preguntas del tema actual, carga automáticamente
   * la siguiente ronda temática ("Profesión" -> "Noviazgo" -> "Ministerio" -> "Emociones")
   * o finaliza el juego al concluir las 4 rondas.
   *
   * @param {string} roomId
   * @param {Object} io
   * @param {Function} [onTimeoutCallback]
   * @returns {{ finished: boolean, questionIndex: number, roundIndex: number }}
   */
  advanceToNextQuestion(roomId, io, onTimeoutCallback) {
    const room = this.getRoom(roomId);
    if (!room) return { finished: true, questionIndex: -1, roundIndex: -1 };

    room.currentQuestionIndex++;
    room.currentQuestionInRoundIndex++;

    // Verificar si se completaron las preguntas de la ronda temática actual
    if (
      Array.isArray(room.rounds) &&
      room.rounds.length > 0 &&
      room.currentRoundQuestions &&
      room.currentQuestionInRoundIndex >= room.currentRoundQuestions.length
    ) {
      const nextRoundIndex = room.currentRoundIndex + 1;
      if (nextRoundIndex < room.rounds.length) {
        // Cargar automáticamente la siguiente ronda con sus 5 preguntas
        this.loadRound(room.roomId, nextRoundIndex, io);
      }
    }

    if (room.currentQuestionIndex < room.questions.length) {
      this.startQuestion(room.roomId, io, onTimeoutCallback);
      return {
        finished: false,
        questionIndex: room.currentQuestionIndex,
        roundIndex: room.currentRoundIndex,
      };
    } else {
      this.finishGame(room.roomId, io);
      return {
        finished: true,
        questionIndex: room.currentQuestionIndex,
        roundIndex: room.currentRoundIndex,
      };
    }
  }

  // =========================================================================
  // Controles en partida (Host): Pausar, Reanudar, Saltar y Forzar Cierre
  // =========================================================================

  /**
   * Pausa la pregunta activa congelando el temporizador y bloqueando respuestas.
   * @param {string} roomId
   * @param {Object} io
   * @returns {{ success: boolean, error?: string, remainingMs?: number }}
   */
  pauseGame(roomId, io) {
    const room = this.getRoom(roomId);
    if (!room) return { success: false, error: 'Sala no encontrada.' };

    if (room.status !== config.roomStatus.IN_PROGRESS) {
      return { success: false, error: 'No hay una pregunta en curso para pausar.' };
    }

    if (room.isPaused) {
      return { success: false, error: 'La partida ya está pausada.' };
    }

    // Congelar timers
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    if (room.tickInterval) {
      clearInterval(room.tickInterval);
      room.tickInterval = null;
    }

    const elapsed = Date.now() - room.questionStartTime;
    room.pausedRemainingMs = Math.max(0, room.questionDurationMs - elapsed);
    room.isPaused = true;

    io.to(room.roomId).emit('game_paused', {
      questionIndex: room.currentQuestionIndex,
      remainingMs: room.pausedRemainingMs,
    });

    return { success: true, remainingMs: room.pausedRemainingMs };
  }

  /**
   * Reanuda la pregunta activa restaurando el tiempo remanente.
   * @param {string} roomId
   * @param {Object} io
   * @param {Function} [onTimeoutCallback]
   * @returns {{ success: boolean, error?: string, remainingMs?: number }}
   */
  resumeGame(roomId, io, onTimeoutCallback) {
    const room = this.getRoom(roomId);
    if (!room) return { success: false, error: 'Sala no encontrada.' };

    if (room.status !== config.roomStatus.IN_PROGRESS) {
      return { success: false, error: 'La partida no está en curso.' };
    }

    if (!room.isPaused) {
      return { success: false, error: 'La partida no está pausada.' };
    }

    room.isPaused = false;
    const remainingMs = room.pausedRemainingMs || 1000;
    room.questionStartTime = Date.now() - (room.questionDurationMs - remainingMs);

    io.to(room.roomId).emit('game_resumed', {
      questionIndex: room.currentQuestionIndex,
      remainingMs,
      startTime: room.questionStartTime,
    });

    // Reanudar temporizadores
    room.timer = setTimeout(() => {
      this.finishCurrentQuestion(room.roomId, io, onTimeoutCallback);
    }, remainingMs);

    room.tickInterval = setInterval(() => {
      if (room.isPaused) return;

      const elapsed = Date.now() - room.questionStartTime;
      const curRemaining = Math.max(0, room.questionDurationMs - elapsed);

      io.to(room.roomId).emit('timer_tick', {
        remainingMs: curRemaining,
        totalDurationMs: room.questionDurationMs,
        elapsedMs: elapsed,
      });

      if (curRemaining <= 0) {
        if (room.tickInterval) {
          clearInterval(room.tickInterval);
          room.tickInterval = null;
        }
      }
    }, 1000);

    return { success: true, remainingMs };
  }

  /**
   * Salta inmediatamente la pregunta actual y muestra los resultados.
   * @param {string} roomId
   * @param {Object} io
   * @param {Function} [onTimeoutCallback]
   * @returns {{ success: boolean, error?: string }}
   */
  skipQuestion(roomId, io, onTimeoutCallback) {
    const room = this.getRoom(roomId);
    if (!room) return { success: false, error: 'Sala no encontrada.' };

    if (room.status !== config.roomStatus.IN_PROGRESS) {
      return { success: false, error: 'Solo se puede saltar una pregunta activa.' };
    }

    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    if (room.tickInterval) {
      clearInterval(room.tickInterval);
      room.tickInterval = null;
    }

    room.isPaused = false;

    io.to(room.roomId).emit('question_skipped', {
      questionIndex: room.currentQuestionIndex,
    });

    this.finishCurrentQuestion(room.roomId, io, onTimeoutCallback);

    return { success: true };
  }

  /**
   * Fuerza el cierre anticipado de respuestas para la pregunta actual.
   * @param {string} roomId
   * @param {Object} io
   * @param {Function} [onTimeoutCallback]
   * @returns {{ success: boolean, error?: string }}
   */
  forceCloseAnswers(roomId, io, onTimeoutCallback) {
    const room = this.getRoom(roomId);
    if (!room) return { success: false, error: 'Sala no encontrada.' };

    if (room.status !== config.roomStatus.IN_PROGRESS) {
      return { success: false, error: 'Solo se pueden cerrar respuestas de una pregunta activa.' };
    }

    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    if (room.tickInterval) {
      clearInterval(room.tickInterval);
      room.tickInterval = null;
    }

    room.isPaused = false;

    io.to(room.roomId).emit('answers_force_closed', {
      questionIndex: room.currentQuestionIndex,
    });

    this.finishCurrentQuestion(room.roomId, io, onTimeoutCallback);

    return { success: true };
  }

  /**
   * Finaliza la partida y calcula el podio final.
   * @param {string} roomId
   * @param {Object} io
   */
  finishGame(roomId, io) {
    const room = this.getRoom(roomId);
    if (!room) return;

    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    if (room.tickInterval) {
      clearInterval(room.tickInterval);
      room.tickInterval = null;
    }

    room.status = config.roomStatus.FINISHED;
    const finalLeaderboard = this.getLeaderboard(room);

    io.to(room.roomId).emit('game_finished', {
      leaderboard: finalLeaderboard,
      podium: finalLeaderboard.slice(0, 3),
    });
  }

  /**
   * Genera el leaderboard ordenado por puntuación descendente.
   * @param {Object} room
   * @returns {Array<Object>}
   */
  getLeaderboard(room) {
    return Array.from(room.players.values())
      .map((p) => ({
        socketId: p.socketId,
        name: p.name,
        avatarId: p.avatarId,
        avatarMeta: p.avatarMeta,
        score: p.score,
        streak: p.streak,
        isActive: p.isActive,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Obtiene la lista de jugadores desinfectada (sin datos sensibles).
   * @param {Object} room
   * @returns {Array<Object>}
   */
  getSanitizedPlayers(room) {
    return Array.from(room.players.values()).map((p) => ({
      socketId: p.socketId,
      name: p.name,
      avatarId: p.avatarId,
      avatarMeta: p.avatarMeta,
      score: p.score,
      streak: p.streak,
      hasAnswered: p.hasAnswered,
      isActive: p.isActive,
    }));
  }

  /**
   * Manejo del ciclo de vida ante desconexión de sockets.
   * @param {string} socketId
   * @param {Object} io
   */
  handleDisconnect(socketId, io) {
    const socketInfo = this.socketToRoom.get(socketId);
    if (!socketInfo) return;

    const { roomId, isHost } = socketInfo;
    const room = this.getRoom(roomId);

    this.socketToRoom.delete(socketId);

    if (!room) return;

    if (isHost) {
      io.to(room.roomId).emit('host_disconnected', {
        message: 'El anfitrión de la sala se ha desconectado.',
        roomId: room.roomId,
      });

      if (room.status === config.roomStatus.LOBBY) {
        this.destroyRoom(room.roomId);
      }
      return;
    }

    const player = room.players.get(socketId);
    if (!player) return;

    if (room.status === config.roomStatus.LOBBY) {
      room.players.delete(socketId);

      io.to(room.roomId).emit('player_left', {
        socketId,
        name: player.name,
        totalPlayers: room.players.size,
        players: this.getSanitizedPlayers(room),
      });
    } else {
      player.isActive = false;

      io.to(room.roomId).emit('player_disconnected', {
        socketId,
        name: player.name,
        avatarId: player.avatarId,
        message: `El jugador "${player.name}" se ha desconectado.`,
        totalActivePlayers: Array.from(room.players.values()).filter((p) => p.isActive).length,
      });

      if (room.status === config.roomStatus.IN_PROGRESS && this.checkIfAllActiveAnswered(room)) {
        this.finishCurrentQuestion(room.roomId, io);
      }
    }
  }

  /**
   * Destruye una sala y libera todos sus recursos y temporizadores.
   * @param {string} roomId
   */
  destroyRoom(roomId) {
    const room = this.getRoom(roomId);
    if (!room) return;

    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    if (room.tickInterval) {
      clearInterval(room.tickInterval);
      room.tickInterval = null;
    }

    globalLockManager.clearRoomLocks(room.roomId);

    this.socketToRoom.delete(room.hostSocketId);
    for (const socketId of room.players.keys()) {
      this.socketToRoom.delete(socketId);
    }

    this.rooms.delete(room.roomId);
  }
}

const gameManager = new GameManager();

module.exports = {
  GameManager,
  gameManager,
};
