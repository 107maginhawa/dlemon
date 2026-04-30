/**
 * Node.js process module shim for QuickJS engine.
 */

const process = {
  env: {},
  argv: ['quickjs', 'hapihub-embedded'],
  version: 'v20.0.0',
  versions: {
    node: '20.0.0',
    v8: '11.0.0',
    modules: '115',
  },
  platform: 'linux',
  arch: 'x64',
  pid: 1,
  ppid: 0,
  cwd: () => '/',
  chdir: (_dir: string) => {},
  exit: (_code?: number) => {},
  nextTick: (cb: Function, ...args: any[]) => setTimeout(() => cb(...args), 0),
  hrtime: (prev?: [number, number]): [number, number] => {
    const now = Date.now();
    const seconds = Math.floor(now / 1000);
    const nanos = (now % 1000) * 1e6;
    if (prev) {
      return [seconds - prev[0], nanos - prev[1]];
    }
    return [seconds, nanos];
  },
  memoryUsage: () => ({
    rss: 0,
    heapTotal: 0,
    heapUsed: 0,
    external: 0,
    arrayBuffers: 0,
  }),
  cpuUsage: () => ({ user: 0, system: 0 }),
  uptime: () => 0,
  stdin: { on: () => {}, pipe: () => {} },
  stdout: { write: (s: string) => console.log(s) },
  stderr: { write: (s: string) => console.error(s) },
  title: 'hapihub-embedded',
  execPath: '/quickjs',
  execArgv: [],
  connected: false,
  binding: () => ({}),
  umask: () => 0o22,
  getuid: () => 0,
  getgid: () => 0,
  getgroups: () => [],
  emitWarning: (msg: string) => console.warn('Warning:', msg),
  release: { name: 'node' },
  features: {},
  config: {},
  moduleLoadList: [],
};

// hrtime.bigint()
(process.hrtime as any).bigint = () => BigInt(Date.now()) * BigInt(1e6);

export default process;
export { process };
