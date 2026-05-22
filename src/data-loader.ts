import fs from 'node:fs';
import path from 'node:path';
import { state } from './state.js';

const VECTORS_PATH = path.join(process.cwd(), 'resources', 'vectors.bin');
const LABELS_PATH = path.join(process.cwd(), 'resources', 'labels.bin');
const TREE_PATH = path.join(process.cwd(), 'resources', 'tree.bin');
const MCC_RISK_PATH = path.join(process.cwd(), 'resources', 'mcc_risk.json');
const CONFIG_PATH = path.join(process.cwd(), 'resources', 'normalization.json');

export function loadData() {
    console.log('⏳ Carregando dataset UINT8 em memória...');
    try {
        const mccRiskData = JSON.parse(fs.readFileSync(MCC_RISK_PATH, 'utf8'));
        for (const [mcc, risk] of Object.entries(mccRiskData)) state.mccRisk.set(mcc, risk as number);
        state.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

        const vectorsSize = state.totalRecords * state.dimensions; // 1 byte por dimensão (Uint8)
        const vectorsBuffer = fs.readFileSync(VECTORS_PATH);
        state.vectors = new Uint8Array(vectorsBuffer.buffer, vectorsBuffer.byteOffset, state.totalRecords * state.dimensions);

        const labelsBuffer = fs.readFileSync(LABELS_PATH);
        state.labels = new Uint8Array(labelsBuffer.buffer, labelsBuffer.byteOffset, Math.ceil(state.totalRecords / 8));

        const treeBuffer = fs.readFileSync(TREE_PATH);
        state.treeInt32 = new Int32Array(treeBuffer.buffer, treeBuffer.byteOffset, treeBuffer.length / 4);
        state.treeFloat64 = new Float64Array(treeBuffer.buffer, treeBuffer.byteOffset, treeBuffer.length / 8);

        state.isReady = true;
        console.log(`✅ UINT8 Ready! Dataset: ~${(vectorsBuffer.length / 1024 / 1024).toFixed(2)} MB`);
    } catch (error) {
        console.error('❌ Erro no loader:', error);
        process.exit(1);
    }
}
