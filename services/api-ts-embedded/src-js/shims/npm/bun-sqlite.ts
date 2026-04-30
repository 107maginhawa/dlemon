/**
 * bun:sqlite shim - we use drizzle sqlite-proxy instead.
 */

class Database {
  filename: string;

  constructor(filename?: string) {
    this.filename = filename || ':memory:';
  }

  exec(_sql: string) {}
  run(_sql: string, ..._params: any[]) { return { changes: 0, lastInsertRowid: 0 }; }
  query(_sql: string) {
    return {
      all: (..._params: any[]) => [],
      get: (..._params: any[]) => undefined,
      run: (..._params: any[]) => ({ changes: 0, lastInsertRowid: 0 }),
      values: (..._params: any[]) => [],
    };
  }
  prepare(_sql: string) {
    return this.query(_sql);
  }
  transaction(_fn: Function) {
    return (...args: any[]) => _fn(...args);
  }
  close() {}
}

export { Database };
export default Database;
