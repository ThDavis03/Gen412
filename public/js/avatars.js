/**
 * avatars.js
 * Sistema de Avatares con DiceBear API (estilo 'bottts') con selección libre
 * sobre un arreglo fijo de 20 seeds ('avatar1' a 'avatar20').
 */

export const DICEBEAR_STYLE = 'bottts';

/**
 * Arreglo de 20 seeds fijos para que las opciones del grid sean siempre consistentes y visibles.
 */
export const DICEBEAR_SEEDS = [
  'avatar1',
  'avatar2',
  'avatar3',
  'avatar4',
  'avatar5',
  'avatar6',
  'avatar7',
  'avatar8',
  'avatar9',
  'avatar10',
  'avatar11',
  'avatar12',
  'avatar13',
  'avatar14',
  'avatar15',
  'avatar16',
  'avatar17',
  'avatar18',
  'avatar19',
  'avatar20',
];

/**
 * Genera la URL del avatar en formato SVG desde la API oficial de DiceBear.
 * @param {string} [seed='avatar1']
 * @param {string} [style=DICEBEAR_STYLE]
 * @returns {string}
 */
export function getDiceBearAvatarUrl(seed = 'avatar1', style = DICEBEAR_STYLE) {
  const cleanSeed = String(seed || 'avatar1').trim();
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(cleanSeed)}`;
}

/**
 * Catálogo completo de 20 avatares fijos de DiceBear.
 */
export const SVG_AVATARS = DICEBEAR_SEEDS.map((seed, index) => ({
  id: seed,
  seed,
  name: `Bot #${index + 1}`,
  url: getDiceBearAvatarUrl(seed),
}));

/**
 * Devuelve el elemento HTML <img> correspondiente al seed de DiceBear para insertar en el Lobby,
 * las píldoras del Host, la tabla de posiciones y el Podio.
 *
 * @param {string} [avatarSeed='avatar1']
 * @returns {string}
 */
export function getAvatarSvg(avatarSeed = 'avatar1') {
  const seed = String(avatarSeed || 'avatar1').trim();
  const url = getDiceBearAvatarUrl(seed);
  return `<img src="${url}" alt="Avatar ${seed}" class="dicebear-avatar-img" data-seed="${seed}" draggable="false" />`;
}

export function getAvatarById(avatarSeed = 'avatar1') {
  const seed = String(avatarSeed || 'avatar1').trim();
  return (
    SVG_AVATARS.find((a) => a.id === seed || a.seed === seed) || {
      id: seed,
      seed,
      name: seed,
      url: getDiceBearAvatarUrl(seed),
    }
  );
}
