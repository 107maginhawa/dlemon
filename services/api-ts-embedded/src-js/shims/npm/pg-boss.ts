/**
 * pg-boss shim - job queue not available in embedded mode.
 */

class PgBoss {
  constructor(_config?: any) {}
  async start() { return this; }
  async stop() {}
  async send(_name: string, _data?: any, _opts?: any) { return null; }
  async sendAfter(_name: string, _data: any, _opts: any, _after: number) { return null; }
  async sendOnce(_name: string, _data: any, _opts: any, _key: string) { return null; }
  async insert(_jobs: any[]) { return []; }
  async fetch(_name: string, _opts?: any) { return null; }
  async work(_name: string, _opts: any, _handler?: Function) { return ''; }
  async offWork(_name: string) {}
  async complete(_id: string, _data?: any) {}
  async fail(_id: string, _err?: any) {}
  async cancel(_id: string) {}
  async resume(_id: string) {}
  async getQueueSize(_name: string) { return 0; }
  async getJobById(_id: string) { return null; }
  async deleteQueue(_name: string) {}
  async deleteAllQueues() {}
  async clearStorage() {}
  async archive() {}
  async purge() {}
  async expire() {}
  on(_event: string, _handler: Function) { return this; }
  off(_event: string, _handler?: Function) { return this; }

  static getConstructionPlans(_schema?: string) { return ''; }
  static getMigrationPlans(_schema?: string, _version?: string) { return ''; }
}

export default PgBoss;
export { PgBoss };
