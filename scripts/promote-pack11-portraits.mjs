#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const packRoot = path.join(root, 'runtime', 'packs', 'PACK_11_NARRATIVE_PORTRAITS');
const productionDir = path.join(packRoot, 'production');
const queuePath = path.join(productionDir, 'production-queue.generated.json');
const statusPath = path.join(productionDir, 'production-status.json');
const approvalPath = path.join(productionDir, 'artistic-approval.json');
const assetsRoot = path.join(packRoot, 'assets');
const manifestPath = path.join(packRoot, 'manifest.generated.json');
const runtimeRegistryPath = path.join(root, 'runtime', 'packs', 'pack-registry.generated.json');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo obrigatório ausente: ${path.relative(root, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const queue = readJson(queuePath);
const status = readJson(statusPath);
const approvals = readJson(approvalPath);

const entries = Array.isArray(queue.queue) ? queue.queue : [];
if (entries.length !== 24) {
  throw new Error(`Fila inválida: esperados 24 assets, encontrados ${entries.length}.`);
}

const assets = entries.map((entry) => {
  const filePath = path.join(assetsRoot, entry.characterId, entry.file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Asset ausente: ${path.relative(root, filePath)}`);
  }

  return {
    order: entry.order,
    characterId: entry.characterId,
    state: entry.state,
    file: entry.file,
    runtimePath: path.relative(root, filePath).replaceAll('\\', '/'),
    sha256: sha256(filePath)
  };
});

const approvalRecords = approvals.characters ?? approvals.approvals ?? approvals;
const requiredCharacters = [
  'hero_vanguard_01',
  'hero_arcanist_01',
  'champion_raider_01',
  'faction_oracle_01'
];

for (const characterId of requiredCharacters) {
  const record = Array.isArray(approvalRecords)
    ? approvalRecords.find((item) => item.characterId === characterId)
    : approvalRecords[characterId];

  if (!record?.approved) {
    throw new Error(`Aprovação artística pendente: ${characterId}`);
  }
}

const manifest = {
  packId: 'PACK_11_NARRATIVE_PORTRAITS',
  status: 'promoted',
  promotedAt: new Date().toISOString(),
  expectedAssets: 24,
  validatedAssets: assets.length,
  approvedCharacters: requiredCharacters.length,
  assets,
  promotion: {
    pack11Ready: true,
    pack99GateSatisfied: true,
    runtimeReady: true
  }
};

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

const registry = fs.existsSync(runtimeRegistryPath)
  ? readJson(runtimeRegistryPath)
  : { packs: [] };

registry.packs = Array.isArray(registry.packs) ? registry.packs : [];
const existingIndex = registry.packs.findIndex((pack) => pack.packId === manifest.packId);
const registryEntry = {
  packId: manifest.packId,
  manifest: path.relative(root, manifestPath).replaceAll('\\', '/'),
  status: 'active',
  assetCount: assets.length,
  activatedAt: manifest.promotedAt
};

if (existingIndex >= 0) registry.packs[existingIndex] = registryEntry;
else registry.packs.push(registryEntry);

fs.mkdirSync(path.dirname(runtimeRegistryPath), { recursive: true });
fs.writeFileSync(runtimeRegistryPath, `${JSON.stringify(registry, null, 2)}\n`);

status.status = 'promoted';
status.validatedAssets = 24;
status.approvedCharacters = 4;
status.promotion = {
  pack11Ready: true,
  pack99GateSatisfied: true,
  runtimeReady: true
};
status.promotedAt = manifest.promotedAt;
fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);

console.log('PACK 11 promovido com sucesso.');
console.log(`Manifesto: ${path.relative(root, manifestPath)}`);
console.log(`Registro runtime: ${path.relative(root, runtimeRegistryPath)}`);
