# Sprint Runtime 04 — Recuperação verificável do PACK 99

## Objetivo

Recuperar o conteúdo integral do `HOC_PACK_99_FINAL_RUNTIME` a partir dos onze ZIPs finais dos PACKS 00–10, sem versionar centenas de megabytes no Git e sem aceitar arquivos com caminhos inseguros ou checksums divergentes.

## Origem recuperada

Foram localizados os seguintes arquivos finais:

- `HOC_PACK_00_FOUNDATION_FINAL.zip`;
- `HOC_PACK_01_TERRAIN_CORE_FINAL.zip`;
- `HOC_PACK_02_BOARD_SYSTEM_FINAL.zip`;
- `HOC_PACK_03_RESOURCES_FINAL.zip`;
- `HOC_PACK_04_PROPS_OBSTACLES_FINAL.zip`;
- `HOC_PACK_05_MAPS_PROCEDURAL_FINAL.zip`;
- `HOC_PACK_06_HERO_MAGE_FINAL.zip`;
- `HOC_PACK_07_HERO_ROSTER_FINAL.zip`;
- `HOC_PACK_08_BASIC_UNITS_FINAL.zip`;
- `HOC_PACK_09_CHAMPIONS_ADVANCED_FINAL.zip`;
- `HOC_PACK_10_VFX_UI_TCG_FINAL.zip`.

Os manifestos globais preservam:

- pack: `HOC_PACK_99_FINAL_RUNTIME`;
- versão: `1.0.0`;
- 11 packs;
- 1.037 IDs canônicos;
- 46 entidades;
- validação global aprovada;
- assinatura `Tehkné Solutions`.

## Desvio encontrado

A cópia recuperada dos metadados não continha somente o arquivo textual:

```text
license/LICENSE-ASSETS.md
```

Todos os demais **4.523 arquivos listados** no `SHA256SUMS.txt` estavam presentes e passaram em seus hashes originais, sem qualquer divergência binária.

O reconstrutor restaura a licença institucional quando ela não for fornecida, recalcula exclusivamente a entrada correspondente no arquivo de checksums e valida novamente a lista completa.

## Reconstrutor

Arquivo:

```text
scripts/assemble_pack99.py
```

Uso:

```bash
python scripts/assemble_pack99.py /caminho/dos-zips \
  --metadata-dir /caminho/HOC_PACK_99_FINAL_RUNTIME \
  --output HOC_PACK_99_FINAL_RUNTIME_RECOVERED.zip
```

Com a licença original disponível:

```bash
python scripts/assemble_pack99.py /caminho/dos-zips \
  --metadata-dir /caminho/HOC_PACK_99_FINAL_RUNTIME \
  --license /caminho/LICENSE-ASSETS.md \
  --output HOC_PACK_99_FINAL_RUNTIME.zip
```

O comando:

1. rejeita caminhos absolutos e `../` dentro dos ZIPs;
2. monta os diretórios `packages/PACK_00_*` até `PACK_10_*`;
3. preserva manifestos, registros, relatórios e TypeScript globais;
4. restaura ou copia a licença;
5. recalcula somente o checksum da licença quando necessário;
6. valida todos os checksums publicados;
7. confirma 11 packs, 1.037 assets e 46 entidades;
8. testa a integridade do ZIP final;
9. gera `.sha256` e `.report.json` ao lado do arquivo.

## Resultado real da recuperação

A execução realizada em 26 de julho de 2026 produziu:

- arquivo: `HOC_PACK_99_FINAL_RUNTIME_RECOVERED_1.0.1.zip`;
- tamanho: `569.804.164` bytes;
- SHA-256: `e0a00bc450c0c80b4d9433f476b8377353433b0eb90318c9589b331923296c6d`;
- checksums internos aprovados: `4.524 / 4.524`;
- teste estrutural do ZIP: aprovado;
- assets canônicos: `1.037`;
- entidades: `46`;
- packs: `11`.

O hash do ZIP recuperado é diferente do hash oficial original porque o arquivo de licença foi reconstruído e o contêiner ZIP foi recomposto. Os binários de gameplay preservaram os hashes publicados.

## Validação de instalação

A montagem foi processada com os mesmos contratos do instalador do runtime:

### Perfil `core`

- assets instalados: `597`;
- arquivos físicos copiados: `942`;
- referências pendentes: `0`;
- volume instalado: aproximadamente `205 MB`.

### Perfil `full`

- assets instalados: `1.037`;
- referências pendentes: `0`;
- volume lógico instalado: aproximadamente `568 MB`.

## Distribuição

O ZIP recuperado não deve ser commitado no repositório. As opções corretas são:

- armazenamento de objetos/CDN;
- Google Drive com link HTTPS controlado;
- release privado;
- artefato de pipeline;
- instalação local com `scripts/install_pack99.py`.

Para uma URL distribuída com hash diferente do original, execute:

```bash
python scripts/sync_pack99.py \
  --url "$PACK99_URL" \
  --expected-sha256 e0a00bc450c0c80b4d9433f476b8377353433b0eb90318c9589b331923296c6d \
  --target all \
  --profile full \
  --clean
```

## Critério de conclusão

A recuperação técnica está concluída. A aplicação definitiva no deploy depende somente de colocar o ZIP recuperado em uma URL HTTPS acessível pelo workflow e executar os perfis `core` e `full`.

**Tehkné Solutions**
