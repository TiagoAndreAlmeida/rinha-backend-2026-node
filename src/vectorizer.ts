import { state } from './state.js';

const SENTINEL = -32768;
const QUERY_VECTOR = new Int16Array(14); // Reutilizável

function quantize(value: number): number {
    if (isNaN(value)) return 0;
    const clamped = Math.max(0, Math.min(1, value));
    return Math.round(clamped * 32767);
}

/**
 * Cálculo rápido do dia da semana (Seg=0, Dom=6) sem usar new Date().
 */
function getDayOfWeek(y: number, m: number, d: number): number {
    const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    if (m < 3) y -= 1;
    const day = (y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400) + t[m-1]! + d) % 7;
    return (day + 6) % 7; 
}

/**
 * Transforma o payload em um Int16Array de 14 dimensões SEM ALOCAÇÃO.
 */
export function vectorize(payload: any): Int16Array {
    const transaction = payload.transaction || {};
    const customer = payload.customer || { known_merchants: [] };
    const merchant = payload.merchant || {};
    const terminal = payload.terminal || {};
    const last_transaction = payload.last_transaction;
    const config = state.config;

    QUERY_VECTOR[0] = quantize(Number(transaction.amount) / config.max_amount);
    QUERY_VECTOR[1] = quantize(Number(transaction.installments) / config.max_installments);

    const amount = Number(transaction.amount) || 0;
    const custAvg = Number(customer.avg_amount) || 0;
    const ratio = custAvg > 0 ? (amount / custAvg) : config.amount_vs_avg_ratio;
    QUERY_VECTOR[2] = quantize(ratio / config.amount_vs_avg_ratio);

    // Parsing manual rápido da data: "2026-03-11T20:23:35Z"
    const reqAt = String(transaction.requested_at || "");
    let hour = 0;
    let dayRinha = 0;
    if (reqAt.length >= 19) {
        hour = (reqAt.charCodeAt(11) - 48) * 10 + (reqAt.charCodeAt(12) - 48);
        const year = parseInt(reqAt.substring(0, 4), 10);
        const month = (reqAt.charCodeAt(5) - 48) * 10 + (reqAt.charCodeAt(6) - 48);
        const day = (reqAt.charCodeAt(8) - 48) * 10 + (reqAt.charCodeAt(9) - 48);
        dayRinha = getDayOfWeek(year, month, day);
    }
    
    QUERY_VECTOR[3] = quantize(hour / 23);
    QUERY_VECTOR[4] = quantize(dayRinha / 6);

    if (last_transaction && last_transaction.timestamp) {
        const currentTs = new Date(reqAt).getTime();
        const lastTs = new Date(last_transaction.timestamp).getTime();
        QUERY_VECTOR[5] = quantize(((currentTs - lastTs) / 60000) / config.max_minutes);
        QUERY_VECTOR[6] = quantize(Number(last_transaction.km_from_current) / config.max_km);
    } else {
        QUERY_VECTOR[5] = SENTINEL;
        QUERY_VECTOR[6] = SENTINEL;
    }

    QUERY_VECTOR[7] = quantize(Number(terminal.km_from_home) / config.max_km);
    QUERY_VECTOR[8] = quantize(Number(customer.tx_count_24h) / config.max_tx_count_24h);
    QUERY_VECTOR[9] = terminal.is_online ? 32767 : 0;
    QUERY_VECTOR[10] = terminal.card_present ? 32767 : 0;

    const mId = String(merchant.id || "");
    const known = Array.isArray(customer.known_merchants) ? customer.known_merchants : [];
    QUERY_VECTOR[11] = known.includes(mId) ? 0 : 32767;

    const risk = state.mccRisk.get(String(merchant.mcc)) ?? 0.5;
    QUERY_VECTOR[12] = quantize(risk);
    QUERY_VECTOR[13] = quantize(Number(merchant.avg_amount) / config.max_merchant_avg_amount);

    return QUERY_VECTOR;
}
