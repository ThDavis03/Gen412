const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');

const config = require('./config');
const { initSocketServer } = require('./socket');
const { gameManager } = require('./managers/GameManager');
const { setQuestionsBank, getQuestionsBankStats } = require('./config/themes');

const app = express();
const httpServer = http.createServer(app);

// Configuración de Multer en memoria para subir archivos JSON de preguntas
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // Máximo 2MB
  },
});

// 1. Configuración de Cabeceras de Seguridad con Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'fonts.googleapis.com'],
        fontSrc: ["'self'", 'fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// 2. Políticas de CORS restrictivas para la API HTTP
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || config.corsOrigin === '*') {
      return callback(null, true);
    }
    if (Array.isArray(config.corsOrigin)) {
      if (config.corsOrigin.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origen ${origin} bloqueado por CORS.`));
    }
    return callback(null, config.corsOrigin === origin);
  },
  methods: ['GET', 'POST'],
  credentials: true,
};
app.use(cors(corsOptions));

// 3. Parsers para peticiones con límites de tamaño para mitigar DoS
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));

/**
 * Helper para leer una cookie desde el header Cookie.
 */
function getCookie(req, cookieName) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  const match = raw.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Verifica si la petición HTTP tiene credenciales válidas de Administrador
 * (vía Basic Auth, Header, Query o Cookie de sesión).
 */
function verifyAdminRequest(req) {
  const expectedPass = config.admin.password;
  const expectedUser = config.admin.user || 'admin';

  // 1. Verificar Header Authorization (Basic Auth o Bearer)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    if (authHeader.startsWith('Basic ')) {
      const base64Credentials = authHeader.slice(6).trim();
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
      const [user, pass] = credentials.split(':');
      if (pass === expectedPass && (!user || user === expectedUser)) {
        return true;
      }
    } else if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token === expectedPass) {
        return true;
      }
    }
  }

  // 2. Verificar Header personalizado x-admin-password
  if (req.headers['x-admin-password'] === expectedPass) {
    return true;
  }

  // 3. Verificar Query parameter (?password=... o ?token=...)
  if (req.query && (req.query.password === expectedPass || req.query.token === expectedPass)) {
    return true;
  }

  // 4. Verificar Body password
  if (req.body && (req.body.adminPassword === expectedPass || req.body.password === expectedPass)) {
    return true;
  }

  // 5. Verificar Cookie admin_session
  const sessionCookie = getCookie(req, 'admin_session');
  if (sessionCookie === expectedPass) {
    return true;
  }

  return false;
}

/**
 * Middleware de protección para el Panel de Administración (/admin).
 * Si no están autenticados, redirige al inicio ('/').
 */
function adminAuthMiddleware(req, res, next) {
  if (verifyAdminRequest(req)) {
    // Establecer cookie de sesión para mantener autenticado al navegador y Socket.io
    res.setHeader(
      'Set-Cookie',
      `admin_session=${encodeURIComponent(config.admin.password)}; Path=/; SameSite=Lax`
    );
    return next();
  }

  // Si no están autenticados, redirigir al inicio como requiere la especificación
  return res.redirect('/');
}

const publicPath = path.join(__dirname, '../public');

// =========================================================================
// 4. Rutas del Panel de Administración Protegido (/admin)
// =========================================================================

// Ruta GET /admin y /admin.html protegidas por el middleware
app.get(['/admin', '/admin.html'], adminAuthMiddleware, (req, res) => {
  res.sendFile(path.join(publicPath, 'admin.html'));
});

// Endpoint POST /admin/login para autenticar con contraseña desde formulario y redirigir a /admin
app.post('/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (password === config.admin.password) {
    res.setHeader(
      'Set-Cookie',
      `admin_session=${encodeURIComponent(config.admin.password)}; Path=/; SameSite=Lax`
    );
    return res.status(200).json({ success: true, redirectUrl: '/admin' });
  }
  return res.status(401).json({
    success: false,
    message: 'Contraseña de administrador incorrecta.',
    redirectUrl: '/',
  });
});

// Endpoint GET /admin/state para consultar configuración actual y estadísticas del banco de preguntas
app.get('/admin/state', adminAuthMiddleware, (req, res) => {
  const stats = getQuestionsBankStats();
  res.status(200).json({
    success: true,
    settings: gameManager.getAdminSettings(),
    questionsBank: {
      total: stats.total,
      countsByTheme: stats.countsByTheme,
    },
  });
});

// Endpoint POST /admin/settings para actualizar tiempo, preguntas por bloque y modo de juego
app.post('/admin/settings', adminAuthMiddleware, (req, res) => {
  try {
    const updated = gameManager.updateAdminSettings(req.body || {});
    return res.status(200).json({
      success: true,
      message: 'Configuración de partida actualizada correctamente.',
      settings: updated,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || 'Error al actualizar la configuración.',
    });
  }
});

// Endpoint POST /admin/upload con multer para subir un archivo JSON y sobrescribir el banco en memoria
app.post('/admin/upload', adminAuthMiddleware, upload.any(), (req, res) => {
  try {
    let parsedQuestions = null;

    if (req.files && req.files.length > 0) {
      const uploadedFile = req.files[0];
      const rawContent = uploadedFile.buffer.toString('utf8');
      parsedQuestions = JSON.parse(rawContent);
    } else if (Array.isArray(req.body)) {
      parsedQuestions = req.body;
    } else if (req.body && Array.isArray(req.body.questions)) {
      parsedQuestions = req.body.questions;
    } else {
      return res.status(400).json({
        success: false,
        message: 'No se recibió ningún archivo JSON válido.',
      });
    }

    const stats = setQuestionsBank(parsedQuestions);

    return res.status(200).json({
      success: true,
      message: `Banco de preguntas actualizado en memoria (${stats.total} preguntas cargadas).`,
      questionsBank: {
        total: stats.total,
        countsByTheme: stats.countsByTheme,
      },
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: `Error al procesar el archivo JSON: ${err.message}`,
    });
  }
});

// 5. Enrutamiento de páginas principales y servir archivos estáticos desde /public
// Ruta del Quiz (/quiz): Servir quiz.html exclusivamente para la experiencia de trivia
app.get(['/quiz', '/quiz/', '/quiz.html'], (req, res) => {
  res.sendFile(path.join(publicPath, 'quiz.html'));
});

// Ruta raíz (/): Servir landing page de Generación 4:12
app.get('/', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

app.use(express.static(publicPath));

// 6. Endpoint de salud (Health Check)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: Math.floor(process.uptime()),
    activeRooms: gameManager.rooms.size,
    timestamp: new Date().toISOString(),
  });
});

// 7. Inicializar servidor de Socket.io
const io = initSocketServer(httpServer);

// 8. Arranque del servidor HTTP
const PORT = config.port;

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️  Puerto ${PORT} ya en uso. Asumiendo servidor preexistente en ejecución.`);
  } else {
    console.error('Error en servidor HTTP:', err);
  }
});

if (require.main === module) {
  httpServer.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Servidor de Trivia en Tiempo Real iniciado`);
    console.log(`📡 Puerto: http://localhost:${PORT}`);
    console.log(`🔐 Panel Admin: http://localhost:${PORT}/admin`);
    console.log(`🔒 Modo: ${config.nodeEnv}`);
    console.log(`🌐 CORS configurado para: ${JSON.stringify(config.corsOrigin)}`);
    console.log(`📁 Archivos estáticos en: ${publicPath}`);
    console.log(`====================================================`);
  });
}

// Manejo de apagado elegante (Graceful Shutdown)
const gracefulShutdown = () => {
  console.log('\nCerrando servidor ordenadamente...');
  io.close(() => {
    console.log('Conexiones de WebSockets cerradas.');
    httpServer.close(() => {
      console.log('Servidor HTTP detenido.');
      process.exit(0);
    });
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = { app, httpServer, io };

