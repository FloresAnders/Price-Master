const path = require("node:path");
const sharp = require("sharp");

const root = path.resolve(__dirname, "..");
const icon = path.resolve(__dirname, "..", "..", "icon128.png");
const smallBackground =
  "C:/Users/chave/.codex/generated_images/01a0eef2-c770-7952-ae7a-ac33bf92392e/exec-a2bd6d50-8d01-4026-808e-5079ae6a2fad.png";
const marqueeBackground =
  "C:/Users/chave/.codex/generated_images/01a0eef2-c770-7952-ae7a-ac33bf92392e/exec-68a48bba-5e7d-4b31-9d76-37f94e80479d.png";

function svgBuffer(width, height, body) {
  return Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .sans { font-family: "Segoe UI", Arial, sans-serif; }
        .shadow { paint-order: stroke; stroke: rgba(0, 40, 58, .3); stroke-width: 2px; stroke-linejoin: round; }
      </style>
      ${body}
    </svg>
  `);
}

async function buildSmallPromo() {
  const preparedIcon = await sharp(icon).resize(72, 72).png().toBuffer();
  const overlay = svgBuffer(
    440,
    280,
    `
      <rect x="19" y="21" width="86" height="86" rx="20" fill="#ffffff" opacity=".98"/>
      <rect x="18" y="130" width="395" height="105" rx="19" fill="#073c55" opacity=".78"/>
      <text class="sans shadow" x="124" y="54" fill="#ffffff" font-size="29" font-weight="800">Encabezado de</text>
      <text class="sans shadow" x="124" y="87" fill="#ffffff" font-size="29" font-weight="800">impresión</text>
      <text class="sans" x="39" y="163" fill="#ffffff" font-size="17" font-weight="700">Personaliza tus comprobantes</text>
      <text class="sans" x="39" y="190" fill="#d9edf5" font-size="14">Imagen, textos, fuentes y tamaños</text>
      <rect x="39" y="205" width="113" height="24" rx="12" fill="#cdeaf4"/>
      <text class="sans" x="56" y="222" fill="#0d5775" font-size="12" font-weight="800">Tucán + Junta</text>
    `,
  );

  await sharp(smallBackground)
    .resize(440, 280, { fit: "cover", position: "center" })
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: preparedIcon, left: 26, top: 28 },
    ])
    .flatten({ background: "#0d5775" })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, "promo-pequena-440x280.png"));
}

async function buildMarquee() {
  const preparedIcon = await sharp(icon).resize(128, 128).png().toBuffer();
  const overlay = svgBuffer(
    1400,
    560,
    `
      <rect x="76" y="126" width="164" height="164" rx="38" fill="#ffffff" opacity=".98"/>
      <rect x="276" y="109" width="845" height="330" rx="35" fill="#073c55" opacity=".66"/>
      <text class="sans shadow" x="320" y="203" fill="#ffffff" font-size="68" font-weight="800">Encabezado de impresión</text>
      <text class="sans" x="322" y="263" fill="#d9edf5" font-size="30">Personaliza los comprobantes de Tucán y Junta</text>
      <rect x="322" y="316" width="180" height="51" rx="25" fill="#cdeaf4"/>
      <rect x="520" y="316" width="204" height="51" rx="25" fill="#cdeaf4"/>
      <rect x="742" y="316" width="218" height="51" rx="25" fill="#cdeaf4"/>
      <text class="sans" x="359" y="349" fill="#0d5775" font-size="20" font-weight="800">Tu imagen</text>
      <text class="sans" x="555" y="349" fill="#0d5775" font-size="20" font-weight="800">Textos centrados</text>
      <text class="sans" x="772" y="349" fill="#0d5775" font-size="19" font-weight="800">Fuente y tamaño</text>
      <text class="sans" x="322" y="409" fill="#ffffff" font-size="21" font-weight="700">Configura una vez. Imprime con tu identidad.</text>
    `,
  );

  await sharp(marqueeBackground)
    .resize(1400, 560, { fit: "cover", position: "center" })
    .composite([
      { input: overlay, left: 0, top: 0 },
      { input: preparedIcon, left: 94, top: 144 },
    ])
    .flatten({ background: "#0d5775" })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(path.join(root, "marquesina-1400x560.png"));
}

Promise.all([buildSmallPromo(), buildMarquee()]).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
