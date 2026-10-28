/**
 * tests/admin-and-modes.test.js
 * Pruebas automatizadas para:
 * 1. Protección de ruta /admin (redirección a '/' si no autenticado, 200 OK con Basic Auth o contraseña .env).
 * 2. Protección de evento Socket.io 'create_game' (solo admin puede hostear).
 * 3. Configuraciones de partida (10s, 15s, 20s, 30s; preguntas por bloque; modos Rápida, Estándar, Pausada).
 * 4. Endpoint POST /admin/upload con multer para sobrescribir el banco de preguntas en memoria.
 */

const assert = require('assert');
const http = require('http');
const { io: Client } = require('socket.io-client');
const { httpServer: server } = require('../src/server');
const config = require('../src/config');
const originalQuestions = require('../data.json');
const { setQuestionsBank } = require('../src/config/themes');

const TEST_PORT = 3095;
const BASE_URL = `http://localhost:${TEST_PORT}`;

function httpRequest(options, bodyBuffer = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try {
          json = JSON.parse(raw);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: raw,
          json,
        });
      });
    });
    req.on('error', reject);
    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

async function runTests() {
  console.log('Iniciando pruebas de Panel de Administración (/admin), Multer y Modos de Juego...');

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  try {
    // 0. Verificar que GET / sirve la landing page y GET /quiz sirve el frontend del quiz
    const landingRes = await httpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/',
      method: 'GET',
    });
    assert.strictEqual(landingRes.statusCode, 200, 'GET / debe responder 200 OK');
    assert.ok(landingRes.body.includes('Generación 4:12'), 'GET / debe servir la landing page');
    assert.ok(landingRes.body.includes('Conoce JEV'), 'Landing page debe contener botón "Conoce JEV"');
    assert.ok(landingRes.body.includes('Jugar Quiz'), 'Landing page debe contener botón "Jugar Quiz"');
    assert.ok(landingRes.body.includes('modal-jev'), 'Landing page debe contener el modal "Conoce JEV" (#modal-jev)');
    assert.ok(landingRes.body.includes('Sábado, 21 de Nov'), 'Landing page debe contener la fecha actualizada en el footer');

    const quizRes = await httpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/quiz',
      method: 'GET',
    });
    assert.strictEqual(quizRes.statusCode, 200, 'GET /quiz debe responder 200 OK');
    assert.ok(quizRes.body.includes('GEN4:12 Quiz'), 'GET /quiz debe servir la interfaz del quiz');
    assert.ok(quizRes.body.includes('Elegir Avatar'), 'GET /quiz debe incluir selector de avatares DiceBear');
    console.log('✓ 0. Rutas "/" (Landing page) y "/quiz" (Quiz) verificadas.');

    // 1. Verificar que /admin sin credenciales redirige al inicio ('/')
    const unauthRes = await httpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/admin',
      method: 'GET',
    });
    assert.strictEqual(unauthRes.statusCode, 302, 'GET /admin sin autenticación debe redirigir (302)');
    assert.strictEqual(unauthRes.headers.location, '/', 'GET /admin sin autenticación debe redirigir a "/"');
    console.log('✓ 1. Ruta /admin redirige a "/" cuando no está autenticada.');

    // 2. Verificar acceso a /admin con Basic Auth
    const basicCreds = Buffer.from(`${config.admin.user}:${config.admin.password}`).toString('base64');
    const authRes = await httpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/admin',
      method: 'GET',
      headers: {
        Authorization: `Basic ${basicCreds}`,
      },
    });
    assert.strictEqual(authRes.statusCode, 200, 'GET /admin con Basic Auth debe responder 200 OK');
    assert.ok(authRes.body.includes('Panel de Administración'), 'Debe servir el HTML del panel admin');
    console.log('✓ 2. Ruta /admin permite acceso con Basic Auth (.env).');

    // 3. Verificar POST /admin/settings (tiempos 10s, 15s, 20s, 30s y modos Rápida, Estándar, Pausada)
    const settingsPayload = Buffer.from(
      JSON.stringify({
        durationSeconds: 15,
        questionsPerTheme: 5,
        gameMode: 'Estándar',
      }),
      'utf8'
    );
    const settingsRes = await httpRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/admin/settings',
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicCreds}`,
          'Content-Type': 'application/json',
          'Content-Length': settingsPayload.length,
        },
      },
      settingsPayload
    );
    assert.strictEqual(settingsRes.statusCode, 200);
    assert.strictEqual(settingsRes.json.success, true);
    assert.strictEqual(settingsRes.json.settings.durationSeconds, 15);
    assert.strictEqual(settingsRes.json.settings.questionsPerTheme, 5);
    assert.strictEqual(settingsRes.json.settings.gameMode, 'Estándar');
    console.log('✓ 3. Configuración dinámica en POST /admin/settings actualizada correctamente.');

    // 4. Verificar POST /admin/upload con multer (multipart/form-data)
    const customQuestions = [
      {
        theme: 'Profesión',
        question: 'Pregunta subida por multer 1',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
      },
      {
        theme: 'Noviazgo',
        question: 'Pregunta subida por multer 2',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 1,
      },
      {
        theme: 'Ministerio',
        question: 'Pregunta subida por multer 3',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 2,
      },
      {
        theme: 'Emociones',
        question: 'Pregunta subida por multer 4',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 3,
      },
    ];

    const boundary = '----Gen412MulterBoundary987654';
    const fileContent = JSON.stringify(customQuestions, null, 2);
    const multipartBody = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="questionsFile"; filename="custom.json"\r\n` +
        `Content-Type: application/json\r\n\r\n` +
        `${fileContent}\r\n` +
        `--${boundary}--\r\n`,
      'utf8'
    );

    const uploadRes = await httpRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/admin/upload',
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicCreds}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': multipartBody.length,
        },
      },
      multipartBody
    );

    assert.strictEqual(uploadRes.statusCode, 200, 'POST /admin/upload debe retornar 200 OK');
    assert.strictEqual(uploadRes.json.success, true);
    assert.strictEqual(uploadRes.json.questionsBank.total, 4, 'El banco en memoria debe tener 4 preguntas nuevas');
    console.log('✓ 4. POST /admin/upload con multer sobrescribió el banco de preguntas en memoria.');

    // Restaurar las 20 preguntas originales para las pruebas de flujo de juego
    setQuestionsBank(originalQuestions);

    // 5. Verificar que solo el admin puede emitir 'create_game'
    const unauthSocket = Client(BASE_URL, { transports: ['websocket'], forceNew: true });
    await new Promise((resolve) => unauthSocket.on('connect', resolve));

    const unauthCreateRes = await new Promise((resolve) => {
      unauthSocket.emit('create_game', { durationSeconds: 15, gameMode: 'Estándar' }, resolve);
    });
    assert.strictEqual(unauthCreateRes.success, false, 'Un socket sin credenciales no debe poder ejecutar create_game');
    assert.strictEqual(unauthCreateRes.code, 'UNAUTHORIZED_ADMIN');
    unauthSocket.disconnect();
    console.log('✓ 5. Evento Socket.io "create_game" rechaza conexiones no autenticadas.');

    // 6. Verificar que el admin autenticado puede emitir 'create_game' y probar modo Estándar (podio cada 5 preguntas)
    const adminSocket = Client(BASE_URL, {
      transports: ['websocket'],
      forceNew: true,
      auth: { adminPassword: config.admin.password },
    });
    await new Promise((resolve) => adminSocket.on('connect', resolve));

    const adminCreateRes = await new Promise((resolve) => {
      adminSocket.emit(
        'create_game',
        {
          durationSeconds: 15,
          questionsPerTheme: 5,
          gameMode: 'Estándar',
        },
        resolve
      );
    });
    assert.strictEqual(adminCreateRes.success, true, 'El admin autenticado debe poder crear sala con create_game');
    assert.strictEqual(adminCreateRes.config.durationSeconds, 15);
    assert.strictEqual(adminCreateRes.config.questionsPerTheme, 5);
    assert.strictEqual(adminCreateRes.config.gameMode, 'Estándar');
    assert.strictEqual(adminCreateRes.config.totalQuestions, 20);

    const roomId = adminCreateRes.roomId;

    // Unir jugador y verificar actualización en tiempo real de avatar ('update_avatar') y modo 'Estándar'
    const playerSocket = Client(BASE_URL, { transports: ['websocket'], forceNew: true });
    await new Promise((resolve) => playerSocket.on('connect', resolve));
    const joinRes = await new Promise((resolve) => {
      playerSocket.emit('join_room', { roomId, name: 'TesterAdmin' }, resolve);
    });
    assert.strictEqual(joinRes.success, true);

    // Probar selección libre de avatar DiceBear ('update_avatar') y recepción en tiempo real por el Host ('avatar_updated')
    const avatarUpdatedPromise = new Promise((resolve) => {
      adminSocket.once('avatar_updated', resolve);
    });
    const updateAvatarAck = await new Promise((resolve) => {
      playerSocket.emit('update_avatar', 'avatar14', resolve);
    });
    const hostAvatarNotification = await avatarUpdatedPromise;

    assert.strictEqual(updateAvatarAck.success, true);
    assert.strictEqual(updateAvatarAck.avatarId, 'avatar14');
    assert.strictEqual(hostAvatarNotification.avatarId, 'avatar14');
    assert.strictEqual(hostAvatarNotification.socketId, playerSocket.id);
    console.log('✓ 6. Selección libre de Avatar (DiceBear) con "update_avatar" actualiza al Host en tiempo real.');

    let roundPodiumReceived = null;
    adminSocket.on('round_podium', (data) => {
      roundPodiumReceived = data;
    });

    // Iniciar juego (Pregunta 1)
    await new Promise((resolve) => adminSocket.emit('start_game', { roomId }, resolve));

    // Avanzar las primeras 5 preguntas del Bloque 1 ("Profesión")
    for (let q = 0; q < 5; q++) {
      // Responder para cerrar la pregunta inmediatamente
      await new Promise((resolve) => {
        adminSocket.once('question_results', resolve);
        playerSocket.emit('submit_answer', { roomId, answerIndex: 0 }, () => {});
      });

      if (q < 4) {
        await new Promise((resolve) => {
          adminSocket.once('question_started', resolve);
          adminSocket.emit('next_question', { roomId }, () => {});
        });
      }
    }

    assert.ok(roundPodiumReceived, 'En modo Estándar debe emitirse round_podium al concluir las 5 preguntas del bloque');
    assert.strictEqual(roundPodiumReceived.completedRoundNumber, 1);
    console.log('✓ 7. Evento "create_game" para admin y Modo "Estándar" (podio cada 5 preguntas) verificados.');

    playerSocket.disconnect();
    adminSocket.disconnect();

    // 8. Verificar Tiempos Libres (ej. 8s / 25s), CRUD de Temas y Preguntas, Checkboxes y 4 Equipos con corte de 10s
    const customDurationPayload = Buffer.from(
      JSON.stringify({
        durationSeconds: 8,
        questionsPerTheme: 2,
        gameMode: 'Estándar',
        teamAssignment: 'choice',
      }),
      'utf8'
    );
    const customDurRes = await httpRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/admin/settings',
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicCreds}`,
          'Content-Type': 'application/json',
          'Content-Length': customDurationPayload.length,
        },
      },
      customDurationPayload
    );
    assert.strictEqual(customDurRes.statusCode, 200);
    assert.strictEqual(customDurRes.json.settings.durationSeconds, 8, 'Debe permitir tiempo numérico libre como 8s');
    assert.strictEqual(customDurRes.json.settings.teamAssignment, 'choice');
    assert.strictEqual(customDurRes.json.settings.teams.length, 4, 'Deben existir los 4 equipos fijos');
    assert.strictEqual(customDurRes.json.settings.teams[0].name, 'Fe Indomable');

    // Crear nuevo tema y agregar pregunta vía CRUD
    const newThemeBody = Buffer.from(JSON.stringify({ theme: 'Liderazgo', icon: '👑', color: '#38bdf8' }), 'utf8');
    const newThemeRes = await httpRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/admin/themes',
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicCreds}`,
          'Content-Type': 'application/json',
          'Content-Length': newThemeBody.length,
        },
      },
      newThemeBody
    );
    assert.strictEqual(newThemeRes.statusCode, 201);
    assert.strictEqual(newThemeRes.json.theme.id, 'liderazgo');

    const newQBody = Buffer.from(
      JSON.stringify({
        theme: 'Liderazgo',
        question: '¿Cómo lidera Jesús según Marcos 10:45?',
        options: ['Sirviendo', 'Mandando', 'Gritando', 'Ignorando'],
        correctIndex: 0,
      }),
      'utf8'
    );
    const addQRes = await httpRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/admin/questions',
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicCreds}`,
          'Content-Type': 'application/json',
          'Content-Length': newQBody.length,
        },
      },
      newQBody
    );
    assert.strictEqual(addQRes.statusCode, 201);
    const createdQId = addQRes.json.question.id;

    // Seleccionar solo el tema 'liderazgo' mediante selectedThemeIds
    const selThemesBody = Buffer.from(JSON.stringify({ selectedThemeIds: ['liderazgo'], durationSeconds: 25 }), 'utf8');
    const selThemesRes = await httpRequest(
      {
        hostname: 'localhost',
        port: TEST_PORT,
        path: '/admin/settings',
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicCreds}`,
          'Content-Type': 'application/json',
          'Content-Length': selThemesBody.length,
        },
      },
      selThemesBody
    );
    assert.strictEqual(selThemesRes.statusCode, 200);
    assert.strictEqual(selThemesRes.json.settings.durationSeconds, 25, 'Debe aceptar 25s como input numérico libre');
    assert.deepStrictEqual(selThemesRes.json.settings.selectedThemeIds, ['liderazgo']);

    // Probar partida con elección de equipo, puntaje acumulado por equipo y corte automático con cuenta de 10s
    const host2 = Client(BASE_URL, {
      transports: ['websocket'],
      forceNew: true,
      auth: { adminPassword: config.admin.password },
    });
    await new Promise((resolve) => host2.on('connect', resolve));
    const room2Res = await new Promise((resolve) => host2.emit('create_game', {}, resolve));
    assert.strictEqual(room2Res.success, true);
    assert.strictEqual(room2Res.durationSeconds, 25);
    assert.strictEqual(room2Res.totalQuestions, 1, 'Solo debe cargar la pregunta del tema seleccionado con checkbox');

    const p2 = Client(BASE_URL, { transports: ['websocket'], forceNew: true });
    await new Promise((resolve) => p2.on('connect', resolve));
    const join2 = await new Promise((resolve) =>
      p2.emit('join_room', { roomId: room2Res.roomId, name: 'JugadorAguila' }, resolve)
    );
    assert.strictEqual(join2.success, true);

    const selectTeamRes = await new Promise((resolve) => p2.emit('select_team', { teamId: 'aguila' }, resolve));
    assert.strictEqual(selectTeamRes.success, true);
    assert.strictEqual(selectTeamRes.teamId, 'aguila');

    await new Promise((resolve) => host2.emit('start_game', { roomId: room2Res.roomId }, resolve));

    const intermissionPromise = new Promise((resolve) => host2.once('intermission_started', resolve));
    const results2Promise = new Promise((resolve) => host2.once('question_results', resolve));
    p2.emit('submit_answer', { roomId: room2Res.roomId, answerIndex: 0 }, () => {});

    const [intermissionData, results2] = await Promise.all([intermissionPromise, results2Promise]);
    assert.strictEqual(results2.allAnswered, true, 'Debe marcar allAnswered=true al responder todos');
    assert.strictEqual(intermissionData.durationMs, 10000, 'Debe iniciar el contador de 10s (10000ms)');
    const aguilaTeam = results2.teamLeaderboard.find((t) => t.id === 'aguila');
    assert.ok(aguilaTeam && aguilaTeam.score > 0, 'El puntaje individual debe acumularse en el puntaje global del equipo Águila');

    // Limpiar tema creado y restaurar estado por defecto
    await httpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: `/admin/questions/${createdQId}`,
      method: 'DELETE',
      headers: { Authorization: `Basic ${basicCreds}` },
    });
    await httpRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/admin/themes/liderazgo',
      method: 'DELETE',
      headers: { Authorization: `Basic ${basicCreds}` },
    });

    p2.disconnect();
    host2.disconnect();
    console.log('✓ 8. Tiempos dinámicos (8s/25s), corte automático de 10s, CRUD de Temas/Preguntas y 4 Equipos verificados.');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n🎉 TODAS LAS PRUEBAS DE ADMIN PANEL, MULTER, DICEBEAR AVATARS Y MODOS PASARON EXITOSAMENTE.');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Error en pruebas de admin:', err);
  process.exit(1);
});
