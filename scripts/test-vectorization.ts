import { vectorize } from '../src/vectorizer.js';
import { state } from '../src/state.js';

/**
 * Script de teste para validar a vetorização contra os exemplos da documentação oficial.
 */
async function runTest() {
    console.log('🧪 Iniciando Teste de Vetorização...');

    // 1. Setup do Mock State (Igual ao que carregamos no data-loader)
    state.config = {
        max_amount: 10000,
        max_installments: 12,
        amount_vs_avg_ratio: 10,
        max_minutes: 1440,
        max_km: 1000,
        max_tx_count_24h: 20,
        max_merchant_avg_amount: 10000
    };
    state.mccRisk.set("5411", 0.15);
    state.mccRisk.set("7802", 0.75);

    // 2. Teste Cenário Legítimo (da REGRAS_DE_DETECCAO.md)
    const payloadLegit = {
        "transaction": { "amount": 41.12, "installments": 2, "requested_at": "2026-03-11T18:45:53Z" },
        "customer": { "avg_amount": 82.24, "tx_count_24h": 3, "known_merchants": ["MERC-003", "MERC-016"] },
        "merchant": { "id": "MERC-016", "mcc": "5411", "avg_amount": 60.25 },
        "terminal": { "is_online": false, "card_present": true, "km_from_home": 29.23 },
        "last_transaction": null
    };

    // Esperado (Normalizado -> Int16)
    // [0.0041, 0.1667, 0.05, 0.7826, 0.3333, -1, -1, 0.0292, 0.15, 0, 1, 0, 0.15, 0.006]
    const expectedLegit = [134, 5462, 1638, 25643, 10921, -32768, -32768, 957, 4915, 0, 32767, 0, 4915, 197];

    const resultLegit = vectorize(payloadLegit);
    console.log('\n--- Cenário Legítimo ---');
    validate(resultLegit, expectedLegit);

    // 3. Teste Cenário Fraudulento (da REGRAS_DE_DETECCAO.md)
    const payloadFraud = {
        "transaction": { "amount": 9505.97, "installments": 10, "requested_at": "2026-03-14T05:15:12Z" },
        "customer": { "avg_amount": 81.28, "tx_count_24h": 20, "known_merchants": ["MERC-008", "MERC-007", "MERC-005"] },
        "merchant": { "id": "MERC-068", "mcc": "7802", "avg_amount": 54.86 },
        "terminal": { "is_online": false, "card_present": true, "km_from_home": 952.27 },
        "last_transaction": null
    };

    // Esperado (Normalizado -> Int16)
    // [0.9506, 0.8333, 1.0, 0.2174, 0.8333, -1, -1, 0.9523, 1.0, 0, 1, 1, 0.75, 0.0055]
    const expectedFraud = [31148, 27315, 32767, 7124, 27315, -32768, -32768, 31204, 32767, 0, 32767, 32767, 24575, 180];

    const resultFraud = vectorize(payloadFraud);
    console.log('\n--- Cenário Fraudulento ---');
    validate(resultFraud, expectedFraud);
}

function validate(result: Int16Array, expected: number[]) {
    let allOk = true;
    for (let i = 0; i < 14; i++) {
        // Tolerância de 2 unidades por causa de arredondamentos de ponto flutuante
        if (Math.abs(result[i] - expected[i]) > 2) {
            console.log(`❌ Dimensão ${i}: Esperado ${expected[i]}, Recebido ${result[i]}`);
            allOk = false;
        }
    }
    if (allOk) {
        console.log('✅ Todos os 14 campos estão corretos e dentro da tolerância!');
    }
}

runTest().catch(console.error);
