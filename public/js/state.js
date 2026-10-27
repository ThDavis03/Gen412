/**
 * state.js
 * Implementación formal del patrón State Machine (Máquina de Estados)
 * para orquestar las transiciones del ciclo de vida del juego y mantener
 * el contexto global de la aplicación (incluyendo bloques temáticos, avatares y rachas).
 */

export const GameStates = Object.freeze({
  INIT: 'INIT',
  LOBBY_HOST: 'LOBBY_HOST',
  LOBBY_PLAYER: 'LOBBY_PLAYER',
  QUESTION_ACTIVE: 'QUESTION_ACTIVE',
  QUESTION_RESULTS: 'QUESTION_RESULTS',
  PODIUM: 'PODIUM',
});

export class GameStateMachine {
  constructor() {
    this.currentState = GameStates.INIT;

    // Contexto global del cliente
    this.context = {
      role: null, // 'HOST' | 'PLAYER'
      roomId: null,
      playerName: null,
      avatarId: null,
      avatarMeta: null,
      score: 0,
      streak: 0,
      currentQuestion: null,
      currentTheme: null,
      isPaused: false,
      pausedRemainingMs: null,
      players: [],
      hasAnswered: false,
      selectedOption: null,
      lastAnswerResult: null,
      leaderboard: [],
      isLastQuestion: false,
    };

    // Suscriptores al cambio de estado
    this.listeners = new Set();

    // Matriz de transiciones válidas para garantizar integridad
    this.validTransitions = {
      [GameStates.INIT]: [GameStates.LOBBY_HOST, GameStates.LOBBY_PLAYER],
      [GameStates.LOBBY_HOST]: [GameStates.QUESTION_ACTIVE, GameStates.INIT],
      [GameStates.LOBBY_PLAYER]: [GameStates.QUESTION_ACTIVE, GameStates.INIT],
      [GameStates.QUESTION_ACTIVE]: [GameStates.QUESTION_RESULTS, GameStates.INIT],
      [GameStates.QUESTION_RESULTS]: [GameStates.QUESTION_ACTIVE, GameStates.PODIUM, GameStates.INIT],
      [GameStates.PODIUM]: [GameStates.INIT],
    };
  }

  /**
   * Obtiene el estado actual de la máquina de estados.
   * @returns {string}
   */
  getState() {
    return this.currentState;
  }

  /**
   * Suscribe una función para ser ejecutada ante cada transición de estado.
   * @param {Function} listener
   */
  onStateChange(listener) {
    this.listeners.add(listener);
  }

  /**
   * Ejecuta una transición de estado si es válida según la matriz.
   *
   * @param {string} targetState - Estado destino
   * @param {Object} [payload] - Datos asociados para actualizar el contexto
   * @returns {boolean} true si la transición fue exitosa
   */
  transition(targetState, payload = {}) {
    const allowed = this.validTransitions[this.currentState];

    if (!allowed || !allowed.includes(targetState)) {
      console.warn(
        `[StateMachine] Transición no permitida: "${this.currentState}" -> "${targetState}". Se fuerza solo en reseteos.`
      );
      if (targetState !== GameStates.INIT) {
        return false;
      }
    }

    const previousState = this.currentState;
    this.currentState = targetState;

    this.updateContext(payload);

    console.log(`[StateMachine] 🔄 [${previousState}] ➡️ [${targetState}]`, this.context);

    this.listeners.forEach((listener) => {
      try {
        listener(this.currentState, previousState, this.context);
      } catch (err) {
        console.error('[StateMachine] Error en suscriptor de estado:', err);
      }
    });

    return true;
  }

  /**
   * Actualiza el contexto interno.
   * @param {Object} delta
   */
  updateContext(delta = {}) {
    this.context = {
      ...this.context,
      ...delta,
    };
  }

  /**
   * Reinicia la máquina de estados al punto de partida.
   */
  reset() {
    this.currentState = GameStates.INIT;
    this.context = {
      role: null,
      roomId: null,
      playerName: null,
      avatarId: null,
      avatarMeta: null,
      score: 0,
      streak: 0,
      currentQuestion: null,
      currentTheme: null,
      isPaused: false,
      pausedRemainingMs: null,
      players: [],
      hasAnswered: false,
      selectedOption: null,
      lastAnswerResult: null,
      leaderboard: [],
      isLastQuestion: false,
    };
  }
}

export const stateMachine = new GameStateMachine();
