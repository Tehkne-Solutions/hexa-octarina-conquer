import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('runtime/packs/PACK_11_NARRATIVE_PORTRAITS');
const productionDir = path.join(root, 'production');
const outputFile = path.join(productionDir, 'production-queue.generated.json');

const batchFiles = fs
  .readdirSync(productionDir)
  .filter((name) => name.endsWith('-batch.json'))
  .sort();

const queue = [];

for (const file of batchFiles) {
  const batch = JSON.parse(fs.readFileSync(path.join(productionDir, file), 'utf8'));
  const characterId = batch.characterId ?? batch.id;
  const states = batch.states ?? batch.outputs ?? [];

  const normalizedStates = Array.isArray(states)
    ? states
    : Object.entries(states).map(([id, prompt]) => ({ id, prompt }));

  for (const state of normalizedStates) {
    const stateId = state.id ?? state.state;
    const fileName =
      state.file ??
      state.fileName ??
      `${characterId}__${stateId}.png`;

    queue.push({
      order: queue.length + 1,
      characterId,
      state: stateId,
      file: fileName,
      status: 'pending',
      batchFile: file,
      prompt: state.prompt ?? state.expression ?? null,
      requiredValidation: [
        'png-signature',
        'allowed-dimensions',
        'alpha-channel',
        'sha256',
        'manual-identity-review'
      ]
    });
  }
}

if (queue.length !== 24) {
  console.error(`PACK11 queue inválida: esperado 24 itens, encontrado ${queue.length}.`);
  process.exit(1);
}

const payload = {
  packId: 'PACK_11_NARRATIVE_PORTRAITS',
  generatedAt: new Date().toISOString(),
  expectedAssets: 24,
  pendingAssets: queue.length,
  completedAssets: 0,
  source: batchFiles,
  queue
};

fs.writeFileSync(outputFile, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Fila PACK11 criada: ${outputFile}`);
console.log(`Itens: ${queue.length}`);
