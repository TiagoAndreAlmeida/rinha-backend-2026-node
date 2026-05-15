import fs from 'fs';
import zlib from 'zlib';
import { Buffer } from 'buffer';
import { pipeline } from 'stream/promises';

const INPUT_FILE = './resources/references.json.gz';
const OUTPUT_VECTORS = './resources/vectors.bin';
const OUTPUT_LABELS = './resources/labels.bin';

/**
 * Quantização para Int16:
 * Mapeia [0.0, 1.0] para [0, 32767]
 * Mapeia -1 para -32768
 * Memória por instância: 3M * 14 * 2 bytes = 84 MB.
 * Total para 2 instâncias: 168 MB (Seguro para o limite de 350 MB).
 */
function quantizeInt16(value: number): number {
    if (value === -1) return -32768;
    const clamped = Math.max(0, Math.min(1, value));
    return Math.round(clamped * 32767);
}

async function preprocess() {
    console.log('🚀 Iniciando pré-processamento final (Int16 + Backpressure)...');
    console.log(`📂 Lendo: ${INPUT_FILE}`);

    try {
        const gunzip = zlib.createGunzip();
        const readStream = fs.createReadStream(INPUT_FILE).pipe(gunzip);
        
        const vectorsStream = fs.createWriteStream(OUTPUT_VECTORS);
        const labelsStream = fs.createWriteStream(OUTPUT_LABELS);

        let totalProcessed = 0;
        const dimensions = 14;
        let currentLabelByte = 0;
        let bitCount = 0;
        let buffer = '';

        console.log('⏳ Aguardando dados do stream...');

        const writeVector = async (vector: number[]) => {
            const vBuf = Buffer.alloc(dimensions * 2);
            for (let d = 0; d < dimensions; d++) {
                vBuf.writeInt16LE(quantizeInt16(vector[d]), d * 2);
            }
            if (!vectorsStream.write(vBuf)) {
                await new Promise(resolve => vectorsStream.once('drain', resolve));
            }
        };

        const writeLabel = async (isFraud: boolean) => {
            if (isFraud) {
                currentLabelByte |= (1 << bitCount);
            }
            bitCount++;

            if (bitCount === 8) {
                if (!labelsStream.write(Buffer.from([currentLabelByte]))) {
                    await new Promise(resolve => labelsStream.once('drain', resolve));
                }
                currentLabelByte = 0;
                bitCount = 0;
            }
        };

        for await (const chunk of readStream) {
            buffer += chunk.toString();
            
            let startIndex = buffer.indexOf('{"vector":');
            while (startIndex !== -1) {
                let endIndex = buffer.indexOf('}', startIndex);
                if (endIndex === -1) break;

                const jsonStr = buffer.substring(startIndex, endIndex + 1);
                try {
                    const entry = JSON.parse(jsonStr);
                    await writeVector(entry.vector);
                    await writeLabel(entry.label === 'fraud');

                    totalProcessed++;
                    if (totalProcessed % 500000 === 0) {
                        console.log(`✅ Progresso: ${totalProcessed} registros...`);
                    }

                    buffer = buffer.substring(endIndex + 1);
                    startIndex = buffer.indexOf('{"vector":');
                } catch (e) {
                    console.error('❌ Erro no parsing:', e);
                    console.error('Trecho problemático:', jsonStr);
                    throw e;
                }
            }

            // Evita que o buffer cresça demais se houver lixo ou strings gigantes
            if (buffer.length > 5 * 1024 * 1024) {
                 const nextStart = buffer.indexOf('{"vector":');
                 buffer = nextStart !== -1 ? buffer.substring(nextStart) : '';
            }
        }

        // Descarrega o último byte de labels se necessário
        if (bitCount > 0) {
            labelsStream.write(Buffer.from([currentLabelByte]));
        }

        vectorsStream.end();
        labelsStream.end();

        console.log(`\n✨ Pré-processamento finalizado!`);
        console.log(`📊 Registros: ${totalProcessed}`);
        console.log(`📦 Vetores (Int16): ${OUTPUT_VECTORS} (${(totalProcessed * dimensions * 2 / 1024 / 1024).toFixed(2)} MB)`);
        console.log(`🏷️ Labels (Bits): ${OUTPUT_LABELS} (${(totalProcessed / 8 / 1024).toFixed(2)} KB)`);
    } catch (err) {
        console.error('❌ Erro durante o processamento:', err);
        throw err;
    }
}

preprocess().catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
});
