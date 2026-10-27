/**
 * network.js
 * Capa de red pura encargada de la comunicación por WebSockets con Socket.io.
 * Aislada completamente de la manipulación del DOM.
 */

class NetworkService {
  constructor() {
    this.socket = null;
    this.eventListeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  /**
   * Inicializa la conexión de Socket.io con configuración de reconexión automática.
   * @param {Object} callbacks - Callbacks de ciclo de vida de conexión
   */
  init(callbacks = {}) {
    if (typeof io === 'undefined') {
      console.error('[NetworkService] Socket.io client no encontrado.');
      if (callbacks.onError) callbacks.onError('Librería Socket.io no disponible');
      return;
    }

    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    // 1. Manejo del ciclo de vida de conexión
    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
      if (callbacks.onConnect) callbacks.onConnect(this.socket.id);
    });

    this.socket.on('disconnect', (reason) => {
      if (callbacks.onDisconnect) callbacks.onDisconnect(reason);
    });

    this.socket.on('connect_error', (error) => {
      this.reconnectAttempts++;
      if (callbacks.onReconnectAttempt) {
        callbacks.onReconnectAttempt(this.reconnectAttempts, this.maxReconnectAttempts, error);
      }
    });

    this.socket.io.on('reconnect', (attemptNumber) => {
      if (callbacks.onReconnect) callbacks.onReconnect(attemptNumber);
    });

    this.socket.io.on('reconnect_failed', () => {
      if (callbacks.onReconnectFailed) callbacks.onReconnectFailed();
    });

    // 2. Enrutamiento dinámico de eventos de juego recibidos del servidor
    const gameEvents = [
      'room_created',
      'join_success',
      'join_error',
      'player_joined',
      'player_left',
      'player_disconnected',
      'theme_change',
      'question_started',
      'timer_tick',
      'answer_accepted',
      'answer_rejected',
      'answer_stats_update',
      'question_results',
      'game_finished',
      'host_disconnected',
      'game_paused',
      'game_resumed',
      'question_skipped',
      'answers_force_closed',
      'avatars_list',
    ];

    gameEvents.forEach((eventName) => {
      this.socket.on(eventName, (data) => {
        this.emitLocalEvent(eventName, data);
      });
    });
  }

  /**
   * Suscribe un listener local para un evento del juego.
   * @param {string} eventName
   * @param {Function} callback
   */
  on(eventName, callback) {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, new Set());
    }
    this.eventListeners.get(eventName).add(callback);
  }

  /**
   * Emite un evento a los suscriptores locales.
   * @private
   */
  emitLocalEvent(eventName, data) {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach((fn) => {
        try {
          fn(data);
        } catch (err) {
          console.error(`[NetworkService] Error en listener para "${eventName}":`, err);
        }
      });
    }
  }

  // --- Emisiones salientes hacia el servidor ---

  createRoom(configOptions = {}) {
    return new Promise((resolve) => {
      this.socket.emit('create_room', configOptions, (res) => {
        resolve(res);
      });
    });
  }

  getAvatars() {
    return new Promise((resolve) => {
      this.socket.emit('get_avatars', (res) => {
        resolve(res);
      });
    });
  }

  joinRoom(roomId, name, avatarId = null) {
    return new Promise((resolve) => {
      this.socket.emit('join_room', { roomId, name, avatarId }, (res) => {
        resolve(res);
      });
    });
  }

  startGame(roomId) {
    return new Promise((resolve) => {
      this.socket.emit('start_game', { roomId }, (res) => {
        resolve(res);
      });
    });
  }

  submitAnswer(roomId, answerIndex) {
    return new Promise((resolve) => {
      this.socket.emit('submit_answer', { roomId, answerIndex }, (res) => {
        resolve(res);
      });
    });
  }

  nextQuestion(roomId) {
    return new Promise((resolve) => {
      this.socket.emit('next_question', { roomId }, (res) => {
        resolve(res);
      });
    });
  }

  // Controles de Anfitrión en Partida
  pauseGame(roomId) {
    return new Promise((resolve) => {
      this.socket.emit('pause_game', { roomId }, (res) => {
        resolve(res);
      });
    });
  }

  resumeGame(roomId) {
    return new Promise((resolve) => {
      this.socket.emit('resume_game', { roomId }, (res) => {
        resolve(res);
      });
    });
  }

  skipQuestion(roomId) {
    return new Promise((resolve) => {
      this.socket.emit('skip_question', { roomId }, (res) => {
        resolve(res);
      });
    });
  }

  forceCloseAnswers(roomId) {
    return new Promise((resolve) => {
      this.socket.emit('force_close_answers', { roomId }, (res) => {
        resolve(res);
      });
    });
  }

  getSocketId() {
    return this.socket ? this.socket.id : null;
  }
}

export const network = new NetworkService();
