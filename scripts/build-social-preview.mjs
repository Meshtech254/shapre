import sharp from "sharp";
await sharp("public/social-preview.svg").png({ compressionLevel: 9 }).toFile("public/social-preview.png");
console.log("Generated public/social-preview.png from the source SVG.");
