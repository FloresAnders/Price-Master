// Migra TODO el arbol app/fondogeneral -> features/fondogeneral:
// 1. git mv de la carpeta completa (preserva relativos internos)
// 2. Reescribe imports alias externos (@/app/fondogeneral -> @/features/fondogeneral)
// 3. Reescribe imports relativos externos que apuntaban a app/fondogeneral
// 4. Crea paginas delgadas en app/fondogeneral/*/page.tsx y app/fondogeneral/page.tsx
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const srcDir = path.join(ROOT, "src");
const appFondo = path.join(srcDir, "app", "fondogeneral");
const featFondo = path.join(srcDir, "features", "fondogeneral");

const normalize = (p) => p.replace(/\\/g, "/");

function collectFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(normalize(full));
    }
  };
  walk(dir);
  return out;
}

// RUTAS: su contenido se MUEVE a features/fondogeneral/<ruta>/page.tsx
// y en app/fondogeneral/<ruta>/page.tsx se crea una pagina delgada que re-exporta
const ROUTE_PAGES = [
  "app/fondogeneral/page.tsx",
  "app/fondogeneral/agregarproveedor/page.tsx",
  "app/fondogeneral/deudasinternas/page.tsx",
  "app/fondogeneral/reportessinpe/page.tsx",
].map((p) => normalize(path.join(srcDir, p)));

// 1. Mover TODO (incluye las rutas -> features) para que los archivos queden
// en features/fondogeneral/ y las paginas delgadas se regeneran despues
fs.mkdirSync(featFondo, { recursive: true });
let movedCount = 0;
for (const f of collectFiles(appFondo)) {
  const rel = normalize(f).slice(normalize(appFondo).length + 1);
  const dest = path.join(featFondo, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    execSync(`git mv "${f}" "${dest}"`, { stdio: "pipe" });
  } catch {
    fs.renameSync(f, dest);
  }
  movedCount++;
}
// limpiar dirs vacios
for (const rp of ROUTE_PAGES) {
  try {
    fs.rmdirSync(path.dirname(rp));
  } catch {}
}
console.log(`Movidos ${movedCount} archivos a features/fondogeneral/`);

// 2. Mapa de ubicaciones finales para resolver relativos externos
const finalMap = new Map();
for (const f of collectFiles(featFondo)) {
  finalMap.set(normalize(f).replace(/\.(ts|tsx)$/, ""), normalize(f));
}

// 3. Reescribir imports en TODO el proyecto (incluye archivos movidos)
const projectFiles = [];
const walkAll = (d) => {
  if (d.includes("node_modules") || d.includes(".next")) return;
  for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
    const full = path.join(d, entry.name);
    if (entry.isDirectory()) walkAll(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) projectFiles.push(normalize(full));
  }
};
walkAll(srcDir);

let changed = 0;
for (const f of projectFiles) {
  if (!fs.existsSync(f)) continue;
  const content = fs.readFileSync(f, "utf8");
  let out = content;

  // alias: @/app/fondogeneral -> @/features/fondogeneral
  if (out.includes("@/app/fondogeneral")) {
    out = out.split("@/app/fondogeneral").join("@/features/fondogeneral");
  }

  // relativos: si el destino resuelto pertenecia a app/fondogeneral y ahora vive en features/fondogeneral
  const importRe = /(from\s*|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;
  out = out.replace(importRe, (match, prefix, spec) => {
    if (!spec.startsWith(".")) return match;
    const absTarget = normalize(path.resolve(path.dirname(f), spec));
    const absTargetNoExt = absTarget.replace(/\.(ts|tsx)$/, "");
    const target = finalMap.get(absTargetNoExt);
    if (!target) return match;
    const relPath = normalize(path.relative(path.dirname(f), target));
    const relSpec = relPath.startsWith(".") ? relPath : `./${relPath}`;
    return `${prefix}"${relSpec}"`;
  });

  if (out !== content) {
    fs.writeFileSync(f, out, "utf8");
    changed++;
  }
}
console.log(`Imports reescritos en ${changed} archivos.`);

// 4. Paginas delgadas en app/fondogeneral
const thinPages = [
  {
    page: "app/fondogeneral/page.tsx",
    component: "FondoPageContent",
    from: "@/features/fondogeneral/page",
    content: `"use client";

// Pagina delgada: re-exporta el feature de fondogeneral
import FondoPageContent from "@/features/fondogeneral/page";

export default FondoPageContent;
`,
  },
  {
    page: "app/fondogeneral/agregarproveedor/page.tsx",
    component: "AgregarProveedorPage",
    from: "@/features/fondogeneral/agregarproveedor/page",
    content: `"use client";

// Pagina delgada: re-exporta el feature de agregar proveedor
import AgregarProveedorPage from "@/features/fondogeneral/agregarproveedor/page";

export default AgregarProveedorPage;
`,
  },
  {
    page: "app/fondogeneral/deudasinternas/page.tsx",
    component: "DeudasInternasPage",
    from: "@/features/fondogeneral/deudasinternas/page",
    content: `"use client";

// Pagina delgada: re-exporta el feature de deudas internas
import DeudasInternasPage from "@/features/fondogeneral/deudasinternas/page";

export default DeudasInternasPage;
`,
  },
  {
    page: "app/fondogeneral/reportessinpe/page.tsx",
    component: "ReportesSinpePage",
    from: "@/features/fondogeneral/reportessinpe/page",
    content: `"use client";

// Pagina delgada: re-exporta el feature de reportes SINPE
import ReportesSinpePage from "@/features/fondogeneral/reportessinpe/page";

export default ReportesSinpePage;
`,
  },
];

for (const tp of thinPages) {
  const pagePath = path.join(srcDir, tp.page);
  fs.mkdirSync(path.dirname(pagePath), { recursive: true });
  fs.writeFileSync(pagePath, tp.content, "utf8");
  console.log(`PAGINA DELGADA: ${tp.page}`);
}

console.log("OK");
