/**
 * ui.js
 * Capa pura de presentación y manipulación del DOM con enfoque en
 * micro-interacciones, animaciones fluidas, avatares vectoriales SVG,
 * tematización dinámica por taller y celebración con confeti.
 */

import { SVG_AVATARS, getAvatarSvg } from './avatars.js';
import { confetti } from './confetti.js';

export class UIManager {
  constructor() {
    this.elements = {};
    this.timerAnimationId = null;
    this.timerStartTime = 0;
    this.timerTotalMs = 20000;
    this.timerCircumference = 2 * Math.PI * 54;
    this.selectedAvatarId = 'avatar_1';
  }

  /**
   * Inicializa referencias del DOM y vincula eventos de UI iniciales.
   */
  init() {
    this.cacheElements();
    this.setupViewTransitions();
  }

  cacheElements() {
    this.elements = {
      // Alerta de red y overlay de pausa
      networkBanner: document.getElementById('networkBanner'),
      networkBannerText: document.getElementById('networkBannerText'),
      gamePausedOverlay: document.getElementById('gamePausedOverlay'),

      // Vistas principales
      viewInit: document.getElementById('viewInit'),
      viewHostLobby: document.getElementById('viewHostLobby'),
      viewHostGame: document.getElementById('viewHostGame'),
      viewHostResults: document.getElementById('viewHostResults'),
      viewHostPodium: document.getElementById('viewHostPodium'),

      viewPlayerLobby: document.getElementById('viewPlayerLobby'),
      viewPlayerGame: document.getElementById('viewPlayerGame'),
      viewPlayerResults: document.getElementById('viewPlayerResults'),
      viewPlayerPodium: document.getElementById('viewPlayerPodium'),

      // Inicio: Jugador y Pre-Lobby Host
      btnShowCreateRoom: document.getElementById('btnShowCreateRoom'),
      btnShowJoinRoom: document.getElementById('btnShowJoinRoom'),
      hostCreateBox: document.getElementById('hostCreateBox'),
      playerJoinBox: document.getElementById('playerJoinBox'),
      inputRoomId: document.getElementById('inputRoomId'),
      inputPlayerName: document.getElementById('inputPlayerName'),
      avatarSelectorGrid: document.getElementById('avatarSelectorGrid'),
      selectQuestionDuration: document.getElementById('selectQuestionDuration'),
      selectQuestionsPerTheme: document.getElementById('selectQuestionsPerTheme'),
      btnSubmitJoin: document.getElementById('btnSubmitJoin'),
      btnSubmitCreate: document.getElementById('btnSubmitCreate'),
      joinErrorMessage: document.getElementById('joinErrorMessage'),

      // Host Lobby & QR
      hostRoomPinDisplay: document.getElementById('hostRoomPinDisplay'),
      hostPlayersCount: document.getElementById('hostPlayersCount'),
      hostPlayersGrid: document.getElementById('hostPlayersGrid'),
      btnHostStartGame: document.getElementById('btnHostStartGame'),
      hostQrCodeContainer: document.getElementById('hostQrCodeContainer'),
      hostJoinUrlLabel: document.getElementById('hostJoinUrlLabel'),

      // Host Game (Pregunta Activa & Bloque Temático)
      themeBannerHost: document.getElementById('themeBannerHost'),
      hostThemeIcon: document.getElementById('hostThemeIcon'),
      hostThemeName: document.getElementById('hostThemeName'),
      hostThemeCounter: document.getElementById('hostThemeCounter'),
      hostQuestionNumber: document.getElementById('hostQuestionNumber'),
      hostQuestionText: document.getElementById('hostQuestionText'),
      hostTimerSeconds: document.getElementById('hostTimerSeconds'),
      hostTimerProgressCircle: document.getElementById('hostTimerProgressCircle'),
      hostAnswersCounter: document.getElementById('hostAnswersCounter'),
      hostOptionsPreview: document.getElementById('hostOptionsPreview'),

      // Controles en partida (Host)
      btnHostPauseGame: document.getElementById('btnHostPauseGame'),
      pauseBtnText: document.getElementById('pauseBtnText'),
      btnHostSkipQuestion: document.getElementById('btnHostSkipQuestion'),
      btnHostForceClose: document.getElementById('btnHostForceClose'),

      // Host Results (Gráficas CSS)
      hostResultsQuestionText: document.getElementById('hostResultsQuestionText'),
      hostBarsContainer: document.getElementById('hostBarsContainer'),
      btnHostNextQuestion: document.getElementById('btnHostNextQuestion'),
      hostMiniLeaderboard: document.getElementById('hostMiniLeaderboard'),

      // Host Podium
      hostPodiumStages: document.getElementById('hostPodiumStages'),
      hostFullLeaderboard: document.getElementById('hostFullLeaderboard'),
      btnHostPlayAgain: document.getElementById('btnHostPlayAgain'),

      // Player Lobby & Avatares
      playerLobbyRoomPin: document.getElementById('playerLobbyRoomPin'),
      playerLobbyName: document.getElementById('playerLobbyName'),
      playerLobbyAvatar: document.getElementById('playerLobbyAvatar'),

      // Player Game (Grid 2x2 Móvil & Tema)
      themeBannerPlayer: document.getElementById('themeBannerPlayer'),
      playerThemeIcon: document.getElementById('playerThemeIcon'),
      playerThemeName: document.getElementById('playerThemeName'),
      playerStreakBadge: document.getElementById('playerStreakBadge'),
      playerGameMeta: document.getElementById('playerGameMeta'),
      playerGridButtons: document.getElementById('playerGridButtons'),
      playerOptionBtns: document.querySelectorAll('.player-btn'),
      playerAnswerLockedOverlay: document.getElementById('playerAnswerLockedOverlay'),
      playerTimerBar: document.getElementById('playerTimerBar'),

      // Player Results & Podium
      playerResultCard: document.getElementById('playerResultCard'),
      playerResultIcon: document.getElementById('playerResultIcon'),
      playerResultTitle: document.getElementById('playerResultTitle'),
      playerResultScoreBadge: document.getElementById('playerResultScoreBadge'),
      playerStreakFeedback: document.getElementById('playerStreakFeedback'),
      playerPodiumRank: document.getElementById('playerPodiumRank'),
      playerPodiumScore: document.getElementById('playerPodiumScore'),
      btnPlayerPlayAgain: document.getElementById('btnPlayerPlayAgain'),
    };
  }

  setupViewTransitions() {
    if (this.elements.hostTimerProgressCircle) {
      this.elements.hostTimerProgressCircle.style.strokeDasharray = `${this.timerCircumference}`;
      this.elements.hostTimerProgressCircle.style.strokeDashoffset = '0';
    }
  }

  switchView(targetView) {
    const allViews = [
      this.elements.viewInit,
      this.elements.viewHostLobby,
      this.elements.viewHostGame,
      this.elements.viewHostResults,
      this.elements.viewHostPodium,
      this.elements.viewPlayerLobby,
      this.elements.viewPlayerGame,
      this.elements.viewPlayerResults,
      this.elements.viewPlayerPodium,
    ];

    allViews.forEach((view) => {
      if (view) {
        view.classList.remove('active');
        view.classList.add('hidden');
      }
    });

    if (targetView) {
      targetView.classList.remove('hidden');
      void targetView.offsetWidth;
      targetView.classList.add('active');
    }
  }

  // =========================================================================
  // Manejo de Alertas de Red y Pausa
  // =========================================================================

  showNetworkAlert(type, message) {
    const banner = this.elements.networkBanner;
    const text = this.elements.networkBannerText;
    if (!banner || !text) return;

    banner.className = `network-banner ${type}`;
    text.textContent = message;
    banner.classList.remove('hidden');
  }

  hideNetworkAlert() {
    const banner = this.elements.networkBanner;
    if (banner) {
      banner.classList.add('hidden');
    }
  }

  setGamePausedUI(isPaused) {
    if (this.elements.gamePausedOverlay) {
      if (isPaused) {
        this.elements.gamePausedOverlay.classList.remove('hidden');
      } else {
        this.elements.gamePausedOverlay.classList.add('hidden');
      }
    }
    if (this.elements.pauseBtnText) {
      this.elements.pauseBtnText.textContent = isPaused ? 'Reanudar' : 'Pausar';
    }
  }

  showJoinError(msg) {
    if (this.elements.joinErrorMessage) {
      this.elements.joinErrorMessage.textContent = msg;
      this.elements.joinErrorMessage.classList.remove('hidden');
    }
  }

  clearJoinError() {
    if (this.elements.joinErrorMessage) {
      this.elements.joinErrorMessage.classList.add('hidden');
      this.elements.joinErrorMessage.textContent = '';
    }
  }

  // =========================================================================
  // 1. Tematización Dinámica por Taller (Variables CSS :root)
  // =========================================================================

  /**
   * Actualiza las variables CSS nativas (:root) para modificar el fondo animado
   * y paleta según el taller activo recibido en 'theme_change'.
   *
   * @param {Object} themeData
   * @param {string} themeName
   * @param {number} idxInTheme
   * @param {number} totalInTheme
   */
  applyTheme(themeData, themeName, idxInTheme = 1, totalInTheme = 5) {
    if (!themeData) return;

    const root = document.documentElement;
    const themeId = themeData.id || themeData.key || 'profesion';
    root.setAttribute('data-theme', themeId);

    // Ajuste directo de variables nativas CSS (:root) según paleta neón del evento sobre #0f172a
    switch (themeId) {
      case 'profesion':
        // Púrpura Neón (#a855f7)
        root.style.setProperty('--theme-bg-1', '#0f172a');
        root.style.setProperty('--theme-bg-2', '#1e1b4b');
        root.style.setProperty('--theme-primary', '#a855f7');
        root.style.setProperty('--theme-accent', '#c084fc');
        root.style.setProperty('--theme-glow', 'rgba(168, 85, 247, 0.42)');
        root.style.setProperty('--theme-text-shadow', '0 0 18px rgba(168, 85, 247, 0.8), 0 0 36px rgba(168, 85, 247, 0.35)');
        root.style.setProperty('--theme-box-shadow', '0 0 28px rgba(168, 85, 247, 0.5), 0 0 56px rgba(168, 85, 247, 0.22)');
        break;

      case 'noviazgo':
        // Rosa Neón (#ec4899)
        root.style.setProperty('--theme-bg-1', '#0f172a');
        root.style.setProperty('--theme-bg-2', '#3b0726');
        root.style.setProperty('--theme-primary', '#ec4899');
        root.style.setProperty('--theme-accent', '#f472b6');
        root.style.setProperty('--theme-glow', 'rgba(236, 72, 153, 0.42)');
        root.style.setProperty('--theme-text-shadow', '0 0 18px rgba(236, 72, 153, 0.8), 0 0 36px rgba(236, 72, 153, 0.35)');
        root.style.setProperty('--theme-box-shadow', '0 0 28px rgba(236, 72, 153, 0.5), 0 0 56px rgba(236, 72, 153, 0.22)');
        break;

      case 'ministerio':
        // Amarillo Neón (#facc15)
        root.style.setProperty('--theme-bg-1', '#0f172a');
        root.style.setProperty('--theme-bg-2', '#2e2306');
        root.style.setProperty('--theme-primary', '#facc15');
        root.style.setProperty('--theme-accent', '#fde047');
        root.style.setProperty('--theme-glow', 'rgba(250, 204, 21, 0.4)');
        root.style.setProperty('--theme-text-shadow', '0 0 18px rgba(250, 204, 21, 0.8), 0 0 36px rgba(250, 204, 21, 0.35)');
        root.style.setProperty('--theme-box-shadow', '0 0 28px rgba(250, 204, 21, 0.5), 0 0 56px rgba(250, 204, 21, 0.22)');
        break;

      case 'emociones':
        // Teal / Turquesa Neón (#2dd4bf)
        root.style.setProperty('--theme-bg-1', '#0f172a');
        root.style.setProperty('--theme-bg-2', '#042f2e');
        root.style.setProperty('--theme-primary', '#2dd4bf');
        root.style.setProperty('--theme-accent', '#5eead4');
        root.style.setProperty('--theme-glow', 'rgba(45, 212, 191, 0.42)');
        root.style.setProperty('--theme-text-shadow', '0 0 18px rgba(45, 212, 191, 0.8), 0 0 36px rgba(45, 212, 191, 0.35)');
        root.style.setProperty('--theme-box-shadow', '0 0 28px rgba(45, 212, 191, 0.5), 0 0 56px rgba(45, 212, 191, 0.22)');
        break;

      default:
        root.style.setProperty('--theme-bg-1', '#0f172a');
        root.style.setProperty('--theme-bg-2', '#1e1b4b');
        root.style.setProperty('--theme-primary', '#a855f7');
        root.style.setProperty('--theme-accent', '#c084fc');
        root.style.setProperty('--theme-glow', 'rgba(168, 85, 247, 0.38)');
        root.style.setProperty('--theme-text-shadow', '0 0 18px rgba(168, 85, 247, 0.75), 0 0 36px rgba(168, 85, 247, 0.35)');
        root.style.setProperty('--theme-box-shadow', '0 0 28px rgba(168, 85, 247, 0.45), 0 0 56px rgba(168, 85, 247, 0.2)');
    }

    // Banners en UI
    if (this.elements.hostThemeIcon) this.elements.hostThemeIcon.textContent = themeData.icon || '🎯';
    if (this.elements.hostThemeName) this.elements.hostThemeName.textContent = themeName || themeData.name;
    if (this.elements.hostThemeCounter) this.elements.hostThemeCounter.textContent = `(${idxInTheme} de ${totalInTheme})`;

    if (this.elements.playerThemeIcon) this.elements.playerThemeIcon.textContent = themeData.icon || '🎯';
    if (this.elements.playerThemeName) this.elements.playerThemeName.textContent = themeData.shortName || themeName;
  }

  // =========================================================================
  // 2. Avatares SVG, Código QR y Lobby del Host (Pop-in con Rebote Elástico)
  // =========================================================================

  /**
   * Genera dinámicamente el código QR gigante centrado en el Lobby del Host
   * apuntando a window.location.origin con resplandor neón púrpura.
   */
  renderLobbyQRCode() {
    const qrContainer = this.elements.hostQrCodeContainer;
    const urlLabel = this.elements.hostJoinUrlLabel;
    const targetUrl = window.location.origin;

    if (urlLabel) {
      urlLabel.textContent = targetUrl;
    }

    if (!qrContainer) return;
    qrContainer.innerHTML = '';

    if (typeof window.QRCode === 'function') {
      new window.QRCode(qrContainer, {
        text: targetUrl,
        width: 240,
        height: 240,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel ? window.QRCode.CorrectLevel.H : 2,
      });
    } else {
      qrContainer.innerHTML = `<div style="width:240px;height:240px;display:flex;align-items:center;justify-content:center;color:#0f172a;font-weight:700;padding:16px;text-align:center;">${this.escapeHtml(targetUrl)}</div>`;
    }
  }

  /**
   * Renderiza el selector de avatares con vectores SVG estilo flat.
   * @param {Array<Object>} [avatars]
   * @param {Function} [onSelect]
   */
  renderAvatarSelector(avatars = null, onSelect) {
    const container = this.elements.avatarSelectorGrid;
    if (!container) return;

    const list = Array.isArray(avatars) && avatars.length > 0 ? avatars : SVG_AVATARS;
    container.innerHTML = '';

    list.forEach((avatar) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `avatar-item ${avatar.id === this.selectedAvatarId ? 'active' : ''}`;
      item.setAttribute('data-id', avatar.id);

      const svgMarkup = getAvatarSvg(avatar.id);

      item.innerHTML = `
        <div class="avatar-svg-thumb" style="width: 38px; height: 38px;">${svgMarkup}</div>
        <span class="avatar-title">${this.escapeHtml(avatar.name)}</span>
      `;

      item.addEventListener('click', () => {
        container.querySelectorAll('.avatar-item').forEach((i) => i.classList.remove('active'));
        item.classList.add('active');
        this.selectedAvatarId = avatar.id;
        if (typeof onSelect === 'function') {
          onSelect(avatar);
        }
      });

      container.appendChild(item);
    });
  }

  renderHostLobby(roomId, players = []) {
    // Establecer el color base del primer tema (Púrpura Neón #a855f7) al entrar al Lobby
    this.applyTheme({ id: 'profesion', icon: '💼', name: 'Profesión (¿Y ahora qué?)' }, 'Profesión (¿Y ahora qué?)', 1, 5);

    if (this.elements.hostRoomPinDisplay) {
      this.elements.hostRoomPinDisplay.textContent = roomId;
    }
    this.renderLobbyQRCode();
    this.renderPlayerTags(players);
  }

  /**
   * Renderizado de alto rendimiento con DocumentFragment.
   * Aplica animación 'pop-in' con rebote elástico a cada participante acompañado de su avatar SVG.
   *
   * @param {Array<Object>} players
   */
  renderPlayerTags(players = []) {
    const container = this.elements.hostPlayersGrid;
    if (!container) return;

    if (this.elements.hostPlayersCount) {
      this.elements.hostPlayersCount.textContent = players.length;
    }

    if (this.elements.btnHostStartGame) {
      this.elements.btnHostStartGame.disabled = players.length === 0;
      this.elements.btnHostStartGame.textContent =
        players.length > 0
          ? `Iniciar Partida (${players.length} listos)`
          : 'Esperando jugadores... (Mínimo 1)';
    }

    if (players.length === 0) {
      container.innerHTML = '<p class="empty-state">Los jugadores aparecerán aquí al ingresar el código...</p>';
      return;
    }

    const fragment = document.createDocumentFragment();

    players.forEach((player) => {
      const chip = document.createElement('div');
      chip.className = `player-tag pop-in-elastic ${!player.isActive ? 'disconnected' : ''}`;
      chip.setAttribute('data-socket-id', player.socketId);

      const avatarSvg = getAvatarSvg(player.avatarId);
      const streakBadge = player.streak > 1 ? `<span class="chip-streak">🔥${player.streak}</span>` : '';

      chip.innerHTML = `
        <span class="tag-avatar-svg">${avatarSvg}</span>
        <span class="tag-name">${this.escapeHtml(player.name)}</span>
        ${streakBadge}
      `;

      fragment.appendChild(chip);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
  }

  // =========================================================================
  // 3. Animaciones In-Game (Slide-down, Staggered Fade-in y Flash + Vibrate)
  // =========================================================================

  /**
   * Prepara la pantalla del host con animación de entrada (Slide-down de pregunta y staggered en opciones).
   * @param {Object} questionData
   */
  prepareQuestionHost(questionData) {
    if (this.elements.hostQuestionText) {
      this.elements.hostQuestionText.classList.remove('slide-down-active');
      void this.elements.hostQuestionText.offsetWidth; // Reflow forzoso para reiniciar animación
      this.elements.hostQuestionText.classList.add('slide-down-active');
      this.elements.hostQuestionText.textContent = questionData.question;
    }

    if (this.elements.hostOptionsPreview) {
      const shapes = ['▲', '◆', '●', '■'];
      this.elements.hostOptionsPreview.innerHTML = questionData.options
        .map(
          (opt, i) => `
          <div class="option-tag opt-${i} stagger-in" style="--stagger: ${i};">
            <span class="shape">${shapes[i]}</span>
            <span class="text">${this.escapeHtml(opt)}</span>
          </div>`
        )
        .join('');
    }
  }

  preparePlayerQuestion(questionData, currentStreak = 0) {
    if (this.elements.playerGameMeta) {
      this.elements.playerGameMeta.textContent = `Pregunta ${questionData.index + 1} de ${questionData.totalQuestions}`;
    }

    if (this.elements.playerStreakBadge) {
      this.elements.playerStreakBadge.textContent = `🔥 Racha: ${currentStreak}`;
    }

    if (this.elements.playerGridButtons) {
      this.elements.playerGridButtons.classList.remove('locked');
      this.elements.playerGridButtons.style.pointerEvents = 'auto';
    }

    if (this.elements.playerAnswerLockedOverlay) {
      this.elements.playerAnswerLockedOverlay.classList.add('hidden');
    }

    this.elements.playerOptionBtns.forEach((btn, i) => {
      btn.disabled = false;
      btn.classList.remove('selected', 'dimmed', 'correct-ans', 'wrong-ans');
      btn.style.setProperty('--stagger', i);
      btn.classList.add('stagger-in');
    });

    if (this.elements.playerTimerBar) {
      this.elements.playerTimerBar.style.width = '100%';
    }
  }

  /**
   * Bloquea touch y muestra el spinner giratorio de "cargando".
   * @param {number} selectedIndex
   */
  lockPlayerInput(selectedIndex) {
    if (this.elements.playerGridButtons) {
      this.elements.playerGridButtons.classList.add('locked');
      this.elements.playerGridButtons.style.pointerEvents = 'none';
    }

    this.elements.playerOptionBtns.forEach((btn, idx) => {
      if (idx === selectedIndex) {
        btn.classList.add('selected');
      } else {
        btn.classList.add('dimmed');
      }
    });

    if (this.elements.playerAnswerLockedOverlay) {
      this.elements.playerAnswerLockedOverlay.classList.remove('hidden');
    }
  }

  /**
   * Al revelar resultado: flash en toda la pantalla (verde/rojo) y vibración háptica.
   *
   * @param {boolean} isCorrect
   * @param {number} pointsAwarded
   * @param {number} currentScore
   * @param {number} streak
   */
  renderPlayerRoundResult(isCorrect, pointsAwarded, currentScore, streak = 0) {
    const card = this.elements.playerResultCard;
    const icon = this.elements.playerResultIcon;
    const title = this.elements.playerResultTitle;
    const badge = this.elements.playerResultScoreBadge;
    const streakFeedback = this.elements.playerStreakFeedback;

    if (!card) return;

    // Flash en pantalla completa y vibración del navegador
    if (isCorrect) {
      document.body.classList.add('flash-screen-green');
      setTimeout(() => document.body.classList.remove('flash-screen-green'), 800);

      // Vibración rítmica de acierto (API navigator.vibrate)
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate([100, 50, 120]);
        } catch (_) {}
      }

      card.className = 'result-feedback-card correct-feedback';
      icon.textContent = '🎉';
      title.textContent = '¡Correcto!';
      badge.textContent = `+${pointsAwarded} pts (Total: ${currentScore})`;

      if (streakFeedback) {
        streakFeedback.textContent = streak > 1 ? `🔥 ¡Racha de ${streak} aciertos seguidos!` : '🔥 ¡Excelente comienzo!';
        streakFeedback.className = 'streak-feedback active';
      }
    } else {
      document.body.classList.add('flash-screen-red');
      setTimeout(() => document.body.classList.remove('flash-screen-red'), 800);

      // Vibración continua de error
      if ('vibrate' in navigator) {
        try {
          navigator.vibrate(280);
        } catch (_) {}
      }

      card.className = 'result-feedback-card wrong-feedback';
      icon.textContent = '❌';
      title.textContent = '¡Incorrecto!';
      badge.textContent = `+0 pts (Total: ${currentScore})`;

      if (streakFeedback) {
        streakFeedback.textContent = 'Racha reiniciada a 0';
        streakFeedback.className = 'streak-feedback reset';
      }
    }
  }

  // =========================================================================
  // 4. Gráficas (Crecimiento Fluido Y=0) y Podio Secuencial con Confeti
  // =========================================================================

  /**
   * Las barras de opciones elegidas crecen desde Y=0 hacia arriba con ease-out-cubic.
   * @param {Object} resultsData
   * @param {Array<string>} options
   */
  renderResultsBars(resultsData, options = []) {
    const container = this.elements.hostBarsContainer;
    if (!container) return;

    const { correctAnswer, optionCounts = [0, 0, 0, 0], optionPercentages = [0, 0, 0, 0] } = resultsData;

    container.innerHTML = '';

    const colors = [
      { name: 'red', shape: '▲' },
      { name: 'blue', shape: '◆' },
      { name: 'yellow', shape: '●' },
      { name: 'green', shape: '■' },
    ];

    options.forEach((optText, index) => {
      const count = optionCounts[index] || 0;
      const percentage = optionPercentages[index] || 0;
      const isCorrect = index === correctAnswer;
      const colorMeta = colors[index % 4];

      const barColumn = document.createElement('div');
      barColumn.className = `chart-column ${colorMeta.name} ${isCorrect ? 'correct-option' : ''}`;

      barColumn.innerHTML = `
        <div class="chart-stats">
          <span class="chart-count">${count}</span>
          <span class="chart-percent">${percentage}%</span>
        </div>
        <div class="chart-bar-wrapper">
          <div class="chart-bar-fill" style="height: 0%"></div>
        </div>
        <div class="chart-label">
          <span class="chart-shape">${colorMeta.shape}</span>
          <span class="chart-opt-text">${this.escapeHtml(optText)}</span>
          ${isCorrect ? '<span class="correct-badge">✓</span>' : ''}
        </div>
      `;

      container.appendChild(barColumn);

      // Crecimiento fluido desde Y=0 hacia arriba con curva ease-out-cubic
      requestAnimationFrame(() => {
        const fill = barColumn.querySelector('.chart-bar-fill');
        if (fill) {
          fill.style.height = `${Math.max(percentage, 4)}%`;
        }
      });
    });

    if (this.elements.hostMiniLeaderboard && Array.isArray(resultsData.leaderboard)) {
      this.elements.hostMiniLeaderboard.innerHTML = resultsData.leaderboard
        .slice(0, 5)
        .map(
          (p, i) => `
          <li class="mini-rank-item">
            <span class="rank-pos">#${i + 1}</span>
            <span class="tag-avatar-svg" style="width:24px; height:24px;">${getAvatarSvg(p.avatarId)}</span>
            <span class="rank-name">${this.escapeHtml(p.name)}</span>
            <span class="rank-score">${p.score} pts</span>
          </li>`
        )
        .join('');
    }

    if (this.elements.btnHostNextQuestion) {
      this.elements.btnHostNextQuestion.textContent = resultsData.isLastQuestion
        ? 'Ver Podio Final 🏆'
        : 'Siguiente Pregunta ➡️';
    }
  }

  /**
   * Renderiza el podio final secuencialmente:
   * 1) Aparece el 3er lugar (0.1s).
   * 2) Aparece el 2do lugar (0.7s).
   * 3) Salta el 1er lugar desde abajo (1.3s) y activa lluvia de confeti.
   *
   * @param {Array<Object>} leaderboard
   */
  renderPodium(leaderboard = []) {
    const stagesContainer = this.elements.hostPodiumStages;
    const fullListContainer = this.elements.hostFullLeaderboard;
    if (!stagesContainer || !fullListContainer) return;

    stagesContainer.innerHTML = '';
    fullListContainer.innerHTML = '';

    const top3 = leaderboard.slice(0, 3);
    const podiumOrder = [
      { rank: 3, item: top3[2], stepClass: 'step-3', label: '3º' },
      { rank: 2, item: top3[1], stepClass: 'step-2', label: '2º' },
      { rank: 1, item: top3[0], stepClass: 'step-1', label: '1º' },
    ];

    podiumOrder.forEach((pos) => {
      if (pos.item) {
        const step = document.createElement('div');
        step.className = `podium-step ${pos.stepClass}`;
        const avatarSvg = getAvatarSvg(pos.item.avatarId);

        step.innerHTML = `
          <div class="podium-avatar-box" style="width: 58px; height: 58px; margin: 0 auto 8px;">
            ${avatarSvg}
          </div>
          <div class="podium-name">${this.escapeHtml(pos.item.name)}</div>
          <div class="podium-score">${pos.item.score} pts</div>
          <div class="podium-pillar">${pos.label}</div>
        `;
        stagesContainer.appendChild(step);
      }
    });

    // Lanzar ráfaga de confeti cuando el 1er lugar termina su salto triunfal
    setTimeout(() => {
      confetti.burst(160);
    }, 1400);

    fullListContainer.innerHTML = leaderboard
      .map(
        (p, i) => `
        <li class="full-rank-item">
          <span class="pos">#${i + 1}</span>
          <span class="tag-avatar-svg" style="width: 26px; height: 26px;">${getAvatarSvg(p.avatarId)}</span>
          <span class="name">${this.escapeHtml(p.name)}</span>
          <span class="score">${p.score} pts</span>
        </li>`
      )
      .join('');
  }

  renderPlayerFinalPodium(myRank, myScore) {
    if (this.elements.playerPodiumRank) {
      this.elements.playerPodiumRank.textContent = `#${myRank}`;
    }
    if (this.elements.playerPodiumScore) {
      this.elements.playerPodiumScore.textContent = `${myScore} pts`;
    }
    // Confeti también en el celular del jugador si quedó en el top 3
    if (myRank <= 3) {
      setTimeout(() => confetti.burst(100), 500);
    }
  }

  // =========================================================================
  // Temporizador Circular SVG Sincronizado
  // =========================================================================

  startCircularTimer(startTime, totalDurationMs) {
    this.stopCircularTimer();
    this.timerStartTime = startTime;
    this.timerTotalMs = totalDurationMs;

    const animate = () => {
      const elapsed = Date.now() - this.timerStartTime;
      const remaining = Math.max(0, this.timerTotalMs - elapsed);
      this.updateTimerVisual(remaining, this.timerTotalMs);

      if (remaining > 0) {
        this.timerAnimationId = requestAnimationFrame(animate);
      } else {
        this.updateTimerVisual(0, this.timerTotalMs);
      }
    };

    this.timerAnimationId = requestAnimationFrame(animate);
  }

  resyncTimerWithTick(remainingMs, totalDurationMs) {
    this.timerTotalMs = totalDurationMs;
    this.timerStartTime = Date.now() - (totalDurationMs - remainingMs);
    this.updateTimerVisual(remainingMs, totalDurationMs);
  }

  updateTimerVisual(remainingMs, totalDurationMs) {
    const ratio = Math.max(0, Math.min(1, remainingMs / totalDurationMs));
    const offset = this.timerCircumference * (1 - ratio);

    if (this.elements.hostTimerProgressCircle) {
      this.elements.hostTimerProgressCircle.style.strokeDashoffset = `${offset}`;
    }

    if (this.elements.hostTimerSeconds) {
      const secondsLeft = Math.ceil(remainingMs / 1000);
      this.elements.hostTimerSeconds.textContent = secondsLeft;
    }
  }

  stopCircularTimer() {
    if (this.timerAnimationId) {
      cancelAnimationFrame(this.timerAnimationId);
      this.timerAnimationId = null;
    }
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const ui = new UIManager();
