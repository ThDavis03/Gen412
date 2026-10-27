const assert = require('assert');
const { calculateDecayScore } = require('../src/utils/scoring');

console.log('🧪 Ejecutando pruebas unitarias de la función de puntuación con decaimiento...');

const totalDurationMs = 15000;
const maxScore = 1000;
const minScore = 200;

// Caso 1: Respuesta instantánea (al milisegundo 0, restan 15000ms)
const scoreInstant = calculateDecayScore(totalDurationMs, totalDurationMs, maxScore, minScore);
assert.strictEqual(scoreInstant, 1000, 'La respuesta instantánea debe otorgar el puntaje máximo (1000)');
console.log('  ✅ Respuesta instantánea otorga puntaje máximo (1000 pts)');

// Caso 2: Respuesta a la mitad del tiempo (restan 7500ms)
const scoreHalf = calculateDecayScore(7500, totalDurationMs, maxScore, minScore);
assert.strictEqual(scoreHalf, 600, 'La respuesta a la mitad del tiempo debe otorgar 600 puntos (200 + 800 * 0.5)');
console.log('  ✅ Respuesta a mitad de tiempo decae proporcionalmente (600 pts)');

// Caso 3: Respuesta en el último milisegundo antes de expirar (resta 1ms)
const scoreLastMs = calculateDecayScore(1, totalDurationMs, maxScore, minScore);
assert.strictEqual(scoreLastMs >= 200 && scoreLastMs <= 201, true, 'Debe otorgar al menos el puntaje mínimo');
console.log('  ✅ Respuesta al límite otorga el puntaje mínimo base (~200 pts)');

// Caso 4: Tiempo expirado (restan 0ms o negativo)
const scoreExpired = calculateDecayScore(0, totalDurationMs, maxScore, minScore);
assert.strictEqual(scoreExpired, 0, 'Si el temporizador expiró debe retornar 0 puntos');
const scoreNegative = calculateDecayScore(-500, totalDurationMs, maxScore, minScore);
assert.strictEqual(scoreNegative, 0, 'Si el tiempo es negativo debe retornar 0 puntos');
console.log('  ✅ Tiempo expirado otorga 0 puntos');

// Caso 5: Parámetros inválidos
assert.strictEqual(calculateDecayScore(null, totalDurationMs), 0, 'Parámetro nulo debe retornar 0');
assert.strictEqual(calculateDecayScore(5000, 0), 0, 'Duración cero debe retornar 0');
console.log('  ✅ Parámetros inválidos manejados con seguridad');

console.log('🎉 ¡Todas las pruebas de la función de decaimiento pasaron exitosamente!\n');
