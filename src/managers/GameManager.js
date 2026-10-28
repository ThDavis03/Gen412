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
const {
  TEAM_ASSIGNMENT_MODES,
  cloneDefaultTeams,
  normalizeTeamAssignment,
  applyTeamEdits,
} = require('../config/teams');

/**
 * Crea un error cuyo mensaje es seguro de mostrar al usuario/administrador.
 * @param {string} message
 * @returns {Error}
 */
function createUserError(message) {
  const err = new Error(message);
  err.userFacing = true;
  return err;
}

/**
 * Clase centralizada GameManager encargada de aislar y administrar el estado
 * en memoria de múltiples salas simultáneas, rondas temáticas continuas,
 * avatares, equipos y controles del anfitrión en tiempo real.
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

    /**
     * Configuraciones dinámicas de partida administrables desde /admin
     */
    this.adminSettings = {
      durationSeconds: Math.round(config.game.defaultDurationMs / 1000) || 15,
      questionsPerTheme: config.game.defaultQuestionsPerTheme || 5,
      gameMode: config.game.defaultGameMode || 'Estándar', // 'Rápida' | 'Estándar' | 'Pausada'
      teamAssignment: TEAM_ASSIGNMENT_MODES.RANDOM, // 'random' | 'choice'
      teams: cloneDefaultTeams(), // 4 equipos fijos con nombres editables
      selectedThemeIds: null, // null = todos los temas; arreglo = temas seleccionados
    };
  }

  /**
   * Normaliza el nombre del modo de juego a una de las 3 opciones oficiales:
   * 'Rápida', 'Estándar' o 'Pausada'.
   * @param {string} [rawMode]
   * @returns {'Rápida'|'Estándar'|'Pausada'}
   */
  normalizeGameMode(rawMode) {
    if (!rawMode || typeof rawMode !== 'string') {
      return this.adminSettings?.gameMode || 'Estándar';
    }
    const clean = rawMode.trim().toLowerCase();
    if (clean.startsWith('rápid') || clean.startsWith('rapid') || clean === 'fast') {
      return 'Rápida';
    }
    if (clean.startsWith('pausad') || clean === 'manual' || clean === 'paused') {
      return 'Pausada';
    }
    return 'Estándar';
  }

  /**
   * Valida un tiempo por pregunta libre (en segundos). Acepta cualquier entero dentro de los límites.
   * @param {*} rawSeconds
   * @returns {number|null} Segundos válidos o null si es inválido.
   */
  parseDurationSeconds(rawSeconds) {
    const sec = Number(rawSeconds);
    if (!Number.isFinite(sec)) return null;
    const rounded = Math.round(sec);
    const { minDurationSeconds, maxDurationSeconds } = config.game;
    if (rounded < minDurationSeconds || rounded > maxDurationSeconds) return null;
    return rounded;
  }

  /**
   * Valida una selección de temas. Devuelve null (todos) o un arreglo de ids existentes.
   * @param {*} raw
   * @returns {string[]|null}
   * @throws {Error} Si la selección está vacía o contiene temas inexistentes.
   */
  validateSelectedThemeIds(raw) {
    if (raw === null) return null;
    if (!Array.isArray(raw)) {
      throw createUserError("El campo 'selectedThemeIds' debe ser un arreglo de ids de tema.");
    }
    const unique = [...new Set(raw.map(String))];
    if (unique.length === 0) {
      throw createUserError('Debes seleccionar al menos un tema para la partida.');
    }
    const unknown = unique.filter((id) => !THEMES[id]);
    if (unknown.length > 0) {
      throw createUserError(`Temas inexistentes en la selección: ${unknown.join(', ')}`);
    }
    return unique;
  }

  /**
   * Obtiene la configuración global actual del panel de administración (copia segura).
   */
  getAdminSettings() {
    return {
      ...this.adminSettings,
      teams: this.adminSettings.teams.map((t) => ({ ...t })),
      selectedThemeIds: Array.isArray(this.adminSettings.selectedThemeIds)
        ? [...this.adminSettings.selectedThemeIds]
        : null,
    };
  }

  /**
   * Actualiza la configuración global de partidas desde el panel de administración.
   * @param {Object} newSettings
   * @throws {Error} Si la selección de temas o los nombres de equipos son inválidos.
   */
  updateAdminSettings(newSettings = {}) {
    // Validar primero lo que puede lanzar error, para no aplicar cambios parciales
    let nextTeams = null;
    if (newSettings.teams !== undefined) {
      nextTeams = applyTeamEdits(this.adminSettings.teams, newSettings.teams);
    }

    let nextSelected;
    if (newSettings.selectedThemeIds !== undefined) {
      nextSelected = this.validateSelectedThemeIds(newSettings.selectedThemeIds);
    }

    if (newSettings.durationSeconds !== undefined) {
      const sec = this.parseDurationSeconds(newSettings.durationSeconds);
      if (sec !== null) {
        this.adminSettings.durationSeconds = sec;
      }
    }

    if (newSettings.questionsPerTheme !== undefined) {
      const qpt = parseInt(newSettings.questionsPerTheme, 10);
      if (!isNaN(qpt) && qpt >= 1 && qpt <= 50) {
        this.adminSettings.questionsPerTheme = qpt;
      }
    }

    if (newSettings.gameMode !== undefined) {
      this.adminSettings.gameMode = this.normalizeGameMode(newSettings.gameMode);
    }

    if (newSettings.teamAssignment !== undefined) {
      this.adminSettings.teamAssignment = normalizeTeamAssignment(
        newSettings.teamAssignment,
        this.adminSettings.teamAssignment
      );
    }

    if (nextTeams) {
      this.adminSettings.teams = nextTeams;
    }

    if (nextSelected !== undefined) {
      this.adminSettings.selectedThemeIds = nextSelected;
    }

    return this.getAdminSettings();
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
   * Crea una nueva sala de trivia dividida en rondas temáticas continuas.
   * Cada ronda carga las preguntas del tema seleccionado en el panel de administración
   * (por defecto "Profesión", "Noviazgo", "Ministerio" y "Emociones").
   *
   * @param {string} hostSocketId - ID del socket del anfitrión.
   * @param {Object|Array} [optionsOrQuestions] - Opciones de configuración o preguntas custom.
   * @returns {Object} La sala creada.
   * @throws {Error} (userFacing) Si los temas seleccionados no tienen preguntas disponibles.
   */
  createRoom(hostSocketId, optionsOrQuestions = {}) {
    // Soporte retrocompatible si se pasa un array de preguntas directas
    let questions;
    let rounds = [];
    let durationMs = (this.adminSettings.durationSeconds || 15) * 1000;
    let questionsPerTheme = this.adminSettings.questionsPerTheme || 5;
    let gameMode = this.adminSettings.gameMode || 'Estándar';
    let selectedThemeIds = Array.isArray(this.adminSettings.selectedThemeIds)
      ? [...this.adminSettings.selectedThemeIds]
      : null;

    const buildGeneralRound = (customQuestions) => [
      {
        roundIndex: 0,
        roundNumber: 1,
        totalRounds: 1,
        theme: 'General',
        themeId: 'profesion',
        themeName: 'General',
        themeData: THEMES.profesion,
        questions: customQuestions,
      },
    ];

    if (Array.isArray(optionsOrQuestions)) {
      questions = optionsOrQuestions;
      rounds = buildGeneralRound(questions);
    } else {
      const opts = optionsOrQuestions || {};
      if (opts.durationSeconds) {
        const sec = this.parseDurationSeconds(opts.durationSeconds);
        if (sec !== null) durationMs = sec * 1000;
      } else if (opts.durationMs) {
        const ms = parseInt(opts.durationMs, 10);
        if (!isNaN(ms) && ms > 0) durationMs = ms;
      }

      if (opts.questionsPerTheme) {
        questionsPerTheme = Math.max(1, parseInt(opts.questionsPerTheme, 10) || questionsPerTheme);
      }

      if (opts.gameMode) {
        gameMode = this.normalizeGameMode(opts.gameMode);
      }

      if (opts.selectedThemeIds !== undefined) {
        selectedThemeIds = this.validateSelectedThemeIds(opts.selectedThemeIds);
      }

      if (Array.isArray(opts.questions) && opts.questions.length > 0) {
        questions = opts.questions;
        rounds = buildGeneralRound(questions);
      } else {
        // Construir las rondas temáticas continuas con los temas seleccionados
        rounds = buildThematicRounds(questionsPerTheme, selectedThemeIds);
        questions = rounds.reduce((acc, round) => acc.concat(round.questions), []);

        if (rounds.length === 0) {
          throw createUserError(
            'Los temas seleccionados no tienen preguntas disponibles. Agrega preguntas o selecciona otros temas.'
          );
        }
      }
    }

    const roomId = this.generateRoomId();

    // Estructura estricta de la Sala con soporte de rondas continuas, equipos y modo de juego
    const room = {
      roomId,
      hostSocketId,
      status: config.roomStatus.LOBBY,
      gameMode, // 'Rápida' | 'Estándar' | 'Pausada'
      teamAssignment: this.adminSettings.teamAssignment, // 'random' | 'choice'
      teams: this.adminSettings.teams.map((t) => ({ ...t })), // Copia fija para la duración de la partida
      selectedThemeIds,
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
      autoAdvanceTimer: null,
      intermissionInterval: null,
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
   * Lista un resumen de las salas activas (para el panel de control del administrador).
   * @returns {Array<Object>}
   */
  listRooms() {
    return Array.from(this.rooms.values()).map((room) => ({
      roomId: room.roomId,
      status: room.status,
      gameMode: room.gameMode,
      teamAssignment: room.teamAssignment,
      totalPlayers: room.players.size,
      totalQuestions: room.questions.length,
      currentQuestionIndex: room.currentQuestionIndex,
      isPaused: room.isPaused,
    }));
  }

  /**
   * Genera una instantánea completa del estado de una sala (monitoreo del administrador).
   * @param {Object} room
   * @returns {Object}
   */
  getRoomSnapshot(room) {
    const players = this.getSanitizedPlayers(room);
    const activePlayers = players.filter((p) => p.isActive);
    const currentQuestion =
      room.currentQuestionIndex >= 0 ? room.questions[room.currentQuestionIndex] : null;

    return {
      roomId: room.roomId,
      status: room.status,
      gameMode: room.gameMode,
      teamAssignment: room.teamAssignment,
      durationMs: room.questionDurationMs,
      totalQuestions: room.questions.length,
      totalRounds: room.totalRounds,
      currentQuestionIndex: room.currentQuestionIndex,
      currentRoundIndex: room.currentRoundIndex,
      isPaused: room.isPaused,
      players,
      totalPlayers: players.length,
      totalActive: activePlayers.length,
      answeredCount: activePlayers.filter((p) => p.hasAnswered).length,
      teams: this.getTeamLeaderboard(room),
      leaderboard: this.getLeaderboard(room),
      currentQuestion: currentQuestion
        ? {
            question: currentQuestion.question,
            theme: currentQuestion.theme || null,
            themeName: currentQuestion.themeName || null,
            options: currentQuestion.options,
            correctAnswer: currentQuestion.correctAnswer,
          }
        : null,
    };
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
   * Agrega un nuevo jugador a una sala con asignación de Avatar, racha y equipo.
   *
   * @param {string} roomId
   * @param {string} socketId
   * @param {string} name
   * @param {string|number} [avatarId]
   * @param {string} [teamId] - Equipo elegido (solo se respeta si la sala usa asignación por elección).
   * @returns {{ success: boolean, error?: string, player?: Object, room?: Object }}
   */
  addPlayer(roomId, socketId, name, avatarId = null, teamId = null) {
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

    // Resolver equipo: elección del jugador (si el modo lo permite y es válido) o aleatorio balanceado
    const useChosenTeam =
      room.teamAssignment === TEAM_ASSIGNMENT_MODES.CHOICE && this.isValidTeamId(room, teamId);
    const assignedTeamId = useChosenTeam ? teamId : this.pickBalancedTeamId(room);

    // Estructura de datos estricta del Jugador: { socketId, name, avatarId, score, streak, teamId }
    const player = {
      socketId,
      name: trimmedName,
      avatarId: avatar.id,
      avatarMeta: avatar, // icon, color, name
      teamId: assignedTeamId,
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

  // =========================================================================
  // Equipos
  // =========================================================================

  /**
   * Comprueba si un id de equipo existe en la sala.
   * @param {Object} room
   * @param {string} teamId
   * @returns {boolean}
   */
  isValidTeamId(room, teamId) {
    return Boolean(teamId) && Array.isArray(room.teams) && room.teams.some((t) => t.id === teamId);
  }

  /**
   * Devuelve el id del equipo con menos integrantes (desempate aleatorio) para balancear equipos.
   * @param {Object} room
   * @returns {string}
   */
  pickBalancedTeamId(room) {
    const counts = new Map(room.teams.map((t) => [t.id, 0]));
    for (const p of room.players.values()) {
      if (counts.has(p.teamId)) counts.set(p.teamId, counts.get(p.teamId) + 1);
    }
    const min = Math.min(...counts.values());
    const candidates = room.teams.filter((t) => counts.get(t.id) === min);
    return candidates[Math.floor(Math.random() * candidates.length)].id;
  }

  /**
   * Campos públicos del equipo de un jugador (para leaderboards y listados).
   * @param {Object} room
   * @param {string} teamId
   * @returns {Object}
   */
  getPlayerTeamFields(room, teamId) {
    const team = (room.teams || []).find((t) => t.id === teamId);
    if (!team) {
      return { teamId: teamId || null, teamName: null, teamAnimal: null, teamEmoji: null, teamColor: null };
    }
    return {
      teamId: team.id,
      teamName: team.name,
      teamAnimal: team.animal,
      teamEmoji: team.emoji,
      teamColor: team.color,
    };
  }

  /**
   * Cambia el equipo de un jugador (solo en el Lobby y con asignación 'Por Elección del Jugador').
   *
   * @param {string} socketId
   * @param {string} teamId
   * @returns {{ success: boolean, error?: string, roomId?: string, player?: Object, players?: Array<Object>, teams?: Array<Object> }}
   */
  selectPlayerTeam(socketId, teamId) {
    const socketInfo = this.getSocketInfo(socketId);
    if (!socketInfo || socketInfo.isHost) {
      return { success: false, error: 'El jugador no pertenece a ninguna sala activa.' };
    }

    const room = this.getRoom(socketInfo.roomId);
    if (!room) {
      return { success: false, error: 'La sala especificada no existe.' };
    }

    const player = room.players.get(socketId);
    if (!player) {
      return { success: false, error: 'Jugador no encontrado en la sala.' };
    }

    if (room.status !== config.roomStatus.LOBBY) {
      return { success: false, error: 'Ya no es posible cambiar de equipo: la partida está en curso.' };
    }

    if (room.teamAssignment !== TEAM_ASSIGNMENT_MODES.CHOICE) {
      return { success: false, error: 'Los equipos de esta partida se asignan de forma aleatoria.' };
    }

    if (!this.isValidTeamId(room, teamId)) {
      return { success: false, error: 'El equipo seleccionado no existe.' };
    }

    player.teamId = teamId;

    return {
      success: true,
      roomId: room.roomId,
      player,
      players: this.getSanitizedPlayers(room),
      teams: this.getTeamLeaderboard(room),
    };
  }

  /**
   * Tabla de posiciones por equipos. El puntaje del equipo es la suma de los puntos
   * individuales de todos sus integrantes (los puntos se acumulan en tiempo real).
   *
   * @param {Object} room
   * @returns {Array<Object>} Equipos ordenados por puntaje descendente.
   */
  getTeamLeaderboard(room) {
    const teams = (room.teams || []).map((team) => ({
      id: team.id,
      animal: team.animal,
      name: team.name,
      emoji: team.emoji,
      color: team.color,
      score: 0,
      memberCount: 0,
      activeCount: 0,
      averageScore: 0,
    }));

    const byId = new Map(teams.map((t) => [t.id, t]));
    for (const p of room.players.values()) {
      const t = byId.get(p.teamId);
      if (!t) continue;
      t.score += p.score;
      t.memberCount += 1;
      if (p.isActive) t.activeCount += 1;
    }

    teams.forEach((t) => {
      t.averageScore = t.memberCount > 0 ? Math.round(t.score / t.memberCount) : 0;
    });

    return teams.sort((a, b) => b.score - a.score);
  }

  /**
   * Actualiza en tiempo real el avatar (seed de DiceBear) de un jugador conectado.
   *
   * @param {string} socketId
   * @param {string} newSeed
   * @param {string} [explicitRoomId]
   * @returns {{ success: boolean, error?: string, roomId?: string, player?: Object, players?: Array<Object> }}
   */
  updatePlayerAvatar(socketId, newSeed, explicitRoomId = null) {
    const socketInfo = this.getSocketInfo(socketId);
    const targetRoomId = explicitRoomId || (socketInfo && socketInfo.roomId);

    if (!targetRoomId) {
      return { success: false, error: 'El jugador no pertenece a ninguna sala activa.' };
    }

    const room = this.getRoom(targetRoomId);
    if (!room) {
      return { success: false, error: 'La sala especificada no existe.' };
    }

    const player = room.players.get(socketId);
    if (!player) {
      return { success: false, error: 'Jugador no encontrado en la sala.' };
    }

    const resolvedAvatar = resolveAvatar(newSeed);
    player.avatarId = resolvedAvatar.id;
    player.avatarMeta = resolvedAvatar;

    return {
      success: true,
      roomId: room.roomId,
      player,
      players: this.getSanitizedPlayers(room),
    };
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
   * Todos respondieron: corta el temporizador principal y abre la cuenta regresiva
   * de 10s antes de pasar a la siguiente pregunta.
   * @param {string} roomId
   * @param {Object} io
   * @param {Function} [callback]
   */
  onAllAnswered(roomId, io, callback) {
    this.finishCurrentQuestion(roomId, io, callback, { allAnswered: true });
  }

  /**
   * Inicia la cuenta regresiva (intermission) emitiendo ticks cada 1s.
   */
  startIntermission(room, io, durationMs, reason) {
    this.clearIntermission(room);
    const endsAt = Date.now() + durationMs;
    io.to(room.roomId).emit('intermission_started', { durationMs, endsAt, reason });
    room.intermissionInterval = setInterval(() => {
      const remainingMs = Math.max(0, endsAt - Date.now());
      io.to(room.roomId).emit('intermission_tick', { remainingMs, durationMs });
      if (remainingMs <= 0) this.clearIntermission(room);
    }, 1000);
    if (typeof room.intermissionInterval.unref === 'function') room.intermissionInterval.unref();
  }

  clearIntermission(room) {
    if (room && room.intermissionInterval) {
      clearInterval(room.intermissionInterval);
      room.intermissionInterval = null;
    }
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

    this.clearIntermission(room);

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
  finishCurrentQuestion(roomId, io, callback, opts = {}) {
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
    if (room.autoAdvanceTimer) {
      clearTimeout(room.autoAdvanceTimer);
      room.autoAdvanceTimer = null;
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
    const isLastQuestion = room.currentQuestionIndex >= room.questions.length - 1;

    const gameMode = room.gameMode || 'Estándar';
    const showRoundPodium = gameMode === 'Estándar' && Boolean(isLastQuestionInRound) && !isLastQuestion;
    const intermissionMs =
      opts.allAnswered && gameMode !== 'Pausada' ? config.game.allAnsweredCountdownMs || 10000 : 0;
    const autoAdvance = gameMode === 'Rápida' || intermissionMs > 0;
    const teamLeaderboard = this.getTeamLeaderboard(room);

    io.to(room.roomId).emit('question_results', {
      questionIndex: room.currentQuestionIndex,
      roundIndex: room.currentRoundIndex,
      roundNumber: room.currentRoundIndex + 1,
      totalRounds: room.totalRounds || 4,
      gameMode,
      theme: currentQuestion ? currentQuestion.theme : null,
      themeId: currentQuestion ? currentQuestion.themeId : null,
      themeName: currentQuestion ? currentQuestion.themeName : null,
      correctAnswer: currentQuestion ? currentQuestion.correctAnswer : 0,
      leaderboard,
      teamLeaderboard,
      optionCounts,
      optionPercentages,
      totalAnswers,
      isLastQuestionInRound,
      isLastQuestion,
      showRoundPodium,
      autoAdvance,
      allAnswered: Boolean(opts.allAnswered),
      autoAdvanceInMs: autoAdvance ? intermissionMs || config.game.autoAdvanceDelayMs || 3500 : null,
    });

    // En modo 'Estándar', emitir podio parcial cada 5 preguntas (al cierre de cada bloque temático)
    if (showRoundPodium) {
      io.to(room.roomId).emit('round_podium', {
        roundIndex: room.currentRoundIndex,
        roundNumber: room.currentRoundIndex + 1,
        completedRoundNumber: room.currentRoundIndex + 1,
        totalRounds: room.totalRounds || 4,
        theme: currentQuestion ? currentQuestion.theme : null,
        themeName: currentQuestion ? currentQuestion.themeName : null,
        leaderboard,
        teamLeaderboard,
        top3: leaderboard.slice(0, 3),
      });
    }

    // Avance automático: modo 'Rápida' o intermission de 10s tras responder todos
    if (autoAdvance) {
      const delay = intermissionMs || config.game.autoAdvanceDelayMs || 3500;
      if (intermissionMs) {
        this.startIntermission(room, io, intermissionMs, 'all_answered');
      }
      room.autoAdvanceTimer = setTimeout(() => {
        const activeRoom = this.getRoom(roomId);
        if (activeRoom && activeRoom.status === config.roomStatus.RESULTS) {
          this.advanceToNextQuestion(roomId, io);
        }
      }, delay);
      if (typeof room.autoAdvanceTimer.unref === 'function') room.autoAdvanceTimer.unref();
    }

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

    if (room.autoAdvanceTimer) {
      clearTimeout(room.autoAdvanceTimer);
      room.autoAdvanceTimer = null;
    }
    this.clearIntermission(room);

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
    if (room.autoAdvanceTimer) {
      clearTimeout(room.autoAdvanceTimer);
      room.autoAdvanceTimer = null;
    }
    this.clearIntermission(room);

    room.status = config.roomStatus.FINISHED;
    const finalLeaderboard = this.getLeaderboard(room);

    io.to(room.roomId).emit('game_finished', {
      teamLeaderboard: this.getTeamLeaderboard(room),
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
        ...this.getPlayerTeamFields(room, p.teamId),
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
      ...this.getPlayerTeamFields(room, p.teamId),
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
        this.onAllAnswered(room.roomId, io);
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
    if (room.autoAdvanceTimer) {
      clearTimeout(room.autoAdvanceTimer);
      room.autoAdvanceTimer = null;
    }
    this.clearIntermission(room);

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
