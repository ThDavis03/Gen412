/**
 * app.js
 * Orquestador principal que conecta la Máquina de Estados, la Capa de Red
 * y la Capa de UI (DOM), gestionando bloques temáticos, avatares y controles del host.
 */

import { network } from './network.js';
import { ui } from './ui.js';
import { stateMachine, GameStates } from './state.js';
import { getAvatarSvg } from './avatars.js';

class AppController {
  constructor() {
    this.avatarsList = [];
    this.selectedAvatarId = null;
    this.init();
  }

  async init() {
    // 1. Inicializar UI del DOM
    ui.init();

    // 2. Conectar la Máquina de Estados con la UI
    this.setupStateMachineListeners();

    // 3. Inicializar la Capa de Red con manejo de reconexión y alertas
    this.setupNetworkLifecycle();

    // 4. Suscribir eventos del juego provenientes de Socket.io
    this.setupGameSocketEvents();

    // 5. Vincular interacción del usuario (Botones, Clicks, Teclado)
    this.setupUserInteractions();

    // 6. Cargar catálogo de avatares disponibles
    this.loadAvatars();

    // Iniciar en estado inicial
    stateMachine.transition(GameStates.INIT);
  }

  async loadAvatars() {
    try {
      ui.renderAvatarSelector(null, (avatar) => {
        this.selectedAvatarId = avatar.id;
      });
      const res = await network.getAvatars();
      if (res && Array.isArray(res.avatars)) {
        this.avatarsList = res.avatars;
      }
    } catch (err) {
      console.warn('[App] No se pudieron cargar los avatares dinámicos:', err);
    }
  }

  // =========================================================================
  // 1. Conexión StateMachine -> UI
  // =========================================================================
  setupStateMachineListeners() {
    stateMachine.onStateChange((targetState, previousState, context) => {
      switch (targetState) {
        case GameStates.INIT:
          ui.switchView(ui.elements.viewInit);
          ui.clearJoinError();
          document.body.style.background = '';
          break;

        case GameStates.LOBBY_HOST:
          ui.switchView(ui.elements.viewHostLobby);
          ui.renderHostLobby(context.roomId, context.players);
          break;

        case GameStates.LOBBY_PLAYER:
          ui.switchView(ui.elements.viewPlayerLobby);
          if (ui.elements.playerLobbyRoomPin) {
            ui.elements.playerLobbyRoomPin.textContent = context.roomId;
          }
          if (ui.elements.playerLobbyName) {
            ui.elements.playerLobbyName.textContent = context.playerName;
          }
          if (ui.elements.playerLobbyAvatar && context.avatarId) {
            ui.elements.playerLobbyAvatar.innerHTML = `<div style="width: 54px; height: 54px;">${getAvatarSvg(context.avatarId)}</div>`;
          }
          break;

        case GameStates.QUESTION_ACTIVE:
          if (context.role === 'HOST') {
            ui.switchView(ui.elements.viewHostGame);
            ui.setGamePausedUI(false);

            if (ui.elements.hostQuestionNumber) {
              ui.elements.hostQuestionNumber.textContent = `Pregunta ${context.currentQuestion.index + 1} de ${context.currentQuestion.totalQuestions}`;
            }
            if (ui.elements.hostAnswersCounter) {
              ui.elements.hostAnswersCounter.textContent = 'Respuestas: 0';
            }

            // Aplicar tema en pantalla del Host
            if (context.currentQuestion.themeData) {
              ui.applyTheme(
                context.currentQuestion.themeData,
                context.currentQuestion.themeName,
                context.currentQuestion.questionIndexInTheme,
                context.currentQuestion.totalQuestionsInTheme
              );
            }

            // Entrada animada: Slide-down de pregunta y staggered cards
            ui.prepareQuestionHost(context.currentQuestion);

            // Iniciar temporizador circular SVG
            ui.startCircularTimer(context.currentQuestion.startTime, context.currentQuestion.durationMs);
          } else {
            // Modo Jugador
            ui.switchView(ui.elements.viewPlayerGame);
            ui.setGamePausedUI(false);

            if (context.currentQuestion.themeData) {
              ui.applyTheme(
                context.currentQuestion.themeData,
                context.currentQuestion.themeName,
                context.currentQuestion.questionIndexInTheme,
                context.currentQuestion.totalQuestionsInTheme
              );
            }

            ui.preparePlayerQuestion(context.currentQuestion, context.streak);
          }
          break;

        case GameStates.QUESTION_RESULTS:
          if (context.role === 'HOST') {
            ui.stopCircularTimer();
            ui.switchView(ui.elements.viewHostResults);
            if (ui.elements.hostResultsQuestionText && context.currentQuestion) {
              ui.elements.hostResultsQuestionText.textContent = context.currentQuestion.question;
            }
            ui.renderResultsBars(context.resultsData, context.currentQuestion ? context.currentQuestion.options : []);
          } else {
            // Modo Jugador
            ui.switchView(ui.elements.viewPlayerResults);
            const isCorrect = context.lastAnswerResult ? context.lastAnswerResult.isCorrect : false;
            const points = context.lastAnswerResult ? context.lastAnswerResult.pointsAwarded : 0;
            const currentStreak = context.lastAnswerResult ? (context.lastAnswerResult.streak || 0) : context.streak;
            ui.renderPlayerRoundResult(isCorrect, points, context.score, currentStreak);
          }
          break;

        case GameStates.PODIUM:
          if (context.role === 'HOST') {
            ui.switchView(ui.elements.viewHostPodium);
            ui.renderPodium(context.leaderboard);
          } else {
            ui.switchView(ui.elements.viewPlayerPodium);
            const myRankIndex = context.leaderboard.findIndex((p) => p.name === context.playerName);
            const myRank = myRankIndex !== -1 ? myRankIndex + 1 : '-';
            ui.renderPlayerFinalPodium(myRank, context.score);
          }
          break;
      }
    });
  }

  // =========================================================================
  // 2. Ciclo de Vida de Red & Alertas
  // =========================================================================
  setupNetworkLifecycle() {
    network.init({
      onConnect: () => {
        ui.hideNetworkAlert();
      },
      onDisconnect: () => {
        ui.showNetworkAlert('warning', '⚠️ Conexión perdida. Intentando reconectar con el servidor...');
      },
      onReconnectAttempt: (attempt, max) => {
        ui.showNetworkAlert('warning', `⚠️ Reconectando automáticamente... (Intento ${attempt}/${max})`);
      },
      onReconnect: () => {
        ui.showNetworkAlert('success', '✅ Conexión restablecida con el servidor.');
        setTimeout(() => ui.hideNetworkAlert(), 2500);
      },
      onReconnectFailed: () => {
        ui.showNetworkAlert('error', '❌ No fue posible reconectar con el servidor. Por favor recarga la página.');
      },
      onError: (errMsg) => {
        ui.showNetworkAlert('error', `❌ Error de red: ${errMsg}`);
      },
    });
  }

  // =========================================================================
  // 3. Suscripción a Eventos de Socket.io
  // =========================================================================
  setupGameSocketEvents() {
    // Sincronización de participantes en la sala
    network.on('player_joined', (data) => {
      stateMachine.updateContext({ players: data.players });
      if (stateMachine.getState() === GameStates.LOBBY_HOST) {
        ui.renderPlayerTags(data.players);
      }
    });

    network.on('player_left', (data) => {
      stateMachine.updateContext({ players: data.players });
      if (stateMachine.getState() === GameStates.LOBBY_HOST) {
        ui.renderPlayerTags(data.players);
      }
    });

    network.on('player_disconnected', (data) => {
      console.log('[App] Jugador desconectado:', data.name);
    });

    // Evento 'theme_change' para actualizar fondos y colores dinámicamente
    network.on('theme_change', (data) => {
      stateMachine.updateContext({ currentTheme: data });
      ui.applyTheme(data.themeData, data.themeName, data.questionIndexInTheme, data.totalQuestionsInTheme);
    });

    // Inicio de Pregunta
    network.on('question_started', (data) => {
      stateMachine.transition(GameStates.QUESTION_ACTIVE, {
        currentQuestion: data,
        hasAnswered: false,
        selectedOption: null,
        lastAnswerResult: null,
        isPaused: false,
      });
    });

    // Re-sincronización con 'ticks' del servidor
    network.on('timer_tick', (data) => {
      if (stateMachine.getState() === GameStates.QUESTION_ACTIVE && !stateMachine.context.isPaused) {
        if (stateMachine.context.role === 'HOST') {
          ui.resyncTimerWithTick(data.remainingMs, data.totalDurationMs);
        } else {
          if (ui.elements.playerTimerBar) {
            const pct = (data.remainingMs / data.totalDurationMs) * 100;
            ui.elements.playerTimerBar.style.width = `${pct}%`;
          }
        }
      }
    });

    // Contador de respuestas en vivo para el Host
    network.on('answer_stats_update', (data) => {
      if (stateMachine.context.role === 'HOST' && ui.elements.hostAnswersCounter) {
        ui.elements.hostAnswersCounter.textContent = `Respuestas: ${data.answeredCount} / ${data.totalActive}`;
      }
    });

    // Respuestas aceptadas (con cálculo de racha)
    network.on('answer_accepted', (res) => {
      if (stateMachine.context.role === 'PLAYER') {
        const newScore = stateMachine.context.score + (res.pointsAwarded || 0);
        stateMachine.updateContext({
          score: newScore,
          streak: res.streak || 0,
          lastAnswerResult: res,
        });
      }
    });

    // Resultados de la Pregunta
    network.on('question_results', (data) => {
      if (stateMachine.context.role === 'PLAYER') {
        const myEntry = data.leaderboard.find((p) => p.name === stateMachine.context.playerName);
        if (myEntry) {
          stateMachine.updateContext({ score: myEntry.score, streak: myEntry.streak || 0 });
        }
      }

      stateMachine.transition(GameStates.QUESTION_RESULTS, {
        resultsData: data,
        leaderboard: data.leaderboard,
        isLastQuestion: data.isLastQuestion,
      });
    });

    // Controles del Anfitrión: Pausa y Reanudación
    network.on('game_paused', (data) => {
      stateMachine.updateContext({ isPaused: true, pausedRemainingMs: data.remainingMs });
      ui.setGamePausedUI(true);
      ui.stopCircularTimer();
    });

    network.on('game_resumed', (data) => {
      stateMachine.updateContext({ isPaused: false });
      ui.setGamePausedUI(false);
      if (stateMachine.context.role === 'HOST') {
        ui.startCircularTimer(data.startTime, stateMachine.context.currentQuestion.durationMs);
      }
    });

    // Fin de la Partida y Podio
    network.on('game_finished', (data) => {
      stateMachine.transition(GameStates.PODIUM, {
        leaderboard: data.leaderboard,
        podium: data.podium,
      });
    });

    // Desconexión del Host
    network.on('host_disconnected', (data) => {
      alert(data.message || 'La sala ha sido cerrada porque el anfitrión se desconectó.');
      stateMachine.reset();
      stateMachine.transition(GameStates.INIT);
    });
  }

  // =========================================================================
  // 4. Interacciones del Usuario (Eventos DOM)
  // =========================================================================
  setupUserInteractions() {
    // Alternar formulario Host / Jugador
    if (ui.elements.btnShowCreateRoom) {
      ui.elements.btnShowCreateRoom.addEventListener('click', () => {
        ui.elements.btnShowCreateRoom.classList.add('active');
        ui.elements.btnShowJoinRoom.classList.remove('active');
        ui.elements.hostCreateBox.classList.remove('hidden');
        ui.elements.playerJoinBox.classList.add('hidden');
        ui.clearJoinError();
      });
    }

    if (ui.elements.btnShowJoinRoom) {
      ui.elements.btnShowJoinRoom.addEventListener('click', () => {
        ui.elements.btnShowJoinRoom.classList.add('active');
        ui.elements.btnShowCreateRoom.classList.remove('active');
        ui.elements.playerJoinBox.classList.remove('hidden');
        ui.elements.hostCreateBox.classList.add('hidden');
        ui.clearJoinError();
      });
    }

    // Host: Crear Sala con Configuración Pre-Lobby
    if (ui.elements.btnSubmitCreate) {
      ui.elements.btnSubmitCreate.addEventListener('click', async () => {
        ui.elements.btnSubmitCreate.disabled = true;

        const durationSeconds = parseInt(ui.elements.selectQuestionDuration.value, 10) || 20;
        const questionsPerTheme = parseInt(ui.elements.selectQuestionsPerTheme.value, 10) || 3;

        try {
          const res = await network.createRoom({
            durationSeconds,
            questionsPerTheme,
          });

          if (res && res.success) {
            stateMachine.transition(GameStates.LOBBY_HOST, {
              role: 'HOST',
              roomId: res.roomId,
              players: [],
            });
          } else {
            alert('No se pudo crear la sala. Intenta nuevamente.');
          }
        } finally {
          ui.elements.btnSubmitCreate.disabled = false;
        }
      });
    }

    // Jugador: Unirse a Sala con Avatar
    if (ui.elements.btnSubmitJoin) {
      const handleJoin = async () => {
        const roomId = (ui.elements.inputRoomId.value || '').trim().toUpperCase();
        const playerName = (ui.elements.inputPlayerName.value || '').trim();
        const avatarId = this.selectedAvatarId;

        ui.clearJoinError();

        if (!roomId || !playerName) {
          ui.showJoinError('Por favor completa tanto el código de sala como tu nombre.');
          return;
        }

        ui.elements.btnSubmitJoin.disabled = true;

        try {
          const res = await network.joinRoom(roomId, playerName, avatarId);
          if (res && res.success) {
            stateMachine.transition(GameStates.LOBBY_PLAYER, {
              role: 'PLAYER',
              roomId: res.roomId,
              playerName: res.player.name,
              avatarId: res.player.avatarId,
              avatarMeta: res.player.avatarMeta,
              score: res.player.score,
              streak: res.player.streak,
            });
          } else {
            ui.showJoinError(res ? res.message : 'Error desconocido al unirse a la sala.');
          }
        } finally {
          ui.elements.btnSubmitJoin.disabled = false;
        }
      };

      ui.elements.btnSubmitJoin.addEventListener('click', handleJoin);

      [ui.elements.inputRoomId, ui.elements.inputPlayerName].forEach((inp) => {
        if (inp) {
          inp.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') handleJoin();
          });
        }
      });
    }

    // Host: Iniciar Partida
    if (ui.elements.btnHostStartGame) {
      ui.elements.btnHostStartGame.addEventListener('click', async () => {
        ui.elements.btnHostStartGame.disabled = true;
        const res = await network.startGame(stateMachine.context.roomId);
        if (!res || !res.success) {
          alert(res ? res.message : 'Error al iniciar partida');
          ui.elements.btnHostStartGame.disabled = false;
        }
      });
    }

    // Host: Siguiente Pregunta
    if (ui.elements.btnHostNextQuestion) {
      ui.elements.btnHostNextQuestion.addEventListener('click', async () => {
        ui.elements.btnHostNextQuestion.disabled = true;
        await network.nextQuestion(stateMachine.context.roomId);
        ui.elements.btnHostNextQuestion.disabled = false;
      });
    }

    // Controles en partida (Host): Pausar / Reanudar
    if (ui.elements.btnHostPauseGame) {
      ui.elements.btnHostPauseGame.addEventListener('click', async () => {
        const roomId = stateMachine.context.roomId;
        if (stateMachine.context.isPaused) {
          await network.resumeGame(roomId);
        } else {
          await network.pauseGame(roomId);
        }
      });
    }

    // Controles en partida (Host): Saltar Pregunta
    if (ui.elements.btnHostSkipQuestion) {
      ui.elements.btnHostSkipQuestion.addEventListener('click', async () => {
        if (confirm('¿Seguro que deseas saltar esta pregunta para todos?')) {
          await network.skipQuestion(stateMachine.context.roomId);
        }
      });
    }

    // Controles en partida (Host): Forzar Cierre de Respuestas
    if (ui.elements.btnHostForceClose) {
      ui.elements.btnHostForceClose.addEventListener('click', async () => {
        await network.forceCloseAnswers(stateMachine.context.roomId);
      });
    }

    // Jugador: Botones 2x2 de Respuesta
    if (ui.elements.playerOptionBtns) {
      ui.elements.playerOptionBtns.forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          e.preventDefault();

          if (stateMachine.context.hasAnswered || stateMachine.context.isPaused) return;

          const chosenIndex = parseInt(btn.getAttribute('data-index'), 10);

          ui.lockPlayerInput(chosenIndex);
          stateMachine.updateContext({ hasAnswered: true, selectedOption: chosenIndex });

          const res = await network.submitAnswer(stateMachine.context.roomId, chosenIndex);
          if (res && res.success) {
            stateMachine.updateContext({
              score: stateMachine.context.score + (res.pointsAwarded || 0),
              streak: res.streak || 0,
              lastAnswerResult: res,
            });
          }
        });
      });
    }

    // Reiniciar juego
    const handlePlayAgain = () => {
      location.reload();
    };
    if (ui.elements.btnHostPlayAgain) {
      ui.elements.btnHostPlayAgain.addEventListener('click', handlePlayAgain);
    }
    if (ui.elements.btnPlayerPlayAgain) {
      ui.elements.btnPlayerPlayAgain.addEventListener('click', handlePlayAgain);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AppController();
});
