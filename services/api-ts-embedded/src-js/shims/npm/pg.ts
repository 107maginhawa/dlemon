/**
 * pg (PostgreSQL) shim - noop since embedded mode uses SQLite.
 */

class Client {
  constructor(_config?: any) {}
  async connect() { throw new Error('PostgreSQL not available in embedded mode'); }
  async query(_text: string, _values?: any[]) { throw new Error('PostgreSQL not available in embedded mode'); }
  async end() {}
  on(_event: string, _cb: Function) { return this; }
  off(_event: string, _cb: Function) { return this; }
  removeListener(_event: string, _cb: Function) { return this; }
}

class Pool {
  constructor(_config?: any) {}
  async connect() { throw new Error('PostgreSQL not available in embedded mode'); }
  async query(_text: string, _values?: any[]) { throw new Error('PostgreSQL not available in embedded mode'); }
  async end() {}
  on(_event: string, _cb: Function) { return this; }
  off(_event: string, _cb: Function) { return this; }
  totalCount = 0;
  idleCount = 0;
  waitingCount = 0;
}

const types = {
  setTypeParser: () => {},
  getTypeParser: () => (v: any) => v,
  arrayParser: { create: () => {} },
};

const pg = { Client, Pool, types };
export default pg;
export { Client, Pool, types };
