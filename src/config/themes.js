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
 * Seeds fijos para los 20 avatares de DiceBear (estilo 'bottts').
 */
const DICEBEAR_SEEDS = Array.from({ length: 20 }, (_, i) => `avatar${i + 1}`);

function getDiceBearUrl(seed = 'avatar1', style = 'bottts') {
  const cleanSeed = String(seed || 'avatar1').trim();
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(cleanSeed)}`;
}

/**
 * Catálogo de avatares predefinidos (20 seeds DiceBear + retrocompatibilidad).
 */
const AVATARS = DICEBEAR_SEEDS.map((seed, index) => ({
  id: seed,
  seed,
  name: `Avatar ${index + 1}`,
  icon: '🤖',
  color: '#a855f7',
  url: getDiceBearUrl(seed),
}));

/**
 * Banco en memoria de preguntas por bloque temático (inicializado desde data.json
 * y actualizable dinámicamente en caliente desde el panel de administración).
 */
let inMemoryQuestions = Array.isArray(questionsData) ? [...questionsData] : [];

const THEMATIC_QUESTIONS = {
  profesion: [],
  noviazgo: [],
  ministerio: [],
  emociones: [],
};

/**
 * Sobrescribe en memoria el banco de preguntas actual a partir de un arreglo JSON.
 *
 * @param {Array<Object>} newQuestionsArray
 * @returns {{ total: number, countsByTheme: Record<string, number> }}
 */
function setQuestionsBank(newQuestionsArray) {
  if (!Array.isArray(newQuestionsArray) || newQuestionsArray.length === 0) {
    throw new Error('El archivo JSON debe contener un arreglo no vacío de preguntas.');
  }

  const normalizedList = newQuestionsArray.map((q, idx) => {
    if (!q || typeof q.question !== 'string' || !q.question.trim()) {
      throw new Error(`La pregunta en la posición ${idx + 1} no tiene un texto válido ('question').`);
    }
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      throw new Error(`La pregunta "${q.question}" debe tener exactamente un arreglo de 4 opciones ('options').`);
    }
    const cIdx = q.correctIndex !== undefined ? Number(q.correctIndex) : Number(q.correctAnswer);
    if (isNaN(cIdx) || cIdx < 0 || cIdx > 3) {
      throw new Error(`La pregunta "${q.question}" debe tener un 'correctIndex' válido entre 0 y 3.`);
    }
    return {
      ...q,
      theme: typeof q.theme === 'string' && q.theme.trim() ? q.theme.trim() : 'Profesión',
      question: q.question.trim(),
      options: q.options.map((opt) => String(opt)),
      correctIndex: cIdx,
      correctAnswer: cIdx,
    };
  });

  inMemoryQuestions = normalizedList;

  THEMATIC_QUESTIONS.profesion = normalizedList.filter(
    (q) => q.theme === 'Profesión' || q.theme.toLowerCase().includes('profesi')
  );
  THEMATIC_QUESTIONS.noviazgo = normalizedList.filter(
    (q) => q.theme === 'Noviazgo' || q.theme.toLowerCase().includes('noviazgo')
  );
  THEMATIC_QUESTIONS.ministerio = normalizedList.filter(
    (q) => q.theme === 'Ministerio' || q.theme.toLowerCase().includes('ministerio')
  );
  THEMATIC_QUESTIONS.emociones = normalizedList.filter(
    (q) => q.theme === 'Emociones' || q.theme.toLowerCase().includes('emocion')
  );

  // Si hay preguntas con temas personalizados no mapeados en los 4 estándar, distribuirlas equitativamente
  const mappedCount =
    THEMATIC_QUESTIONS.profesion.length +
    THEMATIC_QUESTIONS.noviazgo.length +
    THEMATIC_QUESTIONS.ministerio.length +
    THEMATIC_QUESTIONS.emociones.length;

  if (mappedCount === 0 && normalizedList.length > 0) {
    const keys = ['profesion', 'noviazgo', 'ministerio', 'emociones'];
    normalizedList.forEach((q, index) => {
      const targetKey = keys[index % keys.length];
      THEMATIC_QUESTIONS[targetKey].push(q);
    });
  }

  return getQuestionsBankStats();
}

/**
 * Obtiene estadísticas del banco de preguntas actual en memoria.
 */
function getQuestionsBankStats() {
  return {
    total: inMemoryQuestions.length,
    countsByTheme: {
      Profesión: THEMATIC_QUESTIONS.profesion.length,
      Noviazgo: THEMATIC_QUESTIONS.noviazgo.length,
      Ministerio: THEMATIC_QUESTIONS.ministerio.length,
      Emociones: THEMATIC_QUESTIONS.emociones.length,
    },
    questions: inMemoryQuestions,
  };
}

// Inicializar banco en memoria con los datos por defecto de data.json
setQuestionsBank(inMemoryQuestions);

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
 * Obtiene o asigna un avatar a partir de un seed/id de DiceBear o de forma aleatoria.
 * @param {string|number} [avatarIdentifier]
 * @returns {Object} Avatar
 */
function resolveAvatar(avatarIdentifier) {
  if (avatarIdentifier !== undefined && avatarIdentifier !== null && avatarIdentifier !== '') {
    if (typeof avatarIdentifier === 'number' || /^\d+$/.test(String(avatarIdentifier))) {
      const idx = Number(avatarIdentifier);
      if (idx >= 0 && idx < AVATARS.length) {
        return AVATARS[idx];
      }
    }

    const strId = String(avatarIdentifier).trim();
    const found = AVATARS.find((a) => a.id === strId || a.seed === strId);
    if (found) return found;

    if (strId.length > 0) {
      return {
        id: strId,
        seed: strId,
        name: strId,
        icon: '🤖',
        color: '#a855f7',
        url: getDiceBearUrl(strId),
      };
    }
  }
  // Asignación aleatoria entre los 20 seeds predefinidos
  const randomIndex = Math.floor(Math.random() * AVATARS.length);
  return AVATARS[randomIndex];
}

module.exports = {
  ROUND_THEMES,
  THEMES,
  THEME_NAME_TO_KEY,
  DICEBEAR_SEEDS,
  AVATARS,
  THEMATIC_QUESTIONS,
  getDiceBearUrl,
  setQuestionsBank,
  getQuestionsBankStats,
  buildThematicRounds,
  generateThematicGameSequence,
  resolveAvatar,
};

