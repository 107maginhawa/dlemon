/**
 * OpenAPI Specification Utilities
 * 
 * Utilities for processing and normalizing OpenAPI specifications,
 * particularly for handling allOf composition and $ref resolution.
 */

export interface OpenAPISpec {
  [key: string]: any;
}

/**
 * Normalize an OpenAPI specification by resolving allOf compositions
 * @param spec - The OpenAPI specification to normalize
 * @returns The normalized specification with allOf arrays processed
 */
export function normalizeOpenAPISpec(spec: OpenAPISpec): OpenAPISpec {
  // First normalize allOf patterns
  const normalizedSpec = normalizeAllOf(spec, spec);
  // Then add security roles to descriptions
  const withRoles = addSecurityRolesToDescriptions(normalizedSpec);
  // Then add expandable field documentation
  return addExpandableFieldsToDescriptions(withRoles);
}

/**
 * Add security roles to operation descriptions
 * @param spec - The OpenAPI specification
 * @returns The spec with enhanced descriptions
 */
function addSecurityRolesToDescriptions(spec: OpenAPISpec): OpenAPISpec {
  if (!spec.paths) return spec;
  
  const updatedSpec = { ...spec };
  
  for (const [path, pathItem] of Object.entries(updatedSpec.paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!operation || typeof operation !== 'object') continue;
      
      // Check if this operation has x-security-required-roles
      const roles = operation['x-security-required-roles'];
      if (roles && Array.isArray(roles) && roles.length > 0) {
        // Format the roles nicely
        const rolesList = roles.map((r: string) => `'${r}'`).join(', ');
        const roleSuffix = ` Requires role: ${rolesList}`;
        
        // Add to description if not already present
        if (operation.description) {
          // Only add if not already mentioned in description
          if (!operation.description.includes('Requires role')) {
            operation.description += roleSuffix;
          }
        } else {
          operation.description = `Operation requires role: ${rolesList}`;
        }
      }
    }
  }
  
  return updatedSpec;
}

/**
 * Add expandable field documentation to schema property descriptions
 * @param spec - The OpenAPI specification
 * @returns The spec with expandable field descriptions enhanced
 */
function addExpandableFieldsToDescriptions(spec: OpenAPISpec): OpenAPISpec {
  if (!spec.components?.schemas) return spec;

  const updatedSpec = { ...spec };

  for (const [schemaName, schema] of Object.entries(updatedSpec.components.schemas)) {
    if (!schema || typeof schema !== 'object') continue;
    if (!schema.properties) continue;

    for (const [propName, property] of Object.entries(schema.properties)) {
      if (!property || typeof property !== 'object') continue;

      // Check if this property is expandable
      const expandMeta = (property as any)['x-expandable-field'];
      if (expandMeta?.opId) {
        const suffix = ` (expandable)`;

        // Add to description if not already present
        if ((property as any).description) {
          if (!(property as any).description.includes('(expandable)')) {
            (property as any).description += suffix;
          }
        } else {
          (property as any).description = `Expandable field${suffix}`;
        }
      }
    }
  }

  return updatedSpec;
}

/**
 * Normalize allOf by resolving references according to OpenAPI composition rules
 * @param obj - The object to normalize (spec, schema, or any nested object)
 * @param rootSpec - The root OpenAPI spec for resolving $ref
 * @returns The normalized object with allOf arrays processed
 */
function normalizeAllOf(obj: any, rootSpec: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Handle arrays by normalizing each element
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeAllOf(item, rootSpec));
  }

  // Check if this object has an allOf property
  const hasAllOf = obj.allOf && Array.isArray(obj.allOf);

  if (hasAllOf) {
    // Process allOf schemas - merge them all into a single schema
    let mergedAllOf: any = {};
    
    for (const schema of obj.allOf) {
      // Resolve $ref if present
      const resolved = resolveRef(schema, rootSpec);
      
      // Recursively normalize the resolved schema first
      const normalized = normalizeAllOf(resolved, rootSpec);
      
      // Merge with accumulated result
      mergedAllOf = mergeSchemas(mergedAllOf, normalized);
    }

    // Create a new object with all non-allOf properties
    const objWithoutAllOf: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key !== 'allOf') {
        // Recursively normalize nested objects
        objWithoutAllOf[key] = normalizeAllOf(value, rootSpec);
      }
    }

    // Merge the allOf result with the existing properties
    // Existing properties take precedence over allOf properties
    const merged = mergeSchemas(mergedAllOf, objWithoutAllOf);

    return merged;
  } else {
    // No allOf, just recursively normalize nested objects
    const normalized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      normalized[key] = normalizeAllOf(value, rootSpec);
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
function resolveRef(schema: any, rootSpec: any): any {
  if (!schema || typeof schema !== 'object') {
    return schema;
  }

  if (schema.$ref && typeof schema.$ref === 'string') {
    // Parse the $ref path
    const refPath = schema.$ref.replace(/^#\//, '').split('/');

    // Navigate to the referenced schema
    let resolved = rootSpec;
    for (const segment of refPath) {
      resolved = resolved?.[segment];
      if (!resolved) {
        console.warn(`Could not resolve $ref: ${schema.$ref}`);
        return schema;
      }
    }

    // Copy any additional properties from the original schema
    // (e.g., description that might be alongside the $ref)
    const result = { ...resolved };
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
function mergeSchemas(base: any, override: any): any {
  // If either is not an object, override wins
  if (!base || typeof base !== 'object' || Array.isArray(base)) {
    return override;
  }
  if (!override || typeof override !== 'object' || Array.isArray(override)) {
    return override;
  }

  const merged = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (key === 'properties' && merged.properties) {
      // Merge properties objects
      merged.properties = {
        ...merged.properties,
        ...value as any
      };
    } else if (key === 'required' && merged.required) {
      // Concatenate and deduplicate required arrays
      const combined = [...(merged.required || []), ...(value as any[] || [])];
      merged.required = [...new Set(combined)];
    } else {
      // For other fields, override wins
      merged[key] = value;
    }
  }

  return merged;
}