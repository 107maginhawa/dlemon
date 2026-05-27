#!/usr/bin/env bun
// Sets DATABASE_URL to monobase_test when not already set, then runs bun test.
// Cross-platform alternative to ${VAR:-default} shell syntax.
process.env.DATABASE_URL ??= 'postgresql://postgres:password@localhost:5432/monobase_test';
const proc = Bun.spawn(['bun', 'test', ...process.argv.slice(2)], { stdio: ['inherit', 'inherit', 'inherit'] });
process.exit(await proc.exited);
