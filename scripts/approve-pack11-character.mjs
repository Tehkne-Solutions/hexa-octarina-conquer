#!/usr/bin/env node

import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const PACK_ROOT = path.join(ROOT, 'runtime', 'packs', 'PACK_11_NARRATIVE_PORTRAITS');
const APPROVAL_FILE = path.join(PACK_ROOT, 'production', 'artistic-approval.json');
const STATUS_FILE = path.join(PACK_ROOT, 'production', 'production-status.json');
const QUEUE_FILE = path.join(PACK_ROOT, 'production', 'production-queue.generated.json');
const REQUIRED_STATES = ['neutral', 'speaking', 'alert', 'combat', 'victory', 'defeat'];

function parseArgs(argv) {
  const args = { character: null, reviewer: null, notes: [], checks: {} };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--character') args.character = argv[++i];
    else if (token === '--reviewer') args.reviewer = argv[++i];
    else if (token === '--note') args.notes.push(argv[++i]);
    else if (token === '--identity') args.checks.identityConsistent = true;
    else if (token === '--states') args.checks.statesReadable = true;
    else if (token === '--framing') args.checks.framingConsistent = true;
    else if (token === '--lighting') args.checks.lightingConsistent = true;
    else if (token === '--signatures') args.checks.signatureElementsPreserved = true;
    else if (token === '--all') {
      args.checks = {
        identityConsistent: true,
        statesReadable: true,
        framingConsistent: true,
        lightingConsistent: true,
        signatureElementsPreserved: true
      };
    }
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

const args = parseArgs(process.argv);
if (!args.character || !args.reviewer) {
  console.error('Uso: node scripts/approve-pack11-character.mjs --character <id> --reviewer <nome> --all [--note "texto"]');
  process.exit(1);
}

const approval = await readJson(APPROVAL_FILE);
const queue = await readJson(QUEUE_FILE);
const status = await readJson(STATUS_FILE);
const target = approval.characters.find((item) => item.characterId === args.character);

if (!target) {
  console.error(`Personagem desconhecido: ${args.character}`);
  process.exit(1);
}

const queued = queue.queue.filter((item) => item.characterId === args.character);
if (queued.length !== REQUIRED_STATES.length) {
  console.error(`Fila incompleta para ${args.character}: ${queued.length}/${REQUIRED_STATES.length}`);
  process.exit(1);
}

const missing = [];
for (const item of queued) {
  const assetPath = path.join(PACK_ROOT, 'assets', args.character, item.file);
  if (!(await fileExists(assetPath))) missing.push(item.file);
}

if (missing.length > 0) {
  console.error(`Aprovação bloqueada. Assets ausentes para ${args.character}:`);
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const requiredChecks = [
  'identityConsistent',
  'statesReadable',
  'framingConsistent',
  'lightingConsistent',
  'signatureElementsPreserved'
];

for (const check of requiredChecks) {
  if (args.checks[check] === true) target.review[check] = true;
}

target.review.notes = [...new Set([...(target.review.notes ?? []), ...args.notes])];
target.review.reviewer = args.reviewer;
target.review.reviewedAt = new Date().toISOString();
target.review.approved = requiredChecks.every((check) => target.review[check] === true);
target.status = target.review.approved ? 'approved' : 'review-incomplete';

const approvedCharacters = approval.characters.filter((item) => item.review.approved).length;
approval.promotion.approvedCharacters = approvedCharacters;
approval.promotion.pack11Ready = approvedCharacters === approval.promotion.requiredApprovedCharacters;
approval.promotion.pack99GateSatisfied = approval.promotion.pack11Ready && status.validatedAssets === status.expectedAssets;
approval.promotion.runtimeReady = approval.promotion.pack99GateSatisfied;

status.approvedCharacters = approvedCharacters;
status.promotion.pack11Ready = approval.promotion.pack11Ready;
status.promotion.pack99GateSatisfied = approval.promotion.pack99GateSatisfied;
status.promotion.runtimeReady = approval.promotion.runtimeReady;
status.status = approval.promotion.runtimeReady
  ? 'ready-for-runtime'
  : status.validatedAssets === status.expectedAssets
    ? 'awaiting-artistic-approval'
    : 'awaiting-assets';

await writeFile(APPROVAL_FILE, `${JSON.stringify(approval, null, 2)}\n`);
await writeFile(STATUS_FILE, `${JSON.stringify(status, null, 2)}\n`);

console.log(`${args.character}: ${target.status}`);
console.log(`Personagens aprovados: ${approvedCharacters}/${approval.promotion.requiredApprovedCharacters}`);
console.log(`PACK 11 pronto: ${approval.promotion.pack11Ready}`);
console.log(`PACK 99 gate: ${approval.promotion.pack99GateSatisfied}`);
console.log(`Runtime pronto: ${approval.promotion.runtimeReady}`);
