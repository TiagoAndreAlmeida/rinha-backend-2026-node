import { state } from './state.js';

const SENTINEL = 255;
const QUERY_VECTOR = new Uint8Array(14); // Reutilizável

const LOG_MAX_AMOUNT = Math.log1p(10000); // Baseado na constante de normalização

/**
 * Quantização UINT8 com Log-Scaling.
 */
function quantize(value: number, isLog: boolean = false): number {
    if (isNaN(value)) return SENTINEL; 
    let normalized = Math.max(0, Math.min(1, value));

    if (isLog) {
        // value aqui é a razão linear (valor / max). Voltamos ao valor real para aplicar log.
        // Como o max é fixo em 10000 para as dimensões log, usamos a constante.
        const actual = normalized * 10000;
        normalized = Math.log1p(actual) / LOG_MAX_AMOUNT;
    }

    return Math.round(normalized * 254);
}

function getMinutesTotal(s: string): number {
    if (s.length < 16) return 0;
    const h = (s.charCodeAt(11) - 48) * 10 + (s.charCodeAt(12) - 48);
    const m = (s.charCodeAt(14) - 48) * 10 + (s.charCodeAt(15) - 48);
    const d = (s.charCodeAt(8) - 48) * 10 + (s.charCodeAt(9) - 48);
    return d * 1440 + h * 60 + m;
}

function getDayOfWeek(y: number, m: number, d: number): number {
    const t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    if (m < 3) y -= 1;
    const day = (y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400) + t[m-1]! + d) % 7;
    return (day + 6) % 7; 
}

export function vectorize(payload: any): Uint8Array {
    const { transaction = {}, customer = {}, merchant = {}, terminal = {}, last_transaction } = payload;
    const config = state.config;

    // Dim 0: amount (LOG)
    const amount = Number(transaction.amount);
    QUERY_VECTOR[0] = quantize(amount / config.max_amount, true);

    // Dim 1: installments
    QUERY_VECTOR[1] = quantize(Number(transaction.installments || 0) / config.max_installments);

    // Dim 2: amount_vs_avg
    const custAvg = Number(customer.avg_amount) || 0;
    const ratio = custAvg > 0 ? (amount / custAvg) : config.amount_vs_avg_ratio;
    QUERY_VECTOR[2] = quantize(ratio / config.amount_vs_avg_ratio);

    // Dim 3 e 4: Data
    const reqAt = String(transaction.requested_at || "");
    let hour = 0;
    let dayRinha = 0;
    if (reqAt.length >= 16) {
        hour = (reqAt.charCodeAt(11) - 48) * 10 + (reqAt.charCodeAt(12) - 48);
        const y = (reqAt.charCodeAt(0)-48)*1000 + (reqAt.charCodeAt(1)-48)*100 + (reqAt.charCodeAt(2)-48)*10 + (reqAt.charCodeAt(3)-48);
        const m = (reqAt.charCodeAt(5)-48)*10 + (reqAt.charCodeAt(6)-48);
        const d = (reqAt.charCodeAt(8)-48)*10 + (reqAt.charCodeAt(9)-48);
        dayRinha = getDayOfWeek(y, m, d);
    }
    QUERY_VECTOR[3] = quantize(hour / 23);
    QUERY_VECTOR[4] = quantize(dayRinha / 6);

    // Dim 5 e 6: Histórico
    if (last_transaction && last_transaction.timestamp) {
        const diff = getMinutesTotal(reqAt) - getMinutesTotal(String(last_transaction.timestamp));
        QUERY_VECTOR[5] = quantize(diff / config.max_minutes);
        QUERY_VECTOR[6] = quantize(Number(last_transaction.km_from_current) / config.max_km);
    } else {
        QUERY_VECTOR[5] = SENTINEL;
        QUERY_VECTOR[6] = SENTINEL;
    }

    // Dim 7 a 10: Terminal
    QUERY_VECTOR[7] = quantize(Number(terminal.km_from_home) / config.max_km);
    QUERY_VECTOR[8] = quantize(Number(customer.tx_count_24h) / config.max_tx_count_24h);
    QUERY_VECTOR[9] = terminal.is_online ? 254 : 0; 
    QUERY_VECTOR[10] = terminal.card_present ? 254 : 0;

    // Dim 11: unknown_merchant
    const mId = String(merchant.id || "");
    const known = customer.known_merchants || [];
    let isKnown = false;
    for (let i = 0; i < known.length; i++) {
        if (known[i] === mId) { isKnown = true; break; }
    }
    QUERY_VECTOR[11] = isKnown ? 0 : 254;

    // Dim 12: mcc_risk
    const risk = state.mccRisk.get(String(merchant.mcc)) ?? 0.5;
    QUERY_VECTOR[12] = quantize(risk);

    // Dim 13: merchant_avg_amount (LOG)
    QUERY_VECTOR[13] = quantize(Number(merchant.avg_amount) / config.max_merchant_avg_amount, true);

    return QUERY_VECTOR;
}
