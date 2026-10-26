/**
 * Modern SVG icon definitions (Lucide inspired, optimized 24x24 viewBox).
 */

const createSvg = (paths, className = 'icon', size = 20) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${className}">
    ${paths}
  </svg>
`.trim();

export const icons = {
  mic: (cls, size) => createSvg(`
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" x2="12" y1="19" y2="22"/>
  `, cls, size),

  micOff: (cls, size) => createSvg(`
    <line x1="2" x2="22" y1="2" y2="22"/>
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/>
    <path d="M5 10v2a7 7 0 0 0 12 5"/>
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
    <line x1="12" x2="12" y1="19" y2="22"/>
  `, cls, size),

  video: (cls, size) => createSvg(`
    <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5"/>
    <rect x="2" y="6" width="14" height="12" rx="2"/>
  `, cls, size),

  videoOff: (cls, size) => createSvg(`
    <line x1="2" x2="22" y1="2" y2="22"/>
    <path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196"/>
    <path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"/>
  `, cls, size),

  screenShare: (cls, size) => createSvg(`
    <path d="M13 3H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3"/>
    <path d="M8 21h8"/>
    <path d="M12 17v4"/>
    <path d="m17 8 5-5"/>
    <path d="M17 3h5v5"/>
  `, cls, size),

  screenShareOff: (cls, size) => createSvg(`
    <line x1="2" x2="22" y1="2" y2="22"/>
    <path d="M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-.58 1.41"/>
    <path d="M2 5v10a2 2 0 0 0 2 2h12"/>
    <path d="M12 17v4"/>
    <path d="M8 21h8"/>
  `, cls, size),

  phone: (cls, size) => createSvg(`
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  `, cls, size),

  phoneOff: (cls, size) => createSvg(`
    <line x1="2" x2="22" y1="2" y2="22"/>
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/>
  `, cls, size),

  phoneIncoming: (cls, size) => createSvg(`
    <polyline points="16 2 16 8 22 8"/>
    <line x1="22" x2="16" y1="2" y2="8"/>
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
  `, cls, size),

  settings: (cls, size) => createSvg(`
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <circle cx="12" cy="12" r="3"/>
  `, cls, size),

  message: (cls, size) => createSvg(`
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  `, cls, size),

  activity: (cls, size) => createSvg(`
    <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
  `, cls, size),

  users: (cls, size) => createSvg(`
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  `, cls, size),

  copy: (cls, size) => createSvg(`
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
  `, cls, size),

  check: (cls, size) => createSvg(`
    <polyline points="20 6 9 17 4 12"/>
  `, cls, size),

  close: (cls, size) => createSvg(`
    <line x1="18" x2="6" y1="6" y2="18"/>
    <line x1="6" x2="18" y1="6" y2="18"/>
  `, cls, size),

  send: (cls, size) => createSvg(`
    <line x1="22" x2="11" y1="2" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  `, cls, size),

  maximize: (cls, size) => createSvg(`
    <polyline points="15 3 21 3 21 9"/>
    <polyline points="9 21 3 21 3 15"/>
    <line x1="21" x2="14" y1="3" y2="10"/>
    <line x1="3" x2="10" y1="21" y2="14"/>
  `, cls, size),

  minimize: (cls, size) => createSvg(`
    <polyline points="4 14 10 14 10 20"/>
    <polyline points="20 10 14 10 14 4"/>
    <line x1="14" x2="21" y1="10" y2="3"/>
    <line x1="3" x2="10" y1="21" y2="14"/>
  `, cls, size),

  shield: (cls, size) => createSvg(`
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
    <path d="m9 12 2 2 4-4"/>
  `, cls, size),

  sparkles: (cls, size) => createSvg(`
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/>
    <path d="M19 17v4"/>
    <path d="M3 5h4"/>
    <path d="M17 19h4"/>
  `, cls, size),

  wifi: (cls, size) => createSvg(`
    <path d="M5 13a10 10 0 0 1 14 0"/>
    <path d="M8.5 16.5a5 5 0 0 1 7 0"/>
    <path d="M2 8.82a15 15 0 0 1 20 0"/>
    <line x1="12" x2="12.01" y1="20" y2="20"/>
  `, cls, size),

  arrowRight: (cls, size) => createSvg(`
    <line x1="5" x2="19" y1="12" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  `, cls, size),

  pip: (cls, size) => createSvg(`
    <rect width="18" height="14" x="3" y="5" rx="2"/>
    <rect width="6" height="4" x="13" y="13" rx="1"/>
  `, cls, size),

  pin: (cls, size) => createSvg(`
    <line x1="12" x2="12" y1="17" y2="22"/>
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 0-2H8a1 1 0 0 0 0 2h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
  `, cls, size),

  pinOff: (cls, size) => createSvg(`
    <line x1="2" x2="22" y1="2" y2="22"/>
    <line x1="12" x2="12" y1="17" y2="22"/>
    <path d="M9 9v1.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h12"/>
    <path d="M15 9.34V6h1a1 1 0 0 0 0-2H8"/>
  `, cls, size)
};

