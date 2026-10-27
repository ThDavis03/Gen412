/**
 * themes.js
 * Definición centralizada de bloques temáticos, rondas continuas de 5 preguntas
 * y catálogo de avatares para el sistema de trivia interactiva Gen412.
 */

const questionsData = require('../../data.json');

/**
 * Orden estricto de las 4 rondas temáticas continuas.
 */
const ROUND_THEMES = ['Profesión', 'Noviazgo', 'Ministerio', 'Emociones'];

const THEMES = {
  profesion: {
    id: 'profesion',
    key: 'profesion',
    theme: 'Profesión',
    name: 'Profesión (¿Y ahora qué?)',
    shortName: 'Profesión',
    subtitle: 'Vocación, ética laboral, propósito y excelencia',
    color: '#a855f7', // Púrpura neón
    accentColor: '#c084fc',
    bgGradient: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    icon: '💼',
  },
  noviazgo: {
    id: 'noviazgo',
    key: 'noviazgo',
    theme: 'Noviazgo',
    name: 'Noviazgo (Señor, confirma)',
    shortName: 'Noviazgo',
    subtitle: 'Relaciones guiadas por Dios, pureza y discernimiento',
    color: '#ec4899', // Rosa neón
    accentColor: '#f472b6',
    bgGradient: 'linear-gradient(135deg, #0f172a 0%, #3b0726 100%)',
    icon: '💍',
  },
  ministerio: {
    id: 'ministerio',
    key: 'ministerio',
    theme: 'Ministerio',
    name: 'Ministerio (Fuera de la banca)',
    shortName: 'Ministerio',
    subtitle: 'Servicio activo, dones espirituales e impacto juvenil',
    color: '#facc15', // Amarillo neón
    accentColor: '#fde047',
    bgGradient: 'linear-gradient(135deg, #0f172a 0%, #2e2306 100%)',
    icon: '🔥',
  },
  emociones: {
    id: 'emociones',
    key: 'emociones',
    theme: 'Emociones',
    name: 'Emociones (Aleluya por fuera, caos por dentro)',
    shortName: 'Emociones',
    subtitle: 'Salud emocional, vulnerabilidad y descanso en Cristo',
    color: '#2dd4bf', // Teal / Turquesa neón
    accentColor: '#5eead4',
    bgGradient: 'linear-gradient(135deg, #0f172a 0%, #042f2e 100%)',
    icon: '🧠',
  },
};

/**
 * Mapa de nombre de tema ("Profesión", "Noviazgo", "Ministerio", "Emociones") a su clave interna.
 */
const THEME_NAME_TO_KEY = {
  Profesión: 'profesion',
  Noviazgo: 'noviazgo',
  Ministerio: 'ministerio',
  Emociones: 'emociones',
};

/**
 * Catálogo de avatares predefinidos para los jugadores.
 */
const AVATARS = [
  { id: 'avatar_1', name: 'Zorblax', icon: '👾', color: '#38bdf8' },
  { id: 'avatar_2', name: 'Ignis', icon: '🔥', color: '#f97316' },
  { id: 'avatar_3', name: 'Krono', icon: '⚡', color: '#eab308' },
  { id: 'avatar_4', name: 'Leo', icon: '🦁', color: '#e11d48' },
  { id: 'avatar_5', name: 'Nova', icon: '🚀', color: '#8b5cf6' },
  { id: 'avatar_6', name: 'Búho', icon: '🦉', color: '#10b981' },
  { id: 'avatar_7', name: 'Titan', icon: '🤖', color: '#64748b' },
  { id: 'avatar_8', name: 'Specter', icon: '👻', color: '#06b6d4' },
  { id: 'avatar_9', name: 'Panda', icon: '🐼', color: '#f8fafc' },
  { id: 'avatar_10', name: 'Zorro', icon: '🦊', color: '#ea580c' },
];

/**
 * Banco completo de preguntas por bloque temático cargadas desde data.json.
 */
const THEMATIC_QUESTIONS = {
  profesion: questionsData
    .filter((q) => q.theme === 'Profesión' || q.theme.includes('Profesión'))
    .map((q) => ({ ...q, correctAnswer: q.correctIndex })),
  noviazgo: questionsData
    .filter((q) => q.theme === 'Noviazgo' || q.theme.includes('Noviazgo'))
    .map((q) => ({ ...q, correctAnswer: q.correctIndex })),
  ministerio: questionsData
    .filter((q) => q.theme === 'Ministerio' || q.theme.includes('Ministerio'))
    .map((q) => ({ ...q, correctAnswer: q.correctIndex })),
  emociones: questionsData
    .filter((q) => q.theme === 'Emociones' || q.theme.includes('Emociones'))
    .map((q) => ({ ...q, correctAnswer: q.correctIndex })),
};

/**
 * Construye la estructura de las 4 rondas temáticas continuas.
 * Cada ronda contiene automáticamente las preguntas de su respectivo tema
 * ("Profesión", "Noviazgo", "Ministerio", "Emociones").
 *
 * @param {number} [questionsPerTheme=5] - Preguntas por ronda (por defecto 5).
 * @returns {Array<Object>} Arreglo de 4 rondas temáticas.
 */
function buildThematicRounds(questionsPerTheme = 5) {
  let globalIndex = 0;

  return ROUND_THEMES.map((themeLabel, roundIndex) => {
    const key = THEME_NAME_TO_KEY[themeLabel];
    const themeMeta = THEMES[key];
    const availableQuestions = THEMATIC_QUESTIONS[key] || [];
    const selected = availableQuestions.slice(0, Math.max(1, questionsPerTheme));

    const roundQuestions = selected.map((q, idxInRound) => ({
      id: ++globalIndex,
      roundIndex,
      roundNumber: roundIndex + 1,
      totalRounds: ROUND_THEMES.length,
      theme: themeLabel,
      themeId: key,
      themeName: themeMeta.name,
      themeData: themeMeta,
      questionIndexInTheme: idxInRound + 1,
      totalQuestionsInTheme: selected.length,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer ?? q.correctIndex,
      correctIndex: q.correctIndex ?? q.correctAnswer,
    }));

    return {
      roundIndex,
      roundNumber: roundIndex + 1,
      totalRounds: ROUND_THEMES.length,
      theme: themeLabel,
      themeId: key,
      themeName: themeMeta.name,
      themeData: themeMeta,
      questions: roundQuestions,
    };
  });
}

/**
 * Genera la secuencia completa de preguntas agrupadas en las 4 rondas temáticas.
 * @param {number} [questionsPerTheme=5] - Cantidad de preguntas por cada uno de los 4 temas (por defecto 5).
 * @returns {Array<Object>} Lista de preguntas estructuradas con metadatos de ronda y tema.
 */
function generateThematicGameSequence(questionsPerTheme = 5) {
  const rounds = buildThematicRounds(questionsPerTheme);
  return rounds.reduce((acc, round) => acc.concat(round.questions), []);
}

/**
 * Obtiene o asigna un avatar a partir de un id o de forma aleatoria.
 * @param {string|number} [avatarIdentifier]
 * @returns {Object} Avatar
 */
function resolveAvatar(avatarIdentifier) {
  if (avatarIdentifier) {
    const found = AVATARS.find(
      (a, index) => a.id === avatarIdentifier || index === Number(avatarIdentifier)
    );
    if (found) return found;
  }
  // Asignación aleatoria
  const randomIndex = Math.floor(Math.random() * AVATARS.length);
  return AVATARS[randomIndex];
}

module.exports = {
  ROUND_THEMES,
  THEMES,
  THEME_NAME_TO_KEY,
  AVATARS,
  THEMATIC_QUESTIONS,
  buildThematicRounds,
  generateThematicGameSequence,
  resolveAvatar,
};
