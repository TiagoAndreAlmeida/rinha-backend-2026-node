# Project Overview: Rinha de Backend 2026 – Fraud Detection via Vector Search

This project is a submission for the "Rinha de Backend 2026" challenge. The goal is to build a high-performance API that detects credit card fraud by transforming transaction payloads into 14-dimensional vectors and performing a K-Nearest Neighbors (KNN) search (k=5) against a reference dataset of 3 million labeled vectors.

### Core Technologies
- **Runtime:** Node.js 22.
- **Protocol:** HTTP Nativo (Node.js `http` module).
- **Data Handling:** Vectorization and normalization of transaction data.
- **Search Algorithm:** Exact KNN (k=5) using Euclidean Distance (optimized for Int16).
- **Infrastructure:** Nginx (Load Balancer), at least two API instances.

### Key Specifications
- **Port:** The application must respond on port `9999`.
- **Endpoints:**
  - `GET /ready`: Health check/readiness probe.
  - `POST /fraud-score`: Main fraud detection logic.
- **Resource Constraints:** Total limit for all services is **1 CPU and 350 MB RAM**.

---

# Implementation Status

### ✅ Phase 1: Data Architecture & Pre-processing
- **Quantization:** Dataset converted from Float32 to **Int16** to fit in RAM.
    - Range `[0.0, 1.0]` mapped to `[0, 32767]`.
    - Sentinel `-1` mapped to `-32768`.
- **Streaming Pre-processor:** Script `preprocess.ts` implemented with `zlib` and backpressure management to handle 3M records without OOM during build.
- **Binary Format:**
    - `vectors.bin`: ~81MB (14 dimensions * Int16).
    - `labels.bin`: ~367KB (Bit-packed fraud/legit status).

### ✅ Phase 2.1: Initialization & Vectorization
- **Efficient Loading:** `DataLoader` uses `fs.readSync` for zero-copy memory mapping into `TypedArrays`.
- **Readiness Probe:** `/ready` endpoint implemented to signal completion of data loading.
- **Vetorizador:** Implementado em `src/vectorizer.ts` com conformidade estrita às 14 dimensões e tratamento de outliers.

### ⏳ Phase 2.2: KNN Search (Next Step)
- Implementation of the Euclidean distance engine optimized for `Int16Array`.
- Goal: p99 ≤ 1ms.

---

# Building and Running

### Development Commands
- **Install Dependencies:** `npm install`
- **Pre-process Data:** `npm run preprocess` (gera os arquivos `.bin` em `resources/`)
- **Run Locally:** `npm start`
- **Test Vectorization:** `npx tsx scripts/test-vectorization.ts`

### Docker Deployment
- Multi-stage build: O pré-processamento ocorre na fase de `builder`.
- A imagem final (`runner`) contém apenas os binários quantizados e o runtime Node.js Alpine.

---

# Development Conventions

### Performance & Memory
- **Memory Limit:** ~81MB por instância para dados brutos. Estimativa total de ~140MB por instância (Heap + Stack + Data).
- **Zero-Allocation:** Evitar criação de objetos em loops quentes (KNN).
- **Source of Truth:** Configurações de MCC e Normalização residem exclusivamente em `resources/*.json`.

---

# Documentation Reference
- `docs/REGRAS_DE_DETECCAO.md`: Normalization formulas.
- `docs/ARQUITETURA.md`: Infrastructure constraints.
- `docs/DATASET.md`: Data formats.
- `docs/AVALIACAO.md`: Scoring and p99 targets.
