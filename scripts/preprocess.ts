import fs from 'fs';
import zlib from 'zlib';
import { Buffer } from 'buffer';
import Chain from 'stream-chain';
import Parser from 'stream-json/parser.js';
import StreamArray from 'stream-json/streamers/stream-array.js';

const INPUT_FILE = './resources/references.json.gz';
const OUTPUT_VECTORS = './resources/vectors.bin';
const OUTPUT_LABELS = './resources/labels.bin';
const OUTPUT_TREE = './resources/tree.bin';

const DIMENSIONS = 14;
const LEAF_SIZE = 64; // Reduzido para melhorar o backtracking em 14D

function quantizeInt16(value: number | null | undefined): number {
    if (value === -1 || value === null || value === undefined) return -32768;
    const clamped = Math.max(0, Math.min(1, value));
    return Math.round(clamped * 32767);
}

function squaredDistance(v1: Int16Array, v2: Int16Array): number {
    let sum = 0;
    for (let i = 0; i < DIMENSIONS; i++) {
        const diff = v1[i] - v2[i];
        sum += diff * diff;
    }
    return sum;
}

function quickselect(indices: Int32Array, left: number, right: number, k: number, distances: Float64Array) {
    while (left < right) {
        let i = left, j = right;
        const pivotDist = distances[indices[Math.floor((left + right) / 2)]];
        while (i <= j) {
            while (distances[indices[i]] < pivotDist) i++;
            while (distances[indices[j]] > pivotDist) j--;
            if (i <= j) {
                const tmp = indices[i];
                indices[i] = indices[j];
                indices[j] = tmp;
                i++;
                j--;
            }
        }
        if (k <= j) right = j;
        else if (i <= k) left = i;
        else break;
    }
}

async function preprocess() {
    console.log('🚀 Iniciando pré-processamento de ELITE...');

    const totalRecords = 3000000;
    const allVectors = new Int16Array(totalRecords * DIMENSIONS);
    const allLabelsTemp = new Uint8Array(totalRecords);

    console.log('⏳ Streaming JSON...');
    const pipeline = Chain.chain([
        fs.createReadStream(INPUT_FILE),
        zlib.createGunzip(),
        Parser.parser(),
        StreamArray.streamArray()
    ]);

    let count = 0;
    for await (const { value } of pipeline) {
        for (let d = 0; d < DIMENSIONS; d++) {
            allVectors[count * DIMENSIONS + d] = quantizeInt16(value.vector[d]);
        }
        allLabelsTemp[count] = value.label === 'fraud' ? 1 : 0;
        count++;
        if (count % 1000000 === 0) console.log(`✅ ${count}M registros...`);
    }

    const indices = new Int32Array(count);
    for (let i = 0; i < count; i++) indices[i] = i;

    const currentDistances = new Float64Array(count);
    const treeNodes: any[] = [];
    
    // Lista final de índices reordenados para garantir localidade de cache
    const finalIndices = new Int32Array(count);
    let finalIdxPtr = 0;

    console.log('🌲 Construindo VP-Tree balanceada...');

    const treeRoot = (function build(start: number, end: number): number {
        const size = end - start;
        const nodeIdx = treeNodes.length;
        treeNodes.push({});

        if (size <= LEAF_SIZE) {
            const leafStart = finalIdxPtr;
            for (let i = start; i < end; i++) {
                finalIndices[finalIdxPtr++] = indices[i];
            }
            // Folha: vantagePointIdx = -1, left = -(leafStart + 1), right = -size
            treeNodes[nodeIdx] = { vantagePointIdx: -1, threshold: 0, left: -(leafStart + 1), right: -size };
            return nodeIdx;
        }

        // Vantage Point é o primeiro. Ele NÃO vai para os filhos.
        const vpIdx = indices[start];
        finalIndices[finalIdxPtr++] = vpIdx;
        const currentVpPos = finalIdxPtr - 1; // Posição dele no futuro array final

        const vpVec = allVectors.subarray(vpIdx * DIMENSIONS, (vpIdx + 1) * DIMENSIONS);
        const subStart = start + 1; // Pula o VP
        const subSize = end - subStart;

        for (let i = 0; i < subSize; i++) {
            const idx = indices[subStart + i];
            currentDistances[idx] = squaredDistance(vpVec, allVectors.subarray(idx * DIMENSIONS, (idx + 1) * DIMENSIONS));
        }

        const mid = subStart + Math.floor(subSize / 2);
        quickselect(indices, subStart, end - 1, mid, currentDistances);
        const thresholdSq = currentDistances[indices[mid]];
        const threshold = Math.sqrt(thresholdSq);

        const left = build(subStart, mid);
        const right = build(mid, end);

        // Nó interno: guardamos a posição futura do VP
        treeNodes[nodeIdx] = { vantagePointIdx: currentVpPos, threshold, left, right };
        return nodeIdx;
    })(0, count);

    console.log(`✅ Árvore com ${treeNodes.length} nós.`);

    // 2. Reordenação Física
    console.log('🔄 Reordenando para localidade de cache...');
    const reorderedVectors = new Int16Array(count * DIMENSIONS);
    const reorderedLabels = Buffer.alloc(Math.ceil(count / 8));

    for (let i = 0; i < count; i++) {
        const oldIdx = finalIndices[i];
        reorderedVectors.set(allVectors.subarray(oldIdx * DIMENSIONS, (oldIdx + 1) * DIMENSIONS), i * DIMENSIONS);
        if (allLabelsTemp[oldIdx]) reorderedLabels[Math.floor(i / 8)] |= (1 << (i % 8));
    }

    // 3. Serialização (24 bytes para alinhamento de 8 bytes do Float64)
    console.log('💾 Salvando tree.bin (24-byte aligned)...');
    fs.writeFileSync(OUTPUT_VECTORS, Buffer.from(reorderedVectors.buffer));
    fs.writeFileSync(OUTPUT_LABELS, reorderedLabels);

    const treeBuffer = Buffer.alloc(treeNodes.length * 24);
    for (let i = 0; i < treeNodes.length; i++) {
        const n = treeNodes[i];
        const offset = i * 24;
        treeBuffer.writeInt32LE(n.vantagePointIdx, offset);
        // Pula 4 bytes para alinhar o Float64 em 8 bytes (offset + 8)
        treeBuffer.writeDoubleLE(n.threshold, offset + 8); 
        treeBuffer.writeInt32LE(n.left, offset + 16);
        treeBuffer.writeInt32LE(n.right, offset + 20);
    }
    fs.writeFileSync(OUTPUT_TREE, treeBuffer);

    console.log('✨ Missão Cumprida! Dataset pronto para p99 < 1ms.');
}

preprocess().catch(console.error);
