/**
 * Lógica del Panel Administrativo (Dashboard) — GEN4:12 Quiz
 * Maneja Configuración, Temas y Preguntas (CRUD), Equipos y Control de Partida en vivo.
 */
(function () {
  const state = {
    settings: {
      durationSeconds: 15,
      questionsPerTheme: 5,
      gameMode: 'Estándar',
      playMode: 'teams',
      teamAssignment: 'random',
      teams: [],
      selectedThemeIds: null,
    },
    themes: [],
    questions: [],
    countsByTheme: {},
    totalQuestions: 0,
    rooms: [],
    watchedRoomId: null,
    watchedSnapshot: null,
    socket: null,
  };

  const SECTION_META = {
    configuracion: {
      title: 'Configuración de Partida',
      subtitle: 'Ajusta tiempos dinámicos libres, rondas temáticas y reglas de juego.',
    },
    'temas-preguntas': {
      title: 'Módulo de Temas y Preguntas',
      subtitle: 'Crea nuevos temas, selecciona cuáles participan con checkboxes y administra preguntas en memoria.',
    },
    equipos: {
      title: 'Modo de Juego por Equipos',
      subtitle: 'Personaliza los 4 escuadrones fijos, el modo de asignación y consulta el puntaje global.',
    },
    'control-partida': {
      title: 'Control de Partida en Vivo',
      subtitle: 'Supervisa salas activas, avance de preguntas y el corte automático de 10 segundos.',
    },
  };

  // =========================================================================
  // Utilidades UI
  // =========================================================================

  function showToast(message, type = 'success') {
    const toast = document.getElementById('admin-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className =
      'fixed bottom-6 right-6 z-50 max-w-md px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-semibold transition-all ' +
      (type === 'error'
        ? 'bg-rose-950/95 border-rose-500/50 text-rose-200'
        : 'bg-slate-900/95 border-teal-400/50 text-teal-200');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 3600);
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function isThemeSelected(themeId) {
    const sel = state.settings.selectedThemeIds;
    if (!Array.isArray(sel) || sel.length === 0) return true;
    return sel.includes(themeId);
  }

  function switchTab(tabKey) {
    document.querySelectorAll('.sidebar-btn[data-tab]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabKey);
    });
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      panel.classList.toggle('hidden', panel.id !== `tab-${tabKey}`);
    });
    const meta = SECTION_META[tabKey];
    if (meta) {
      const titleEl = document.getElementById('dashboard-section-title');
      const subEl = document.getElementById('dashboard-section-subtitle');
      if (titleEl) titleEl.textContent = meta.title;
      if (subEl) subEl.textContent = meta.subtitle;
    }
    if (tabKey === 'control-partida') {
      refreshRoomsList();
    }
  }

  // =========================================================================
  // Carga de Estado desde el Backend
  // =========================================================================

  async function fetchAdminState() {
    try {
      const res = await fetch('/admin/state', { credentials: 'same-origin' });
      const data = await res.json();
      if (!data.success) return;

      state.settings = data.settings || state.settings;
      if (data.questionsBank) {
        state.totalQuestions = data.questionsBank.total || 0;
        state.countsByTheme = data.questionsBank.countsByTheme || {};
        state.themes = data.questionsBank.themes || [];
        state.questions = data.questionsBank.questions || [];
      }
      state.rooms = data.rooms || [];

      renderAll();
    } catch (err) {
      console.error('[admin] Error cargando /admin/state:', err);
    }
  }

  function renderAll() {
    renderHeaderStats();
    renderSettingsTab();
    renderThemesAndQuestionsTab();
    renderTeamsTab();
    renderRoomsTab();
  }

  function renderHeaderStats() {
    const durEl = document.getElementById('header-stat-duration');
    const modeEl = document.getElementById('header-stat-mode');
    const teamEl = document.getElementById('header-stat-teams');
    const qBadgeSidebar = document.getElementById('sidebar-total-questions');
    const rBadgeSidebar = document.getElementById('sidebar-active-rooms');

    if (durEl) durEl.textContent = `${state.settings.durationSeconds}s`;
    if (modeEl) modeEl.textContent = state.settings.gameMode;
    if (teamEl) {
      if (state.settings.playMode === 'solo') {
        teamEl.textContent = 'Individual (Solitario)';
      } else {
        teamEl.textContent =
          state.settings.teamAssignment === 'choice' ? 'Equipos (Elección)' : 'Equipos (Aleatoria)';
      }
    }
    if (qBadgeSidebar) qBadgeSidebar.textContent = String(state.totalQuestions);
    if (rBadgeSidebar) rBadgeSidebar.textContent = String(state.rooms.length);
  }

  // =========================================================================
  // Pestaña 1: Configuración
  // =========================================================================

  function renderSettingsTab() {
    const durInput = document.getElementById('setting-duration');
    const qptInput = document.getElementById('setting-questions-per-theme');
    const modeSelect = document.getElementById('setting-game-mode');
    const playModeSelect = document.getElementById('setting-play-mode');
    const teamSelect = document.getElementById('setting-team-assignment');
    const subOptionBox = document.getElementById('team-assignment-suboption-box');
    const totalBadge = document.getElementById('total-questions-badge');
    const summaryContainer = document.getElementById('config-themes-summary');

    const currentPlayMode = state.settings.playMode || 'teams';
    if (durInput) durInput.value = state.settings.durationSeconds;
    if (qptInput) qptInput.value = state.settings.questionsPerTheme;
    if (modeSelect) modeSelect.value = state.settings.gameMode;
    if (playModeSelect) playModeSelect.value = currentPlayMode;
    if (teamSelect) teamSelect.value = state.settings.teamAssignment || 'random';
    if (totalBadge) totalBadge.textContent = `${state.totalQuestions} preguntas`;

    // Resaltar botones de modalidad Individual vs Por Equipos
    document.querySelectorAll('[data-play-mode-btn]').forEach((btn) => {
      const active = btn.dataset.playModeBtn === currentPlayMode;
      btn.className =
        'play-mode-toggle p-4 rounded-xl border text-left transition-all flex items-start gap-3 ' +
        (active
          ? 'bg-gradient-to-r from-purple-900/50 to-teal-900/40 border-purple-400 shadow-lg shadow-purple-500/20'
          : 'bg-slate-900/90 border-slate-800 opacity-75 hover:opacity-100');
    });

    // Mostrar/atenuar la sub-opción de equipos según la modalidad principal
    if (subOptionBox) {
      if (currentPlayMode === 'solo') {
        subOptionBox.classList.add('opacity-50', 'pointer-events-none');
      } else {
        subOptionBox.classList.remove('opacity-50', 'pointer-events-none');
      }
    }

    if (summaryContainer) {
      summaryContainer.innerHTML = state.themes
        .map((t) => {
          const active = isThemeSelected(t.id);
          return `
            <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/90 border ${
              active ? 'border-slate-700' : 'border-slate-800/60 opacity-50'
            }">
              <div class="flex items-center gap-2">
                <span>${escapeHtml(t.icon || '✨')}</span>
                <span class="font-semibold text-white">${escapeHtml(t.theme)}</span>
                <span class="text-[10px] px-2 py-0.5 rounded-full ${
                  active ? 'bg-teal-500/20 text-teal-300' : 'bg-slate-800 text-slate-400'
                }">${active ? 'Activo' : 'Omitido'}</span>
              </div>
              <span class="font-bold text-slate-300">${t.questionCount || 0} preg.</span>
            </div>
          `;
        })
        .join('');
    }
  }

  async function saveSettingsFromForm(showAlert = true) {
    const durInput = document.getElementById('setting-duration');
    const qptInput = document.getElementById('setting-questions-per-theme');
    const modeSelect = document.getElementById('setting-game-mode');
    const playModeSelect = document.getElementById('setting-play-mode');
    const teamSelect = document.getElementById('setting-team-assignment');

    const payload = {
      durationSeconds: Number(durInput ? durInput.value : state.settings.durationSeconds),
      questionsPerTheme: Number(qptInput ? qptInput.value : state.settings.questionsPerTheme),
      gameMode: modeSelect ? modeSelect.value : state.settings.gameMode,
      playMode: playModeSelect ? playModeSelect.value : state.settings.playMode || 'teams',
      teamAssignment: teamSelect ? teamSelect.value : state.settings.teamAssignment,
      selectedThemeIds: getCheckedThemeIds(),
      teams: collectEditedTeams(),
    };

    const res = await fetch('/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'No se pudo guardar la configuración.');
    }

    state.settings = data.settings;
    renderAll();
    if (showAlert) {
      showToast('Configuración actualizada correctamente.');
    }
    return data.settings;
  }

  async function launchHostGame() {
    try {
      await saveSettingsFromForm(false);
      window.location.href = '/quiz?adminHost=1';
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  // =========================================================================
  // Pestaña 2: Temas y Preguntas (Checkboxes + Crear Tema + CRUD)
  // =========================================================================

  function renderThemesAndQuestionsTab() {
    const checkboxList = document.getElementById('themes-checkbox-list');
    const filterSelect = document.getElementById('questions-filter-theme');
    const modalThemeSelect = document.getElementById('q-form-theme');

    if (checkboxList) {
      checkboxList.innerHTML = state.themes
        .map((t) => {
          const checked = isThemeSelected(t.id) ? 'checked' : '';
          return `
            <div class="flex items-center justify-between p-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition">
              <label class="flex items-center gap-3 cursor-pointer flex-1">
                <input
                  type="checkbox"
                  class="theme-participate-checkbox w-4 h-4 accent-purple-500 rounded"
                  value="${escapeHtml(t.id)}"
                  ${checked}
                />
                <span class="w-3 h-3 rounded-full" style="background:${escapeHtml(t.color || '#a855f7')}"></span>
                <div>
                  <div class="text-xs font-bold text-white">${escapeHtml(t.icon || '✨')} ${escapeHtml(t.theme)}</div>
                  <div class="text-[11px] text-slate-400">${t.questionCount || 0} preguntas</div>
                </div>
              </label>
              ${
                !t.builtin
                  ? `<button type="button" data-delete-theme="${escapeHtml(t.id)}" class="text-xs text-rose-400 hover:text-rose-300 font-bold px-2 py-1" title="Eliminar tema">✕</button>`
                  : `<span class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400">Base</span>`
              }
            </div>
          `;
        })
        .join('');
    }

    const currentFilter = filterSelect ? filterSelect.value : '';
    if (filterSelect) {
      filterSelect.innerHTML =
        `<option value="">Todos los temas (${state.questions.length})</option>` +
        state.themes
          .map(
            (t) =>
              `<option value="${escapeHtml(t.id)}" ${currentFilter === t.id ? 'selected' : ''}>${escapeHtml(
                t.icon || '✨'
              )} ${escapeHtml(t.theme)} (${t.questionCount || 0})</option>`
          )
          .join('');
    }

    if (modalThemeSelect) {
      modalThemeSelect.innerHTML = state.themes
        .map((t) => `<option value="${escapeHtml(t.theme)}">${escapeHtml(t.icon || '✨')} ${escapeHtml(t.theme)}</option>`)
        .join('');
    }

    renderQuestionsList();
  }

  function getCheckedThemeIds() {
    const boxes = Array.from(document.querySelectorAll('.theme-participate-checkbox'));
    if (boxes.length === 0) return state.settings.selectedThemeIds;
    const checked = boxes.filter((b) => b.checked).map((b) => b.value);
    return checked;
  }

  function renderQuestionsList() {
    const container = document.getElementById('questions-crud-list');
    const filterSelect = document.getElementById('questions-filter-theme');
    if (!container) return;

    const filterThemeId = filterSelect ? filterSelect.value : '';
    const filtered = filterThemeId
      ? state.questions.filter((q) => q.themeId === filterThemeId)
      : state.questions;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
          No hay preguntas registradas para este filtro. Haz clic en <strong>"+ Nueva Pregunta"</strong>.
        </div>
      `;
      return;
    }

    container.innerHTML = filtered
      .map((q) => {
        const optionsHtml = (q.options || [])
          .map((opt, idx) => {
            const isCorrect = idx === Number(q.correctIndex ?? q.correctAnswer);
            return `
              <span class="px-2.5 py-1 rounded-lg text-[11px] ${
                isCorrect
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'bg-slate-800/80 text-slate-300'
              }">
                ${isCorrect ? '✓ ' : ''}${escapeHtml(opt)}
              </span>
            `;
          })
          .join('');

        return `
          <div class="p-4 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition space-y-2.5">
            <div class="flex items-start justify-between gap-3">
              <div class="space-y-1">
                <span class="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  ${escapeHtml(q.theme)}
                </span>
                <h4 class="text-sm font-bold text-white">${escapeHtml(q.question)}</h4>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  data-edit-question="${q.id}"
                  class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-teal-300 transition"
                >
                  Editar
                </button>
                <button
                  type="button"
                  data-delete-question="${q.id}"
                  class="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-xs font-semibold text-rose-300 transition"
                >
                  Eliminar
                </button>
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5">${optionsHtml}</div>
          </div>
        `;
      })
      .join('');
  }

  function openQuestionModal(questionObj = null) {
    const modal = document.getElementById('question-modal');
    const title = document.getElementById('question-modal-title');
    const idInput = document.getElementById('q-form-id');
    const themeSelect = document.getElementById('q-form-theme');
    const textInput = document.getElementById('q-form-text');

    if (!modal) return;
    if (questionObj) {
      title.textContent = `Editar Pregunta #${questionObj.id}`;
      idInput.value = String(questionObj.id);
      themeSelect.value = questionObj.theme;
      textInput.value = questionObj.question;
      (questionObj.options || []).forEach((opt, i) => {
        const el = document.getElementById(`q-opt-${i}`);
        if (el) el.value = opt;
      });
      const correctIdx = Number(questionObj.correctIndex ?? questionObj.correctAnswer ?? 0);
      const radio = document.querySelector(`input[name="qCorrectIndex"][value="${correctIdx}"]`);
      if (radio) radio.checked = true;
    } else {
      title.textContent = 'Nueva Pregunta';
      idInput.value = '';
      textInput.value = '';
      for (let i = 0; i < 4; i++) {
        const el = document.getElementById(`q-opt-${i}`);
        if (el) el.value = '';
      }
      const radio0 = document.querySelector('input[name="qCorrectIndex"][value="0"]');
      if (radio0) radio0.checked = true;
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function closeQuestionModal() {
    const modal = document.getElementById('question-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  // =========================================================================
  // Pestaña 3: Equipos (4 Equipos Fijos + Puntajes Globales)
  // =========================================================================

  function renderTeamsTab() {
    const grid = document.getElementById('teams-edit-grid');
    const teams = state.settings.teams || [];

    // Sincronizar botones del toggle Aleatoria / Por Elección
    document.querySelectorAll('[data-team-mode-btn]').forEach((btn) => {
      const isCurrent = btn.dataset.teamModeBtn === (state.settings.teamAssignment || 'random');
      btn.className =
        'team-mode-toggle px-3.5 py-1.5 rounded-lg text-xs font-bold transition ' +
        (isCurrent
          ? 'bg-gradient-to-r from-purple-600 to-teal-500 text-white shadow'
          : 'text-slate-400 hover:text-white');
    });

    if (grid) {
      grid.innerHTML = teams
        .map(
          (team) => `
          <div class="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3" style="border-top: 3px solid ${escapeHtml(
            team.color
          )}">
            <div class="flex items-center justify-between">
              <span class="text-2xl">${escapeHtml(team.emoji)}</span>
              <span class="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                ${escapeHtml(team.animal)}
              </span>
            </div>
            <div>
              <label class="block text-[11px] uppercase font-semibold text-slate-400 mb-1">
                Animal / Emblema
              </label>
              <input
                type="text"
                data-team-animal="${escapeHtml(team.id)}"
                value="${escapeHtml(team.animal)}"
                maxlength="20"
                class="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white"
              />
            </div>
            <div>
              <label class="block text-[11px] uppercase font-semibold text-slate-400 mb-1">
                Nombre del Equipo
              </label>
              <input
                type="text"
                data-team-name="${escapeHtml(team.id)}"
                value="${escapeHtml(team.name)}"
                maxlength="30"
                required
                class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        `
        )
        .join('');
    }

    renderLiveTeamsScoreboard();
  }

  function collectEditedTeams() {
    const current = state.settings.teams || [];
    return current.map((t) => {
      const nameInput = document.querySelector(`[data-team-name="${t.id}"]`);
      const animalInput = document.querySelector(`[data-team-animal="${t.id}"]`);
      return {
        id: t.id,
        name: nameInput ? nameInput.value.trim() || t.name : t.name,
        animal: animalInput ? animalInput.value.trim() || t.animal : t.animal,
      };
    });
  }

  function renderLiveTeamsScoreboard() {
    const container = document.getElementById('teams-live-scoreboard');
    const badge = document.getElementById('teams-live-room-badge');
    if (!container) return;

    const teamsData =
      (state.watchedSnapshot && state.watchedSnapshot.teams) ||
      (state.settings.teams || []).map((t) => ({ ...t, score: 0, memberCount: 0 }));

    if (badge) {
      badge.textContent = state.watchedSnapshot
        ? `Sala activa: ${state.watchedSnapshot.roomId}`
        : 'Mostrando equipos configurados (sin sala en curso)';
    }

    container.innerHTML = teamsData
      .map(
        (t, idx) => `
        <div class="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span class="text-2xl">${escapeHtml(t.emoji)}</span>
            <div>
              <div class="text-xs font-bold text-slate-400">#${idx + 1} • ${escapeHtml(t.animal)}</div>
              <div class="text-sm font-extrabold text-white">${escapeHtml(t.name)}</div>
              <div class="text-[11px] text-slate-400">${t.memberCount || 0} integrantes</div>
            </div>
          </div>
          <div class="text-right">
            <div class="text-lg font-black font-heading" style="color:${escapeHtml(t.color || '#a855f7')}">
              ${t.score || 0}
            </div>
            <div class="text-[10px] uppercase text-slate-400">pts</div>
          </div>
        </div>
      `
      )
      .join('');
  }

  // =========================================================================
  // Pestaña 4: Control de Partida en Vivo (Socket.io)
  // =========================================================================

  function initAdminSocket() {
    if (typeof io !== 'function') return;
    const socket = io({ withCredentials: true });
    state.socket = socket;

    socket.on('connect', () => {
      refreshRoomsList();
    });

    const refreshWatch = () => {
      if (state.watchedRoomId) {
        watchRoom(state.watchedRoomId);
      }
      refreshRoomsList();
    };

    socket.on('player_joined', refreshWatch);
    socket.on('player_left', refreshWatch);
    socket.on('player_disconnected', refreshWatch);
    socket.on('teams_update', refreshWatch);
    socket.on('question_started', () => {
      hideIntermissionBanner();
      refreshWatch();
    });
    socket.on('question_results', refreshWatch);
    socket.on('game_finished', () => {
      hideIntermissionBanner();
      refreshWatch();
    });

    socket.on('answer_stats_update', (data) => {
      const ansEl = document.getElementById('live-answered-count');
      const actEl = document.getElementById('live-active-count');
      if (ansEl && data.answeredCount !== undefined) ansEl.textContent = String(data.answeredCount);
      if (actEl && data.totalActive !== undefined) actEl.textContent = String(data.totalActive);
    });

    socket.on('intermission_started', (data) => {
      const banner = document.getElementById('live-intermission-banner');
      const secEl = document.getElementById('live-intermission-seconds');
      if (banner) banner.classList.remove('hidden');
      if (secEl) secEl.textContent = `${Math.ceil((data.durationMs || 10000) / 1000)}s`;
    });

    socket.on('intermission_tick', (data) => {
      const secEl = document.getElementById('live-intermission-seconds');
      if (secEl) secEl.textContent = `${Math.ceil((data.remainingMs || 0) / 1000)}s`;
    });
  }

  function hideIntermissionBanner() {
    const banner = document.getElementById('live-intermission-banner');
    if (banner) banner.classList.add('hidden');
  }

  function refreshRoomsList() {
    if (!state.socket) return;
    state.socket.emit('admin_list_rooms', (res) => {
      if (res && res.success) {
        state.rooms = res.rooms || [];
        renderHeaderStats();
        renderRoomsTab();
        if (!state.watchedRoomId && state.rooms.length > 0) {
          watchRoom(state.rooms[0].roomId);
        }
      }
    });
  }

  function watchRoom(roomId) {
    if (!state.socket || !roomId) return;
    state.watchedRoomId = roomId;
    state.socket.emit('admin_watch_room', { roomId }, (res) => {
      if (res && res.success && res.snapshot) {
        state.watchedSnapshot = res.snapshot;
        renderWatchedRoom();
        renderLiveTeamsScoreboard();
      }
    });
  }

  function renderRoomsTab() {
    const listEl = document.getElementById('admin-rooms-list');
    if (!listEl) return;

    if (state.rooms.length === 0) {
      listEl.innerHTML = `
        <div class="md:col-span-3 p-6 rounded-xl bg-slate-900/70 border border-slate-800 text-center text-xs text-slate-400">
          No hay salas activas en este momento. Usa el botón <strong>"🚀 Iniciar Host de Partida"</strong> para crear una sala.
        </div>
      `;
      const panel = document.getElementById('watched-room-panel');
      if (panel) panel.classList.add('hidden');
      return;
    }

    listEl.innerHTML = state.rooms
      .map((r) => {
        const isWatched = state.watchedRoomId === r.roomId;
        return `
          <div class="p-4 rounded-xl bg-slate-900/90 border ${
            isWatched ? 'border-teal-400' : 'border-slate-800'
          } flex items-center justify-between">
            <div>
              <div class="text-lg font-black font-heading text-teal-400">${escapeHtml(r.roomId)}</div>
              <div class="text-xs text-slate-400">${escapeHtml(r.status)} • ${r.totalPlayers} jugadores</div>
            </div>
            <button
              type="button"
              data-watch-room="${escapeHtml(r.roomId)}"
              class="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-xs font-bold text-purple-200 transition"
            >
              ${isWatched ? 'Observando' : 'Controlar'}
            </button>
          </div>
        `;
      })
      .join('');
  }

  function renderWatchedRoom() {
    const panel = document.getElementById('watched-room-panel');
    const snap = state.watchedSnapshot;
    if (!panel || !snap) return;

    panel.classList.remove('hidden');
    document.getElementById('live-room-pin').textContent = snap.roomId;
    document.getElementById('live-room-status').textContent = snap.status;
    document.getElementById('live-answered-count').textContent = String(snap.answeredCount || 0);
    document.getElementById('live-active-count').textContent = String(snap.totalActive || 0);
    document.getElementById('live-players-total').textContent = String(snap.totalPlayers || 0);

    const qTitle = document.getElementById('live-room-question-title');
    if (qTitle) {
      qTitle.textContent = snap.currentQuestion
        ? `[${snap.currentQuestion.theme || 'Tema'}] ${snap.currentQuestion.question}`
        : 'Sala en espera de iniciar o en pantalla de resultados.';
    }

    const playersList = document.getElementById('live-players-list');
    if (playersList) {
      playersList.innerHTML = (snap.players || [])
        .map(
          (p) => `
          <div class="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
            <div class="flex items-center gap-2">
              <span>${escapeHtml(p.teamEmoji || '🛡️')}</span>
              <div>
                <div class="font-bold text-white">${escapeHtml(p.name)}</div>
                <div class="text-[10px] text-slate-400">${escapeHtml(p.teamName || '')}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="font-bold text-teal-300">${p.score} pts</div>
              <div class="text-[10px] ${p.hasAnswered ? 'text-emerald-400' : 'text-slate-500'}">
                ${p.hasAnswered ? '✓ Respondió' : 'Pendiente'}
              </div>
            </div>
          </div>
        `
        )
        .join('');
    }
  }

  function emitRoomControl(eventName) {
    if (!state.socket || !state.watchedRoomId) {
      showToast('Selecciona primero una sala activa.', 'error');
      return;
    }
    state.socket.emit(eventName, { roomId: state.watchedRoomId }, (res) => {
      if (res && res.success === false) {
        showToast(res.message || res.error || 'Acción rechazada.', 'error');
      } else {
        watchRoom(state.watchedRoomId);
      }
    });
  }

  // =========================================================================
  // Event Listeners
  // =========================================================================

  document.addEventListener('DOMContentLoaded', () => {
    // Navegación del Sidebar
    document.querySelectorAll('.sidebar-btn[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Presets rápidos de tiempo
    document.querySelectorAll('[data-duration-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('setting-duration');
        if (input) input.value = btn.dataset.durationPreset;
      });
    });

    // Guardar configuración
    const settingsForm = document.getElementById('admin-settings-form');
    if (settingsForm) {
      settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await saveSettingsFromForm(true);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Botones de Iniciar Host
    ['btn-launch-host', 'btn-sidebar-launch-host', 'btn-control-launch-host'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', launchHostGame);
    });

    // Subir archivo JSON con Multer
    const uploadBtn = document.getElementById('btn-upload-json');
    if (uploadBtn) {
      uploadBtn.addEventListener('click', async () => {
        const fileInput = document.getElementById('json-file-input');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
          showToast('Selecciona un archivo .json primero.', 'error');
          return;
        }
        const formData = new FormData();
        formData.append('questionsFile', fileInput.files[0]);

        try {
          const res = await fetch('/admin/upload', {
            method: 'POST',
            credentials: 'same-origin',
            body: formData,
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.message || 'Error al subir archivo JSON.');
          }
          showToast(data.message || 'Banco de preguntas actualizado.');
          await fetchAdminState();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Guardar selección de temas (checkboxes)
    const saveThemesBtn = document.getElementById('btn-save-theme-selection');
    if (saveThemesBtn) {
      saveThemesBtn.addEventListener('click', async () => {
        try {
          const selectedThemeIds = getCheckedThemeIds();
          const res = await fetch('/admin/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ selectedThemeIds }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.message);
          state.settings = data.settings;
          renderAll();
          showToast('Temas participantes guardados.');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Crear nuevo tema
    const createThemeForm = document.getElementById('create-theme-form');
    if (createThemeForm) {
      createThemeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameEl = document.getElementById('new-theme-name');
        const iconEl = document.getElementById('new-theme-icon');
        const colorEl = document.getElementById('new-theme-color');
        try {
          const res = await fetch('/admin/themes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              theme: nameEl.value.trim(),
              icon: iconEl.value.trim() || '✨',
              color: colorEl.value || '#38bdf8',
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.message);
          nameEl.value = '';
          showToast(data.message || 'Tema creado.');
          await fetchAdminState();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Eliminar tema personalizado
    const checkboxList = document.getElementById('themes-checkbox-list');
    if (checkboxList) {
      checkboxList.addEventListener('click', async (e) => {
        const delBtn = e.target.closest('[data-delete-theme]');
        if (!delBtn) return;
        const themeId = delBtn.dataset.deleteTheme;
        try {
          const res = await fetch(`/admin/themes/${encodeURIComponent(themeId)}`, {
            method: 'DELETE',
            credentials: 'same-origin',
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.message);
          showToast('Tema eliminado.');
          await fetchAdminState();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Filtro y acciones CRUD de preguntas
    const filterSelect = document.getElementById('questions-filter-theme');
    if (filterSelect) {
      filterSelect.addEventListener('change', renderQuestionsList);
    }

    const openQBtn = document.getElementById('btn-open-question-modal');
    if (openQBtn) openQBtn.addEventListener('click', () => openQuestionModal(null));
    const closeQBtn = document.getElementById('btn-close-question-modal');
    if (closeQBtn) closeQBtn.addEventListener('click', closeQuestionModal);
    const cancelQBtn = document.getElementById('btn-cancel-question-modal');
    if (cancelQBtn) cancelQBtn.addEventListener('click', closeQuestionModal);

    const questionsList = document.getElementById('questions-crud-list');
    if (questionsList) {
      questionsList.addEventListener('click', async (e) => {
        const editBtn = e.target.closest('[data-edit-question]');
        if (editBtn) {
          const qId = Number(editBtn.dataset.editQuestion);
          const found = state.questions.find((q) => q.id === qId);
          if (found) openQuestionModal(found);
          return;
        }
        const delBtn = e.target.closest('[data-delete-question]');
        if (delBtn) {
          const qId = Number(delBtn.dataset.deleteQuestion);
          try {
            const res = await fetch(`/admin/questions/${qId}`, {
              method: 'DELETE',
              credentials: 'same-origin',
            });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message);
            showToast('Pregunta eliminada de memoria.');
            await fetchAdminState();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    }

    const questionForm = document.getElementById('question-crud-form');
    if (questionForm) {
      questionForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const qId = document.getElementById('q-form-id').value.trim();
        const theme = document.getElementById('q-form-theme').value;
        const question = document.getElementById('q-form-text').value.trim();
        const options = [
          document.getElementById('q-opt-0').value.trim(),
          document.getElementById('q-opt-1').value.trim(),
          document.getElementById('q-opt-2').value.trim(),
          document.getElementById('q-opt-3').value.trim(),
        ];
        const checkedRadio = document.querySelector('input[name="qCorrectIndex"]:checked');
        const correctIndex = checkedRadio ? Number(checkedRadio.value) : 0;

        try {
          const url = qId ? `/admin/questions/${qId}` : '/admin/questions';
          const method = qId ? 'PUT' : 'POST';
          const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({ theme, question, options, correctIndex }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.message);
          closeQuestionModal();
          showToast(data.message || 'Pregunta guardada en memoria.');
          await fetchAdminState();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Modalidad Principal: Individual (Solitario) vs Por Equipos
    document.querySelectorAll('[data-play-mode-btn]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const pMode = btn.dataset.playModeBtn;
        const playSelect = document.getElementById('setting-play-mode');
        if (playSelect) playSelect.value = pMode;
        state.settings.playMode = pMode;
        renderSettingsTab();
        try {
          await saveSettingsFromForm(true);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    const playModeSelectEl = document.getElementById('setting-play-mode');
    if (playModeSelectEl) {
      playModeSelectEl.addEventListener('change', () => {
        state.settings.playMode = playModeSelectEl.value;
        renderSettingsTab();
      });
    }

    const teamAssignmentSelectEl = document.getElementById('setting-team-assignment');
    if (teamAssignmentSelectEl) {
      teamAssignmentSelectEl.addEventListener('change', () => {
        state.settings.teamAssignment = teamAssignmentSelectEl.value;
        renderTeamsTab();
      });
    }

    // Equipos: Toggle de asignación y guardado de nombres
    document.querySelectorAll('[data-team-mode-btn]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const mode = btn.dataset.teamModeBtn;
        const selectEl = document.getElementById('setting-team-assignment');
        if (selectEl) selectEl.value = mode;
        state.settings.teamAssignment = mode;
        try {
          await saveSettingsFromForm(true);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    const teamsForm = document.getElementById('teams-edit-form');
    if (teamsForm) {
      teamsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await saveSettingsFromForm(true);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    // Control de Partida
    const refreshRoomsBtn = document.getElementById('btn-refresh-rooms');
    if (refreshRoomsBtn) refreshRoomsBtn.addEventListener('click', refreshRoomsList);

    const roomsList = document.getElementById('admin-rooms-list');
    if (roomsList) {
      roomsList.addEventListener('click', (e) => {
        const watchBtn = e.target.closest('[data-watch-room]');
        if (watchBtn) watchRoom(watchBtn.dataset.watchRoom);
      });
    }

    const bindCtrl = (id, ev) => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', () => emitRoomControl(ev));
    };
    bindCtrl('ctrl-btn-start', 'start_game');
    bindCtrl('ctrl-btn-next', 'next_question');
    bindCtrl('ctrl-btn-pause', 'pause_game');
    bindCtrl('ctrl-btn-resume', 'resume_game');
    bindCtrl('ctrl-btn-force-close', 'force_close_answers');
    bindCtrl('ctrl-btn-skip', 'skip_question');
    bindCtrl('ctrl-btn-close-room', 'admin_close_room');

    fetchAdminState();
    initAdminSocket();
  });
})();
