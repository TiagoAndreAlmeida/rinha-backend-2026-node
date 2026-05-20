import fs from 'node:fs';
import path from 'node:path';
import { state } from './state.js';
const VECTORS_PATH = path.join(process.cwd(), 'resources', 'vectors.bin');
const LABELS_PATH = path.join(process.cwd(), 'resources', 'labels.bin');
const TREE_PATH = path.join(process.cwd(), 'resources', 'tree.bin');
const MCC_RISK_PATH = path.join(process.cwd(), 'resources', 'mcc_risk.json');
const CONFIG_PATH = path.join(process.cwd(), 'resources', 'normalization.json');

/**
 * Carrega os dados binários e constantes para a memória de forma eficiente.
 */
export function loadData() {
    console.log('⏳ Carregando dataset e constantes em memória...');
    const start = Date.now();

    try {
        // 0. Carregar Constantes
        const mccRiskData = JSON.parse(fs.readFileSync(MCC_RISK_PATH, 'utf8'));
        for (const [mcc, risk] of Object.entries(mccRiskData)) {
            state.mccRisk.set(mcc, risk as number);
        }

        const configData = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        state.config = configData;

        // 1. Carregar Vetores (Int16 - 2 bytes por dimensão)
        const vectorsSize = state.totalRecords * state.dimensions * 2;
        const vectorsBuffer = Buffer.allocUnsafe(vectorsSize);
        const fdVectors = fs.openSync(VECTORS_PATH, 'r');
        fs.readSync(fdVectors, vectorsBuffer, 0, vectorsSize, 0);
        fs.closeSync(fdVectors);

        state.vectors = new Int16Array(vectorsBuffer.buffer, vectorsBuffer.byteOffset, state.totalRecords * state.dimensions);

        // 2. Carregar Labels (Bits empacotados em bytes)
        const labelsSize = Math.ceil(state.totalRecords / 8);
        const labelsBuffer = Buffer.allocUnsafe(labelsSize);
        const fdLabels = fs.openSync(LABELS_PATH, 'r');
        fs.readSync(fdLabels, labelsBuffer, 0, labelsSize, 0);
        fs.closeSync(fdLabels);

        state.labels = new Uint8Array(labelsBuffer.buffer, labelsBuffer.byteOffset, labelsSize);

        // 3. Carregar VP-Tree (Nós de 24 bytes)
        const treeStats = fs.statSync(TREE_PATH);
        const treeBuffer = Buffer.allocUnsafe(treeStats.size);
        const fdTree = fs.openSync(TREE_PATH, 'r');
        fs.readSync(fdTree, treeBuffer, 0, treeStats.size, 0);
        fs.closeSync(fdTree);

        state.treeInt32 = new Int32Array(treeBuffer.buffer, treeBuffer.byteOffset, treeStats.size / 4);
        state.treeFloat64 = new Float64Array(treeBuffer.buffer, treeBuffer.byteOffset, treeStats.size / 8);

        state.isReady = true;
        const end = Date.now();
        const totalSize = vectorsSize + labelsSize + treeStats.size;
        console.log(`✅ Dataset e Árvore carregados com sucesso em ${end - start}ms`);
        console.log(`📊 Memória estimada para dados: ~${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    } catch (error) {
        console.error('❌ Erro ao carregar dataset:', error);
        process.exit(1);
    }
}
