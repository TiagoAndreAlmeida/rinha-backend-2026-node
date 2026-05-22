/**
 * Estado global da aplicação.
 * Armazena os vetores quantizados em Uint8 para maximizar a economia de RAM.
 */
export const state = {
    isReady: false,
    vectors: null as Uint8Array | null,
    labels: null as Uint8Array | null,
    treeInt32: null as Int32Array | null,
    treeFloat64: null as Float64Array | null,
    totalRecords: 3000000,
    dimensions: 14,
    
    // Constantes de Normalização
    mccRisk: new Map<string, number>(),
    config: {
        max_amount: 10000,
        max_installments: 12,
        amount_vs_avg_ratio: 10,
        max_minutes: 1440,
        max_km: 1000,
        max_tx_count_24h: 20,
        max_merchant_avg_amount: 10000
    }
};
