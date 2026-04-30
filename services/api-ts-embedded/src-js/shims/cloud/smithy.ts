/**
 * @smithy/* shim - base classes for AWS SDK v3.
 *
 * CRITICAL: These must be proper classes that can be extended because
 * AWS SDK v3 does `class S3Client extends SmithyClient`.
 */

// Base client that all AWS service clients extend
class Client {
  protected config: any;
  protected middlewareStack: any;

  constructor(config?: any) {
    this.config = config || {};
    this.middlewareStack = {
      add: () => {},
      addRelativeTo: () => {},
      clone: () => this.middlewareStack,
      use: () => {},
      remove: () => false,
      removeByTag: () => false,
      concat: () => this.middlewareStack,
      applyToStack: () => {},
      identify: () => [],
      resolve: () => async () => ({}),
    };
  }

  async send(_command: any, _options?: any): Promise<any> {
    console.warn('[smithy] Cloud operations not available in embedded mode');
    return {};
  }

  destroy(): void {}
}

// Command base class
class Command {
  input: any;
  constructor(input?: any) {
    this.input = input || {};
  }
  resolveMiddleware(_stack: any, _config: any, _options: any): any {
    return async () => ({ $metadata: {} });
  }
}

// ServiceException base
class ServiceException extends Error {
  $fault: 'client' | 'server';
  $metadata: any;

  constructor(options: { name: string; message?: string; $fault?: 'client' | 'server' }) {
    super(options.message || options.name);
    this.name = options.name;
    this.$fault = options.$fault || 'client';
    this.$metadata = {};
  }
}

// Export everything needed by AWS SDK
export {
  Client,
  Client as SmithyClient,
  Command,
  ServiceException,
};

export default {
  Client,
  SmithyClient: Client,
  Command,
  ServiceException,
};
