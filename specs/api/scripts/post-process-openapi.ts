#!/usr/bin/env bun
/**
 * Post-process OpenAPI spec to enhance descriptions
 * Adds auto-generated documentation for expandable fields
 */

import { readFile, writeFile } from 'fs/promises';
import { normalizeOpenAPISpec } from '../src/utils/openapi';

const OPENAPI_PATH = './dist/openapi/openapi.json';

async function main() {
  console.log('📝 Post-processing OpenAPI spec...');

  // Read generated spec
  const rawSpec = await readFile(OPENAPI_PATH, 'utf-8');
  const spec = JSON.parse(rawSpec);

  // Normalize and enhance descriptions
  const enhanced = normalizeOpenAPISpec(spec);

  // Write back
  await writeFile(OPENAPI_PATH, JSON.stringify(enhanced, null, 2));

  console.log('   ✓ Enhanced expandable field descriptions');
}

main().catch(console.error);
