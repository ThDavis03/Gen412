// Inicializar conexión de Socket.io
const socket = io();

// Estado del cliente local
let currentRole = 'player'; // 'player' | 'host'
let currentRoomId = null;
let myPlayerName = null;
let currentScore = 0;
let questionDuration = 15000;
let questionStartTime = 0;
let timerInterval = null;
let hasSubmittedCurrent = false;

// Elementos del DOM
const connectionBadge = document.getElementById('connectionBadge');
const statusText = document.getElementById('statusText');

// Tabs
const roleTabs = document.querySelectorAll('.role-tab');
const playerTab = document.getElementById('playerTab');
const hostTab = document.getElementById('hostTab');

// Secciones Jugador
const playerJoinSection = document.getElementById('playerJoinSection');
const playerLobbySection = document.getElementById('playerLobbySection');
const playerGameSection = document.getElementById('playerGameSection');
const playerEndSection = document.getElementById('playerEndSection');

const roomInput = document.getElementById('roomInput');
const nameInput = document.getElementById('nameInput');
const btnJoinRoom = document.getElementById('btnJoinRoom');
const playerError = document.getElementById('playerError');

const playerRoomCode = document.getElementById('playerRoomCode');
const playerNameDisplay = document.getElementById('playerNameDisplay');
const playerCurrentScore = document.getElementById('playerCurrentScore');

const playerQuestionIndexBadge = document.getElementById('playerQuestionIndexBadge');
const playerTimerFill = document.getElementById('playerTimerFill');
const playerTimerSeconds = document.getElementById('playerTimerSeconds');
const playerQuestionText = document.getElementById('playerQuestionText');
const playerOptionsGrid = document.getElementById('playerOptionsGrid');
const playerFeedbackBox = document.getElementById('playerFeedbackBox');
const feedbackIcon = document.getElementById('feedbackIcon');
const feedbackTitle = document.getElementById('feedbackTitle');
const feedbackDetail = document.getElementById('feedbackDetail');
const playerFinalScore = document.getElementById('playerFinalScore');
const btnPlayAgain = document.getElementById('btnPlayAgain');

// Secciones Host
const hostCreateSection = document.getElementById('hostCreateSection');
const hostDashboardSection = document.getElementById('hostDashboardSection');
const btnCreateRoom = document.getElementById('btnCreateRoom');
const hostRoomCode = document.getElementById('hostRoomCode');
const hostPlayerCount = document.getElementById('hostPlayerCount');
const hostRoomStatus = document.getElementById('hostRoomStatus');
const btnStartGame = document.getElementById('btnStartGame');
const hostPlayersList = document.getElementById('hostPlayersList');
const hostQuestionMonitor = document.getElementById('hostQuestionMonitor');
const hostQuestionIndex = document.getElementById('hostQuestionIndex');
const hostAnsweredTicker = document.getElementById('hostAnsweredTicker');
const hostCurrentQuestionText = document.getElementById('hostCurrentQuestionText');
const hostOptionsSummary = document.getElementById('hostOptionsSummary');
const hostGameControls = document.getElementById('hostGameControls');
const btnNextQuestion = document.getElementById('btnNextQuestion');
const hostPodiumPanel = document.getElementById('hostPodiumPanel');
const hostPodiumList = document.getElementById('hostPodiumList');

// ----------------------------------------------------
// 1. Conexión de Sockets
// ----------------------------------------------------
socket.on('connect', () => {
  connectionBadge.className = 'connection-badge connected';
  statusText.textContent = 'En línea';
});

socket.on('disconnect', () => {
  connectionBadge.className = 'connection-badge disconnected';
  statusText.textContent = 'Desconectado';
});

// ----------------------------------------------------
// 2. Cambio de Tabs (Modo Jugador vs Host)
// ----------------------------------------------------
roleTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    roleTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');

    const targetTab = tab.getAttribute('data-tab');
    if (targetTab === 'playerTab') {
      currentRole = 'player';
      playerTab.classList.add('active');
      hostTab.classList.remove('active');
    } else {
      currentRole = 'host';
      hostTab.classList.add('active');
      playerTab.classList.remove('active');
    }
  });
});

// ----------------------------------------------------
// 3. Lógica del Host
// ----------------------------------------------------
btnCreateRoom.addEventListener('click', () => {
  socket.emit('create_room', null, (res) => {
    if (res && res.success) {
      currentRoomId = res.roomId;
      hostCreateSection.classList.add('hidden');
      hostDashboardSection.classList.remove('hidden');
      hostRoomCode.textContent = currentRoomId;
      hostRoomStatus.textContent = res.status;
    }
  });
});

btnStartGame.addEventListener('click', () => {
  if (!currentRoomId) return;
  socket.emit('start_game', { roomId: currentRoomId }, (res) => {
    if (!res.success) {
      alert(res.message);
    }
  });
});

btnNextQuestion.addEventListener('click', () => {
  if (!currentRoomId) return;
  socket.emit('next_question', { roomId: currentRoomId });
  btnNextQuestion.classList.add('hidden');
});

// Actualización en Host: Respuestas recibidas
socket.on('answer_stats_update', (data) => {
  if (currentRole !== 'host') return;
  hostAnsweredTicker.textContent = `Respuestas: ${data.answeredCount} / ${data.totalActive}`;
});

// ----------------------------------------------------
// 4. Lógica del Jugador
// ----------------------------------------------------
btnJoinRoom.addEventListener('click', () => {
  const roomId = roomInput.value.trim().toUpperCase();
  const name = nameInput.value.trim();

  playerError.classList.add('hidden');

  if (!roomId || !name) {
    showPlayerError('Por favor completa todos los campos.');
    return;
  }

  socket.emit('join_room', { roomId, name }, (res) => {
    if (!res.success) {
      showPlayerError(res.message);
    } else {
      currentRoomId = res.roomId;
      myPlayerName = res.player.name;
      currentScore = res.player.score;

      playerRoomCode.textContent = currentRoomId;
      playerNameDisplay.textContent = myPlayerName;
      playerCurrentScore.textContent = `${currentScore} pts`;

      playerJoinSection.classList.add('hidden');
      playerLobbySection.classList.remove('hidden');
    }
  });
});

socket.on('join_error', (data) => {
  showPlayerError(data.message);
});

function showPlayerError(msg) {
  playerError.textContent = msg;
  playerError.classList.remove('hidden');
}

// ----------------------------------------------------
// 5. Eventos Compartidos de Sala (Jugadores y Host)
// ----------------------------------------------------
socket.on('player_joined', (data) => {
  renderPlayers(data.players);
  if (currentRole === 'host') {
    hostPlayerCount.textContent = data.totalPlayers;
    btnStartGame.disabled = data.totalPlayers === 0;
    btnStartGame.textContent =
      data.totalPlayers > 0
        ? `Iniciar Partida (${data.totalPlayers} jugadores listos)`
        : 'Iniciar Partida (Mínimo 1 jugador)';
  }
});

socket.on('player_left', (data) => {
  renderPlayers(data.players);
  if (currentRole === 'host') {
    hostPlayerCount.textContent = data.totalPlayers;
    btnStartGame.disabled = data.totalPlayers === 0;
  }
});

socket.on('player_disconnected', (data) => {
  console.log(data.message);
});

function renderPlayers(players) {
  if (!players || !hostPlayersList) return;

  if (players.length === 0) {
    hostPlayersList.innerHTML = '<p class="empty-hint">Esperando a que se unan jugadores...</p>';
    return;
  }

  hostPlayersList.innerHTML = players
    .map(
      (p) => `
      <div class="player-chip ${p.hasAnswered ? 'answered' : ''} ${!p.isActive ? 'disconnected' : ''}">
        <span>${p.name}</span>
        <small style="color:var(--text-muted);">(${p.score} pts)</small>
      </div>`
    )
    .join('');
}

// ----------------------------------------------------
// 6. Ciclo de Vida de Preguntas (Question Lifecycle)
// ----------------------------------------------------
socket.on('question_started', (data) => {
  hasSubmittedCurrent = false;
  questionDuration = data.durationMs;
  questionStartTime = data.startTime;

  // Lado Host
  if (currentRole === 'host') {
    hostRoomStatus.textContent = 'EN JUEGO';
    document.getElementById('hostLobbyControls').classList.add('hidden');
    hostQuestionMonitor.classList.remove('hidden');
    hostQuestionIndex.textContent = `Pregunta ${data.index + 1} de ${data.totalQuestions}`;
    hostCurrentQuestionText.textContent = data.question;
    hostAnsweredTicker.textContent = 'Respuestas: 0';
    hostOptionsSummary.innerHTML = data.options
      .map((opt, i) => `<div class="option-btn">${i + 1}. ${opt}</div>`)
      .join('');
  }

  // Lado Jugador
  if (currentRole === 'player' && currentRoomId) {
    playerLobbySection.classList.add('hidden');
    playerGameSection.classList.remove('hidden');
    playerFeedbackBox.classList.add('hidden');
    playerOptionsGrid.classList.remove('hidden');

    playerQuestionIndexBadge.textContent = `Pregunta ${data.index + 1} de ${data.totalQuestions}`;
    playerQuestionText.textContent = data.question;

    // Renderizar opciones
    playerOptionsGrid.innerHTML = '';
    data.options.forEach((option, index) => {
      const btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = option;
      btn.addEventListener('click', () => submitAnswer(index, btn));
      playerOptionsGrid.appendChild(btn);
    });

    // Iniciar temporizador visual sincronizado con el servidor
    startTimerAnimation(data.startTime, data.durationMs);
  }
});

function startTimerAnimation(startTime, duration) {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, duration - elapsed);
    const percent = (remaining / duration) * 100;

    if (playerTimerFill) {
      playerTimerFill.style.width = `${percent}%`;
    }
    if (playerTimerSeconds) {
      playerTimerSeconds.textContent = `${Math.ceil(remaining / 1000)}s`;
    }

    if (remaining <= 0) {
      clearInterval(timerInterval);
    }
  }, 50);
}

function submitAnswer(index, selectedButton) {
  if (hasSubmittedCurrent) return;
  hasSubmittedCurrent = true;

  // Deshabilitar todos los botones de opciones inmediatamente
  const buttons = playerOptionsGrid.querySelectorAll('.option-btn');
  buttons.forEach((btn) => (btn.disabled = true));
  selectedButton.classList.add('selected');

  // Enviar evento 'submit_answer'
  socket.emit('submit_answer', { roomId: currentRoomId, answerIndex: index }, (res) => {
    playerFeedbackBox.classList.remove('hidden');

    if (!res.success) {
      feedbackIcon.textContent = '⚠️';
      feedbackTitle.textContent = 'Error';
      feedbackDetail.textContent = res.message;
    } else {
      feedbackIcon.textContent = '✅';
      feedbackTitle.textContent = 'Respuesta Registrada';
      feedbackDetail.textContent = 'Calculando puntuación con el reloj del servidor...';
    }
  });
}

// ----------------------------------------------------
// 7. Resultados de la Pregunta
// ----------------------------------------------------
socket.on('question_results', (data) => {
  if (timerInterval) clearInterval(timerInterval);

  // Lado Host
  if (currentRole === 'host') {
    hostGameControls.classList.remove('hidden');
    if (!data.isLastQuestion) {
      btnNextQuestion.classList.remove('hidden');
    }
    // Resaltar respuesta correcta en monitor
    const optionBtns = hostOptionsSummary.querySelectorAll('.option-btn');
    if (optionBtns[data.correctAnswer]) {
      optionBtns[data.correctAnswer].classList.add('correct');
    }
  }

  // Lado Jugador
  if (currentRole === 'player' && currentRoomId) {
    const myEntry = data.leaderboard.find((p) => p.socketId === socket.id);
    if (myEntry) {
      currentScore = myEntry.score;
      playerCurrentScore.textContent = `${currentScore} pts`;
    }

    // Resaltar en UI del jugador la respuesta correcta
    const buttons = playerOptionsGrid.querySelectorAll('.option-btn');
    buttons.forEach((btn, idx) => {
      if (idx === data.correctAnswer) {
        btn.classList.add('correct');
      } else if (btn.classList.contains('selected')) {
        btn.classList.add('wrong');
      }
    });

    feedbackTitle.textContent = '¡Tiempo finalizado!';
    feedbackDetail.textContent = `Tu puntuación actual es: ${currentScore} pts.`;
  }
});

// ----------------------------------------------------
// 8. Finalización de la Partida
// ----------------------------------------------------
socket.on('game_finished', (data) => {
  if (timerInterval) clearInterval(timerInterval);

  if (currentRole === 'host') {
    hostRoomStatus.textContent = 'FINALIZADA';
    hostQuestionMonitor.classList.add('hidden');
    hostGameControls.classList.add('hidden');
    hostPodiumPanel.classList.remove('hidden');

    hostPodiumList.innerHTML = data.podium
      .map(
        (p, i) => `
        <div class="podium-item">
          <span>#${i + 1} ${p.name}</span>
          <span>${p.score} pts</span>
        </div>`
      )
      .join('');
  }

  if (currentRole === 'player' && currentRoomId) {
    playerGameSection.classList.add('hidden');
    playerEndSection.classList.remove('hidden');
    playerFinalScore.textContent = `${currentScore} pts`;
  }
});

btnPlayAgain.addEventListener('click', () => {
  location.reload();
});
