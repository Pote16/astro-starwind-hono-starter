/**
 * Erzeugt aus public/favicon.svg den Favicon-Satz, die App-Icons für das
 * Web-App-Manifest und das Standard-Vorschaubild (1200×630) für Open Graph.
 *
 * Einmalig ausführen und die Ergebnisse committen:
 *   cd apps/frontend && bun tools/erzeuge-icons.ts
 *
 * Rasterung braucht sharp und gehört nicht in den Seitenbau; deshalb liegen die
 * PNG/ICO-Dateien fertig unter public/ bzw. src/assets/. Wer das Logo oder den
 * Markennamen ändert, passt favicon.svg und die Konstanten unten an und führt
 * das Skript erneut aus.
 */
import { fileURLToPath } from "node:url";

import sharp from "sharp";

// Markenname im Vorschaubild. Absichtlich nicht aus src/data/site.ts importiert:
// site.ts bindet das hier erzeugte PNG ein, und Bun kann PNG-Importe nicht laden.
const MARKE = "Astro + Starwind Starter";
const UNTERZEILE = "Astro · Hono · Bun · PostgreSQL";
const FARBE = "#2563eb";
const FARBE_DUNKEL = "#1d4ed8";

const publicDir = new URL("../public/", import.meta.url);
const ogZiel = new URL("../src/assets/og-default.png", import.meta.url);
const quelle = await Bun.file(new URL("favicon.svg", publicDir)).bytes();

/** Symbol in Kantenlänge `groesse`; `hintergrund` füllt Transparenz mit der Markenfarbe. */
async function symbol(groesse: number, hintergrund = false): Promise<Buffer> {
  const bild = sharp(quelle, { density: 384 }).resize(groesse, groesse);
  return (hintergrund ? bild.flatten({ background: FARBE }) : bild).png().toBuffer();
}

/** Maskable: Android beschneidet auf Kreis oder Quadrat; nur die inneren 80 % sind sicher. */
async function maskierbar(groesse: number): Promise<Buffer> {
  const innen = Math.round(groesse * 0.8);
  const glyphe = await sharp(quelle, { density: 384 }).resize(innen, innen).png().toBuffer();
  return sharp({
    create: { width: groesse, height: groesse, channels: 4, background: FARBE },
  })
    .composite([{ input: glyphe, gravity: "centre" }])
    .png()
    .toBuffer();
}

/**
 * ICO-Container mit PNG-Einträgen (seit Windows Vista unterstützt, von allen
 * aktuellen Browsern gelesen). Aufbau: ICONDIR (6 Byte) + je Eintrag
 * ICONDIRENTRY (16 Byte) + die PNG-Daten in derselben Reihenfolge.
 */
function ico(eintraege: { groesse: number; png: Buffer }[]): Buffer {
  const kopf = Buffer.alloc(6);
  kopf.writeUInt16LE(0, 0); // reserviert
  kopf.writeUInt16LE(1, 2); // Typ 1 = Icon
  kopf.writeUInt16LE(eintraege.length, 4);
  const verzeichnis = Buffer.alloc(16 * eintraege.length);
  let offset = 6 + verzeichnis.length;
  eintraege.forEach(({ groesse, png }, index) => {
    const eintrag = verzeichnis.subarray(index * 16, index * 16 + 16);
    eintrag.writeUInt8(groesse >= 256 ? 0 : groesse, 0); // Breite (0 = 256)
    eintrag.writeUInt8(groesse >= 256 ? 0 : groesse, 1); // Höhe
    eintrag.writeUInt8(0, 2); // Palettenfarben (0 = keine Palette)
    eintrag.writeUInt8(0, 3); // reserviert
    eintrag.writeUInt16LE(1, 4); // Farbebenen
    eintrag.writeUInt16LE(32, 6); // Bits je Pixel
    eintrag.writeUInt32LE(png.length, 8);
    eintrag.writeUInt32LE(offset, 12);
    offset += png.length;
  });
  return Buffer.concat([kopf, verzeichnis, ...eintraege.map(({ png }) => png)]);
}

/** Vorschaubild 1200×630: Verlauf, Symbol, Markenname. Textlayout als SVG. */
async function vorschaubild(): Promise<Buffer> {
  const glyphe = await sharp(quelle, { density: 384 }).resize(220, 220).png().toBuffer();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${FARBE_DUNKEL}"/>
      <stop offset="1" stop-color="${FARBE}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <text x="380" y="298" font-family="Inter, Segoe UI, Arial, Helvetica, sans-serif" font-size="64" font-weight="700" fill="#ffffff">${MARKE}</text>
  <text x="380" y="366" font-family="Inter, Segoe UI, Arial, Helvetica, sans-serif" font-size="32" fill="#dbeafe">${UNTERZEILE}</text>
</svg>`;
  return sharp(Buffer.from(svg))
    .composite([{ input: glyphe, left: 110, top: 205 }])
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
}

const ausgaben: [URL, Buffer][] = [
  [new URL("favicon-32.png", publicDir), await symbol(32)],
  [new URL("apple-touch-icon.png", publicDir), await symbol(180, true)],
  [new URL("icon-192.png", publicDir), await symbol(192)],
  [new URL("icon-512.png", publicDir), await symbol(512)],
  [new URL("icon-512-maskable.png", publicDir), await maskierbar(512)],
  [
    new URL("favicon.ico", publicDir),
    ico(
      await Promise.all(
        [16, 32, 48].map(async (groesse) => ({ groesse, png: await symbol(groesse) })),
      ),
    ),
  ],
  [ogZiel, await vorschaubild()],
];
for (const [ziel, daten] of ausgaben) {
  await Bun.write(ziel, daten);
  process.stdout.write(`${fileURLToPath(ziel)} (${daten.length} Byte)\n`);
}
