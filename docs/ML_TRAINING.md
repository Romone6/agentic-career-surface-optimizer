# Ranker Model Training Guide

This document describes how to train and deploy a trainable neural network ranker for profile optimization using real data and embeddings.

## Overview

The ranker is a pairwise ranking model that learns to prefer better profile content based on:
- **Real Embeddings**: Text embeddings from @xenova/transformers (all-MiniLM-L6-v2, 384D)
- **Metrics**: Quantitative metrics (clarity, impact, relevance, readability, keyword_density, completeness)
- **Training Signals**: User preferences, benchmark comparisons, before/after changes

## Prerequisites

### Node.js Dependencies

```bash
# Install workspace dependencies
pnpm install

# Install optional ONNX runtime for Node.js inference
npm install onnxruntime-node
```

### Python Environment

```bash
cd tools/ml

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

Required packages:
- `torch` - PyTorch for model training
- `numpy` - Numerical operations
- `onnx` - ONNX model format
- `onnxruntime` - ONNX inference
- `scikit-learn` - For dataset utilities
- `tqdm` - Progress bars

## Quick Start (End-to-End Pipeline)

Run these commands in sequence to build a production-grade ranker from scratch:

```bash
# Step 1: Seed elite GitHub profiles
pnpm cli benchmarks:seed:github --n 50

# Step 2: Ingest profile content (bio, README, repo READMEs)
pnpm cli benchmarks:ingest:github --limit 50

# Step 3: Generate real embeddings using @xenova/transformers
pnpm cli benchmarks:embed --platform github

# Step 4: Create rank items and bootstrap training pairs
pnpm cli ranker:bootstrap --platform github --n-pairs 500 --diversity 0.3

# Step 5: Export dataset to JSONL
pnpm cli ranker:export --platform github --out data/ranker

# Step 6: Validate dataset
pnpm cli ranker:validate --dataset data/ranker/dataset.jsonl --metadata data/ranker/metadata.json

# Step 7: Train neural network model
pnpm cli ranker:train --epochs 50 --batch-size 32

# Step 8: Check model status
pnpm cli ranker:status

# Step 9: Run smoke test
pnpm cli ranker:smoke
```

## Manual Workflow

### Benchmark Management

```bash
# Seed GitHub profiles from elite sources
pnpm cli benchmarks:seed:github --n 100

# Ingest profile content
pnpm cli benchmarks:ingest:github --limit 50

# Generate embeddings for all sections
pnpm cli benchmarks:embed --platform github

# View benchmark stats
pnpm cli benchmarks:stats
```

### Ranker Data Pipeline

```bash
# Create rank items from benchmarks and generate training pairs
pnpm cli ranker:bootstrap --platform github --n-pairs 500 --diversity 0.3

# Export dataset for training
pnpm cli ranker:export --platform github --out data/ranker

# Validate dataset consistency
pnpm cli ranker:validate --dataset data/ranker/dataset.jsonl --metadata data/ranker/metadata.json
```

### Model Training

```bash
# Train with default settings (50 epochs, batch size 32)
pnpm cli ranker:train

# Custom training settings
pnpm cli ranker:train --epochs 100 --batch-size 64

# Manual training (Python)
cd tools/ml
source venv/bin/activate
python train_ranker.py \
  --input ../../data/ranker/dataset.jsonl \
  --output ../../models \
  --epochs 50 \
  --batch-size 32
```

### Model Management

```bash
# Check if ranker is active
pnpm cli ranker:status

# Test model inference
pnpm cli ranker:smoke

# Manually label a pair
pnpm cli ranker:label --a <item_id_a> --b <item_id_b> --better a --tags clarity,impact
```

## Model Files

Training produces:
- `models/ranker.onnx` - The neural network model (MLP)
- `models/ranker_metadata.json` - Model metadata (dims, features, metrics)
- `models/active_model.json` - Pointer to active model

## Architecture

### Neural Network

```
Input: [embedding (384D) + metrics (6D)] = 390D
  ↓
Shared MLP: Linear(390→128) → ReLU → Dropout → Linear(128→64) → ReLU
  ↓
Score Head: Linear(64→1)
  ↓
Output: Scalar score
```

### Training Loss

Margin Ranking Loss:
```
L = max(0, margin - label * (score_A - score_B))
```

Where `label = 1` if A > B, `-1` if B > A.

### Feature Names

The model uses these 6 features in a fixed order:
1. `clarity` - How clear and concise the content is
2. `impact` - Evidence of impact and results
3. `relevance` - Technical relevance and keywords
4. `readability` - Sentence structure and word choice
5. `keyword_density` - Keyword optimization
6. `completeness` - Content depth and structure

## Fallback Behavior

If ONNX runtime is not available or model is missing, the system falls back to heuristic scoring:

```typescript
function heuristicScore(metrics): number {
  return (
    clarity * 0.3 +
    impact * 0.4 +
    keyword_score * 0.3
  );
}
```

## Troubleshooting

### Python venv Issues

```bash
# Recreate venv
rm -rf tools/ml/venv
python3 -m venv tools/ml/venv
source tools/ml/venv/bin/activate
pip install -r tools/ml/requirements.txt
```

### No Training Pairs

```bash
# Check existing pairs
pnpm cli ranker:status

# Bootstrap more pairs
pnpm cli ranker:bootstrap --platform github --n-pairs 500
```

### Model Not Activating

```bash
# Check model files
ls -la models/

# Manually activate (edit models/active_model.json)
```

### ONNX Runtime Missing

```bash
# Install onnxruntime-node (optional)
npm install onnxruntime-node

# Without it, fallback to heuristics
pnpm cli ranker:smoke
# Should show "provenance: heuristic"
```

### Embedding Generation Fails

```bash
# Check if @xenova/transformers is installed
npm list @xenova/transformers

# Reinstall
npm install @xenova/transformers
```

## API Reference

### CLI Commands

| Command | Description |
|---------|-------------|
| `pnpm cli benchmarks:seed:github --n 50` | Seed 50 elite GitHub profiles |
| `pnpm cli benchmarks:ingest:github` | Fetch profile content |
| `pnpm cli benchmarks:embed --platform github` | Generate embeddings |
| `pnpm cli ranker:bootstrap --n-pairs 500` | Create training pairs |
| `pnpm cli ranker:export --out data/ranker` | Export dataset |
| `pnpm cli ranker:validate` | Validate dataset |
| `pnpm cli ranker:train --epochs 50` | Train model |
| `pnpm cli ranker:status` | Show model status |
| `pnpm cli ranker:smoke` | Test inference |

### Node.js API

```typescript
import { RankerInferenceService, FeatureExtractor } from '@ancso/ml';

const ranker = new RankerInferenceService();
await ranker.initialize();

// Score an item
const { score, provenance } = await ranker.scoreItem({
  id: '1',
  platform: 'github',
  section: 'readme',
  sourceRef: 'Experienced software engineer',
  score: 0,
  metrics: { clarity: 0.8, impact: 0.7, relevance: 0.9 }
});

// Compare two items with real embeddings
const result = await ranker.compareWithEmbeddings(
  itemA, embeddingA,
  itemB, embeddingB
);
// result: { aScore, bScore, preference, confidence, provenance }
```

## Performance

- **Embedding Generation**: ~10-50ms per section (local CPU)
- **Training**: ~2-10 minutes on CPU for 50 epochs with 500 pairs
- **Inference**: <5ms per item on CPU
- **Memory**: Model uses ~200KB

## Next Steps

1. **Collect More Data**: Add more pairs from user interactions
2. **Fine-tune**: Adjust hyperparameters in `train_ranker.py`
3. **Cross-platform**: Train on LinkedIn data for multi-platform ranking
4. **Evaluation**: Add A/B testing to measure real-world improvement
