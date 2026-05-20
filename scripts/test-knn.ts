import { state } from '../src/state.js';
import { loadData } from '../src/data-loader.js';
import { vectorize } from '../src/vectorizer.js';
import { findKNN } from '../src/knn.js';

/**
 * Valida o motor KNN contra os exemplos da documentação.
 */
async function testKNN() {
    console.log('🧪 Iniciando Teste de Integração KNN...');

    // 1. Carrega dados reais
    loadData();

    // 2. Cenário Legítimo (REGRAS_DE_DETECCAO.md)
    const payloadLegit = {
        "id": "tx-1329056812",
        "transaction": { "amount": 41.12, "installments": 2, "requested_at": "2026-03-11T18:45:53Z" },
        "customer": { "avg_amount": 82.24, "tx_count_24h": 3, "known_merchants": ["MERC-003", "MERC-016"] },
        "merchant": { "id": "MERC-016", "mcc": "5411", "avg_amount": 60.25 },
        "terminal": { "is_online": false, "card_present": true, "km_from_home": 29.23 },
        "last_transaction": null
    };

    console.log('\n--- Testando Cenário Legítimo ---');
    const vecLegit = vectorize(payloadLegit);
    const startLegit = performance.now();
    const fraudCountLegit = findKNN(vecLegit, 5);
    const endLegit = performance.now();
    const scoreLegit = fraudCountLegit / 5;
    console.log(`Fraudes encontradas: ${fraudCountLegit}/5`);
    console.log(`Fraud Score: ${scoreLegit}`);
    console.log(`Approved: ${scoreLegit < 0.6}`);
    console.log(`Tempo: ${(endLegit - startLegit).toFixed(4)}ms`);

    // 3. Cenário Fraudulento (REGRAS_DE_DETECCAO.md)
    const payloadFraud = {
        "id": "tx-3330991687",
        "transaction": { "amount": 9505.97, "installments": 10, "requested_at": "2026-03-14T05:15:12Z" },
        "customer": { "avg_amount": 81.28, "tx_count_24h": 20, "known_merchants": ["MERC-008", "MERC-007", "MERC-005"] },
        "merchant": { "id": "MERC-068", "mcc": "7802", "avg_amount": 54.86 },
        "terminal": { "is_online": false, "card_present": true, "km_from_home": 952.27 },
        "last_transaction": null
    };

    console.log('\n--- Testando Cenário Fraudulento ---');
    const vecFraud = vectorize(payloadFraud);
    const startFraud = performance.now();
    const fraudCountFraud = findKNN(vecFraud, 5);
    const endFraud = performance.now();
    const scoreFraud = fraudCountFraud / 5;
    console.log(`Fraudes encontradas: ${fraudCountFraud}/5`);
    console.log(`Fraud Score: ${scoreFraud}`);
    console.log(`Approved: ${scoreFraud < 0.6}`);
    console.log(`Tempo: ${(endFraud - startFraud).toFixed(4)}ms`);

    console.log('\n--- Benchmark de Latência (Warm-up 10k queries) ---');
    const vecBench = vectorize(payloadLegit);
    // Warm-up
    for (let i = 0; i < 10000; i++) {
        findKNN(vecBench, 5);
    }
    
    // Medição real
    const iterations = 1000;
    const startBench = performance.now();
    for (let i = 0; i < iterations; i++) {
        findKNN(vecBench, 5);
    }
    const endBench = performance.now();
    console.log(`Média de latência (após warm-up): ${((endBench - startBench) / iterations).toFixed(4)}ms`);

    console.log('\n✨ Teste concluído.');
}

testKNN().catch(console.error);
