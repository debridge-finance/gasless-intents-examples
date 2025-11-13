export function now() {
  return new Date().toISOString();
}

export function log(...args: any[]) {
  console.log(`[${now()}]`, ...args);
}

export function warn(...args: any[]) {
  console.warn(`[${now()}][WARN]`, ...args);
}

export function err(...args: any[]) {
  console.error(`[${now()}][ERROR]`, ...args);
}

