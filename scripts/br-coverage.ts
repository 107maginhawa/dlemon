/**
 * BR Coverage Reporter
 * Usage: bun run scripts/br-coverage.ts --module=<module-name>
 *
 * Reads specs/api/docs/standards/br-registry.json and reports
 * coverage status for the specified module (or all modules).
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const REGISTRY_PATH = resolve(import.meta.dir, '../specs/api/docs/standards/br-registry.json')

function parseArgs() {
  const args = process.argv.slice(2)
  const moduleArg = args.find(a => a.startsWith('--module='))
  return {
    module: moduleArg ? moduleArg.replace('--module=', '') : null,
  }
}

function loadRegistry() {
  if (!existsSync(REGISTRY_PATH)) {
    console.error(`Registry not found at ${REGISTRY_PATH}`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(REGISTRY_PATH, 'utf-8'))
}

function reportModule(moduleName: string, rules: Record<string, any>) {
  const entries = Object.entries(rules)
  const covered = entries.filter(([, v]) => v.status === 'COVERED').length
  const partial = entries.filter(([, v]) => v.status === 'PARTIAL').length
  const untested = entries.filter(([, v]) => v.status === 'UNTESTED').length

  console.log(`\n## Module: ${moduleName}`)
  console.log(`   Total: ${entries.length} | Covered: ${covered} | Partial: ${partial} | Untested: ${untested}`)

  if (untested > 0 || partial > 0) {
    console.log('\n   Needs attention:')
    for (const [id, rule] of entries) {
      if (rule.status !== 'COVERED') {
        console.log(`   ${rule.status.padEnd(8)} [${id}] ${rule.rule}`)
      }
    }
  } else {
    console.log('   ✓ Fully covered')
  }
}

function main() {
  const { module: targetModule } = parseArgs()
  const registry = loadRegistry()

  if (!registry.modules || Object.keys(registry.modules).length === 0) {
    console.log('BR registry is empty. Run /br-extract on a module to populate it.')
    process.exit(0)
  }

  if (targetModule) {
    const rules = registry.modules[targetModule]
    if (!rules) {
      console.log(`No entries found for module "${targetModule}". Run /br-extract first.`)
      process.exit(0)
    }
    reportModule(targetModule, rules)
  } else {
    console.log('# BR Coverage Report — All Modules')
    for (const [name, rules] of Object.entries(registry.modules)) {
      reportModule(name, rules as Record<string, any>)
    }
  }
}

main()
