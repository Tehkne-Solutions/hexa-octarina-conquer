#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const PACK_ROOT = path.join(ROOT, 'runtime', 'packs', 'PACK_11_NARRATIVE_PORTRAITS');
const PRODUCTION_ROOT = path.join(PACK_ROOT, 'production');
const QUEUE_PATH = path.join(PRODUCTION_ROOT, 'production-queue.generated.json');
const STATUS_PATH = path.join(PRODUCTION_ROOT, 'production-status.json');
const DEFAULT_STAGING = path.join(ROOT, 'staging', 'PACK_11_NARRATIVE_PORTRAITS');
const ASSETS_ROOT = path.join(PACK_ROOT, 'assets');
const REPORT_PATH = path.join(PRODUCTION_ROOT, 'ingestion-report.generated.json');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ALLOWED_SIZES = new Set(['1024x1024', '256x256']);
const REQUIRED_STATES = ['neutral', 'speaking', 'alert', 'combat', 'victory', 'defeat'];

function parseArgs(argv) {
  const args = { staging: DEFAULT_STAGING, dryRun: false };
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--dry-run') args.dryRun = true;
    else if (value === '--staging') args.staging = path.resolve(argv[++index]);
    else throw new Error(`Argumento desconhecido: ${value}`);
  }
  return args;
}

function readPngMetadata(buffer) {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('assinatura PNG invalida');
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const colorType = buffer.readUInt8(25);
  const hasAlpha = colorType === 4 || colorType === 6;
  return { width, height, hasAlpha, size: `${width}x${height}` };
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const queueDocument = await readJson(QUEUE_PATH);

  if (!Array.isArray(queueDocument.queue) || queueDocument.queue.length !== 24) {
    throw new Error('A fila canonica deve conter exatamente 24 assets.');
  }

  const seenFiles = new Set();
  const results = [];

  for (const item of queueDocument.queue) {
    if (seenFiles.has(item.file)) throw new Error(`Arquivo duplicado na fila: ${item.file}`);
    seenFiles.add(item.file);

    const source = path.join(args.staging, item.file);
    const destinationDir = path.join(ASSETS_ROOT, item.characterId);
    const destination = path.join(destinationDir, item.file);

    const result = {
      order: item.order,
      characterId: item.characterId,
      state: item.state,
      file: item.file,
      source,
      destination,
      status: 'missing',
      dimensions: null,
      alpha: null,
      sha256: null,
      error: null
    };

    if (!(await fileExists(source))) {
      results.push(result);
      continue;
    }

    try {
      const buffer = await readFile(source);
      const metadata = readPngMetadata(buffer);

      if (!ALLOWED_SIZES.has(metadata.size)) {
        throw new Error(`dimensao invalida: ${metadata.size}`);
      }
      if (!metadata.hasAlpha) {
        throw new Error('PNG sem canal alpha');
      }

      result.dimensions = metadata.size;
      result.alpha = true;
      result.sha256 = sha256(buffer);
      result.status = args.dryRun ? 'validated-dry-run' : 'ingested';

      if (!args.dryRun) {
        await mkdir(destinationDir, { recursive: true });
        await copyFile(source, destination);
      }
    } catch (error) {
      result.status = 'rejected';
      result.error = error instanceof Error ? error.message : String(error);
    }

    results.push(result);
  }

  const byCharacter = new Map();
  for (const result of results) {
    const items = byCharacter.get(result.characterId) ?? [];
    items.push(result);
    byCharacter.set(result.characterId, items);
  }

  const characters = [...byCharacter.entries()].map(([characterId, items]) => {
    const states = new Set(items.filter((item) => ['ingested', 'validated-dry-run'].includes(item.status)).map((item) => item.state));
    const complete = REQUIRED_STATES.every((state) => states.has(state));
    return {
      characterId,
      validatedAssets: states.size,
      complete,
      artisticReviewRequired: complete,
      approved: false
    };
  });

  const validatedAssets = results.filter((item) => ['ingested', 'validated-dry-run'].includes(item.status)).length;
  const structurallyCompleteCharacters = characters.filter((item) => item.complete).length;

  const report = {
    packId: queueDocument.packId,
    mode: args.dryRun ? 'dry-run' : 'ingest',
    staging: args.staging,
    generatedAt: new Date().toISOString(),
    expectedAssets: 24,
    validatedAssets,
    rejectedAssets: results.filter((item) => item.status === 'rejected').length,
    missingAssets: results.filter((item) => item.status === 'missing').length,
    structurallyCompleteCharacters,
    artisticApprovalRequired: true,
    results,
    characters,
    promotion: {
      pack11Ready: false,
      pack99GateSatisfied: false,
      runtimeReady: false
    }
  };

  await mkdir(PRODUCTION_ROOT, { recursive: true });
  await writeJson(REPORT_PATH, report);

  if (!args.dryRun) {
    const status = await readJson(STATUS_PATH);
    status.status = validatedAssets === 24 ? 'awaiting-artistic-approval' : 'awaiting-assets';
    status.validatedAssets = validatedAssets;
    status.approvedCharacters = 0;
    status.lastIngestion = {
      generatedAt: report.generatedAt,
      validatedAssets,
      rejectedAssets: report.rejectedAssets,
      missingAssets: report.missingAssets,
      report: path.relative(ROOT, REPORT_PATH).replaceAll('\\', '/')
    };
    status.promotion = {
      pack11Ready: false,
      pack99GateSatisfied: false,
      runtimeReady: false
    };
    await writeJson(STATUS_PATH, status);
  }

  console.log(`PACK 11: ${validatedAssets}/24 PNGs estruturalmente validos.`);
  console.log(`Completos por personagem: ${structurallyCompleteCharacters}/4.`);
  console.log(`Relatorio: ${path.relative(ROOT, REPORT_PATH)}`);

  if (report.rejectedAssets > 0) process.exitCode = 2;
  else if (report.missingAssets > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
