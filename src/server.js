const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const config = require('./config');
const { initSocketServer } = require('./socket');
const { gameManager } = require('./managers/GameManager');

const app = express();
const httpServer = http.createServer(app);

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
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));

// 4. Servir archivos estáticos desde la carpeta /public
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// 5. Endpoint de salud (Health Check)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: Math.floor(process.uptime()),
    activeRooms: gameManager.rooms.size,
    timestamp: new Date().toISOString(),
  });
});

// 6. Inicializar servidor de Socket.io
const io = initSocketServer(httpServer);

// 7. Arranque del servidor HTTP
const PORT = config.port;

httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`⚠️  Puerto ${PORT} ya en uso. Asumiendo servidor preexistente en ejecución.`);
  } else {
    console.error('Error en servidor HTTP:', err);
  }
});

httpServer.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Servidor de Trivia en Tiempo Real iniciado`);
  console.log(`📡 Puerto: http://localhost:${PORT}`);
  console.log(`🔒 Modo: ${config.nodeEnv}`);
  console.log(`🌐 CORS configurado para: ${JSON.stringify(config.corsOrigin)}`);
  console.log(`📁 Archivos estáticos en: ${publicPath}`);
  console.log(`====================================================`);
});

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
