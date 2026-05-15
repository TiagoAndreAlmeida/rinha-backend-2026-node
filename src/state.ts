/**
 * Estado global da aplicação.
 * Armazena os vetores quantizados, as labels e as constantes em memória.
 */
export const state = {
    isReady: false,
    vectors: null as Int16Array | null,
    labels: null as Uint8Array | null,
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
