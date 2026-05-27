#!/usr/bin/env bun
/**
 * check-module-boundaries — Phase 10 boundary lint
 *
 * Finds cross-module repo imports in production handler code.
 * A handler in `handlers/{A}/` must not import from `handlers/{B}/repos/`
 * unless B is 'shared' (the legitimate cross-cutting utility module).
 *
 * Usage: bun run check:boundaries [--error]
 *   --error  exit 1 on any violation (use in CI after migration is complete)
 *   default  warn only, exit 0 (current: migration in progress)
 */

import { readdir, readFile } from 'fs/promises';
import { join, relative } from 'path';

const HANDLERS_DIR = join(import.meta.dir, '../src/handlers');
/** Modules that may be freely imported by any handler (cross-cutting utilities). */
const ALLOWED_CROSS_MODULE = new Set(['shared']);
/** Modules that may import from any other module's repos (legitimate hubs). */
const EXEMPT_SOURCE_MODULES = new Set(['shared']);
const IS_ERROR_MODE = process.argv.includes('--error');
const FILTER_MODULE = (() => {
  const idx = process.argv.indexOf('--module');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

interface Violation {
  file: string;
  module: string;
  importedModule: string;
  line: number;
  importPath: string;
}

async function getHandlerModules(): Promise<string[]> {
  const entries = await readdir(HANDLERS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

async function getTypeScriptFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await getTypeScriptFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.facade.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

const CROSS_REPO_IMPORT = /from ['"](@\/handlers\/([^/]+)\/repos\/[^'"]+)['"]/g;

async function checkModule(moduleName: string, violations: Violation[]): Promise<void> {
  const moduleDir = join(HANDLERS_DIR, moduleName);
  let files: string[];
  try {
    files = await getTypeScriptFiles(moduleDir);
  } catch {
    return;
  }

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match: RegExpExecArray | null;
      const re = /from ['"](@\/handlers\/([^/]+)\/repos\/[^'"]+)['"]/g;
      while ((match = re.exec(line)) !== null) {
        const [, fullImportPath, importedModule] = match;
        // Facade imports are allowed — they are the migration destination
        if (fullImportPath.endsWith('.facade') || fullImportPath.includes('.facade.ts')) continue;
        if (importedModule !== moduleName && !ALLOWED_CROSS_MODULE.has(importedModule) && !EXEMPT_SOURCE_MODULES.has(moduleName)) {
          violations.push({
            file: relative(join(HANDLERS_DIR, '..', '..'), filePath),
            module: moduleName,
            importedModule,
            line: i + 1,
            importPath: fullImportPath,
          });
        }
      }
    }
  }
}

async function main() {
  const modules = await getHandlerModules();
  const violations: Violation[] = [];

  await Promise.all(modules.map((m) => checkModule(m, violations)));

  // Apply per-module filter if --module flag provided
  const activeViolations = FILTER_MODULE
    ? violations.filter(v => v.module === FILTER_MODULE)
    : violations;

  if (activeViolations.length === 0) {
    if (FILTER_MODULE) {
      console.log(`✅ No cross-module repo boundary violations found in module [${FILTER_MODULE}].`);
    } else {
      console.log('✅ No cross-module repo boundary violations found.');
    }
    process.exit(0);
  }

  // Group by module for readability
  const byModule = new Map<string, Violation[]>();
  for (const v of activeViolations) {
    const key = v.module;
    if (!byModule.has(key)) byModule.set(key, []);
    byModule.get(key)!.push(v);
  }

  const emoji = IS_ERROR_MODE ? '❌' : '⚠️';
  console.log(`\n${emoji} Cross-module repo boundary violations (${activeViolations.length} total)\n`);
  console.log('Rule: handlers/{A}/ must not import from handlers/{B}/repos/ unless B="shared"');
  console.log('Fix:  expose a facade function in module B that returns only what A needs.\n');

  for (const [mod, viols] of byModule.entries()) {
    console.log(`  [${mod}] — ${viols.length} violation(s):`);
    for (const v of viols) {
      console.log(`    ${v.file}:${v.line}  →  imports from ${v.importedModule}/repos/`);
    }
  }

  console.log('\nSee docs/development/ for the facade pattern and migration guide.');
  process.exit(IS_ERROR_MODE ? 1 : 0);
}

main().catch((err) => {
  console.error('boundary check error:', err);
  process.exit(1);
});
