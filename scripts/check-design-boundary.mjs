#!/usr/bin/env node
/**
 * Design-system boundary check — report mode.
 *
 * Regla: `primeng/*` solo se importa desde el kit (`src/app/shared/components/bw-*`).
 * Todo lo demás consume componentes `bw-*`, no `p-*`. Es la etapa 5 del
 * design system (docs/design-system-library.md), operando como reporte:
 * hoy lista la deuda, no rompe el build.
 *
 * Uso:
 *   node scripts/check-design-boundary.mjs           # reporte, exit 0
 *   node scripts/check-design-boundary.mjs --strict  # exit 1 si hay deuda
 *
 * Los `*.spec.ts` quedan fuera: un spec puede montar `p-*` para probar un
 * componente legacy sin que eso sea una violación de frontera.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const KIT_DIR = 'src/app/shared/components/bw-';
const IMPORT_RE = /from\s+['"]primeng\/([a-z0-9/-]+)['"]/g;

const strict = process.argv.includes('--strict');

// `providePrimeNG()` es wiring del runtime: sigue siendo necesario mientras
// haya componentes alquilados. No es markup ni estado, así que no cuenta como
// deuda de frontera.
const PROVIDER_FILES = new Set(['src/app/app.config.ts']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.angular') continue;
      walk(full, out);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

function areaOf(relPath) {
  const parts = relPath.split('/');
  if (parts[0] === 'src' && parts[1] === 'app' && parts[2] === 'app.config.ts') return 'app';
  if (parts[2] === 'features') {
    return parts[3] === 'admin' ? `features/admin/${parts[4] ?? ''}`.replace(/\/$/, '') : `features/${parts[3] ?? ''}`;
  }
  if (parts[2] === 'layouts') return 'layouts';
  if (parts[2] === 'shared') return `shared/${parts[3] ?? ''}`;
  if (parts[2] === 'core') return 'core';
  return parts.slice(0, 3).join('/');
}

const files = walk(SRC);
const allowed = [];
const outside = [];
let scannedImports = 0;

for (const file of files) {
  const rel = relative(ROOT, file).split('\\').join('/');
  const source = readFileSync(file, 'utf8');
  const modules = [...source.matchAll(IMPORT_RE)].map((m) => m[1]);
  if (modules.length === 0) continue;
  scannedImports += modules.length;
  const entry = { rel, modules: [...new Set(modules)].sort() };
  if (rel.startsWith(KIT_DIR) || PROVIDER_FILES.has(rel)) allowed.push(entry);
  else outside.push(entry);
}

const total = outside.length + allowed.length;
const byArea = new Map();
const byModule = new Map();
for (const { rel, modules } of outside) {
  const area = areaOf(rel);
  byArea.set(area, (byArea.get(area) ?? 0) + 1);
  for (const mod of modules) byModule.set(mod, (byModule.get(mod) ?? 0) + 1);
}

const sorted = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

console.log('Design-system boundary — primeng/* outside the kit');
console.log(`Allowed: ${KIT_DIR}*/`);
console.log('');
console.log(
  `Scanned ${files.length} TS files · ${total} import primeng/* · ${allowed.length} allowed (kit + provider) · ${outside.length} outside · ${scannedImports} imports total`,
);

if (allowed.length > 0) {
  console.log('');
  console.log('Allowed (kit + provider wiring)');
  for (const { rel, modules } of allowed) console.log(`  ${rel}  [${modules.join(', ')}]`);
}

if (outside.length > 0) {
  console.log('');
  console.log('Outside the kit, by area');
  for (const [area, count] of sorted(byArea)) console.log(`  ${area.padEnd(34)} ${String(count).padStart(3)}`);

  console.log('');
  console.log('Outside the kit, by module');
  for (const [mod, count] of sorted(byModule)) console.log(`  ${mod.padEnd(18)} ${String(count).padStart(3)} files`);

  console.log('');
  console.log('Files');
  for (const { rel, modules } of outside.sort((a, b) => a.rel.localeCompare(b.rel))) {
    console.log(`  ${rel}`);
    console.log(`      ${modules.join(', ')}`);
  }
}

console.log('');
if (strict && outside.length > 0) {
  console.log(`FAIL: ${outside.length} file(s) outside the kit import primeng/*.`);
  process.exit(1);
}
console.log(
  outside.length === 0
    ? 'OK: no primeng/* outside the kit.'
    : `Report only: ${outside.length} file(s) pending migration. Run with --strict to fail.`,
);
