/**
 * teams.js
 * Definición de los 4 equipos fijos del modo de juego por equipos de Generación 4:12
 * y utilidades de validación/normalización para su edición desde el panel de administración.
 */

/**
 * Equipos por defecto (id fijo, animal y nombre editables desde el panel).
 */
const DEFAULT_TEAMS = Object.freeze([
  Object.freeze({ id: 'leon', animal: 'León', name: 'Fe Indomable', emoji: '🦁', color: '#f59e0b' }),
  Object.freeze({ id: 'cordero', animal: 'Cordero', name: 'Elegidos', emoji: '🐑', color: '#e2e8f0' }),
  Object.freeze({ id: 'aguila', animal: 'Águila', name: 'Renovados', emoji: '🦅', color: '#38bdf8' }),
  Object.freeze({ id: 'paloma', animal: 'Paloma', name: 'Bajo Sus Alas', emoji: '🕊️', color: '#34d399' }),
]);

const TEAM_IDS = DEFAULT_TEAMS.map((t) => t.id);

const TEAM_ASSIGNMENT_MODES = Object.freeze({
  RANDOM: 'random',
  CHOICE: 'choice',
});

/**
 * Devuelve una copia mutable de los equipos por defecto.
 * @returns {Array<{id: string, animal: string, name: string, emoji: string, color: string}>}
 */
function cloneDefaultTeams() {
  return DEFAULT_TEAMS.map((t) => ({ ...t }));
}

/**
 * Normaliza el modo de asignación de equipos a 'random' | 'choice'.
 * Acepta alias en español.
 * @param {string} raw
 * @param {string} [fallback='random']
 * @returns {'random'|'choice'}
 */
function normalizeTeamAssignment(raw, fallback = TEAM_ASSIGNMENT_MODES.RANDOM) {
  if (typeof raw !== 'string') return fallback;
  const clean = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (['random', 'aleatoria', 'aleatorio', 'azar'].includes(clean)) {
    return TEAM_ASSIGNMENT_MODES.RANDOM;
  }
  if (['choice', 'eleccion', 'player', 'jugador', 'manual', 'por eleccion del jugador'].includes(clean)) {
    return TEAM_ASSIGNMENT_MODES.CHOICE;
  }
  return fallback;
}

/**
 * Aplica ediciones (nombre y/o animal) sobre la lista de equipos actual.
 * El id y la cantidad de equipos son fijos; las entradas desconocidas se ignoran.
 *
 * @param {Array<Object>} currentTeams - Equipos vigentes (se muta una copia, no el original).
 * @param {Array<{id: string, name?: string, animal?: string}>} edits
 * @returns {Array<Object>} Nueva lista de equipos con los cambios aplicados.
 * @throws {Error} Si un nombre es inválido (vacío o > 30 caracteres).
 */
function applyTeamEdits(currentTeams, edits) {
  if (!Array.isArray(edits)) {
    throw new Error("El campo 'teams' debe ser un arreglo de equipos.");
  }

  const next = currentTeams.map((t) => ({ ...t }));

  edits.forEach((edit) => {
    if (!edit || typeof edit !== 'object') return;
    const target = next.find((t) => t.id === edit.id);
    if (!target) return;

    if (edit.name !== undefined) {
      const name = String(edit.name).trim();
      if (name.length < 1 || name.length > 30) {
        throw new Error(`El nombre del equipo ${target.animal} debe tener entre 1 y 30 caracteres.`);
      }
      target.name = name;
    }

    if (edit.animal !== undefined) {
      const animal = String(edit.animal).trim();
      if (animal.length < 1 || animal.length > 20) {
        throw new Error(`El animal del equipo "${target.name}" debe tener entre 1 y 20 caracteres.`);
      }
      target.animal = animal;
    }
  });

  return next;
}

module.exports = {
  DEFAULT_TEAMS,
  TEAM_IDS,
  TEAM_ASSIGNMENT_MODES,
  cloneDefaultTeams,
  normalizeTeamAssignment,
  applyTeamEdits,
};
