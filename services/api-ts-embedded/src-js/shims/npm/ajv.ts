/**
 * AJV stub.
 *
 * Real AJV uses `new Function()` for code generation which doesn't work in QuickJS.
 * This stub provides a simple validator that always passes - response validation
 * is nice-to-have but not critical for offline-first embedded mode.
 */

// Validator function that always returns true (valid)
function createPassthroughValidator() {
  const validate = (_data: any): boolean => true;
  validate.errors = null;
  return validate;
}

// Use a function constructor pattern that works with or without `new`
function Ajv(this: any, opts?: any) {
  // Support calling without `new`
  if (!(this instanceof Ajv)) {
    return new (Ajv as any)(opts);
  }
  this.opts = opts || {};
  this.schemas = new Map();
}

// Add methods to prototype
Ajv.prototype.compile = function(_schema: any) {
  return createPassthroughValidator();
};

Ajv.prototype.addSchema = function(schema: any, key?: string) {
  const id = key || schema.$id || schema.id;
  if (id) {
    this.schemas.set(id, schema);
  }
  return this;
};

Ajv.prototype.getSchema = function(key: string) {
  const schema = this.schemas.get(key);
  if (schema) {
    return this.compile(schema);
  }
  return undefined;
};

Ajv.prototype.removeSchema = function(key: string) {
  this.schemas.delete(key);
  return this;
};

Ajv.prototype.validateSchema = function(_schema: any) {
  return true;
};

Ajv.prototype.addFormat = function(_name: string, _format: any) {
  return this;
};

Ajv.prototype.addKeyword = function(_keyword: string | any, _definition?: any) {
  return this;
};

Ajv.prototype.validate = function(_schemaOrRef: any, _data: any): boolean {
  return true;
};

Ajv.prototype.errorsText = function(_errors?: any[], _options?: any): string {
  return '';
};

// Also export as a function for ajv() calls
function ajv(opts?: any) {
  return new Ajv(opts);
}

// Attach static properties
ajv.default = Ajv;
ajv.Ajv = Ajv;

// ajv-formats compatibility
export function addFormats(ajvInstance: any, _formats?: any) {
  return ajvInstance;
}

export default Ajv;
export { Ajv, ajv };
