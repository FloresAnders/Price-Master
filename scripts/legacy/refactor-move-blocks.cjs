/**
 * Codemod de reestructuración Fase 1.
 * Mueve carpetas según MOVES y reescribe imports (alias "@/..." y relativos)
 * en todos los archivos fuente para que apunten a las nuevas ubicaciones.
 *
 * Lógica clave: cada archivo tiene una ubicación FINAL (misma ruta si no se mueve,
 * o la nueva dentro de MOVES). Los imports relativos se recalculan desde la
 * ubicación final del importador hacia la ubicación final del importado.
 *
 * Uso: node scripts/refactor-move-blocks.cjs
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");

// Mapa origen -> destino (relativo a src/)
// Los alias "@/<origen>/..." se derivan automáticamente a "@/<destino>/..."
const MOVES = [
  ["components/recetas", "features/recetas"],
  ["components/xml", "features/xml"],
  ["components/anotaciones", "features/anotaciones"],
  ["components/scanner", "features/scanner"],
  ["components/chat", "features/chat"],
  ["components/session", "features/session"],
  ["components/solicitud", "features/solicitud"],
  ["components/calculator", "features/calculator"],
  ["components/edicionPerfil", "features/perfil"],
  ["components/daily-closings", "features/daily-closings"],
  ["components/admin", "features/admin"],
  ["components/auth", "features/auth"],
  ["components/funciones", "features/funciones"],
  ["components/diagnostics", "features/diagnostics"],
  ["components/business/cash-counter-tabs", "features/cash-counter"],
  ["components/business/control-horario", "features/control-horario"],
  ["components/business/registro-tiempos", "features/registro-tiempos"],
  ["components/business/registro-tucan", "features/registro-tucan"],
];

const SOURCE_EXT = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const normalize = (p) => path.normalize(p).replace(/\\/g, "/");
const stripExt = (p) => (SOURCE_EXT.includes(path.extname(p)) ? p.slice(0, -path.extname(p).length) : p);

function collectSourceFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "out"].includes(entry.name)) continue;
      out.push(...collectSourceFiles(full));
    } else if (SOURCE_EXT.includes(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

const allFiles = collectSourceFiles(SRC);
console.log(`Archivos fuente: ${allFiles.length}`);

// ---------- Mapa de ubicaciones finales ----------
// movedOrigins: lista de rutas absolutas de carpetas origen
const movedOrigins = MOVES.filter(([from]) => fs.existsSync(path.join(SRC, from))).map(
  ([from]) => path.join(SRC, from),
);

function finalLocation(absFile) {
  const key = normalize(stripExt(absFile));
  for (const origin of movedOrigins) {
    const rel = path.relative(origin, absFile);
    if (!rel.startsWith("..") && !path.isAbsolute(rel)) {
      // Está dentro de una carpeta movida: localizar cuál MOVES y aplicar destino
      const fromRel = path.relative(SRC, origin);
      const move = MOVES.find(([f]) => path.join(SRC, f) === origin);
      const toDir = path.join(SRC, move[1]);
      const dest = path.join(toDir, rel);
      return normalize(stripExt(dest));
    }
  }
  return key;
}

const finalMap = new Map();
for (const f of allFiles) finalMap.set(normalize(stripExt(f)), finalLocation(f));
console.log(`Mapa de ubicaciones finales construido (${finalMap.size} entradas)`);

// ---------- Reescribir imports ----------
// Derivar alias automáticamente de MOVES: "@/<origen>/" -> "@/<destino>/"
const ALIAS_MAP = {};
for (const [from, to] of MOVES) {
  ALIAS_MAP[`@/${from}/`] = `@/${to}/`;
  ALIAS_MAP[`@/${from}`] = `@/${to}`;
}
const aliasEntries = Object.entries(ALIAS_MAP).sort((a, b) => b[0].length - a[0].length);

function rewriteAliases(src) {
  let out = src;
  for (const [from, to] of aliasEntries) out = out.split(from).join(to);
  return out;
}

// Captura: from 'x', import 'x', import('x'), require('x')
const specifierRegex = /(?:from|import)\s*\(?\s*["']([^"']+)["']|require\s*\(\s*["']([^"']+)["']\s*\)/g;

function rewriteRelativeImports(fileAbs, src) {
  const importerFinalDir = path.dirname(finalMap.get(normalize(stripExt(fileAbs))));
  return src.replace(specifierRegex, (match, fromSpec, requireSpec) => {
    const spec = fromSpec ?? requireSpec;
    if (!spec.startsWith("./") && !spec.startsWith("../")) return match;
    const resolvedAbs = path.resolve(path.dirname(fileAbs), spec);
    const targetFinal = finalMap.get(normalize(stripExt(resolvedAbs)));
    if (!targetFinal) return match; // no existe o no mapeado: no tocar
    const newRel = path.relative(importerFinalDir, targetFinal).split(path.sep).join("/");
    const newSpec = newRel.startsWith(".") ? newRel : "./" + newRel;
    return match.replace(spec, newSpec);
  });
}

let changed = 0;
for (const file of allFiles) {
  const original = fs.readFileSync(file, "utf8");
  let content = rewriteAliases(original);
  content = rewriteRelativeImports(file, content);
  if (content !== original) {
    fs.writeFileSync(file, content, "utf8");
    changed++;
  }
}
console.log(`Archivos con imports reescritos: ${changed}`);

// ---------- git mv ----------
for (const [from, to] of MOVES) {
  const fromAbs = path.join(SRC, from);
  if (!fs.existsSync(fromAbs)) continue;
  const toAbs = path.join(SRC, to);
  fs.mkdirSync(path.dirname(toAbs), { recursive: true });
  try {
    execSync(`git mv "${fromAbs}" "${toAbs}"`, { stdio: "pipe" });
  } catch {
    try {
      execSync(`mv "${fromAbs}" "${toAbs}"`, { stdio: "pipe" });
    } catch (e) {
      console.error(`ERROR moviendo ${from}: ${e.message}`);
      process.exit(1);
    }
  }
  console.log(`git mv ${from} -> ${to}`);
}

console.log("\nListo. Siguiente: npx tsc --noEmit");
