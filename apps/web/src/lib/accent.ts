/** Acento del tema (data-accent en <html>): verde (default) | teal | indigo. */
// labelKey vive en el namespace `settings` — se traduce con t() en el render.
export const ACCENTS = [
  { key: 'verde', labelKey: 'appearance.accents.verde', swatch: '#0e7a4d' },
  { key: 'teal', labelKey: 'appearance.accents.teal', swatch: '#0f7e96' },
  { key: 'indigo', labelKey: 'appearance.accents.indigo', swatch: '#41599e' },
] as const;

export type AccentKey = (typeof ACCENTS)[number]['key'];

const STORAGE_KEY = 'accent';

export function getAccent(): AccentKey {
  const stored = localStorage.getItem(STORAGE_KEY);
  return ACCENTS.some((a) => a.key === stored) ? (stored as AccentKey) : 'verde';
}

/** 'verde' es el default del CSS: se quita el atributo en vez de setearlo. */
export function applyAccent(key: AccentKey): void {
  if (key === 'verde') {
    document.documentElement.removeAttribute('data-accent');
  } else {
    document.documentElement.setAttribute('data-accent', key);
  }
  localStorage.setItem(STORAGE_KEY, key);
}
