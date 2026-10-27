/**
 * avatars.js
 * Catálogo de 8 avatares vectoriales en formato SVG (estilo flat, coloridos y expresivos).
 * Genera código SVG inline optimizado para selector, lobby tags y podio.
 */

export const SVG_AVATARS = [
  {
    id: 'avatar_1',
    name: 'Zorblax',
    color: '#8b5cf6',
    svg: `<svg viewBox="0 0 100 100" class="svg-avatar-vector">
      <defs>
        <radialGradient id="grad-zorblax" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#a78bfa" />
          <stop offset="100%" stop-color="#7c3aed" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="url(#grad-zorblax)" />
      <!-- Antena -->
      <line x1="50" y1="20" x2="50" y2="8" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
      <circle cx="50" cy="7" r="6" fill="#38bdf8" />
      <!-- Ojo central grande -->
      <circle cx="50" cy="46" r="16" fill="#ffffff" />
      <circle cx="50" cy="46" r="8" fill="#0f172a" />
      <circle cx="53" cy="43" r="3" fill="#38bdf8" />
      <!-- Ojos laterales pequeños -->
      <circle cx="28" cy="42" r="8" fill="#ffffff" />
      <circle cx="28" cy="42" r="4" fill="#0f172a" />
      <circle cx="72" cy="42" r="8" fill="#ffffff" />
      <circle cx="72" cy="42" r="4" fill="#0f172a" />
      <!-- Sonrisa -->
      <path d="M 38 68 Q 50 80 62 68" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" />
    </svg>`,
  },
  {
    id: 'avatar_2',
    name: 'Ignis',
    color: '#f97316',
    svg: `<svg viewBox="0 0 100 100" class="svg-avatar-vector">
      <defs>
        <linearGradient id="grad-ignis" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fde047" />
          <stop offset="50%" stop-color="#f97316" />
          <stop offset="100%" stop-color="#dc2626" />
        </linearGradient>
      </defs>
      <!-- Silueta de Fuego -->
      <circle cx="50" cy="50" r="46" fill="#451a03" />
      <path d="M 50 14 C 64 30 78 44 78 62 C 78 78 66 88 50 88 C 34 88 22 78 22 62 C 22 46 40 32 50 14 Z" fill="url(#grad-ignis)" />
      <!-- Ojos -->
      <ellipse cx="40" cy="58" rx="5" ry="7" fill="#ffffff" />
      <circle cx="40" cy="58" r="3.5" fill="#18181b" />
      <ellipse cx="60" cy="58" rx="5" ry="7" fill="#ffffff" />
      <circle cx="60" cy="58" r="3.5" fill="#18181b" />
      <!-- Sonrisa de fuego -->
      <path d="M 42 72 Q 50 78 58 72" stroke="#ffffff" stroke-width="3.5" fill="none" stroke-linecap="round" />
    </svg>`,
  },
  {
    id: 'avatar_3',
    name: 'Krono',
    color: '#eab308',
    svg: `<svg viewBox="0 0 100 100" class="svg-avatar-vector">
      <defs>
        <linearGradient id="grad-krono" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fef08a" />
          <stop offset="100%" stop-color="#eab308" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="84" height="84" rx="24" fill="#18181b" stroke="#eab308" stroke-width="3" />
      <!-- Rayo central -->
      <polygon points="54,18 34,48 50,48 44,82 66,46 50,46" fill="url(#grad-krono)" filter="drop-shadow(0 0 6px #eab308)" />
      <!-- Ojos tipo robot -->
      <rect x="22" y="38" width="12" height="6" rx="3" fill="#38bdf8" />
      <rect x="66" y="38" width="12" height="6" rx="3" fill="#38bdf8" />
    </svg>`,
  },
  {
    id: 'avatar_4',
    name: 'Leo',
    color: '#e11d48',
    svg: `<svg viewBox="0 0 100 100" class="svg-avatar-vector">
      <!-- Melena -->
      <circle cx="50" cy="50" r="46" fill="#f59e0b" />
      <!-- Cara -->
      <circle cx="50" cy="52" r="32" fill="#fde68a" />
      <!-- Orejas -->
      <circle cx="28" cy="28" r="10" fill="#f59e0b" />
      <circle cx="28" cy="28" r="6" fill="#fde68a" />
      <circle cx="72" cy="28" r="10" fill="#f59e0b" />
      <circle cx="72" cy="28" r="6" fill="#fde68a" />
      <!-- Ojos -->
      <circle cx="38" cy="48" r="4.5" fill="#1e1b4b" />
      <circle cx="62" cy="48" r="4.5" fill="#1e1b4b" />
      <!-- Nariz triangular -->
      <polygon points="50,56 44,64 56,64" fill="#e11d48" />
      <!-- Bigotes -->
      <line x1="28" y1="62" x2="18" y2="60" stroke="#b45309" stroke-width="2" />
      <line x1="28" y1="66" x2="18" y2="68" stroke="#b45309" stroke-width="2" />
      <line x1="72" y1="62" x2="82" y2="60" stroke="#b45309" stroke-width="2" />
      <line x1="72" y1="66" x2="82" y2="68" stroke="#b45309" stroke-width="2" />
    </svg>`,
  },
  {
    id: 'avatar_5',
    name: 'Nova',
    color: '#38bdf8',
    svg: `<svg viewBox="0 0 100 100" class="svg-avatar-vector">
      <defs>
        <linearGradient id="grad-visor" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8" />
          <stop offset="100%" stop-color="#0284c7" />
        </linearGradient>
      </defs>
      <!-- Casco espacial blanco -->
      <circle cx="50" cy="50" r="46" fill="#0f172a" />
      <circle cx="50" cy="50" r="38" fill="#f8fafc" />
      <!-- Visor astronauta con reflejo -->
      <ellipse cx="50" cy="52" rx="28" ry="20" fill="url(#grad-visor)" />
      <ellipse cx="42" cy="46" rx="8" ry="4" fill="#ffffff" opacity="0.6" transform="rotate(-15 42 46)" />
      <!-- Orejeras / Auriculares -->
      <rect x="8" y="44" width="8" height="16" rx="4" fill="#94a3b8" />
      <rect x="84" y="44" width="8" height="16" rx="4" fill="#94a3b8" />
    </svg>`,
  },
  {
    id: 'avatar_6',
    name: 'Búho',
    color: '#10b981',
    svg: `<svg viewBox="0 0 100 100" class="svg-avatar-vector">
      <!-- Cuerpo búho esmeralda -->
      <circle cx="50" cy="50" r="46" fill="#064e3b" />
      <ellipse cx="50" cy="54" rx="34" ry="36" fill="#10b981" />
      <!-- Penachos de orejas -->
      <polygon points="26,24 38,36 22,42" fill="#064e3b" />
      <polygon points="74,24 62,36 78,42" fill="#064e3b" />
      <!-- Grandes Ojos con lentes -->
      <circle cx="37" cy="48" r="14" fill="#fef08a" stroke="#047857" stroke-width="3" />
      <circle cx="37" cy="48" r="6" fill="#064e3b" />
      <circle cx="63" cy="48" r="14" fill="#fef08a" stroke="#047857" stroke-width="3" />
      <circle cx="63" cy="48" r="6" fill="#064e3b" />
      <!-- Pico naranja -->
      <polygon points="50,56 44,66 56,66" fill="#f97316" />
    </svg>`,
  },
  {
    id: 'avatar_7',
    name: 'Specter',
    color: '#06b6d4',
    svg: `<svg viewBox="0 0 100 100" class="svg-avatar-vector">
      <defs>
        <radialGradient id="grad-ghost" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#cffafe" />
          <stop offset="100%" stop-color="#06b6d4" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill="#083344" />
      <!-- Fantasma amigable con ondas inferiores -->
      <path d="M 50 18 C 30 18 24 36 24 54 C 24 72 26 84 32 82 C 38 80 40 86 50 84 C 60 86 62 80 68 82 C 74 84 76 72 76 54 C 76 36 70 18 50 18 Z" fill="url(#grad-ghost)" />
      <!-- Ojos grandes y curiosos -->
      <ellipse cx="42" cy="46" rx="5" ry="7" fill="#083344" />
      <circle cx="43" cy="44" r="2" fill="#ffffff" />
      <ellipse cx="58" cy="46" rx="5" ry="7" fill="#083344" />
      <circle cx="59" cy="44" r="2" fill="#ffffff" />
      <!-- Mejillas sonrojadas -->
      <circle cx="34" cy="54" r="4" fill="#f43f5e" opacity="0.5" />
      <circle cx="66" cy="54" r="4" fill="#f43f5e" opacity="0.5" />
    </svg>`,
  },
  {
    id: 'avatar_8',
    name: 'Panda',
    color: '#f8fafc',
    svg: `<svg viewBox="0 0 100 100" class="svg-avatar-vector">
      <circle cx="50" cy="50" r="46" fill="#18181b" />
      <!-- Orejas negras -->
      <circle cx="24" cy="26" r="12" fill="#09090b" />
      <circle cx="76" cy="26" r="12" fill="#09090b" />
      <!-- Cabeza blanca -->
      <circle cx="50" cy="54" r="36" fill="#f8fafc" />
      <!-- Manchas en los ojos -->
      <ellipse cx="36" cy="50" rx="9" ry="12" fill="#09090b" transform="rotate(-15 36 50)" />
      <circle cx="37" cy="49" r="3" fill="#ffffff" />
      <ellipse cx="64" cy="50" rx="9" ry="12" fill="#09090b" transform="rotate(15 64 50)" />
      <circle cx="63" cy="49" r="3" fill="#ffffff" />
      <!-- Nariz y boca -->
      <ellipse cx="50" cy="64" rx="5" ry="3.5" fill="#09090b" />
      <path d="M 45 70 Q 50 74 55 70" stroke="#09090b" stroke-width="2.5" fill="none" stroke-linecap="round" />
    </svg>`,
  },
];

/**
 * Devuelve el SVG de un avatar por su ID, o el primero por defecto.
 * @param {string} avatarId
 * @returns {string} Código SVG inline
 */
export function getAvatarSvg(avatarId) {
  const found = SVG_AVATARS.find((a) => a.id === avatarId);
  return found ? found.svg : SVG_AVATARS[0].svg;
}
