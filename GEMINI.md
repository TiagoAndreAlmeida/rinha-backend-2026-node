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
- **Quantization & VP-Tree**:
    - Dataset convertido para **Int16** (84MB) e indexado em uma **VP-Tree** (3MB) durante o build.
    - **Leaf Clustering**: Agrupamento de vetores em nós folha (tamanho 64) para busca linear rápida e otimização de cache da CPU.
    - **Physical Reordering**: Vetores e Labels reordenados fisicamente no disco para seguir a ordem da árvore, maximizando a localidade de cache durante o acesso.
- **Binary Format**:
    - `vectors.bin`: Vetores Int16 (alinhados).
    - `labels.bin`: Bit-packed labels.
    - `tree.bin`: Nós de 24 bytes (Vantage Point, Threshold Float64, Ponteiros).

### 🛠️ Memory Management Strategy
- **Zero-Copy Loading**: As APIs carregam os binários via `mmap` ou `fs.readSync` em `TypedArrays` compartilhados, minimizando o footprint de RAM.
- **Memory Sharing**: Para operar dentro dos 350MB totais, utilizamos **memória compartilhada via kernel/SO** (page cache), onde múltiplas instâncias Node.js mapeiam o mesmo arquivo físico na RAM, evitando duplicação.
- **Pre-allocation**: Buffer de memória pré-alocado para evitar Garbage Collection (GC) durante o ciclo de vida da requisição (p99 ≤ 1ms).

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
