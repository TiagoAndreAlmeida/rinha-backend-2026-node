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
const LEAF_SIZE = 128;

const MAX_AMOUNT = 10000;
const LOG_MAX_AMOUNT = Math.log1p(MAX_AMOUNT);

/**
 * Quantização UINT8 com Log-Scaling para Amount (Dim 0 e 13).
 * Sentinel: 255, Dados: 0-254.
 */
function quantizeUint8(value: number | null | undefined, dim: number): number {
    if (value === -1 || value === null || value === undefined) return 255;
    
    let normalized = Math.max(0, Math.min(1, value));

    // Aplica Log-Scaling para dimensões financeiras (0 e 13)
    if (dim === 0 || dim === 13) {
        const actualAmount = normalized * MAX_AMOUNT;
        normalized = Math.log1p(actualAmount) / LOG_MAX_AMOUNT;
    }

    return Math.round(normalized * 254);
}

function squaredDistance(v1: Uint8Array, v2: Uint8Array): number {
    let sum = 0;
    for (let i = 0; i < DIMENSIONS; i++) {
        const diff = v1[i]! - v2[i]!;
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
    console.log('🚀 Iniciando pré-processamento UINT8 com Log-Scaling...');

    const totalRecords = 3000000;
    const allVectors = new Uint8Array(totalRecords * DIMENSIONS);
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
            allVectors[count * DIMENSIONS + d] = quantizeUint8(value.vector[d], d);
        }
        allLabelsTemp[count] = value.label === 'fraud' ? 1 : 0;
        count++;
        if (count % 1000000 === 0) console.log(`✅ ${count}M registros...`);
    }

    const indices = new Int32Array(count);
    for (let i = 0; i < count; i++) indices[i] = i;

    const currentDistances = new Float64Array(count);
    const treeNodes: any[] = [];
    const finalIndices = new Int32Array(count);
    let finalIdxPtr = 0;

    console.log('🌲 Construindo VP-Tree...');

    const treeRoot = (function build(start: number, end: number): number {
        const size = end - start;
        const nodeIdx = treeNodes.length;
        treeNodes.push({});

        if (size <= LEAF_SIZE) {
            const leafStart = finalIdxPtr;
            for (let i = start; i < end; i++) finalIndices[finalIdxPtr++] = indices[i];
            treeNodes[nodeIdx] = { vantagePointIdx: -1, threshold: 0, left: -(leafStart + 1), right: -size };
            return nodeIdx;
        }

        const vpIdx = indices[start];
        finalIndices[finalIdxPtr++] = vpIdx;
        const currentVpPos = finalIdxPtr - 1;

        const vpVec = allVectors.subarray(vpIdx * DIMENSIONS, (vpIdx + 1) * DIMENSIONS);
        const subStart = start + 1;
        const subSize = end - subStart;

        for (let i = 0; i < subSize; i++) {
            const idx = indices[subStart + i];
            currentDistances[idx] = squaredDistance(vpVec, allVectors.subarray(idx * DIMENSIONS, (idx + 1) * DIMENSIONS));
        }

        const mid = subStart + Math.floor(subSize / 2);
        quickselect(indices, subStart, end - 1, mid, currentDistances);
        
        const threshold = Math.sqrt(currentDistances[indices[mid]]);
        const left = build(subStart, mid);
        const right = build(mid, end);

        treeNodes[nodeIdx] = { vantagePointIdx: currentVpPos, threshold, left, right };
        return nodeIdx;
    })(0, count);

    console.log('🔄 Serializando UINT8 Reordenado...');
    const reorderedVectors = new Uint8Array(count * DIMENSIONS);
    const reorderedLabels = Buffer.alloc(Math.ceil(count / 8));

    for (let i = 0; i < count; i++) {
        const oldIdx = finalIndices[i];
        reorderedVectors.set(allVectors.subarray(oldIdx * DIMENSIONS, (oldIdx + 1) * DIMENSIONS), i * DIMENSIONS);
        if (allLabelsTemp[oldIdx]) reorderedLabels[Math.floor(i / 8)] |= (1 << (i % 8));
    }

    fs.writeFileSync(OUTPUT_VECTORS, Buffer.from(reorderedVectors.buffer));
    fs.writeFileSync(OUTPUT_LABELS, reorderedLabels);

    const treeBuffer = Buffer.alloc(treeNodes.length * 24);
    for (let i = 0; i < treeNodes.length; i++) {
        const n = treeNodes[i];
        const offset = i * 24;
        treeBuffer.writeInt32LE(n.vantagePointIdx, offset);
        treeBuffer.writeDoubleLE(n.threshold, offset + 8); 
        treeBuffer.writeInt32LE(n.left, offset + 16);
        treeBuffer.writeInt32LE(n.right, offset + 20);
    }
    fs.writeFileSync(OUTPUT_TREE, treeBuffer);
    console.log('✨ Missão UINT8 Cumprida!');
}

preprocess().catch(console.error);
