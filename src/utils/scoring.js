const config = require('../config');

/**
 * Calcula la puntuación obtenida por una respuesta correcta aplicando una función de decaimiento temporal.
 * Basado estrictamente en los milisegundos restantes registrados por el servidor (no por el cliente).
 *
 * @param {number} remainingMs - Milisegundos restantes del temporizador del servidor.
 * @param {number} totalDurationMs - Duración total de la pregunta en milisegundos.
 * @param {number} [maxScore] - Puntuación máxima por responder al instante.
 * @param {number} [minScore] - Puntuación base mínima por responder antes de que expire el tiempo.
 * @param {number} [decayFactor] - Factor de decaimiento (1.0 = lineal, >1.0 = mayor penalización por demora).
 * @returns {number} Puntos calculados (entero). Retorna 0 si el tiempo expiró o los parámetros son inválidos.
 */
function calculateDecayScore(
  remainingMs,
  totalDurationMs,
  maxScore = config.game.maxScore,
  minScore = config.game.minScore,
  decayFactor = config.game.decayFactor
) {
  if (typeof remainingMs !== 'number' || typeof totalDurationMs !== 'number') {
    return 0;
  }

  // Si no queda tiempo o el tiempo restante es menor o igual a 0, 0 puntos
  if (remainingMs <= 0 || totalDurationMs <= 0) {
    return 0;
  }

  // Limitar el tiempo restante dentro de los rangos válidos [0, totalDurationMs]
  const clampedRemaining = Math.min(Math.max(0, remainingMs), totalDurationMs);

  // Ratio de tiempo restante: 1.0 (inicio inmediato) -> 0.0 (final del tiempo)
  const timeRatio = clampedRemaining / totalDurationMs;

  // Función de decaimiento
  const decayValue = Math.pow(timeRatio, decayFactor);
  const calculatedPoints = minScore + (maxScore - minScore) * decayValue;

  return Math.round(calculatedPoints);
}

module.exports = {
  calculateDecayScore,
};
