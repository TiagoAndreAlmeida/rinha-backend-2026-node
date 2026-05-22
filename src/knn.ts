import { state } from './state.js';

const DIMENSIONS = 14;

/**
 * Calcula a distância euclidiana ao quadrado entre vetor Uint8 (dataset) e Uint8 (query).
 */
function squaredDistance(dataset: Uint8Array, start: number, query: Uint8Array): number {
    let sum = 0;
    // Loop desdobrado para máxima performance
    let d = dataset[start + 0]! - query[0]!; sum += d * d;
    d = dataset[start + 1]! - query[1]!; sum += d * d;
    d = dataset[start + 2]! - query[2]!; sum += d * d;
    d = dataset[start + 3]! - query[3]!; sum += d * d;
    d = dataset[start + 4]! - query[4]!; sum += d * d;
    d = dataset[start + 5]! - query[5]!; sum += d * d;
    d = dataset[start + 6]! - query[6]!; sum += d * d;
    d = dataset[start + 7]! - query[7]!; sum += d * d;
    d = dataset[start + 8]! - query[8]!; sum += d * d;
    d = dataset[start + 9]! - query[9]!; sum += d * d;
    d = dataset[start + 10]! - query[10]!; sum += d * d;
    d = dataset[start + 11]! - query[11]!; sum += d * d;
    d = dataset[start + 12]! - query[12]!; sum += d * d;
    d = dataset[start + 13]! - query[13]!; sum += d * d;
    return sum;
}

const GLOBAL_STACK = new Int32Array(256);
const BEST_DISTANCES = new Float64Array(5);
const BEST_INDICES = new Int32Array(5);

/**
 * Encontra os K vizinhos mais próximos usando a VP-Tree (Uint8 Dataset).
 */
export function findKNN(query: Uint8Array, k: number = 5): number {
    if (!state.vectors || !state.treeInt32 || !state.treeFloat64 || !state.labels) return 0;

    const vectors = state.vectors;
    const treeInt = state.treeInt32;
    const treeFloat = state.treeFloat64;
    const labels = state.labels;

    BEST_DISTANCES.fill(Infinity);
    BEST_INDICES.fill(-1);
    let worstBestDistSq = Infinity;
    let worstBestDist = Infinity;

    let stackPtr = 0;
    GLOBAL_STACK[stackPtr++] = 0; // Raiz

    while (stackPtr > 0) {
        const nodeIdx = GLOBAL_STACK[--stackPtr]!;
        const baseInt = nodeIdx * 6;
        const baseFloat = nodeIdx * 3;

        const vpIdx = treeInt[baseInt]!; 
        const threshold = treeFloat[baseFloat + 1]!; 
        const left = treeInt[baseInt + 4]!;
        const right = treeInt[baseInt + 5]!;

        if (vpIdx === -1) {
            const leafStart = -(left + 1);
            const leafSize = -right;
            for (let i = 0; i < leafSize; i++) {
                const idx = leafStart + i;
                const distSq = squaredDistance(vectors, idx * DIMENSIONS, query);
                if (distSq < worstBestDistSq) {
                    insertNeighbor(distSq, idx, k);
                    worstBestDistSq = BEST_DISTANCES[0]!;
                    worstBestDist = Math.sqrt(worstBestDistSq);
                }
            }
            continue;
        }

        const distToVpSq = squaredDistance(vectors, vpIdx * DIMENSIONS, query);
        if (distToVpSq < worstBestDistSq) {
            insertNeighbor(distToVpSq, vpIdx, k);
            worstBestDistSq = BEST_DISTANCES[0]!;
            worstBestDist = Math.sqrt(worstBestDistSq);
        }

        const d = Math.sqrt(distToVpSq);
        const t = threshold;
        const r = worstBestDist;

        if (d < t) {
            if (d + r >= t) GLOBAL_STACK[stackPtr++] = right;
            GLOBAL_STACK[stackPtr++] = left;
        } else {
            if (d - r <= t) GLOBAL_STACK[stackPtr++] = left;
            GLOBAL_STACK[stackPtr++] = right;
        }
    }

    let fraudCount = 0;
    for (let i = 0; i < k; i++) {
        const idx = BEST_INDICES[i]!;
        if (idx !== -1 && (labels[idx >> 3]! & (1 << (idx & 7)))) {
            fraudCount++;
        }
    }
    return fraudCount;
}

function insertNeighbor(dist: number, idx: number, k: number) {
    if (dist >= BEST_DISTANCES[0]!) return;
    BEST_DISTANCES[0] = dist;
    BEST_INDICES[0] = idx;
    for (let i = 0; i < k - 1; i++) {
        if (BEST_DISTANCES[i]! < BEST_DISTANCES[i+1]!) {
            const tD = BEST_DISTANCES[i]!;
            const tI = BEST_INDICES[i]!;
            BEST_DISTANCES[i] = BEST_DISTANCES[i+1]!;
            BEST_INDICES[i] = BEST_INDICES[i+1]!;
            BEST_DISTANCES[i+1] = tD;
            BEST_INDICES[i+1] = tI;
        } else break;
    }
}
