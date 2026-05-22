import { state } from './state.js';

const DIMENSIONS = 14;

/**
 * Calcula a distância euclidiana ao quadrado entre dois vetores Int16.
 */
function squaredDistance(v1: Int16Array, v1Start: number, v2: Int16Array): number {
    const d0 = v1[v1Start + 0]! - v2[0]!;
    const d1 = v1[v1Start + 1]! - v2[1]!;
    const d2 = v1[v1Start + 2]! - v2[2]!;
    const d3 = v1[v1Start + 3]! - v2[3]!;
    const d4 = v1[v1Start + 4]! - v2[4]!;
    const d5 = v1[v1Start + 5]! - v2[5]!;
    const d6 = v1[v1Start + 6]! - v2[6]!;
    const d7 = v1[v1Start + 7]! - v2[7]!;
    const d8 = v1[v1Start + 8]! - v2[8]!;
    const d9 = v1[v1Start + 9]! - v2[9]!;
    const d10 = v1[v1Start + 10]! - v2[10]!;
    const d11 = v1[v1Start + 11]! - v2[11]!;
    const d12 = v1[v1Start + 12]! - v2[12]!;
    const d13 = v1[v1Start + 13]! - v2[13]!;
    return d0 * d0 + d1 * d1 + d2 * d2 + d3 * d3 + d4 * d4 + d5 * d5 + d6 * d6 + d7 * d7 + d8 * d8 + d9 * d9 + d10 * d10 + d11 * d11 + d12 * d12 + d13 * d13;
}

const GLOBAL_STACK = new Int32Array(256);
const BEST_DISTANCES = new Float64Array(5);
const BEST_INDICES = new Int32Array(5);

/**
 * Encontra os K vizinhos mais próximos usando a VP-Tree.
 * Retorna o número de fraudes entre os K vizinhos.
 */
export function findKNN(query: Int16Array, k: number = 5): number {
    if (!state.vectors || !state.treeInt32 || !state.treeFloat64 || !state.labels) return 0;

    const vectors = state.vectors;
    const treeInt = state.treeInt32;
    const treeFloat = state.treeFloat64;
    const labels = state.labels;

    // Inicializa estruturas globais - BEST_DISTANCES[0] é sempre o MAIOR (raio de poda)
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

/**
 * Insere mantendo os K menores, com o MAIOR deles no índice 0 (Max-Heap na posição 0).
 */
function insertNeighbor(dist: number, idx: number, k: number) {
    if (dist >= BEST_DISTANCES[0]!) return;
    
    BEST_DISTANCES[0] = dist;
    BEST_INDICES[0] = idx;
    
    // Bubble down para manter o maior no topo (índice 0)
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
