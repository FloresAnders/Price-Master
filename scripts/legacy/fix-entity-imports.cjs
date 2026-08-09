/**
 * One-off: reemplaza imports relativos (../shared/services/...) que apuntan a
 * los 6 services movidos a entities/ por alias absolutos @/entities/...
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const SRC = path.join(process.cwd(), "src");

// service name -> entity dir
const MAP = {
  empresas: "empresa",
  empleados: "empleado",
  productos: "producto",
  "productos-cache": "producto/cache",
  providers: "proveedor",
  recetas: "receta",
};

// Recopilar archivos con fs (evita problemas de espacios en rutas Windows)
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", "out"].includes(entry.name)) continue;
      walk(full, out);
    } else if (/\.[jt]sx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}
const files = walk(SRC).filter((f) =>
  /shared\/services\/(empresas|empleados|productos|productos-cache|providers|recetas)/.test(
    fs.readFileSync(f, "utf8"),
  ),
);

let changed = 0;
for (const file of files) {
  const original = fs.readFileSync(file, "utf8");
  let content = original;
  // Reescribir cualquier specifier relativo o alias que apunte a los services movidos
  content = content.replace(
    /(from\s+|import\s*\(?\s*)(["'])([^"']*shared\/services\/(empresas|empleados|productos|productos-cache|providers|recetas))(["'])/g,
    (m, prefix, q, full, name) => {
      const entity = MAP[name];
      return `${prefix}${q}@/entities/${entity}${q}`;
    },
  );
  if (content !== original) {
    fs.writeFileSync(file, content, "utf8");
    changed++;
    console.log(`  OK: ${path.relative(process.cwd(), file)}`);
  }
}
console.log(`\nArchivos actualizados: ${changed}`);
