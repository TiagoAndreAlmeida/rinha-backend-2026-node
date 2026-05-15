import { state } from './state.js';

/**
 * Valor sentinela para dados faltantes (last_transaction: null).
 * Deve ser idêntico ao usado no preprocess.ts.
 */
const SENTINEL = -32768;

/**
 * Função utilitária para clamp e quantização Int16.
 */
function quantize(value: number): number {
    const clamped = Math.max(0, Math.min(1, value));
    return Math.round(clamped * 32767);
}

/**
 * Transforma o payload da transação em um Int16Array de 14 dimensões.
 * Otimizado para latência mínima.
 */
export function vectorize(payload: any): Int16Array {
    const vector = new Int16Array(14);
    const { transaction, customer, merchant, terminal, last_transaction } = payload;
    const config = state.config;

    // Dim 0: amount
    vector[0] = quantize(transaction.amount / config.max_amount);

    // Dim 1: installments
    vector[1] = quantize(transaction.installments / config.max_installments);

    // Dim 2: amount_vs_avg
    vector[2] = quantize((transaction.amount / customer.avg_amount) / config.amount_vs_avg_ratio);

    // Tratamento de Data (ISO: 2026-03-11T20:23:35Z)
    const reqAt = transaction.requested_at;
    const hour = parseInt(reqAt.substring(11, 13), 10);
    
    // Dim 3: hour_of_day
    vector[3] = Math.round((hour / 23) * 32767);

    // Dim 4: day_of_week (seg=0, dom=6)
    // Usamos Date apenas para o dia da semana, que é complexo de calcular via string
    const date = new Date(reqAt);
    const dayUtc = date.getUTCDay(); // Dom=0, Seg=1...
    const dayRinha = (dayUtc + 6) % 7; // Seg=0, Dom=6
    vector[4] = Math.round((dayRinha / 6) * 32767);

    // Dim 5 e 6: Histórico
    if (last_transaction) {
        const currentTs = date.getTime();
        const lastTs = new Date(last_transaction.timestamp).getTime();
        const diffMinutes = (currentTs - lastTs) / 60000;
        
        vector[5] = quantize(diffMinutes / config.max_minutes);
        vector[6] = quantize(last_transaction.km_from_current / config.max_km);
    } else {
        vector[5] = SENTINEL;
        vector[6] = SENTINEL;
    }

    // Dim 7: km_from_home
    vector[7] = quantize(terminal.km_from_home / config.max_km);

    // Dim 8: tx_count_24h
    vector[8] = quantize(customer.tx_count_24h / config.max_tx_count_24h);

    // Dim 9: is_online
    vector[9] = terminal.is_online ? 32767 : 0;

    // Dim 10: card_present
    vector[10] = terminal.card_present ? 32767 : 0;

    // Dim 11: unknown_merchant
    // 1 se merchant.id não estiver em customer.known_merchants
    const isKnown = customer.known_merchants.includes(merchant.id);
    vector[11] = isKnown ? 0 : 32767;

    // Dim 12: mcc_risk
    const risk = state.mccRisk.get(merchant.mcc) ?? 0.5;
    vector[12] = Math.round(risk * 32767);

    // Dim 13: merchant_avg_amount
    vector[13] = quantize(merchant.avg_amount / config.max_merchant_avg_amount);

    return vector;
}
