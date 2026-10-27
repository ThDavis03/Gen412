require('dotenv').config();

const parseCorsOrigins = (rawOrigins) => {
  if (!rawOrigins || rawOrigins === '*') {
    return '*';
  }
  return rawOrigins.split(',').map((origin) => origin.trim());
};

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: parseCorsOrigins(process.env.CORS_ORIGIN),
  admin: {
    user: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASSWORD || 'gen412admin',
  },
  game: {
    defaultDurationMs: parseInt(process.env.DEFAULT_QUESTION_DURATION_MS, 10) || 15000,
    allowedDurationsSeconds: [10, 15, 20, 30],
    defaultQuestionsPerTheme: 5,
    defaultGameMode: 'Estándar', // 'Rápida' | 'Estándar' | 'Pausada'
    autoAdvanceDelayMs: 3500, // Delay automático entre preguntas en modo Rápida / Estándar
    roundPodiumDelayMs: 6500, // Tiempo de visualización del podio cada 5 preguntas en modo Estándar
    maxScore: parseInt(process.env.MAX_SCORE, 10) || 1000,
    minScore: parseInt(process.env.MIN_SCORE, 10) || 200,
    decayFactor: 1.0, // Decaimiento lineal (1.0) o exponencial (>1.0)
    tickIntervalMs: 1000,
  },
  gameModes: Object.freeze({
    RAPIDA: 'Rápida',
    ESTANDAR: 'Estándar',
    PAUSADA: 'Pausada',
  }),
  roomStatus: Object.freeze({
    LOBBY: 'LOBBY',
    IN_PROGRESS: 'IN_PROGRESS',
    RESULTS: 'RESULTS',
    ROUND_PODIUM: 'ROUND_PODIUM',
    FINISHED: 'FINISHED',
  }),
};

module.exports = config;
