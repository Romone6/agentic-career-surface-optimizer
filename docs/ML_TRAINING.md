# Ranker Model Training Guide

This document describes how to train and deploy a trainable neural network ranker for profile optimization.

## Overview

The ranker is a pairwise ranking model that learns to prefer better profile content based on:
- **Embeddings**: Text embeddings from OpenRouter API
- **Metrics**: Quantitative metrics (clarity, impact, relevance, etc.)
- **Training Signals**: User preferences, benchmark comparisons, before/after changes

## Prerequisites

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
- `tqdm` - Progress bars

## Quick Start

### Step 1: Bootstrap Initial Training Data

```bash
# Bootstrap 200 pairs from GitHub benchmarks
pnpm cli ranker:bootstrap --platform github --n-pairs 200

# Or LinkedIn
pnpm cli ranker:bootstrap --platform linkedin --n-pairs 200
```

This creates initial training pairs using heuristic quality signals from benchmark profiles.

### Step 2: Export Dataset

```bash
# Export to data/ranker directory
pnpm cli ranker:export --out data/ranker
```

This creates:
- `data/ranker/dataset.jsonl` - Training pairs in JSONL format
- `data/ranker/metadata.json` - Dataset metadata with feature names

### Step 3: Train Model

```bash
# Train the ranker model
pnpm cli ranker:train --epochs 50 --batch-size 32
```

This:
1. Reads the exported dataset
2. Trains a neural network with margin ranking loss
3. Exports to ONNX format
4. Activates the model for inference

### Step 4: Verify Status

```bash
# Check if ranker is active
pnpm cli ranker:status

# Run smoke test
pnpm cli ranker:smoke
```

## Manual Workflow

### Dataset Export

```bash
# Export specific platform
pnpm cli ranker:export --platform github --out data/ranker/github

# Export with statistics only
pnpm cli ranker:export --stats
```

### Manual Training (Python)

```bash
cd tools/ml

# Activate venv
source venv/bin/activate

# Run training script directly
python train_ranker.py \
  --input ../../data/ranker/dataset.jsonl \
  --output ../../models \
  --epochs 50 \
  --batch-size 32
```

### Model Files

Training produces:
- `models/ranker.onnx` - The neural network model
- `models/ranker_metadata.json` - Model metadata (dims, features, metrics)
- `models/active_model.json` - Pointer to active model

## Adding Training Signals

### Manual Labeling

```bash
# Get item IDs from database, then label a pair
pnpm cli ranker:label --a <item_id_a> --b <item_id_b> --better a --tags clarity,impact
```

### Capturing User Choices

When users choose between A/B variants, pairs are automatically captured with:
- `source: user_choice`
- Reason tags from the comparison

### Before/After Tracking

When content is optimized and applied:
- Pairs are created with `source: before_after`
- Labels indicate improvement direction

## Architecture

### Neural Network

```
Input: [embedding (1536D) + metrics (6D)] = 1542D
  ↓
Shared MLP: Linear(1542→128) → ReLU → Dropout → Linear(128→64) → ReLU
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

### Inference

The model can be used for:
1. **Item Scoring**: Score a single profile section
2. **Comparison**: Compare two items and return preference
3. **Ranking**: Rank multiple items by score

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

# Manually activate
# Edit models/active_model.json with correct filenames
```

### ONNX Runtime Missing

```bash
# Install onnxruntime-node (optional)
npm install onnxruntime-node

# Without it, fallback to heuristics
pnpm cli ranker:smoke
# Should show "provenance: heuristic"
```

## API Reference

### CLI Commands

| Command | Description |
|---------|-------------|
| `pnpm cli ranker:status` | Show model status and dataset stats |
| `pnpm cli ranker:smoke` | Test model inference |
| `pnpm cli ranker:export` | Export dataset to JSONL |
| `pnpm cli ranker:bootstrap` | Create initial training pairs |
| `pnpm cli ranker:train` | Train and activate model |
| `pnpm cli ranker:label` | Manually label a pair |

### Node.js API

```typescript
import { RankerInferenceService } from '@ancso/ml';

const ranker = new RankerInferenceService();
await ranker.initialize();

// Score an item
const { score, provenance } = await ranker.scoreItem({
  id: '1',
  platform: 'linkedin',
  section: 'headline',
  sourceRef: 'Experienced software engineer',
  score: 0,
  metrics: { clarity: 0.8, impact: 0.7, relevance: 0.9 }
});

// Compare two items
const result = await ranker.compare(itemA, itemB);
// result: { aScore, bScore, preference, confidence, provenance }
```

## Performance

- **Training**: ~1-5 minutes on CPU for 50 epochs with 200 pairs
- **Inference**: <10ms per item on CPU
- **Memory**: Model uses ~200KB

## Next Steps

1. **Collect More Data**: Add more pairs from user interactions
2. **Fine-tune**: Adjust hyperparameters in `train_ranker.py`
3. **Embeddings**: Connect to actual embedding storage for real embeddings
4. **Evaluation**: Add A/B testing to measure real-world improvement
