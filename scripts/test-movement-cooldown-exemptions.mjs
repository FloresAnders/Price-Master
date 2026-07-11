import { readFileSync } from "node:fs";
import { join } from "node:path";

const submitPath = join(
  process.cwd(),
  "src",
  "app",
  "fondogeneral",
  "utils",
  "submitFondo.ts",
);
const deletionPath = join(
  process.cwd(),
  "src",
  "app",
  "fondogeneral",
  "utils",
  "movementDeletion.ts",
);

const source = readFileSync(submitPath, "utf8");
const deletionSource = readFileSync(deletionPath, "utf8");

const cooldownBlock = source.match(
  /Admins\/Superadmins are exempt from the 1-minute cooldown\.[\s\S]*?const fingerprintParts = \[/,
)?.[0];

if (!cooldownBlock) {
  throw new Error("No se encontro el bloque de cooldown de movimientos.");
}

if (!/newIsCierreFondoVentas/.test(cooldownBlock)) {
  throw new Error(
    "La exencion debe calcularse explicitamente para el movimiento nuevo.",
  );
}

if (!/!newIsIngresoDesdeFV\s*&&\s*!newIsCierreFondoVentas/.test(cooldownBlock)) {
  throw new Error(
    'CIERRE FONDO VENTAS debe saltar el bloqueo de cooldown de 1 minuto.',
  );
}

if (!/previousCooldownAt/.test(deletionSource)) {
  throw new Error(
    "Al borrar CIERRE FONDO VENTAS se debe preservar el cooldown previo.",
  );
}

if (!/const isCierreVentas = isCierreFondoVentasMovement\(entry, deps\)/.test(deletionSource)) {
  throw new Error(
    "La limpieza al borrar cierre debe usar la misma deteccion que autoriza borrarlo.",
  );
}

if (!/localStorage\.setItem\(createdKey,\s*JSON\.stringify\(\{\s*at:\s*previousCooldownAt\s*\}\)\)/s.test(deletionSource)) {
  throw new Error("El cooldown previo debe restaurarse en localStorage.");
}

console.log("movement cooldown exemptions ok");
