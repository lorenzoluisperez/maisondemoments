import { gzipSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const MAX_INITIAL_JS = 200 * 1024;
const MAX_CRITICAL_ASSETS = 300 * 1024;
const MAX_CRITICAL_TRANSFER = 600 * 1024;
const MAX_ACTIVE_DECODED_MEMORY = 64 * 1024 * 1024;
const MAX_VARIANT_WIDTH = 1600;
const MAX_VARIANT_HEIGHT = 2400;

const outputDirectory = resolve(".next/server/app/i");
const htmlFiles = (await readdir(outputDirectory)).filter((name) => name.endsWith("-demo.html"));
if (htmlFiles.length !== 8) throw new Error(`Expected 8 prerendered invitation demos, found ${htmlFiles.length}`);

let maxInitialJs = 0;
let maxCriticalTransfer = 0;
for (const htmlFile of htmlFiles) {
  const html = await readFile(resolve(outputDirectory, htmlFile), "utf8");
  const chunkPaths = uniqueMatches(html, /(?:src|href)="(\/_next\/static\/chunks\/[^"]+\.js)/g);
  const cssPaths = uniqueMatches(html, /href="(\/_next\/static\/chunks\/[^"]+\.css)/g);
  const initialJs = await compressedFiles(chunkPaths.map(nextBuildPath));
  const css = await compressedFiles(cssPaths.map(nextBuildPath));
  const artworkPath = htmlFile.includes("midnight-garden") ? "public/maison-botanical.webp" : "public/maison-luminous-parchment.webp";
  const artwork = (await stat(artworkPath)).size;
  const criticalTransfer = initialJs + css + artwork + gzipSync(Buffer.from(html), { level: 9 }).length;
  maxInitialJs = Math.max(maxInitialJs, initialJs);
  maxCriticalTransfer = Math.max(maxCriticalTransfer, criticalTransfer);
}

const artworkBytes = await Promise.all(["public/maison-botanical.webp", "public/maison-luminous-parchment.webp"].map(async (path) => (await stat(path)).size));
const maxArtwork = Math.max(...artworkBytes);
const activeDecodedMemory = MAX_VARIANT_WIDTH * MAX_VARIANT_HEIGHT * 4 * 2;

if (maxInitialJs > MAX_INITIAL_JS) throw new Error(`Initial guest JavaScript exceeds 200 KiB: ${maxInitialJs} bytes`);
if (maxArtwork > MAX_CRITICAL_ASSETS) throw new Error(`Critical artwork exceeds 300 KiB: ${maxArtwork} bytes`);
if (maxCriticalTransfer > MAX_CRITICAL_TRANSFER) throw new Error(`Critical transfer exceeds 600 KiB: ${maxCriticalTransfer} bytes`);
if (activeDecodedMemory > MAX_ACTIVE_DECODED_MEMORY) throw new Error("Active image decode budget exceeds 64 MiB");

console.log(JSON.stringify({
  demos: htmlFiles.length,
  maxInitialGuestJsKiB: toKiB(maxInitialJs),
  maxCriticalArtworkKiB: toKiB(maxArtwork),
  maxCriticalTransferKiB: toKiB(maxCriticalTransfer),
  activeAndAdjacentDecodedMemoryMiB: Math.round(activeDecodedMemory / 1024 / 1024 * 10) / 10,
}));

function uniqueMatches(value, pattern) {
  return [...new Set([...value.matchAll(pattern)].map((match) => match[1]))];
}

function nextBuildPath(path) {
  return resolve(".next", path.replace(/^\/_next\//, ""));
}

async function compressedFiles(paths) {
  let total = 0;
  for (const path of paths) total += gzipSync(await readFile(path), { level: 9 }).length;
  return total;
}

function toKiB(bytes) {
  return Math.round(bytes / 1024 * 10) / 10;
}
