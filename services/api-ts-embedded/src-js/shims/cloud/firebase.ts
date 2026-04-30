/**
 * firebase-admin shim - FCM not available in embedded mode.
 */

class Messaging {
  async send(_message: any) {
    console.warn('[firebase] FCM not available in embedded mode');
    return 'embedded-noop-message-id';
  }

  async sendEach(_messages: any[]) {
    console.warn('[firebase] FCM not available in embedded mode');
    return { responses: [], successCount: 0, failureCount: 0 };
  }

  async sendEachForMulticast(_message: any) {
    console.warn('[firebase] FCM not available in embedded mode');
    return { responses: [], successCount: 0, failureCount: 0 };
  }

  async subscribeToTopic(_tokens: string[], _topic: string) {
    return { successCount: 0, failureCount: 0, errors: [] };
  }

  async unsubscribeFromTopic(_tokens: string[], _topic: string) {
    return { successCount: 0, failureCount: 0, errors: [] };
  }
}

class App {
  name: string;
  options: any;

  constructor(options?: any, name?: string) {
    this.name = name || '[DEFAULT]';
    this.options = options || {};
  }

  messaging(): Messaging {
    return new Messaging();
  }

  delete(): Promise<void> {
    return Promise.resolve();
  }
}

let defaultApp: App | null = null;

function initializeApp(options?: any, name?: string): App {
  const app = new App(options, name);
  if (!name || name === '[DEFAULT]') {
    defaultApp = app;
  }
  return app;
}

function getApp(name?: string): App {
  if (!name || name === '[DEFAULT]') {
    if (!defaultApp) {
      throw new Error('Firebase app not initialized');
    }
    return defaultApp;
  }
  throw new Error(`Firebase app '${name}' not found`);
}

function getApps(): App[] {
  return defaultApp ? [defaultApp] : [];
}

function deleteApp(app: App): Promise<void> {
  if (app === defaultApp) {
    defaultApp = null;
  }
  return Promise.resolve();
}

function messaging(app?: App): Messaging {
  return (app || getApp()).messaging();
}

const credential = {
  cert: (_serviceAccount: any) => ({}),
  refreshToken: (_token: any) => ({}),
  applicationDefault: () => ({}),
};

const firebaseAdmin = {
  initializeApp,
  getApp,
  getApps,
  deleteApp,
  messaging,
  credential,
  apps: [] as App[],
};

export default firebaseAdmin;
export {
  initializeApp,
  getApp,
  getApps,
  deleteApp,
  messaging,
  credential,
  App,
  Messaging,
};
