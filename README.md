# Rinha de Backend 2026 – Detecção de Fraude por Busca Vetorial

Este repositório contém a implementação para a **Rinha de Backend 2026**. O desafio consiste em desenvolver um serviço de alta performance capaz de detectar fraudes em transações de cartão de crédito utilizando busca vetorial em tempo real, sob restrições severas de infraestrutura (1 CPU, 350MB RAM).

## O Problema
O objetivo é processar transações, transformá-las em um vetor de 14 dimensões e realizar uma consulta K-Nearest Neighbors (k=5) contra um dataset de referência de 3 milhões de transações rotuladas, mantendo latência (p99) abaixo de 1ms.

## Metodologia e Algoritmos

Para atender aos requisitos rigorosos de latência e recursos, a solução utiliza:

### 1. Vetorização Otimizada (Zero-Allocation)
A transformação do payload JSON em vetor de 14 dimensões é feita utilizando aritmética manual e mapeamento direto, evitando a criação excessiva de objetos. Utilizamos quantização de ponto flutuante para `Int16` para reduzir o footprint de memória e otimizar cálculos de distância.

### 2. Busca Vetorial via VP-Tree (Vantage Point Tree)
Em vez de força bruta — que seria ineficiente para 3 milhões de registros — utilizamos uma **VP-Tree (Vantage Point Tree)**.
*   **Construção:** A árvore é pré-construída no tempo de build (fase de preprocess), particionando o espaço métrico de forma esférica.
*   **Busca:** A busca utiliza uma abordagem iterativa com stack pré-alocada e poda (pruning) de ramos, eliminando cálculos desnecessários e garantindo a convergência rápida para os vizinhos mais próximos.
*   **Performance:** A função de distância euclidiana foi otimizada com *loop unrolling* manual para evitar overhead de controle de fluxo nas 14 dimensões.

### 3. Gerenciamento de Memória (Zero-Copy)
*   Os datasets (`vectors.bin`, `labels.bin`, `tree.bin`) são carregados em `TypedArrays` (Int16Array, Uint8Array) garantindo acesso direto à memória (zero-copy), mantendo o uso de RAM dentro dos limites estritos de 160MB por instância.
*   Técnicas de *Zero-Allocation* foram aplicadas no "caminho quente" (hot path) da busca KNN, reutilizando buffers para evitar pausas indesejadas do Garbage Collector do Node.js.

### 4. Infraestrutura
*   **Load Balancing:** Nginx configurado para balanceamento Round-Robin simples entre instâncias da API.
*   **Tuning de Runtime:** Flags agressivas do V8 (`--max-old-space-size=110`) para manter o heap sob controle constante, evitando o comportamento "stop-the-world" que impactaria o p99.
*   **Conteinerização:** Multi-stage Docker build para reduzir o tamanho da imagem e garantir a portabilidade.

## Como rodar localmente
1. Instale as dependências: `npm install`
2. Gere os binários: `npm run preprocess`
3. Inicie o servidor: `npm start`
4. Execute os testes: `npm run test:smoke` ou `npm run test:load`

## Estrutura da Submissão
A branch `submission` contém apenas os arquivos essenciais para a execução do desafio, isolando a lógica de negócio contida nesta branch `main`.
