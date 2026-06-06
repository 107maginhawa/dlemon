/**
 * Auto-Expand Transformer
 *
 * Automatically transforms API responses by expanding related resources
 * based on the `expand` query parameter. Uses OpenAPI metadata
 * (x-expandable-field with opId) to determine which fields can be
 * expanded and which operations to call.
 *
 * Uses internal HTTP requests to ensure authorization and business logic
 * are properly enforced during expansion.
 *
 * Based on Stripe's expand pattern, adapted for our architecture.
 */

import openapiSpec from '@monobase/api-spec/openapi.json';
import type { Context } from 'hono';

const MAX_EXPAND_DEPTH = 4; // Stripe's limit

interface ExpandPath {
  segments: string[];
  depth: number;
}

/**
 * Transform a Hono Response by applying expand parameters to its JSON body
 *
 * @param response - The original Response object from the handler
 * @param expandParam - The expand query parameter value
 * @param schemaName - The name of the response schema in OpenAPI spec
 * @param ctx - Hono context for accessing database and logger
 * @returns Transformed Response with expanded fields
 */
export async function transformExpandResponse(
  response: Response,
  expandParam: string,
  schemaName: string,
  ctx: Context
): Promise<Response> {
  const logger = ctx.get('logger');

  logger.debug({ expandParam, schemaName }, 'transformExpandResponse called');

  try {
    // Prevent infinite recursion - don't expand internal expand requests
    if (ctx.req.header('X-Internal-Expand')) {
      logger.debug('Skipping expand - internal request');
      return response;
    }

    // Clone and parse original response
    const clonedResponse = response.clone();
    const originalData = await clonedResponse.json();

    logger.debug({ dataKeys: Object.keys(originalData || {}) }, 'Parsed original data');

    // Parse expand parameters
    const expandPaths = parseExpandParams(expandParam);

    // Validate depth
    const maxDepth = Math.max(...expandPaths.map(p => p.depth));
    if (maxDepth > MAX_EXPAND_DEPTH) {
      ctx.get('logger')?.warn(
        { maxDepth, limit: MAX_EXPAND_DEPTH },
        'Expand depth exceeds limit, returning original response'
      );
      return response; // Reject deep expands
    }

    // Apply expansions
    const expandedData = await applyExpands(
      originalData,
      expandPaths,
      schemaName,
      ctx
    );

    // Create new response with expanded data
    return new Response(
      JSON.stringify(expandedData),
      {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      }
    );
  } catch (error) {
    // On error, return original response
    ctx.get('logger')?.error(
      { error, schemaName, expandParam },
      'Expand transformation failed, returning original response'
    );
    return response;
  }
}

/**
 * Parse expand query parameter into structured paths
 *
 * @param expand - Comma-separated expand paths (e.g., "customer,merchant.address")
 * @returns Array of parsed expand paths with depth information
 */
function parseExpandParams(expand: string): ExpandPath[] {
  const expandArray = expand.split(',').map(s => s.trim()).filter(Boolean);

  return expandArray.map(path => ({
    segments: path.split('.'),
    depth: path.split('.').length
  }));
}

/**
 * Apply expands to data recursively
 *
 * @param data - The data to expand (can be object, array, or paginated response)
 * @param expandPaths - Parsed expand paths
 * @param schemaName - Current schema name for metadata lookup
 * @param ctx - Hono context for making internal requests
 * @param currentDepth - Current recursion depth
 * @returns Data with expansions applied
 */
export async function applyExpands<T>(
  data: T,
  expandPaths: ExpandPath[],
  schemaName: string,
  ctx: Context,
  currentDepth = 0
): Promise<T> {
  const logger = ctx.get('logger');

  // Handle arrays (e.g., list responses)
  if (Array.isArray(data)) {
    return Promise.all(
      data.map(item => applyExpands(item, expandPaths, schemaName, ctx, currentDepth))
    ) as unknown as Promise<T>;
  }

  // Handle paginated responses (has 'data' array property)
  if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as Record<string, unknown>)['data'])) {
    const paginatedData = data as Record<string, unknown[]>;
    const inner = paginatedData['data'];
    if (Array.isArray(inner)) {
      paginatedData['data'] = await Promise.all(
        inner.map((item: unknown) =>
          applyExpands(item, expandPaths, schemaName, ctx, currentDepth)
        )
      );
    }
    return data;
  }

  // Depth limit check
  if (currentDepth >= MAX_EXPAND_DEPTH || !data || typeof data !== 'object') {
    return data;
  }

  // Get schema metadata from OpenAPI spec
  const spec = openapiSpec as { components: { schemas: Record<string, unknown> } };
  const schema = spec.components.schemas[schemaName];
  if (!schema) {
    logger.warn({ schemaName }, 'Schema not found in OpenAPI spec');
    return data;
  }

  // Infer expandable fields from properties with x-expandable-field metadata
  const expandableFields = getExpandableFields(schema);

  // Group expand paths by first segment
  const groupedExpands = groupExpandsByFirstSegment(expandPaths);

  // Process each expandable field
  for (const [fieldName, remainingPaths] of Object.entries(groupedExpands)) {
    // Validate field is expandable
    if (!expandableFields.includes(fieldName)) {
      logger.warn({ fieldName, schemaName }, 'Requested field is not expandable');
      continue;
    }

    await expandField(
      data as Record<string, unknown>,
      fieldName,
      remainingPaths,
      schema,
      ctx,
      currentDepth
    );
  }

  return data;
}

type OpenAPIProperty = { 'x-expandable-field'?: { opId?: string }; anyOf?: Array<{ $ref?: string }> };
type OpenAPISchema = { properties?: Record<string, OpenAPIProperty> };

/**
 * Infer expandable fields from schema properties
 */
function getExpandableFields(schema: unknown): string[] {
  const expandableFields: string[] = [];
  const s = schema as OpenAPISchema;

  for (const [fieldName, property] of Object.entries(s.properties || {})) {
    if (property['x-expandable-field']?.opId) {
      expandableFields.push(fieldName);
    }
  }

  return expandableFields;
}

type OpenAPIOperation = { operationId?: string };
type OpenAPIPathItem = Record<string, OpenAPIOperation>;
type OpenAPIPaths = Record<string, OpenAPIPathItem>;

/**
 * Find route by operation ID in OpenAPI spec
 */
function findRouteByOperationId(operationId: string): { path: string; method: string } | null {
  const paths = (openapiSpec as { paths: OpenAPIPaths }).paths;
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      if (operation.operationId === operationId) {
        return { path, method: method.toUpperCase() };
      }
    }
  }
  return null;
}

/**
 * Expand a single field in the data object
 */
async function expandField(
  data: Record<string, unknown>,
  fieldName: string,
  remainingPaths: ExpandPath[],
  schema: unknown,
  ctx: Context,
  currentDepth: number
): Promise<void> {
  const s = schema as OpenAPISchema;
  const property = s.properties?.[fieldName];
  if (!property) return;

  // Get expand metadata
  const expandMetadata = property['x-expandable-field'];
  if (!expandMetadata?.opId) return;

  // Extract target schema from anyOf pattern
  const targetSchemaRef = property.anyOf?.find((item) => item.$ref)?.$ref;
  if (!targetSchemaRef) return;

  const targetSchema = targetSchemaRef.split('/').pop();
  if (!targetSchema) return;

  const fieldValue = data[fieldName];
  if (!fieldValue) return;

  // Handle different field value types
  if (Array.isArray(fieldValue)) {
    // Expand array of references
    data[fieldName] = await expandArrayField(
      fieldValue,
      targetSchema,
      expandMetadata.opId,
      remainingPaths,
      ctx,
      currentDepth
    );
  } else if (typeof fieldValue === 'string') {
    // Expand single reference (ID)
    data[fieldName] = await expandSingleField(
      fieldValue,
      targetSchema,
      expandMetadata.opId,
      remainingPaths,
      ctx,
      currentDepth
    );
  } else if (typeof fieldValue === 'object' && remainingPaths.length > 0) {
    // Already expanded - recurse for nested expands
    await applyExpands(
      fieldValue,
      remainingPaths,
      targetSchema,
      ctx,
      currentDepth + 1
    );
  }
}

/**
 * Expand a single field that contains an ID using internal HTTP request
 */
async function expandSingleField(
  fieldId: string,
  targetSchema: string,
  operationId: string,
  remainingPaths: ExpandPath[],
  ctx: Context,
  currentDepth: number
): Promise<unknown> {
  const logger = ctx.get('logger');

  // Find the route for this operation
  const route = findRouteByOperationId(operationId);
  if (!route) {
    logger.warn({ operationId }, 'Route not found for operation ID');
    return fieldId;
  }

  // Replace path parameters with actual ID
  // e.g., "/persons/{person}" → "/persons/per_123"
  const url = route.path.replace(/{[^}]+}/g, fieldId);

  // Make internal HTTP request with service token
  const app = ctx.get('app');
  const internalServiceToken = ctx.get('internalServiceToken');

  try {
    const response = await app.request(url, {
      method: route.method,
      headers: {
        'Authorization': ctx.req.header('Authorization') || '', // For audit trail
        'X-Internal-Service-Token': internalServiceToken, // Proves internal service call
        'X-Expand-Context': 'true' // Indicates this is an expand request
      }
    });

    if (!response.ok) {
      logger.warn({ fieldId, url, status: response.status }, 'Failed to expand field via internal request');
      return fieldId; // Fallback to ID
    }

    const expandedData = await response.json();

    // Recursively expand nested fields
    if (remainingPaths.length > 0) {
      await applyExpands(
        expandedData,
        remainingPaths,
        targetSchema,
        ctx,
        currentDepth + 1
      );
    }

    return expandedData;
  } catch (error) {
    logger.error({ error, fieldId, operationId }, 'Error expanding field via internal request');
    return fieldId;
  }
}

/**
 * Expand an array field using internal HTTP requests
 * Note: Makes individual requests for each ID (N+1 issue)
 * TODO: Consider implementing batch expand endpoint for better performance
 */
async function expandArrayField(
  fieldValues: unknown[],
  targetSchema: string,
  operationId: string,
  remainingPaths: ExpandPath[],
  ctx: Context,
  currentDepth: number
): Promise<unknown[]> {
  // Collect all IDs
  const ids = fieldValues.filter(v => typeof v === 'string');
  if (ids.length === 0) return fieldValues;

  // Expand each ID using internal requests
  // Note: This is N+1, but ensures auth/business logic for each item
  const result = await Promise.all(
    fieldValues.map(async (value) => {
      if (typeof value !== 'string') return value;

      // Expand this single ID
      const expandedData = await expandSingleField(
        value,
        targetSchema,
        operationId,
        remainingPaths,
        ctx,
        currentDepth
      );

      return expandedData;
    })
  );

  return result;
}

/**
 * Group expand paths by their first segment for efficient processing
 */
function groupExpandsByFirstSegment(paths: ExpandPath[]): Record<string, ExpandPath[]> {
  const grouped: Record<string, ExpandPath[]> = {};

  for (const path of paths) {
    const [first, ...rest] = path.segments;

    // Skip invalid paths
    if (!first) continue;

    if (!grouped[first]) {
      grouped[first] = [];
    }

    if (rest.length > 0) {
      grouped[first].push({
        segments: rest,
        depth: path.depth - 1
      });
    } else {
      // Leaf node
      grouped[first].push({ segments: [], depth: 0 });
    }
  }

  return grouped;
}

