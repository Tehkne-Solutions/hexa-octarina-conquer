import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('runtime/packs/PACK_11_NARRATIVE_PORTRAITS');
const CHARACTERS = [
  'hero_vanguard_01',
  'hero_arcanist_01',
  'champion_raider_01',
  'faction_oracle_01'
];

function readPngHeader(buffer) {
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error('arquivo não é um PNG válido');
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    colorType: buffer.readUInt8(25)
  };
}

async function validateCharacter(characterId) {
  const characterRoot = path.join(ROOT, 'characters', characterId);
  const checklistPath = path.join(characterRoot, 'asset-checklist.json');
  const checklist = JSON.parse(await readFile(checklistPath, 'utf8'));
  const assetsDirectory = path.join(characterRoot, 'assets');
  const results = [];

  for (const asset of checklist.assets) {
    const filePath = path.join(assetsDirectory, asset.file);
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error('caminho não aponta para arquivo');

      const buffer = await readFile(filePath);
      const header = readPngHeader(buffer);
      const hasAlpha = header.colorType === 4 || header.colorType === 6;
      const dimensionsValid =
        (header.width === 1024 && header.height === 1024) ||
        (header.width === 256 && header.height === 256);

      results.push({
        file: asset.file,
        present: true,
        width: header.width,
        height: header.height,
        dimensionsValid,
        alphaCapable: hasAlpha,
        sha256: createHash('sha256').update(buffer).digest('hex')
      });
    } catch (error) {
      results.push({
        file: asset.file,
        present: false,
        error: error.message
      });
    }
  }

  return {
    characterId,
    approvedByStructure: results.every(
      (result) => result.present && result.dimensionsValid && result.alphaCapable
    ),
    results
  };
}

async function main() {
  const report = {
    packId: 'PACK_11_NARRATIVE_PORTRAITS',
    generatedAt: new Date().toISOString(),
    expectedAssets: 24,
    characters: []
  };

  for (const characterId of CHARACTERS) {
    report.characters.push(await validateCharacter(characterId));
  }

  const flatResults = report.characters.flatMap((character) => character.results);
  report.completedAssets = flatResults.filter((result) => result.present).length;
  report.structurallyValidAssets = flatResults.filter(
    (result) => result.present && result.dimensionsValid && result.alphaCapable
  ).length;
  report.approvedCharacters = report.characters.filter(
    (character) => character.approvedByStructure
  ).length;
  report.packReadyForArtReview = report.structurallyValidAssets === report.expectedAssets;

  console.log(JSON.stringify(report, null, 2));

  if (!report.packReadyForArtReview) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
