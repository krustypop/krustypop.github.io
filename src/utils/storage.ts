// Storage can be unavailable (private mode, blocked site data): reads fall back, writes are best effort.

export function readFlag(key: string, fallback = false) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value === '1';
  } catch {
    return fallback;
  }
}

export function writeFlag(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // The setting still applies for this visit.
  }
}

export function readNumber(key: string, fallback = 0) {
  try {
    const value = Number(localStorage.getItem(key) ?? Number.NaN);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function writeNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Kept in memory for this visit.
  }
}
