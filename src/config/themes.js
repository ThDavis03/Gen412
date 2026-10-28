/**
 * themes.js
 * Definición centralizada de bloques temáticos (dinámicos), banco de preguntas en memoria
 * con CRUD, rondas continuas y catálogo de avatares para el sistema de trivia interactiva Gen412.
 *
 * Los 4 temas oficiales ("Profesión", "Noviazgo", "Ministerio", "Emociones") se incluyen por defecto
 * y el administrador puede crear temas nuevos y gestionar preguntas desde el panel /admin.
 */

const questionsData = require('../../data.json');

// =========================================================================
// 1. Utilidades
// =========================================================================

/**
 * Normaliza texto para comparaciones (minúsculas, sin acentos, sin espacios sobrantes).
 * @param {*} value
 * @returns {string}
 */
function normalizeText(value) {
  return String(value === undefined || value === null ? '' : value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function createUserError(message) {
  const err = new Error(message);
  err.userFacing = true;
  return err;
}

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Mezcla dos colores hex. t=0 devuelve a, t=1 devuelve b.
 */
function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

// =========================================================================
// 2. Temas (dinámicos)
// =========================================================================

/**
 * Orden estricto de las rondas temáticas. Se mantiene sincronizado (mutación in-place)
 * con las etiquetas de los temas existentes.
 * @type {string[]}
 */
const ROUND_THEMES = [];

/**
 * Catálogo de temas indexado por id. Se muta en caliente al crear/editar/eliminar temas.
 * @type {Record<string, Object>}
 */
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
    builtin: true,
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
    builtin: true,
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
    builtin: true,
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
    builtin: true,
  },
};

/**
 * Mapa de etiqueta de tema a su id interno (se reconstruye al mutar temas).
 * @type {Record<string, string>}
 */
const THEME_NAME_TO_KEY = {};

/**
 * Raíces para reconocer variantes de los 4 temas oficiales al importar archivos JSON.
 */
const BUILTIN_THEME_ROOTS = {
  profesion: 'profesi',
  noviazgo: 'noviazgo',
  ministerio: 'ministerio',
  emociones: 'emocion',
};

/**
 * Paleta neón usada para asignar color automático a los temas nuevos.
 */
const CUSTOM_THEME_PALETTE = ['#f97316', '#22c55e', '#3b82f6', '#ef4444', '#06b6d4', '#8b5cf6', '#84cc16', '#f43f5e'];

function buildThemeVisuals(color) {
  return {
    color,
    accentColor: mixHex(color, '#ffffff', 0.3),
    bgGradient: `linear-gradient(135deg, #0f172a 0%, ${mixHex('#0f172a', color, 0.22)} 100%)`,
  };
}

function slugify(text) {
  return (
    normalizeText(text)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'tema'
  );
}

function generateUniqueThemeId(name) {
  const base = slugify(name);
  let candidate = base;
  let n = 2;
  while (THEMES[candidate]) {
    candidate = `${base}-${n++}`;
  }
  return candidate;
}

function sanitizeIcon(icon) {
  const raw = typeof icon === 'string' ? icon.trim() : '';
  if (!raw) return '⭐';
  return Array.from(raw).slice(0, 3).join('');
}

function isThemeNameTaken(name, ignoreId = null) {
  const norm = normalizeText(name);
  return Object.values(THEMES).some(
    (t) => t.id !== ignoreId && [t.theme, t.name, t.shortName].some((label) => normalizeText(label) === norm)
  );
}

/**
 * Crea un nuevo tema.
 * @param {{ name: string, icon?: string, color?: string, subtitle?: string }} input
 * @returns {Object} Tema creado.
 */
function createTheme(input = {}) {
  const rawName = typeof input.name === 'string' ? input.name : typeof input.theme === 'string' ? input.theme : '';
  const name = rawName.trim();
  if (name.length < 2 || name.length > 60) {
    throw createUserError('El nombre del tema debe tener entre 2 y 60 caracteres.');
  }
  if (isThemeNameTaken(name)) {
    throw createUserError(`Ya existe un tema llamado "${name}".`);
  }

  let color = typeof input.color === 'string' ? input.color.trim() : '';
  if (color && !HEX_COLOR_REGEX.test(color)) {
    throw createUserError("El color del tema debe tener formato hexadecimal (ej. '#f97316').");
  }
  if (!color) {
    const customCount = Object.values(THEMES).filter((t) => !t.builtin).length;
    color = CUSTOM_THEME_PALETTE[customCount % CUSTOM_THEME_PALETTE.length];
  }

  const id = generateUniqueThemeId(name);
  const theme = {
    id,
    key: id,
    theme: name,
    name,
    shortName: name,
    subtitle: typeof input.subtitle === 'string' ? input.subtitle.trim().slice(0, 120) : '',
    icon: sanitizeIcon(input.icon),
    builtin: false,
    ...buildThemeVisuals(color.toLowerCase()),
  };

  THEMES[id] = theme;
  syncDerivedState();
  return theme;
}

/**
 * Actualiza un tema existente. Los temas oficiales solo permiten cambiar ícono y color.
 * @param {string} id
 * @param {{ name?: string, theme?: string, icon?: string, color?: string }} patch
 * @returns {Object} Tema actualizado.
 */
function updateTheme(id, patch = {}) {
  const theme = THEMES[id];
  if (!theme) {
    throw createUserError('El tema especificado no existe.');
  }

  const rawPatchName = patch.name !== undefined ? patch.name : patch.theme;
  if (rawPatchName !== undefined && !theme.builtin) {
    const name = String(rawPatchName).trim();
    if (name.length < 2 || name.length > 60) {
      throw createUserError('El nombre del tema debe tener entre 2 y 60 caracteres.');
    }
    if (isThemeNameTaken(name, id)) {
      throw createUserError(`Ya existe un tema llamado "${name}".`);
    }
    theme.theme = name;
    theme.name = name;
    theme.shortName = name;
  }

  if (patch.icon !== undefined) {
    theme.icon = sanitizeIcon(patch.icon);
  }

  if (patch.color !== undefined) {
    const color = String(patch.color).trim();
    if (!HEX_COLOR_REGEX.test(color)) {
      throw createUserError("El color del tema debe tener formato hexadecimal (ej. '#f97316').");
    }
    // Los temas oficiales conservan su gradiente curado; solo se ajusta el color principal.
    if (theme.builtin) {
      theme.color = color.toLowerCase();
      theme.accentColor = mixHex(color, '#ffffff', 0.3);
    } else {
      Object.assign(theme, buildThemeVisuals(color.toLowerCase()));
    }
  }

  syncDerivedState();
  return theme;
}

/**
 * Elimina un tema personalizado junto con todas sus preguntas.
 * @param {string} id
 * @returns {{ removedQuestions: number }}
 */
function deleteTheme(id) {
  const theme = THEMES[id];
  if (!theme) {
    throw createUserError('El tema especificado no existe.');
  }
  if (theme.builtin) {
    throw createUserError('Los 4 temas oficiales no se pueden eliminar (puedes desmarcarlos de la partida).');
  }

  const before = questionBank.length;
  questionBank = questionBank.filter((q) => q.themeId !== id);
  delete THEMES[id];
  syncDerivedState();
  return { removedQuestions: before - questionBank.length };
}

/**
 * Obtiene un tema por id.
 * @param {string} id
 * @returns {Object|undefined}
 */
function getTheme(id) {
  return THEMES[id];
}

/**
 * Lista todos los temas con la cantidad de preguntas de cada uno.
 * @returns {Array<Object>}
 */
function listThemes() {
  return Object.values(THEMES).map((t) => ({
    id: t.id,
    name: t.name,
    theme: t.theme,
    shortName: t.shortName,
    subtitle: t.subtitle,
    icon: t.icon,
    color: t.color,
    builtin: Boolean(t.builtin),
    questionCount: questionBank.filter((q) => q.themeId === t.id).length,
  }));
}

/**
 * Resuelve el id de tema a partir de una etiqueta libre (nombre completo, corto o variante).
 * @param {string} label
 * @param {{ create?: boolean }} [options] - Si create es true, crea el tema cuando no existe.
 * @returns {string|null}
 */
function resolveThemeId(label, { create = false } = {}) {
  const norm = normalizeText(label);
  if (!norm) return null;

  for (const t of Object.values(THEMES)) {
    if ([t.id, t.theme, t.name, t.shortName].some((v) => normalizeText(v) === norm)) {
      return t.id;
    }
  }

  for (const [id, root] of Object.entries(BUILTIN_THEME_ROOTS)) {
    if (THEMES[id] && norm.includes(root)) {
      return id;
    }
  }

  if (create) {
    return createTheme({ name: String(label).trim() }).id;
  }
  return null;
}

// =========================================================================
// 3. Avatares
// =========================================================================

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

// =========================================================================
// 4. Banco de preguntas en memoria (con CRUD)
// =========================================================================

/**
 * Banco de preguntas: { id, themeId, question, options[4], correctIndex }.
 * @type {Array<Object>}
 */
let questionBank = [];
let nextQuestionId = 1;

/**
 * Índice derivado themeId -> preguntas (se reconstruye en cada cambio).
 * @type {Record<string, Array<Object>>}
 */
const THEMATIC_QUESTIONS = {};

function syncDerivedState() {
  ROUND_THEMES.length = 0;
  Object.keys(THEME_NAME_TO_KEY).forEach((k) => delete THEME_NAME_TO_KEY[k]);
  Object.keys(THEMATIC_QUESTIONS).forEach((k) => delete THEMATIC_QUESTIONS[k]);

  Object.values(THEMES).forEach((t) => {
    ROUND_THEMES.push(t.theme);
    THEME_NAME_TO_KEY[t.theme] = t.id;
    THEMATIC_QUESTIONS[t.id] = questionBank
      .filter((q) => q.themeId === t.id)
      .map((q) => toPublicQuestion(q));
  });
}

function toPublicQuestion(q) {
  const theme = THEMES[q.themeId];
  return {
    id: q.id,
    themeId: q.themeId,
    theme: theme ? theme.theme : q.themeId,
    themeName: theme ? theme.name : q.themeId,
    question: q.question,
    options: [...q.options],
    correctIndex: q.correctIndex,
    correctAnswer: q.correctIndex,
  };
}

/**
 * Valida y normaliza los campos de una pregunta.
 * @param {Object} q
 * @param {string} [label] - Texto descriptivo para mensajes de error.
 * @returns {{ question: string, options: string[], correctIndex: number }}
 */
function validateQuestionFields(q, label = '') {
  const where = label ? ` ${label}` : '';

  if (!q || typeof q.question !== 'string' || !q.question.trim()) {
    throw createUserError(`La pregunta${where} no tiene un texto válido ('question').`);
  }
  const questionText = q.question.trim();
  if (questionText.length > 300) {
    throw createUserError(`La pregunta "${questionText.slice(0, 40)}…" supera los 300 caracteres.`);
  }

  if (!Array.isArray(q.options) || q.options.length !== 4) {
    throw createUserError(`La pregunta "${questionText}" debe tener exactamente un arreglo de 4 opciones ('options').`);
  }
  const options = q.options.map((opt) => String(opt === undefined || opt === null ? '' : opt).trim());
  if (options.some((opt) => opt.length === 0)) {
    throw createUserError(`La pregunta "${questionText}" no puede tener opciones vacías.`);
  }
  if (options.some((opt) => opt.length > 120)) {
    throw createUserError(`Las opciones de "${questionText}" no pueden superar los 120 caracteres.`);
  }

  const cIdx = q.correctIndex !== undefined ? Number(q.correctIndex) : Number(q.correctAnswer);
  if (!Number.isInteger(cIdx) || cIdx < 0 || cIdx > 3) {
    throw createUserError(`La pregunta "${questionText}" debe tener un 'correctIndex' válido entre 0 y 3.`);
  }

  return { question: questionText, options, correctIndex: cIdx };
}

/**
 * Sobrescribe en memoria el banco de preguntas actual a partir de un arreglo JSON.
 * Los temas desconocidos del archivo se crean automáticamente como temas nuevos.
 *
 * @param {Array<Object>} newQuestionsArray
 * @returns {{ total: number, countsByTheme: Record<string, number> }}
 */
function setQuestionsBank(newQuestionsArray) {
  if (!Array.isArray(newQuestionsArray) || newQuestionsArray.length === 0) {
    throw createUserError('El archivo JSON debe contener un arreglo no vacío de preguntas.');
  }

  // Pasada 1: validar todo antes de mutar el estado (evita crear temas si el archivo es inválido)
  const validated = newQuestionsArray.map((q, idx) => ({
    raw: q,
    fields: validateQuestionFields(q, `en la posición ${idx + 1}`),
  }));

  // Pasada 2: resolver/crear temas y reemplazar el banco
  const nextBank = validated.map(({ raw, fields }) => {
    let themeId = raw.themeId && THEMES[raw.themeId] ? raw.themeId : null;
    if (!themeId) {
      const label = typeof raw.theme === 'string' && raw.theme.trim() ? raw.theme.trim() : 'Profesión';
      themeId = resolveThemeId(label, { create: true });
    }
    return { id: nextQuestionId++, themeId, ...fields };
  });

  questionBank = nextBank;
  syncDerivedState();
  return getQuestionsBankStats();
}

/**
 * Agrega una pregunta al banco.
 * @param {{ themeId?: string, theme?: string, question: string, options: string[], correctIndex: number }} input
 * @returns {Object} Pregunta creada.
 */
function addQuestion(input = {}) {
  const fields = validateQuestionFields(input);
  const themeId = input.themeId && THEMES[input.themeId] ? input.themeId : resolveThemeId(input.theme || '', { create: false });
  if (!themeId) {
    throw createUserError('Debes seleccionar un tema válido para la pregunta.');
  }

  const entry = { id: nextQuestionId++, themeId, ...fields };
  questionBank.push(entry);
  syncDerivedState();
  return toPublicQuestion(entry);
}

/**
 * Edita una pregunta existente.
 * @param {number|string} id
 * @param {Object} input - Campos a reemplazar (question, options, correctIndex, themeId).
 * @returns {Object} Pregunta actualizada.
 */
function updateQuestion(id, input = {}) {
  const numericId = Number(id);
  const entry = questionBank.find((q) => q.id === numericId);
  if (!entry) {
    throw createUserError('La pregunta especificada no existe.');
  }

  const fields = validateQuestionFields({
    question: input.question !== undefined ? input.question : entry.question,
    options: input.options !== undefined ? input.options : entry.options,
    correctIndex:
      input.correctIndex !== undefined || input.correctAnswer !== undefined
        ? input.correctIndex !== undefined
          ? input.correctIndex
          : input.correctAnswer
        : entry.correctIndex,
  });

  let themeId = entry.themeId;
  if (input.themeId !== undefined || input.theme !== undefined) {
    const resolved =
      input.themeId && THEMES[input.themeId] ? input.themeId : resolveThemeId(input.theme || '', { create: false });
    if (!resolved) {
      throw createUserError('El tema seleccionado no existe.');
    }
    themeId = resolved;
  }

  Object.assign(entry, fields, { themeId });
  syncDerivedState();
  return toPublicQuestion(entry);
}

/**
 * Elimina una pregunta del banco.
 * @param {number|string} id
 * @returns {boolean} true si se eliminó.
 */
function deleteQuestion(id) {
  const numericId = Number(id);
  const before = questionBank.length;
  questionBank = questionBank.filter((q) => q.id !== numericId);
  if (questionBank.length === before) {
    throw createUserError('La pregunta especificada no existe.');
  }
  syncDerivedState();
  return true;
}

/**
 * Lista las preguntas del banco (opcionalmente filtradas por tema).
 * @param {string} [themeId]
 * @returns {Array<Object>}
 */
function listQuestions(themeId = null) {
  return questionBank.filter((q) => !themeId || q.themeId === themeId).map(toPublicQuestion);
}

/**
 * Obtiene estadísticas del banco de preguntas actual en memoria.
 */
function getQuestionsBankStats() {
  const countsByTheme = {};
  Object.values(THEMES).forEach((t) => {
    countsByTheme[t.theme] = questionBank.filter((q) => q.themeId === t.id).length;
  });

  return {
    total: questionBank.length,
    countsByTheme,
    questions: listQuestions(),
    themes: listThemes(),
  };
}

// Inicializar banco en memoria con los datos por defecto de data.json
syncDerivedState();
setQuestionsBank(Array.isArray(questionsData) ? questionsData : []);

// =========================================================================
// 5. Rondas temáticas
// =========================================================================

/**
 * Construye la estructura de rondas temáticas continuas.
 * Cada ronda contiene automáticamente las preguntas de su respectivo tema.
 * Solo participan los temas seleccionados que tengan al menos una pregunta.
 *
 * @param {number} [questionsPerTheme=5] - Preguntas por ronda (por defecto 5).
 * @param {string[]|null} [selectedThemeIds=null] - Temas participantes (null = todos).
 * @returns {Array<Object>} Arreglo de rondas temáticas.
 */
function buildThematicRounds(questionsPerTheme = 5, selectedThemeIds = null) {
  const selection = Array.isArray(selectedThemeIds) ? new Set(selectedThemeIds) : null;

  const activeThemes = Object.values(THEMES).filter((t) => {
    if (selection && !selection.has(t.id)) return false;
    return (THEMATIC_QUESTIONS[t.id] || []).length > 0;
  });

  let globalIndex = 0;
  const totalRounds = activeThemes.length;

  return activeThemes.map((themeMeta, roundIndex) => {
    const availableQuestions = THEMATIC_QUESTIONS[themeMeta.id] || [];
    const selected = availableQuestions.slice(0, Math.max(1, questionsPerTheme));

    const roundQuestions = selected.map((q, idxInRound) => ({
      id: ++globalIndex,
      roundIndex,
      roundNumber: roundIndex + 1,
      totalRounds,
      theme: themeMeta.theme,
      themeId: themeMeta.id,
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
      totalRounds,
      theme: themeMeta.theme,
      themeId: themeMeta.id,
      themeName: themeMeta.name,
      themeData: themeMeta,
      questions: roundQuestions,
    };
  });
}

/**
 * Genera la secuencia completa de preguntas agrupadas en rondas temáticas.
 * @param {number} [questionsPerTheme=5]
 * @param {string[]|null} [selectedThemeIds=null]
 * @returns {Array<Object>} Lista de preguntas estructuradas con metadatos de ronda y tema.
 */
function generateThematicGameSequence(questionsPerTheme = 5, selectedThemeIds = null) {
  const rounds = buildThematicRounds(questionsPerTheme, selectedThemeIds);
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
  // Temas
  getTheme,
  listThemes,
  createTheme,
  updateTheme,
  deleteTheme,
  resolveThemeId,
  // Preguntas
  setQuestionsBank,
  getQuestionsBankStats,
  listQuestions,
  addQuestion,
  updateQuestion,
  deleteQuestion,
  // Rondas y avatares
  buildThematicRounds,
  generateThematicGameSequence,
  resolveAvatar,
};
