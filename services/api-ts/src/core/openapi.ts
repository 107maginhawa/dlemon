/**
 * OpenAPI Documentation Module
 * Handles registration of API documentation routes with support for multiple OpenAPI specs
 */

import { Hono } from 'hono';
import { Scalar } from '@scalar/hono-api-reference';
import type { Logger } from '@/types/logger';
import type { Config } from '@/core/config';

type OpenAPINode = Record<string, unknown> | unknown[] | string | number | boolean | null | undefined;

/**
 * Normalize allOf by merging schemas according to OpenAPI composition rules
 * @param obj - The object to normalize (spec, schema, or any nested object)
 * @param rootSpec - The root OpenAPI spec for resolving $ref
 * @returns The normalized object with allOf arrays merged
 */
function normalizeAllOf(obj: OpenAPINode, rootSpec: Record<string, unknown>): OpenAPINode {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays by normalizing each element
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeAllOf(item as OpenAPINode, rootSpec));
  }

  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const objRecord = obj as Record<string, unknown>;

  // Check if this object has an allOf property
  const hasAllOf = objRecord['allOf'] && Array.isArray(objRecord['allOf']);

  if (hasAllOf) {
    // Process allOf schemas - merge them all into a single schema
    let mergedAllOf: Record<string, unknown> = {};

    for (const schema of objRecord['allOf'] as unknown[]) {
      // Resolve $ref if present
      const resolved = resolveRef(schema as Record<string, unknown>, rootSpec);

      // Recursively normalize the resolved schema first
      const normalized = normalizeAllOf(resolved as OpenAPINode, rootSpec);

      // Merge with accumulated result
      mergedAllOf = mergeSchemas(mergedAllOf, normalized as Record<string, unknown>);
    }

    // Create a new object with all non-allOf properties
    const objWithoutAllOf: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(objRecord)) {
      if (key !== 'allOf') {
        // Recursively normalize nested objects
        objWithoutAllOf[key] = normalizeAllOf(value as OpenAPINode, rootSpec);
      }
    }

    // Merge the allOf result with the existing properties
    // Existing properties take precedence over allOf properties
    const merged = mergeSchemas(mergedAllOf, objWithoutAllOf);

    return merged;
  } else {
    // No allOf, just recursively normalize nested objects
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(objRecord)) {
      normalized[key] = normalizeAllOf(value as OpenAPINode, rootSpec);
    }
    return normalized;
  }
}

/**
 * Resolve a $ref to its actual schema
 * @param schema - Schema that might contain a $ref
 * @param rootSpec - The root OpenAPI spec
 * @returns The resolved schema
 */
function resolveRef(schema: Record<string, unknown>, rootSpec: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (schema['$ref'] && typeof schema['$ref'] === 'string') {
    // Parse the $ref path
    const refPath = (schema['$ref'] as string).replace(/^#\//, '').split('/');

    // Navigate to the referenced schema
    let resolved: unknown = rootSpec;
    for (const segment of refPath) {
      resolved = (resolved as Record<string, unknown>)?.[segment];
      if (!resolved) {
        console.warn(`Could not resolve $ref: ${schema['$ref']}`);
        return schema;
      }
    }

    // Copy any additional properties from the original schema
    // (e.g., description that might be alongside the $ref)
    const result = { ...(resolved as Record<string, unknown>) };
    for (const [key, value] of Object.entries(schema)) {
      if (key !== '$ref' && !(key in result)) {
        result[key] = value;
      }
    }

    return result;
  }

  return schema;
}

/**
 * Merge two schemas according to OpenAPI rules
 * @param base - Base schema
 * @param override - Schema to merge into base
 * @returns The merged schema
 */
function mergeSchemas(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown> {
  // If either is not an object, override wins
  if (!base || typeof base !== 'object' || Array.isArray(base)) {
    return override;
  }
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return override;
  }

  const merged: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (key === 'properties' && merged['properties']) {
      // Merge properties objects
      merged['properties'] = {
        ...(merged['properties'] as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      };
    } else if (key === 'required' && merged['required']) {
      // Concatenate and deduplicate required arrays
      const combined = [...(merged['required'] as unknown[] || []), ...((value as unknown[]) || [])];
      merged['required'] = [...new Set(combined)];
    } else {
      // For other fields, override wins
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * Merge multiple OpenAPI specifications into a single spec
 * Combines paths, components, tags, and other top-level properties
 */
function mergeOpenAPISpecs(specs: Record<string, unknown>[], config?: Record<string, unknown>): Record<string, unknown> {
  if (specs.length === 0) {
    throw new Error('At least one OpenAPI spec is required');
  }

  if (specs.length === 1) {
    // Even for a single spec, normalize allOf
    const spec = specs[0] as Record<string, unknown>;
    return normalizeAllOf(spec, spec) as Record<string, unknown>;
  }

  // Start with the first spec as base
  const merged = { ...specs[0] };

  // Merge remaining specs
  for (let i = 1; i < specs.length; i++) {
    const spec = specs[i];
    if (!spec) continue;

    // Merge paths
    if (spec['paths']) {
      merged['paths'] = {
        ...((merged['paths'] as Record<string, unknown>) || {}),
        ...(spec['paths'] as Record<string, unknown>),
      };
    }

    // Merge components
    if (spec['components']) {
      const mc = (merged['components'] as Record<string, Record<string, unknown>>) || {};
      const sc = spec['components'] as Record<string, Record<string, unknown>>;
      merged['components'] = {
        schemas: { ...(mc['schemas'] || {}), ...(sc['schemas'] || {}) },
        securitySchemes: { ...(mc['securitySchemes'] || {}), ...(sc['securitySchemes'] || {}) },
        parameters: { ...(mc['parameters'] || {}), ...(sc['parameters'] || {}) },
        responses: { ...(mc['responses'] || {}), ...(sc['responses'] || {}) },
        requestBodies: { ...(mc['requestBodies'] || {}), ...(sc['requestBodies'] || {}) },
      };
    }

    // Merge tags (avoid duplicates)
    if (spec['tags']) {
      const existingTags = new Set(((merged['tags'] as Array<{ name: string }>) || []).map((t) => t.name));
      const newTags = (spec['tags'] as Array<{ name: string }>).filter((tag) => !existingTags.has(tag.name));
      merged['tags'] = [...((merged['tags'] as unknown[]) || []), ...newTags];
    }

    // Merge security requirements
    if (spec['security']) {
      merged['security'] = [...((merged['security'] as unknown[]) || []), ...(spec['security'] as unknown[])];
    }
  }

  // Sort tags with priority order: health, auth, then alphabetical
  if (merged['tags']) {
    const priorityTags = ['health', 'auth']; // Define priority order

    (merged['tags'] as Array<{ name: string }>).sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      
      const priorityA = priorityTags.indexOf(nameA);
      const priorityB = priorityTags.indexOf(nameB);
      
      // Both have priority - sort by priority order
      if (priorityA !== -1 && priorityB !== -1) {
        return priorityA - priorityB;
      }
      
      // Only A has priority - A comes first
      if (priorityA !== -1) {
        return -1;
      }
      
      // Only B has priority - B comes first  
      if (priorityB !== -1) {
        return 1;
      }
      
      // Neither has priority - sort alphabetically
      return nameA.localeCompare(nameB);
    });
  }

  // Enhance servers with local and public options
  const existingServers = (merged['servers'] as Array<{ url: string; description: string }>) || [];
  const servers: Array<{ url: string; description: string }> = [];
  
  // Always add local development server at the beginning
  const serverConf = config?.['server'] as { port?: string | number; host?: string; publicUrl?: string } | undefined;
  const port = serverConf?.port ?? process.env['PORT'] ?? '7213';
  const host = serverConf?.host ?? 'localhost';
  const localUrl = `http://${host}:${port}`;
  servers.push({
    url: localUrl,
    description: 'Local development server',
  });
  
  // Add existing servers from the specs
  servers.push(...existingServers);
  
  // Add public server if configured and not already present
  if (serverConf?.publicUrl) {
    const publicUrl = serverConf.publicUrl;
    const urlExists = servers.some((s) => s.url === publicUrl);
    
    if (!urlExists) {
      servers.push({
        url: publicUrl,
        description: 'Public server',
      });
    }
  }

  merged['servers'] = servers;

  // Normalize allOf patterns in the merged spec before returning
  return normalizeAllOf(merged, merged) as Record<string, unknown>;
}

/**
 * Register OpenAPI documentation routes
 * 
 * @param app - Hono application instance
 * @param specs - Array of OpenAPI specifications to merge and serve
 * @param config - Optional configuration for server settings
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Hono generic parameter varies by caller (Variables shape unknown at this layer)
export function registerRoutes(app: Hono<any> & { logger?: Logger }, specs: Record<string, unknown>[], config?: Config): void {
  const logger = app.logger;

  // Merge all provided specs
  const mergedSpec = mergeOpenAPISpecs(specs, config as unknown as Record<string, unknown>);

  if (logger) {
    logger.debug(
      {
        specsCount: specs.length,
        totalPaths: Object.keys((mergedSpec['paths'] as Record<string, unknown>) || {}).length,
        tags: (mergedSpec['tags'] as Array<{ name: string }>)?.map((t) => t.name),
      },
      'Merged OpenAPI specifications for documentation'
    );
  }

  // API Documentation UI
  app.get(
    '/docs',
    Scalar({
      url: '/docs/openapi.json',
      title: 'Monobase API Documentation',
      layout: 'modern',
      theme: 'bluePlanet',
      hideModels: true,
      metaData: {
        title: 'Monobase API Documentation - Modern Application Platform',
        description:
          'Comprehensive API documentation for Monobase application platform. RESTful APIs for person management, communications, file storage, notifications, and more.',
        ogTitle: 'Monobase API Documentation',
        ogDescription:
          'Modern application platform with enterprise security and audit compliance',
      },
    }),
  );

  // Serve merged OpenAPI spec
  app.get('/docs/openapi.json', (c) => c.json(mergedSpec));

  if (logger) {
    logger.debug('Registered OpenAPI documentation routes at /docs');
  }
}