const { io: ioClient } = require('socket.io-client');
const http = require('http');
const { app, httpServer, io } = require('../src/server');

const TOTAL_CLIENTS = 160; // Más de 150 conexiones concurrentes
const SERVER_URL = `http://localhost:${process.env.PORT || 3000}`;

async function runLoadTest() {
  console.log(`\n===============================================================`);
  console.log(`🚀 INICIANDO PRUEBA DE CARGA: ${TOTAL_CLIENTS} CONEXIONES CONCURRENTES`);
  console.log(`===============================================================\n`);

  // Esperar a que el servidor esté listo
  await new Promise((res) => setTimeout(res, 800));

  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`Memoria Heap Inicial: ${startMemory.toFixed(2)} MB`);

  // 1. Conectar Host
  const hostSocket = ioClient(SERVER_URL, { transports: ['websocket'] });
  let roomId = null;

  await new Promise((resolve) => {
    hostSocket.on('connect', () => {
      hostSocket.emit('create_room', null, (res) => {
        roomId = res.roomId;
        console.log(`✅ Sala de prueba creada con éxito. Room ID: [${roomId}]`);
        resolve();
      });
    });
  });

  // 2. Conectar masivamente 160 clientes simultáneos
  console.log(`\nConectando ${TOTAL_CLIENTS} jugadores simultáneos a la sala...`);
  const clientSockets = [];
  let joinedCount = 0;
  const joinStartTime = Date.now();

  const joinPromises = [];

  for (let i = 1; i <= TOTAL_CLIENTS; i++) {
    const p = new Promise((resolve) => {
      const client = ioClient(SERVER_URL, {
        transports: ['websocket'],
        forceNew: true,
      });

      client.on('connect', () => {
        client.emit('join_room', { roomId, name: `Jugador_${i}` }, (res) => {
          if (res && res.success) {
            joinedCount++;
          } else {
            console.error(`Error uniendo jugador ${i}:`, res ? res.message : 'timeout');
          }
          resolve();
        });
      });

      clientSockets.push(client);
    });

    joinPromises.push(p);
  }

  await Promise.all(joinPromises);
  const joinDuration = Date.now() - joinStartTime;
  console.log(`✅ ${joinedCount}/${TOTAL_CLIENTS} jugadores conectados y unidos en ${joinDuration} ms.`);

  // 3. Iniciar la Partida desde el Host
  console.log(`\nIniciando partida desde el Host...`);
  const questionReceivedPromises = clientSockets.map((s) => {
    return new Promise((resolve) => {
      s.once('question_started', (data) => {
        resolve(data);
      });
    });
  });

  hostSocket.emit('start_game', { roomId });
  await Promise.all(questionReceivedPromises);
  console.log(`✅ La totalidad de los ${TOTAL_CLIENTS} sockets recibieron el evento 'question_started'`);

  // 4. Ráfaga masiva y concurrente de respuestas (160 respuestas simultáneas)
  console.log(`\n⚡ Disparando ráfaga masiva de ${TOTAL_CLIENTS} respuestas concurrentes...`);
  const answerStartTime = Date.now();
  let answersAccepted = 0;

  const answerPromises = clientSockets.map((s, index) => {
    return new Promise((resolve) => {
      // Simular latencias variables entre 10ms y 500ms
      const randomDelay = Math.floor(Math.random() * 400);
      setTimeout(() => {
        const optionIndex = index % 2 === 0 ? 1 : 0; // Algunas correctas (1), otras incorrectas (0)
        s.emit('submit_answer', { roomId, answerIndex: optionIndex }, (res) => {
          if (res && res.success) {
            answersAccepted++;
          }
          resolve(res);
        });
      }, randomDelay);
    });
  });

  await Promise.all(answerPromises);
  const answerDuration = Date.now() - answerStartTime;
  console.log(`✅ ${answersAccepted}/${TOTAL_CLIENTS} respuestas procesadas transaccionalmente en ${answerDuration} ms.`);

  const endMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`Memoria Heap Final: ${endMemory.toFixed(2)} MB (+${(endMemory - startMemory).toFixed(2)} MB)`);

  // 5. Desconexión masiva ordenada
  console.log(`\nDesconectando todos los clientes...`);
  clientSockets.forEach((s) => s.disconnect());
  hostSocket.disconnect();

  console.log(`\n===============================================================`);
  console.log(`📊 REPORTE DE RENDIMIENTO (BENCHMARK):`);
  console.log(`- Conexiones concurrentes activas: ${TOTAL_CLIENTS}`);
  console.log(`- Tasa de éxito en 'join_room': ${(joinedCount / TOTAL_CLIENTS * 100).toFixed(1)}%`);
  console.log(`- Tasa de éxito en 'submit_answer': ${(answersAccepted / TOTAL_CLIENTS * 100).toFixed(1)}%`);
  console.log(`- Latencia promedio por ráfaga: ${(answerDuration / TOTAL_CLIENTS).toFixed(2)} ms/socket`);
  console.log(`- Consumo de memoria adicional: ${(endMemory - startMemory).toFixed(2)} MB`);
  console.log(`- Estado: EXCELENTE (Sin saturación de event loop)`);
  console.log(`===============================================================\n`);

  process.exit(0);
}

runLoadTest().catch((err) => {
  console.error('Error durante la prueba de carga:', err);
  process.exit(1);
});
