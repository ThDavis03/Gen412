/**
 * questions.js
 * Módulo exportable con el cuestionario completo de lectura ultra rápida (<5s)
 * para el evento "Generación 4:12", organizado en 4 rondas temáticas de 5 preguntas.
 */

const questionsData = require('../../data.json');

/**
 * Orden estricto de las 4 rondas temáticas continuas
 */
const ROUND_THEMES = ['Profesión', 'Noviazgo', 'Ministerio', 'Emociones'];

/**
 * Nombres cortos y extendidos de los 4 talleres
 */
const THEME_NAMES = {
  PROFESION: 'Profesión',
  NOVIAZGO: 'Noviazgo',
  MINISTERIO: 'Ministerio',
  EMOCIONES: 'Emociones',
};

/**
 * Obtiene las 5 preguntas asociadas a un tema específico.
 * @param {string} themeName - "Profesión" | "Noviazgo" | "Ministerio" | "Emociones"
 * @returns {Array}
 */
function getQuestionsByTheme(themeName) {
  const normalized = (themeName || '').trim().toLowerCase();
  return questionsData.filter((q) => {
    const qTheme = (q.theme || '').trim().toLowerCase();
    return qTheme === normalized || normalized.includes(qTheme) || qTheme.includes(normalized);
  });
}

/**
 * Agrupa las preguntas en un mapa indexado por cada uno de los 4 temas.
 * @returns {Record<string, Array>}
 */
function getQuestionsGroupedByTheme() {
  return ROUND_THEMES.reduce((acc, themeName) => {
    acc[themeName] = getQuestionsByTheme(themeName);
    return acc;
  }, {});
}

/**
 * Construye las 4 rondas temáticas continuas (cada una con sus 5 preguntas).
 * @returns {Array<{ roundIndex: number, roundNumber: number, theme: string, questions: Array }>}
 */
function getThematicRounds() {
  return ROUND_THEMES.map((themeName, idx) => ({
    roundIndex: idx,
    roundNumber: idx + 1,
    theme: themeName,
    questions: getQuestionsByTheme(themeName),
  }));
}

module.exports = {
  questions: questionsData,
  ROUND_THEMES,
  THEME_NAMES,
  getQuestionsByTheme,
  getQuestionsGroupedByTheme,
  getThematicRounds,
};
