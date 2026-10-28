/**
 * ui.js
 * Capa pura de presentación y manipulación del DOM con enfoque en
 * micro-interacciones, animaciones fluidas, avatares vectoriales SVG,
 * tematización dinámica por taller y celebración con confeti.
 */

import { SVG_AVATARS, DICEBEAR_SEEDS, getDiceBearAvatarUrl, getAvatarSvg } from './avatars.js';
import { confetti } from './confetti.js';

export class UIManager {
  constructor() {
    this.elements = {};
    this.timerAnimationId = null;
    this.timerStartTime = 0;
    this.timerTotalMs = 20000;
    this.timerCircumference = 2 * Math.PI * 54;
    this.selectedAvatarId = 'avatar1';
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

      // Modal de Selección Libre de Avatares (DiceBear)
      avatarModalOverlay: document.getElementById('avatarModalOverlay'),
      btnOpenAvatarModal: document.getElementById('btnOpenAvatarModal'),
      btnCloseAvatarModal: document.getElementById('btnCloseAvatarModal'),
      dicebearModalGrid: document.getElementById('dicebearModalGrid'),

      // Vistas principales
      viewInit: document.getElementById('viewInit'),
      viewHostLobby: document.getElementById('viewHostLobby'),
      viewHostGame: document.getElementById('viewHostGame'),
      viewHostResults: document.getElementById('viewHostResults'),
      viewHostPodium: document.getElementById('viewHostPodium'),

      viewPlayerTeamSelect: document.getElementById('viewPlayerTeamSelect'),
      viewPlayerLobby: document.getElementById('viewPlayerLobby'),
      viewPlayerGame: document.getElementById('viewPlayerGame'),
      viewPlayerResults: document.getElementById('viewPlayerResults'),
      viewPlayerPodium: document.getElementById('viewPlayerPodium'),

      // Inicio: Jugador (PIN + Nombre)
      playerJoinBox: document.getElementById('playerJoinBox'),
      inputRoomId: document.getElementById('inputRoomId'),
      inputPlayerName: document.getElementById('inputPlayerName'),
      btnSubmitJoin: document.getElementById('btnSubmitJoin'),
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
      roundPodiumBanner: document.getElementById('roundPodiumBanner'),
      resultsRankingTitle: document.getElementById('resultsRankingTitle'),
      hostResultsQuestionText: document.getElementById('hostResultsQuestionText'),
      hostBarsContainer: document.getElementById('hostBarsContainer'),
      btnHostNextQuestion: document.getElementById('btnHostNextQuestion'),
      hostTeamsLeaderboard: document.getElementById('hostTeamsLeaderboard'),
      hostMiniLeaderboard: document.getElementById('hostMiniLeaderboard'),

      // Host Podium
      hostWinningTeamBanner: document.getElementById('hostWinningTeamBanner'),
      hostPodiumTeams: document.getElementById('hostPodiumTeams'),
      hostPodiumStages: document.getElementById('hostPodiumStages'),
      hostFullLeaderboard: document.getElementById('hostFullLeaderboard'),
      btnHostPlayAgain: document.getElementById('btnHostPlayAgain'),

      // Player Team Select & Lobby & Avatares
      playerTeamCardsScreenGrid: document.getElementById('playerTeamCardsScreenGrid'),
      playerLobbyRoomPin: document.getElementById('playerLobbyRoomPin'),
      playerLobbyName: document.getElementById('playerLobbyName'),
      playerLobbyAvatar: document.getElementById('playerLobbyAvatar'),
      playerTeamBadge: document.getElementById('playerTeamBadge'),
      btnChangeTeamScreen: document.getElementById('btnChangeTeamScreen'),
      playerInlineAvatarGridBox: document.getElementById('playerInlineAvatarGridBox'),
      playerInlineDicebearGrid: document.getElementById('playerInlineDicebearGrid'),
      playerTeamSelectorBox: document.getElementById('playerTeamSelectorBox'),
      playerTeamsGrid: document.getElementById('playerTeamsGrid'),

      // Player Game (Grid 2x2 Móvil & Tema)
      themeBannerPlayer: document.getElementById('themeBannerPlayer'),
      playerThemeIcon: document.getElementById('playerThemeIcon'),
      playerThemeName: document.getElementById('playerThemeName'),
      playerStreakBadge: document.getElementById('playerStreakBadge'),
      playerGameMeta: document.getElementById('playerGameMeta'),
      playerAnswersCounter: document.getElementById('playerAnswersCounter'),
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
      playerWinningTeamBanner: document.getElementById('playerWinningTeamBanner'),
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
      this.elements.viewPlayerTeamSelect,
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

      default: {
        const customColor = themeData.color || '#a855f7';
        const customAccent = themeData.accentColor || customColor;
        root.style.setProperty('--theme-bg-1', '#0f172a');
        root.style.setProperty('--theme-bg-2', '#1e1b4b');
        root.style.setProperty('--theme-primary', customColor);
        root.style.setProperty('--theme-accent', customAccent);
        root.style.setProperty('--theme-glow', 'rgba(168, 85, 247, 0.38)');
        root.style.setProperty('--theme-text-shadow', `0 0 18px ${customColor}, 0 0 36px rgba(168, 85, 247, 0.35)`);
        root.style.setProperty('--theme-box-shadow', `0 0 28px ${customColor}, 0 0 56px rgba(168, 85, 247, 0.2)`);
      }
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
    const targetUrl = `${window.location.origin}/quiz`;

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
   * Actualiza la imagen del avatar principal del jugador en su pantalla de espera (Lobby).
   * @param {string} seed
   */
  updatePlayerLobbyAvatar(seed = 'avatar1') {
    this.selectedAvatarId = seed;
    const avatarBox = this.elements.playerLobbyAvatar;
    if (!avatarBox) return;

    avatarBox.innerHTML = getAvatarSvg(seed);
    avatarBox.classList.remove('avatar-pop');
    void avatarBox.offsetWidth;
    avatarBox.classList.add('avatar-pop');
  }

  /**
   * Renderiza la pantalla de 4 tarjetas grandes (🦁 León, 🐑 Cordero, 🦅 Águila, 🕊️ Paloma)
   * cuando la partida está configurada como "Elección del Jugador".
   */
  renderTeamSelectionScreen(currentTeamId, teams = [], onSelectTeam = null) {
    const grid = this.elements.playerTeamCardsScreenGrid;
    if (!grid) return;

    const defaultTeams = [
      { id: 'leon', animal: 'León', name: 'Fe Indomable', emoji: '🦁', color: '#f59e0b', memberCount: 0 },
      { id: 'cordero', animal: 'Cordero', name: 'Elegidos', emoji: '🐑', color: '#ec4899', memberCount: 0 },
      { id: 'aguila', animal: 'Águila', name: 'Renovados', emoji: '🦅', color: '#a855f7', memberCount: 0 },
      { id: 'paloma', animal: 'Paloma', name: 'Bajo Sus Alas', emoji: '🕊️', color: '#2dd4bf', memberCount: 0 },
    ];
    const list = Array.isArray(teams) && teams.length > 0 ? teams : defaultTeams;

    grid.innerHTML = list
      .map((t) => {
        const isSelected = t.id === currentTeamId;
        const borderColor = t.color || '#a855f7';
        return `
          <button
            type="button"
            class="team-big-card ${isSelected ? 'selected' : ''}"
            data-big-team-id="${this.escapeHtml(t.id)}"
            style="border-color: ${isSelected ? borderColor : 'rgba(255,255,255,0.14)'}; box-shadow: 0 12px 30px ${borderColor}26;"
          >
            <div class="team-big-emoji">${this.escapeHtml(t.emoji || '🦁')}</div>
            <div class="team-big-animal">${this.escapeHtml(t.animal)}</div>
            <div class="team-big-name" style="color:${borderColor}">${this.escapeHtml(t.name)}</div>
            <span class="team-big-count">${t.memberCount || 0} jugadores</span>
          </button>
        `;
      })
      .join('');

    grid.querySelectorAll('[data-big-team-id]').forEach((card) => {
      card.addEventListener('click', () => {
        const chosenId = card.getAttribute('data-big-team-id');
        if (typeof onSelectTeam === 'function') {
          onSelectTeam(chosenId);
        }
      });
    });
  }

  /**
   * Renderiza la insignia de equipo del jugador y el botón para volver a las 4 tarjetas si el modo es 'choice'.
   * En modo 'solo' ("Individual (Solitario)"), muestra la insignia individual y la cuadrícula de 20 avatares DiceBear.
   */
  renderPlayerTeamLobby(currentTeamId, teams = [], teamAssignment = 'random', onSelectTeam = null, playMode = 'teams', onSelectAvatar = null) {
    if (onSelectTeam) {
      this._onSelectTeamCallback = onSelectTeam;
    }
    const badge = this.elements.playerTeamBadge;
    const changeBtn = this.elements.btnChangeTeamScreen;
    const inlineAvatarBox = this.elements.playerInlineAvatarGridBox;
    const box = this.elements.playerTeamSelectorBox;

    if (playMode === 'solo') {
      if (badge) {
        badge.innerHTML = `👤 <strong>Modo Individual (Solitario)</strong>`;
        badge.style.borderColor = '#a855f7';
      }
      if (changeBtn) {
        changeBtn.classList.add('hidden');
      }
      if (box) {
        box.classList.add('hidden');
      }
      if (inlineAvatarBox) {
        inlineAvatarBox.classList.remove('hidden');
        this.renderInlineDiceBearGrid(this.selectedAvatarId, onSelectAvatar);
      }
      return;
    }

    if (inlineAvatarBox) {
      inlineAvatarBox.classList.add('hidden');
    }

    const myTeam = teams.find((t) => t.id === currentTeamId) || teams[0];
    if (badge && myTeam) {
      badge.innerHTML = `${this.escapeHtml(myTeam.emoji || '🦁')} <strong>${this.escapeHtml(myTeam.animal)}: ${this.escapeHtml(myTeam.name)}</strong>`;
      badge.style.borderColor = myTeam.color || '#a855f7';
    }

    if (changeBtn) {
      if (teamAssignment === 'choice') {
        changeBtn.classList.remove('hidden');
      } else {
        changeBtn.classList.add('hidden');
      }
    }

    if (box) {
      box.classList.add('hidden');
    }
  }

  /**
   * Renderiza la cuadrícula fija de 20 avatares de DiceBear directamente en el Lobby del jugador (Modo Individual).
   */
  renderInlineDiceBearGrid(currentSeed = 'avatar1', onSelectSeed = null) {
    const grid = this.elements.playerInlineDicebearGrid;
    if (!grid) return;

    this.selectedAvatarId = currentSeed || this.selectedAvatarId || 'avatar1';
    grid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    DICEBEAR_SEEDS.forEach((seed) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dicebear-grid-item ${seed === this.selectedAvatarId ? 'selected' : ''}`;
      btn.setAttribute('data-seed', seed);
      btn.setAttribute('aria-label', `Elegir ${seed}`);

      const imgUrl = getDiceBearAvatarUrl(seed);
      btn.innerHTML = `<img src="${imgUrl}" alt="${seed}" class="dicebear-avatar-img" loading="lazy" />`;

      btn.addEventListener('click', () => {
        this.selectedAvatarId = seed;
        this.updatePlayerLobbyAvatar(seed);
        grid.querySelectorAll('.dicebear-grid-item').forEach((item) => {
          item.classList.toggle('selected', item.getAttribute('data-seed') === seed);
        });
        if (typeof onSelectSeed === 'function') {
          onSelectSeed(seed);
        }
      });

      fragment.appendChild(btn);
    });

    grid.appendChild(fragment);
  }

  /**
   * Abre el modal con fondo borroso y genera el grid iterando sobre los 20 seeds fijos
   * ('avatar1', 'avatar2', ..., 'avatar20') usando la API de DiceBear.
   *
   * @param {string} currentSeed
   * @param {Function} onSelectSeed - Callback invocado con el nuevo seed cuando el jugador toca un avatar
   */
  openAvatarModal(currentSeed = 'avatar1', onSelectSeed) {
    const overlay = this.elements.avatarModalOverlay;
    const grid = this.elements.dicebearModalGrid;
    if (!overlay || !grid) return;

    this.selectedAvatarId = currentSeed || this.selectedAvatarId || 'avatar1';
    grid.innerHTML = '';

    const fragment = document.createDocumentFragment();

    DICEBEAR_SEEDS.forEach((seed) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dicebear-grid-item ${seed === this.selectedAvatarId ? 'selected' : ''}`;
      btn.setAttribute('data-seed', seed);
      btn.setAttribute('aria-label', `Elegir ${seed}`);

      const imgUrl = getDiceBearAvatarUrl(seed);
      btn.innerHTML = `<img src="${imgUrl}" alt="${seed}" class="dicebear-avatar-img" loading="lazy" />`;

      btn.addEventListener('click', () => {
        this.selectedAvatarId = seed;
        this.updatePlayerLobbyAvatar(seed);
        this.closeAvatarModal();
        if (typeof onSelectSeed === 'function') {
          onSelectSeed(seed);
        }
      });

      fragment.appendChild(btn);
    });

    grid.appendChild(fragment);
    overlay.classList.remove('hidden');
  }

  /**
   * Cierra el modal de selección de avatares.
   */
  closeAvatarModal() {
    if (this.elements.avatarModalOverlay) {
      this.elements.avatarModalOverlay.classList.add('hidden');
    }
  }

  renderHostLobby(roomId, players = [], teams = [], playMode = 'teams') {
    this._cachedPlayMode = playMode;
    // Establecer el color base del primer tema (Púrpura Neón #a855f7) al entrar al Lobby
    this.applyTheme({ id: 'profesion', icon: '💼', name: 'Profesión (¿Y ahora qué?)' }, 'Profesión (¿Y ahora qué?)', 1, 5);

    if (this.elements.hostRoomPinDisplay) {
      this.elements.hostRoomPinDisplay.textContent = roomId;
    }
    this.renderLobbyQRCode();
    this.renderPlayerTags(players, teams, playMode);
  }

  /**
   * Renderiza a los jugadores agrupados en las 4 columnas de Equipos
   * (🦁 León, 🐑 Cordero, 🦅 Águila, 🕊️ Paloma) en la pantalla del Host,
   * o flotando independientemente con su avatar DiceBear si la partida es 'solo'.
   *
   * @param {Array<Object>} players
   * @param {Array<Object>} [teams]
   * @param {string} [playMode]
   */
  renderPlayerTags(players = [], teams = [], playMode = null) {
    const container = this.elements.hostPlayersGrid;
    if (!container) return;

    if (playMode) {
      this._cachedPlayMode = playMode;
    }
    const activePlayMode = this._cachedPlayMode || 'teams';

    if (Array.isArray(teams) && teams.length > 0) {
      this._cachedTeams = teams;
    }

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

    if (activePlayMode === 'solo') {
      container.className = 'players-grid solo-floating-grid';
      if (players.length === 0) {
        container.innerHTML = '<p class="empty-hint">Los jugadores aparecerán aquí flotando con su avatar de DiceBear...</p>';
        return;
      }
      const soloFragment = document.createDocumentFragment();
      players.forEach((player, idx) => {
        const chip = document.createElement('div');
        chip.className = `player-tag solo-floating-tag pop-in-elastic ${!player.isActive ? 'disconnected' : ''}`;
        chip.style.animationDelay = `${(idx % 6) * 0.35}s`;
        chip.setAttribute('data-socket-id', player.socketId);
        const avatarSvg = getAvatarSvg(player.avatarId);
        const streakBadge = player.streak > 1 ? `<span class="chip-streak">🔥${player.streak}</span>` : '';
        chip.innerHTML = `
          <span class="tag-avatar-svg">${avatarSvg}</span>
          <span class="tag-name">${this.escapeHtml(player.name)}</span>
          ${streakBadge}
        `;
        soloFragment.appendChild(chip);
      });
      container.innerHTML = '';
      container.appendChild(soloFragment);
      return;
    }

    container.className = 'players-grid host-teams-lobby-grid';

    const defaultTeams = [
      { id: 'leon', animal: 'León', name: 'Fe Indomable', emoji: '🦁', color: '#f59e0b' },
      { id: 'cordero', animal: 'Cordero', name: 'Elegidos', emoji: '🐑', color: '#ec4899' },
      { id: 'aguila', animal: 'Águila', name: 'Renovados', emoji: '🦅', color: '#a855f7' },
      { id: 'paloma', animal: 'Paloma', name: 'Bajo Sus Alas', emoji: '🕊️', color: '#2dd4bf' },
    ];
    const teamList = Array.isArray(this._cachedTeams) && this._cachedTeams.length === 4 ? this._cachedTeams : defaultTeams;

    const fragment = document.createDocumentFragment();

    teamList.forEach((team) => {
      const col = document.createElement('div');
      col.className = 'host-team-column';
      col.style.borderTop = `3px solid ${team.color || '#a855f7'}`;

      const teamPlayers = players.filter((p) => p.teamId === team.id);

      const header = document.createElement('div');
      header.className = 'host-team-header';
      header.innerHTML = `
        <div class="host-team-identity">
          <span class="host-team-emoji">${this.escapeHtml(team.emoji || '🦁')}</span>
          <div>
            <div class="host-team-subtitle">${this.escapeHtml(team.animal)}</div>
            <div class="host-team-title" style="color:${this.escapeHtml(team.color || '#fff')}">${this.escapeHtml(team.name)}</div>
          </div>
        </div>
        <span class="host-team-badge-count">${teamPlayers.length}</span>
      `;
      col.appendChild(header);

      const membersBox = document.createElement('div');
      membersBox.className = 'host-team-members';

      if (teamPlayers.length === 0) {
        membersBox.innerHTML = '<p class="host-team-empty">Esperando integrantes...</p>';
      } else {
        teamPlayers.forEach((player) => {
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
          membersBox.appendChild(chip);
        });
      }

      col.appendChild(membersBox);
      fragment.appendChild(col);
    });

    container.innerHTML = '';
    container.appendChild(fragment);
  }

  /**
   * Actualiza en tiempo real el indicador "Han respondido: X de Y jugadores"
   * tanto en la pantalla del Host como en la del Jugador.
   */
  updateLiveAnswersCounter(answeredCount = 0, totalActive = 0) {
    const label = `Han respondido: ${answeredCount} de ${totalActive} jugadores`;
    if (this.elements.hostAnswersCounter) {
      this.elements.hostAnswersCounter.textContent = label;
    }
    if (this.elements.playerAnswersCounter) {
      this.elements.playerAnswersCounter.textContent = label;
    }
  }

  /**
   * Actualiza en tiempo real el avatar de un jugador específico en la pantalla del Host
   * cuando recibe el evento 'avatar_updated'.
   *
   * @param {string} socketId
   * @param {string} newSeed
   * @param {Array<Object>} [players]
   */
  updateHostPlayerAvatarInPlace(socketId, newSeed, players = []) {
    const container = this.elements.hostPlayersGrid;
    if (!container) return;

    const existingTag = container.querySelector(`[data-socket-id="${socketId}"]`);
    if (existingTag) {
      const avatarSpan = existingTag.querySelector('.tag-avatar-svg');
      if (avatarSpan) {
        avatarSpan.innerHTML = getAvatarSvg(newSeed);
      }
      existingTag.classList.remove('pop-in-elastic');
      void existingTag.offsetWidth;
      existingTag.classList.add('pop-in-elastic');
    } else if (Array.isArray(players) && players.length > 0) {
      this.renderPlayerTags(players);
    }
  }

  // =========================================================================
  // 3. Animaciones In-Game (Slide-down, Staggered Fade-in y Flash + Vibrate)
  // =========================================================================

  /**
   * Prepara la pantalla del host con animación de entrada (Slide-down de pregunta y staggered en opciones).
   * @param {Object} questionData
   */
  prepareQuestionHost(questionData) {
    this.updateLiveAnswersCounter(questionData.answeredCount || 0, questionData.totalActive || 0);
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
    this.updateLiveAnswersCounter(questionData.answeredCount || 0, questionData.totalActive || 0);
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

    if (this.elements.roundPodiumBanner) {
      if (resultsData.showRoundPodium) {
        this.elements.roundPodiumBanner.textContent = `🏆 PODIO PARCIAL — FIN DEL BLOQUE: ${resultsData.themeName || ''}`;
        this.elements.roundPodiumBanner.classList.remove('hidden');
        setTimeout(() => confetti.burst(75), 350);
      } else {
        this.elements.roundPodiumBanner.classList.add('hidden');
      }
    }

    const hasTeams = Array.isArray(resultsData.teamLeaderboard) && resultsData.teamLeaderboard.length > 0;

    if (this.elements.resultsRankingTitle) {
      if (resultsData.showRoundPodium) {
        this.elements.resultsRankingTitle.textContent = '🏆 Podio Parcial del Bloque (Top 5)';
      } else {
        this.elements.resultsRankingTitle.textContent = hasTeams
          ? 'Tabla de Líderes & Equipos'
          : 'Tabla de Líderes (Modo Individual)';
      }
    }

    // Marcador global acumulado por equipos (se oculta en Modo Individual)
    if (this.elements.hostTeamsLeaderboard) {
      if (hasTeams) {
        this.elements.hostTeamsLeaderboard.innerHTML = resultsData.teamLeaderboard
          .map(
            (t) => `
            <div style="padding:8px 10px; border-radius:10px; background:rgba(15,23,42,0.75); border:1px solid ${this.escapeHtml(t.color || '#a855f7')}; display:flex; align-items:center; justify-content:space-between; font-size:12px;">
              <span>${this.escapeHtml(t.emoji)} <strong>${this.escapeHtml(t.name)}</strong></span>
              <strong style="color:${this.escapeHtml(t.color || '#a855f7')}">${t.score} pts</strong>
            </div>`
          )
          .join('');
      } else {
        this.elements.hostTeamsLeaderboard.innerHTML = '';
      }
    }

    if (this.elements.hostMiniLeaderboard && Array.isArray(resultsData.leaderboard)) {
      this.elements.hostMiniLeaderboard.innerHTML = resultsData.leaderboard
        .slice(0, 5)
        .map(
          (p, i) => `
          <li class="mini-rank-item">
            <span class="rank-pos">#${i + 1}</span>
            <span class="tag-avatar-svg" style="width:24px; height:24px;">${getAvatarSvg(p.avatarId)}</span>
            <span class="rank-name">${this.escapeHtml(p.name)} ${p.teamEmoji ? `<small>${this.escapeHtml(p.teamEmoji)}</small>` : ''}</span>
            <span class="rank-score">${p.score} pts</span>
          </li>`
        )
        .join('');
    }

    if (this.elements.btnHostNextQuestion) {
      if (resultsData.allAnswered && resultsData.autoAdvanceInMs) {
        const secs = Math.ceil(resultsData.autoAdvanceInMs / 1000);
        this.updateIntermissionCountdown(secs, resultsData.isLastQuestion);
      } else if (resultsData.autoAdvanceInMs && resultsData.autoAdvanceInMs > 0) {
        this.elements.btnHostNextQuestion.textContent = resultsData.isLastQuestion
          ? '⚡ Mostrando Podio Final automáticamente...'
          : '⚡ Modo Rápida: Avanzando automáticamente...';
      } else if (resultsData.isLastQuestion) {
        this.elements.btnHostNextQuestion.textContent = 'Ver Podio Final 🏆';
      } else if (resultsData.gameMode === 'Pausada') {
        this.elements.btnHostNextQuestion.textContent = '⏸️ Avanzar Manualmente a Siguiente Pregunta ➡️';
      } else {
        this.elements.btnHostNextQuestion.textContent = 'Siguiente Pregunta ➡️';
      }
    }
  }

  updateIntermissionCountdown(secondsLeft, isLastQuestion = false) {
    if (this.elements.btnHostNextQuestion) {
      this.elements.btnHostNextQuestion.textContent = isLastQuestion
        ? `⚡ ¡Todos respondieron! Podio Final en ${secondsLeft}s (o clic para avanzar)`
        : `⚡ ¡Todos respondieron! Siguiente pregunta en ${secondsLeft}s ➡️`;
    }
  }

  showHostCreateError(message) {
    const el = this.elements.hostCreateErrorMessage;
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
  }

  clearHostCreateError() {
    const el = this.elements.hostCreateErrorMessage;
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
  }

  /**
   * Renderiza el podio final secuencialmente y se adapta según el modo:
   * - Modo Individual: Muestra los 3 mejores jugadores.
   * - Modo Equipos: Muestra al Equipo Ganador en conjunto y el acumulado global de los 4 equipos.
   *
   * @param {Array<Object>} leaderboard
   * @param {Array<Object>} [teamLeaderboard]
   */
  renderPodium(leaderboard = [], teamLeaderboard = []) {
    const stagesContainer = this.elements.hostPodiumStages;
    const fullListContainer = this.elements.hostFullLeaderboard;
    if (!stagesContainer || !fullListContainer) return;

    stagesContainer.innerHTML = '';
    fullListContainer.innerHTML = '';

    const hasTeams = Array.isArray(teamLeaderboard) && teamLeaderboard.length > 0;

    // Mostrar al Equipo Ganador en Conjunto (solo en Modo Equipos)
    if (this.elements.hostWinningTeamBanner) {
      if (hasTeams) {
        const winningTeam = teamLeaderboard[0];
        const winningMembers = leaderboard
          .filter((p) => p.teamId === winningTeam.id)
          .map((p) => this.escapeHtml(p.name))
          .join(', ');

        this.elements.hostWinningTeamBanner.innerHTML = `
          <div class="winning-team-card" style="border-color:${this.escapeHtml(winningTeam.color || '#facc15')}">
            <span class="winning-team-crown">👑 EQUIPO CAMPEÓN EN CONJUNTO 👑</span>
            <div style="font-size:3.2rem; line-height:1.1; margin:4px 0;">${this.escapeHtml(winningTeam.emoji || '🦁')}</div>
            <div style="font-size:1.35rem; font-weight:900; font-family:var(--font-heading); color:#fff;">
              ${this.escapeHtml(winningTeam.animal)} — "${this.escapeHtml(winningTeam.name)}"
            </div>
            <div style="font-size:1.2rem; font-weight:900; color:${this.escapeHtml(winningTeam.color || '#facc15')}">
              ${winningTeam.score || 0} puntos globales acumulados
            </div>
            ${
              winningMembers
                ? `<div style="font-size:0.82rem; color:#cbd5e1; margin-top:4px;">Integrantes: <strong>${winningMembers}</strong></div>`
                : ''
            }
          </div>
        `;
      } else {
        this.elements.hostWinningTeamBanner.innerHTML = '';
      }
    }

    if (this.elements.hostPodiumTeams) {
      if (hasTeams) {
        this.elements.hostPodiumTeams.innerHTML = teamLeaderboard
          .map(
            (t, i) => `
            <div style="padding:10px 12px; border-radius:12px; background:rgba(15,23,42,0.85); border:1px solid ${this.escapeHtml(t.color || '#a855f7')}; text-align:center;">
              <div style="font-size:18px;">${this.escapeHtml(t.emoji)} <strong style="font-size:12px; color:#cbd5e1;">#${i + 1} ${this.escapeHtml(t.animal)}</strong></div>
              <div style="font-size:13px; font-weight:800; color:#fff;">${this.escapeHtml(t.name)}</div>
              <div style="font-size:14px; font-weight:900; color:${this.escapeHtml(t.color || '#a855f7')}">${t.score} pts</div>
            </div>`
          )
          .join('');
      } else {
        this.elements.hostPodiumTeams.innerHTML = '';
      }
    }

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
          <span class="name">${this.escapeHtml(p.name)} ${p.teamEmoji ? `<small>${this.escapeHtml(p.teamEmoji)}</small>` : ''}</span>
          <span class="score">${p.score} pts</span>
        </li>`
      )
      .join('');
  }

  renderPlayerFinalPodium(myRank, myScore, teamLeaderboard = []) {
    if (this.elements.playerPodiumRank) {
      this.elements.playerPodiumRank.textContent = `#${myRank}`;
    }
    if (this.elements.playerPodiumScore) {
      this.elements.playerPodiumScore.textContent = `${myScore} pts`;
    }
    if (this.elements.playerWinningTeamBanner) {
      if (Array.isArray(teamLeaderboard) && teamLeaderboard.length > 0) {
        const winningTeam = teamLeaderboard[0];
        this.elements.playerWinningTeamBanner.innerHTML = `
          <div style="padding:12px; border-radius:14px; background:rgba(15,23,42,0.9); border:1px solid ${this.escapeHtml(winningTeam.color || '#facc15')}; text-align:center;">
            <div style="font-size:11px; font-weight:800; color:#fde047; text-transform:uppercase;">🏆 Equipo Ganador en Conjunto</div>
            <div style="font-size:24px; margin:2px 0;">${this.escapeHtml(winningTeam.emoji || '🦁')} <strong>${this.escapeHtml(winningTeam.name)}</strong></div>
            <div style="font-size:13px; font-weight:800; color:${this.escapeHtml(winningTeam.color || '#facc15')}">${winningTeam.score || 0} pts globales</div>
          </div>
        `;
      } else {
        this.elements.playerWinningTeamBanner.innerHTML = '';
      }
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
