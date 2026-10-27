const assert = require('assert');
const { GameManager } = require('../src/managers/GameManager');
const { TransactionLockManager } = require('../src/utils/lock');

console.log('🧪 Probando mitigación de Race Conditions (Doble envío desde el mismo socket)...');

const gm = new GameManager();
const hostSocketId = 'host_socket_01';
const room = gm.createRoom(hostSocketId);
const roomId = room.roomId;

// Agregar jugador de prueba
const playerSocketId = 'player_socket_01';
const addResult = gm.addPlayer(roomId, playerSocketId, 'JugadorTest');
assert.strictEqual(addResult.success, true, 'Debe agregar jugador');

// Iniciar juego manualmente en GameManager
room.currentQuestionIndex = 0;
room.status = 'IN_PROGRESS';
room.questionStartTime = Date.now();

// Simular ráfaga concurrente de 10 peticiones simultáneas desde el mismo socket
console.log('  ⚡ Disparando 10 peticiones de respuesta concurrentes (Promise.all)...');

const mockIO = { to: () => ({ emit: () => {} }) };

const submissions = Array.from({ length: 10 }).map((_, i) => {
  return new Promise((resolve) => {
    // Intento de envío
    const res = gm.submitAnswer(roomId, playerSocketId, 1);
    resolve({ index: i, result: res });
  });
});

Promise.all(submissions).then((results) => {
  const accepted = results.filter((r) => r.result.success);
  const rejected = results.filter((r) => !r.result.success);

  console.log(`  📊 Resultados: ${accepted.length} aceptada(s), ${rejected.length} rechazada(s)`);

  assert.strictEqual(accepted.length, 1, 'Exactamente 1 envío debe ser procesado exitosamente');
  assert.strictEqual(rejected.length, 9, 'Las 9 peticiones concurrentes restantes deben ser rechazadas');

  const player = room.players.get(playerSocketId);
  assert.strictEqual(player.hasAnswered, true, 'El jugador debe quedar marcado como hasAnswered');
  
  console.log('🎉 ¡Prueba de bloqueo de Race Conditions superada con éxito!\n');
});
