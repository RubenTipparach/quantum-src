const SKIN_KEY = 'quantumsrc_skin';

export type SkinId = 'hacker' | 'win95' | 'aseprite';

export interface SkinMeta {
  id: SkinId;
  label: string;
  description: string;
}

export const SKINS: SkinMeta[] = [
  { id: 'hacker', label: 'Hacker', description: 'Classic green-on-black terminal' },
  { id: 'win95', label: 'Win 95', description: 'Retro Windows 95 desktop' },
  { id: 'aseprite', label: 'Aseprite', description: 'Pixel art editor dark theme' },
];

let currentSkin: SkinId = 'hacker';

export function loadSkin(): void {
  const saved = localStorage.getItem(SKIN_KEY) as SkinId | null;
  if (saved && SKINS.some(s => s.id === saved)) {
    currentSkin = saved;
  }
  applySkin(currentSkin);
}

export function getSkin(): SkinId {
  return currentSkin;
}

export function setSkin(id: SkinId): void {
  currentSkin = id;
  localStorage.setItem(SKIN_KEY, id);
  applySkin(id);
}

function applySkin(id: SkinId): void {
  document.documentElement.setAttribute('data-skin', id);
}
