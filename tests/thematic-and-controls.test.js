const assert = require('assert');
const { GameManager } = require('../src/managers/GameManager');
const { THEMES, AVATARS } = require('../src/config/themes');

console.log('🧪 Iniciando pruebas de Configuración de Host, Bloques Temáticos, Avatares y Controles...');

const gm = new GameManager();

// =========================================================================
// Prueba 1: Configuración Pre-Lobby y Bloques Temáticos
// =========================================================================
console.log('\n1. Verificando Configuración Pre-Lobby y Bloques Temáticos...');

const hostSocketId = 'host_socket_theme_01';
const room = gm.createRoom(hostSocketId, {
  durationSeconds: 20,
  questionsPerTheme: 2,
});

assert.strictEqual(room.questionDurationMs, 20000, 'La duración debe configurarse en 20,000 ms (20s)');
assert.strictEqual(room.questionsPerTheme, 2, 'Debe haber 2 preguntas por tema');
assert.strictEqual(room.questions.length, 8, 'Debe haber un total de 8 preguntas (4 temas x 2 preguntas)');

// Verificar que las preguntas cubran los 4 temas especificados
const themeIds = [...new Set(room.questions.map((q) => q.themeId))];
assert.strictEqual(themeIds.length, 4, 'Deben estar presentes las 4 temáticas');
assert.ok(themeIds.includes('profesion'), 'Debe contener el bloque Profesión');
assert.ok(themeIds.includes('noviazgo'), 'Debe contener el bloque Noviazgo');
assert.ok(themeIds.includes('ministerio'), 'Debe contener el bloque Ministerio');
assert.ok(themeIds.includes('emociones'), 'Debe contener el bloque Emociones');

console.log('  ✅ Sala creada con 4 bloques temáticos y configuración previa exitosa.');

// =========================================================================
// Prueba 2: Sistema de Avatares y Racha (Streak)
// =========================================================================
console.log('\n2. Verificando Sistema de Avatares y Rachas...');

// Jugador con avatar específico
const player1Res = gm.addPlayer(room.roomId, 'socket_player_01', 'Santiago', 'avatar_2');
assert.strictEqual(player1Res.success, true);
assert.strictEqual(player1Res.player.avatarId, 'avatar_2', 'Debe asignar el avatar seleccionado');
assert.strictEqual(player1Res.player.streak, 0, 'La racha inicial debe ser 0');
assert.ok(player1Res.player.avatarMeta, 'Debe contener metadata del avatar (ícono, color)');

// Jugador con avatar aleatorio
const player2Res = gm.addPlayer(room.roomId, 'socket_player_02', 'Valeria');
assert.strictEqual(player2Res.success, true);
assert.ok(player2Res.player.avatarId, 'Debe asignar un avatar aleatorio automáticamente');
assert.strictEqual(player2Res.player.streak, 0);

console.log('  ✅ Avatares asignados correctamente con estructura { socketId, name, avatarId, score, streak }.');

// =========================================================================
// Prueba 3: Evento 'theme_change' al iniciar pregunta
// =========================================================================
console.log('\n3. Verificando emisión de "theme_change"...');

let themeChangeEmitted = null;
const mockIO = {
  to: (roomId) => ({
    emit: (eventName, data) => {
      if (eventName === 'theme_change') {
        themeChangeEmitted = data;
      }
    },
  }),
};

room.currentQuestionIndex = 0;
gm.startQuestion(room.roomId, mockIO);

assert.ok(themeChangeEmitted, 'Debe emitir el evento theme_change');
assert.strictEqual(themeChangeEmitted.themeId, 'profesion', 'El primer tema debe ser profesión');
assert.strictEqual(themeChangeEmitted.themeName, 'Profesión (¿Y ahora qué?)');
assert.ok(themeChangeEmitted.themeData.bgGradient, 'Debe incluir paleta y gradiente del tema');

console.log(`  ✅ Evento 'theme_change' emitido para el tema: "${themeChangeEmitted.themeName}".`);

// =========================================================================
// Prueba 4: Rachas y Puntuación en submitAnswer
// =========================================================================
console.log('\n4. Verificando cálculo de racha (streak)...');

const curQ = room.questions[room.currentQuestionIndex];
// Respuesta correcta
const ansRes1 = gm.submitAnswer(room.roomId, 'socket_player_01', curQ.correctAnswer);
assert.strictEqual(ansRes1.success, true);
assert.strictEqual(ansRes1.isCorrect, true);
assert.strictEqual(ansRes1.streak, 1, 'Racha debe aumentar a 1');

// Avanzar a pregunta 2
room.currentQuestionIndex = 1;
gm.startQuestion(room.roomId, mockIO);

const curQ2 = room.questions[room.currentQuestionIndex];
// Respuesta incorrecta
const wrongAnswer = (curQ2.correctAnswer + 1) % 4;
const ansRes2 = gm.submitAnswer(room.roomId, 'socket_player_01', wrongAnswer);
assert.strictEqual(ansRes2.success, true);
assert.strictEqual(ansRes2.isCorrect, false);
assert.strictEqual(ansRes2.streak, 0, 'Racha debe reiniciarse a 0 tras error');

console.log('  ✅ Lógica de rachas (streak) probada con éxito.');

// =========================================================================
// Prueba 5: Controles del Host (Pausar, Reanudar, Saltar, Forzar Cierre)
// =========================================================================
console.log('\n5. Verificando Controles del Anfitrión (Pausar, Reanudar, Saltar, Forzar Cierre)...');

let eventEmitted = null;
const controlMockIO = {
  to: () => ({
    emit: (name, data) => {
      eventEmitted = { name, data };
    },
  }),
};

// 5.1 Pausar
const pauseRes = gm.pauseGame(room.roomId, controlMockIO);
assert.strictEqual(pauseRes.success, true);
assert.strictEqual(room.isPaused, true);
assert.strictEqual(eventEmitted.name, 'game_paused');

// Intentar enviar respuesta mientras está pausado
const submitWhilePaused = gm.submitAnswer(room.roomId, 'socket_player_02', 0);
assert.strictEqual(submitWhilePaused.success, false);
assert.strictEqual(submitWhilePaused.error, 'La partida se encuentra pausada por el anfitrión.');
console.log('  ✅ Partida pausada: temporizador congelado y respuestas bloqueadas.');

// 5.2 Reanudar
const resumeRes = gm.resumeGame(room.roomId, controlMockIO);
assert.strictEqual(resumeRes.success, true);
assert.strictEqual(room.isPaused, false);
assert.strictEqual(eventEmitted.name, 'game_resumed');
console.log('  ✅ Partida reanudada con el tiempo restante.');

// 5.3 Forzar Cierre de Respuestas
const closeRes = gm.forceCloseAnswers(room.roomId, controlMockIO);
assert.strictEqual(closeRes.success, true);
assert.strictEqual(room.status, 'RESULTS', 'El estado debe cambiar de inmediato a RESULTS');
console.log('  ✅ Cierre forzado de respuestas ejecutado con éxito.');

// 5.4 Saltar Pregunta
room.status = 'IN_PROGRESS';
const skipRes = gm.skipQuestion(room.roomId, controlMockIO);
assert.strictEqual(skipRes.success, true);
assert.strictEqual(room.status, 'RESULTS');
console.log('  ✅ Salto de pregunta ejecutado con éxito.');

// Limpiar sala
gm.destroyRoom(room.roomId);

// =========================================================================
// Prueba 6: 4 Rondas Temáticas Continuas (5 preguntas por tema = 20 total)
// =========================================================================
console.log('\n6. Verificando las 4 Rondas Temáticas Continuas (5 preguntas por ronda = 20 total)...');

const fullRoom = gm.createRoom('host_full_rounds');
assert.strictEqual(fullRoom.rounds.length, 4, 'Deben existir exactamente 4 rondas temáticas');
assert.strictEqual(fullRoom.questionsPerTheme, 5, 'Por defecto deben ser 5 preguntas por ronda temática');
assert.strictEqual(fullRoom.questions.length, 20, 'El total debe ser de 20 preguntas');

const expectedThemes = ['Profesión', 'Noviazgo', 'Ministerio', 'Emociones'];
const roundTransitions = [];

const roundMockIO = {
  to: () => ({
    emit: (eventName, payload) => {
      if (eventName === 'round_started') {
        roundTransitions.push(payload.theme);
      }
    },
  }),
};

// Iniciar en la primera pregunta (Ronda 1: Profesión)
fullRoom.currentQuestionIndex = 0;
gm.startQuestion(fullRoom.roomId, roundMockIO);

for (let i = 0; i < 20; i++) {
  const expectedRoundIdx = Math.floor(i / 5);
  const expectedQInRound = i % 5;
  assert.strictEqual(fullRoom.currentRoundIndex, expectedRoundIdx, `Pregunta ${i} debe pertenecer a la ronda ${expectedRoundIdx}`);
  assert.strictEqual(fullRoom.currentQuestionInRoundIndex, expectedQInRound, `Posición en ronda debe ser ${expectedQInRound}`);
  assert.strictEqual(fullRoom.currentRound.theme, expectedThemes[expectedRoundIdx], `Tema activo debe ser ${expectedThemes[expectedRoundIdx]}`);
  assert.strictEqual(fullRoom.currentRoundQuestions.length, 5, 'La ronda activa debe tener cargadas sus 5 preguntas');

  if (i < 19) {
    const step = gm.advanceToNextQuestion(fullRoom.roomId, roundMockIO);
    assert.strictEqual(step.finished, false);
  } else {
    const finalStep = gm.advanceToNextQuestion(fullRoom.roomId, roundMockIO);
    assert.strictEqual(finalStep.finished, true, 'Al terminar la pregunta 20 debe finalizar la partida');
  }
}

assert.deepStrictEqual(roundTransitions, expectedThemes, 'Las 4 rondas deben haberse cargado en orden continuo');
console.log('  ✅ Las 4 rondas ("Profesión", "Noviazgo", "Ministerio", "Emociones") cargaron sus 5 preguntas automáticamente.');

gm.destroyRoom(fullRoom.roomId);

console.log('\n🎉 ¡Todas las pruebas de Configuración de Host, Temas, Avatares y Controles pasaron al 100%!\n');
