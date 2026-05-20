import { state } from '../src/state.js';
import { loadData } from '../src/data-loader.js';
import { vectorize } from '../src/vectorizer.js';
import { findKNN } from '../src/knn.js';

const DIMENSIONS = 14;

/**
 * Implementação de Força Bruta para validação de precisão.
 */
function findKNNBruteForce(query: Int16Array, k: number = 5): number {
    const vectors = state.vectors!;
    const labels = state.labels!;
    const total = state.totalRecords;
    
    const distances = new Float64Array(total);
    const indices = new Int32Array(total);

    for (let i = 0; i < total; i++) {
        let sum = 0;
        const start = i * DIMENSIONS;
        for (let d = 0; d < DIMENSIONS; d++) {
            const diff = vectors[start + d] - query[d];
            sum += diff * diff;
        }
        distances[i] = sum;
        indices[i] = i;
    }

    // Ordenação parcial para pegar os K menores
    const topIndices = indices.sort((a, b) => distances[a] - distances[b]).slice(0, k);
    
    let fraudCount = 0;
    for (const idx of topIndices) {
        if (labels[idx >> 3] & (1 << (idx & 7))) {
            fraudCount++;
        }
    }
    return fraudCount;
}

async function validateAccuracy() {
    console.log('🧪 Iniciando Validação de Precisão (VP-Tree vs Brute Force)...');
    loadData();

    // Exemplos da documentação + payloads extras se existirem
    const payloads = [
        {
            "id": "legit-1",
            "transaction": { "amount": 41.12, "installments": 2, "requested_at": "2026-03-11T18:45:53Z" },
            "customer": { "avg_amount": 82.24, "tx_count_24h": 3, "known_merchants": ["MERC-003", "MERC-016"] },
            "merchant": { "id": "MERC-016", "mcc": "5411", "avg_amount": 60.25 },
            "terminal": { "is_online": false, "card_present": true, "km_from_home": 29.23 },
            "last_transaction": null
        },
        {
            "id": "fraud-1",
            "transaction": { "amount": 9505.97, "installments": 10, "requested_at": "2026-03-14T05:15:12Z" },
            "customer": { "avg_amount": 81.28, "tx_count_24h": 20, "known_merchants": ["MERC-008", "MERC-007", "MERC-005"] },
            "merchant": { "id": "MERC-068", "mcc": "7802", "avg_amount": 54.86 },
            "terminal": { "is_online": false, "card_present": true, "km_from_home": 952.27 },
            "last_transaction": null
        }
    ];

    let success = 0;
    for (const p of payloads) {
        const query = vectorize(p);
        
        console.log(`\nVerificando ID: ${p.id}...`);
        
        const startBrute = performance.now();
        const bruteResult = findKNNBruteForce(query, 5);
        const endBrute = performance.now();
        
        const startTree = performance.now();
        const treeResult = findKNN(query, 5);
        const endTree = performance.now();

        console.log(`Brute Force: ${bruteResult}/5 (${(endBrute - startBrute).toFixed(2)}ms)`);
        console.log(`VP-Tree:     ${treeResult}/5 (${(endTree - startTree).toFixed(4)}ms)`);

        if (bruteResult === treeResult) {
            console.log('✅ Resultado idêntico!');
            success++;
        } else {
            console.log('❌ DIVERGÊNCIA ENCONTRADA!');
        }
    }

    console.log(`\nTaxa de sucesso: ${success}/${payloads.length}`);
    if (success === payloads.length) {
        console.log('✨ Motor KNN validado com 100% de precisão!');
    } else {
        process.exit(1);
    }
}

validateAccuracy().catch(console.error);
