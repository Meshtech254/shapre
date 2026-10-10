import sharp from "sharp";
import { writeFile } from "node:fs/promises";
// Match the existing lime, rounded, rotated standalone mark.
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g transform="rotate(-12 32 32)"><rect x="12" y="12" width="40" height="40" rx="10" fill="none" stroke="#c5f47b" stroke-width="10"/></g></svg>';
const png = await sharp(Buffer.from(svg)).png().toBuffer();
await writeFile("src/app/icon.png", png);
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 64;
header[7] = 64;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
await writeFile("public/favicon.ico", Buffer.concat([header, png]));
