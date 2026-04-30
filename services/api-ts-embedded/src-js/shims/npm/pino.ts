/**
 * pino logger shim - uses console.log instead of sonic-boom.
 */

interface Logger {
  level: string;
  trace: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  fatal: (...args: any[]) => void;
  child: (bindings: object) => Logger;
  silent: (...args: any[]) => void;
}

function createLogger(opts?: any): Logger {
  const level = opts?.level || 'info';
  const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
  const levelIndex = levels.indexOf(level);

  const shouldLog = (msgLevel: string) => {
    const msgIndex = levels.indexOf(msgLevel);
    return msgIndex >= levelIndex;
  };

  const logger: Logger = {
    level,
    trace: (...args) => { if (shouldLog('trace')) console.log('[pino:trace]', ...args); },
    debug: (...args) => { if (shouldLog('debug')) console.log('[pino:debug]', ...args); },
    info: (...args) => { if (shouldLog('info')) console.log('[pino:info]', ...args); },
    warn: (...args) => { if (shouldLog('warn')) console.warn('[pino:warn]', ...args); },
    error: (...args) => { if (shouldLog('error')) console.error('[pino:error]', ...args); },
    fatal: (...args) => { if (shouldLog('fatal')) console.error('[pino:fatal]', ...args); },
    silent: () => {},
    child: (bindings) => {
      const childLogger = createLogger({ ...opts, ...bindings });
      return childLogger;
    },
  };

  return logger;
}

// pino() returns a logger
function pino(opts?: any): Logger {
  return createLogger(opts);
}

// Static properties
pino.destination = () => ({ write: (s: string) => console.log(s) });
pino.transport = () => ({ write: (s: string) => console.log(s) });
pino.multistream = () => ({ write: (s: string) => console.log(s) });
pino.stdSerializers = {
  req: (req: any) => ({ method: req?.method, url: req?.url }),
  res: (res: any) => ({ statusCode: res?.statusCode }),
  err: (err: any) => ({ message: err?.message, stack: err?.stack }),
};
pino.levels = {
  values: { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 },
  labels: { 10: 'trace', 20: 'debug', 30: 'info', 40: 'warn', 50: 'error', 60: 'fatal' },
};

export default pino;
export { pino };
