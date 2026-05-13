# Project Overview: Rinha de Backend 2026 – Fraud Detection via Vector Search

This project is a submission for the "Rinha de Backend 2026" challenge. The goal is to build a high-performance API that detects credit card fraud by transforming transaction payloads into 14-dimensional vectors and performing a K-Nearest Neighbors (KNN) search (k=5) against a reference dataset of 3 million labeled vectors.

### Core Technologies
- **Runtime:** Node.js (inferred from `package.json`).
- **Data Handling:** Vectorization and normalization of transaction data.
- **Search Algorithm:** Vector search (e.g., Euclidean distance) to find the 5 most similar transactions.
- **Infrastructure:** Docker Compose, Load Balancer (round-robin), and at least two API instances.

### Key Specifications
- **Port:** The application must respond on port `9999`.
- **Endpoints:**
  - `GET /ready`: Health check/readiness probe.
  - `POST /fraud-score`: Main fraud detection logic.
- **Resource Constraints:** Total limit for all services is **1 CPU and 350 MB RAM**.
- **Fraud Decision:** `fraud_score = (number of fraud neighbors / 5)`. Approved if `fraud_score < 0.6`.

---

# Building and Running

### Prerequisites
- Node.js (latest LTS recommended)
- Docker & Docker Compose

### Development Commands
*Note: These are inferred/standard commands for a Node.js project. Update as the implementation progresses.*

- **Install Dependencies:** `npm install`
- **Run Locally:** `node index.js` (TODO: Verify main entry point)
- **Run with Docker:** `docker-compose up --build`
- **Run Tests:** `npm test`

### Production Submission
- The solution must be containerized and defined in a `docker-compose.yml`.
- The submission requires a `submission` branch containing only the necessary files for execution.

---

# Development Conventions

### Performance & Scalability
- **Latency is critical:** Max score is achieved at p99 ≤ 1ms.
- **Memory Efficiency:** The 350MB RAM limit is extremely tight for 3M vectors (~284MB uncompressed). Efficient data structures (e.g., typed arrays, specialized vector indexes) are mandatory.
- **Pre-processing:** Reference data (`references.json.gz`, `mcc_risk.json`, `normalization.json`) should be pre-loaded or indexed during build or startup.

### Vectorization Rules
- Strictly follow the 14-dimensional normalization formulas in `docs/REGRAS_DE_DETECCAO.md`.
- Use the sentinel value `-1` for missing historical data (`last_transaction: null`).
- Use the constants from `resources/normalization.json`.
- Default `mcc_risk` to `0.5` if the MCC is not found in `mcc_risk.json`.

### Coding Style
- Prefer explicit composition and decoupled architecture.
- Optimize for cold start and memory footprint.
- Ensure the Load Balancer is a simple round-robin proxy without business logic.

---

# Documentation Reference
- `docs/API.md`: API contract details.
- `docs/REGRAS_DE_DETECCAO.md`: Normalization formulas and vector dimensions.
- `docs/ARQUITETURA.md`: Infrastructure constraints and topology.
- `docs/DATASET.md`: Details on reference files and data formats.
- `docs/AVALIACAO.md`: Scoring formula and local testing guide.
