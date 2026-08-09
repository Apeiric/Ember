/**
 * EMBER — tiny structured logger. No dependency, readable in Render's log tab.
 * OWNER: shared
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

const threshold =
  LEVELS[(process.env.LOG_LEVEL as Level | undefined) ?? 'info'] ?? LEVELS.info;

function emit(level: Level, msg: string, meta?: unknown): void {
  if (LEVELS[level] < threshold) return;
  const ts = new Date().toISOString().slice(11, 23);
  const tag = level.toUpperCase().padEnd(5);
  const line = `${ts} ${tag} ${msg}`;
  const stream = level === 'error' || level === 'warn' ? console.error : console.log;
  if (meta === undefined) stream(line);
  else stream(line, meta);
}

export const log = {
  debug: (msg: string, meta?: unknown) => emit('debug', msg, meta),
  info: (msg: string, meta?: unknown) => emit('info', msg, meta),
  warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta),
};
