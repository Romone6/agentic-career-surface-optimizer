# Machine Learning Training Guide

This guide explains how to train the pairwise ranker model using the provided training scaffold.

## Overview

The pairwise ranker uses a neural network to learn preferences between items (e.g., profile sections, projects, skills). It's trained using margin ranking loss on pairwise preference data collected through the CLI.

## Prerequisites

1. **Python 3.8+** installed
2. **Node.js** for the main application
3. **Dataset** collected using the ranker CLI commands

## Setup

### 1. Install Python Dependencies

```bash
cd tools/ml
pip install -r requirements.txt
```

### 2. Collect Training Data

Use the CLI commands to collect pairwise preferences:

```bash
# Add pairwise preferences interactively
pnpm run profile ranker add-pair --interactive

# Or add preferences via command line
pnpm run profile ranker add-pair \
  --item-type project \
  --item-a proj-1 \
  --item-b proj-2 \
  --label 1 \
  --reason-tags relevance,metrics

# Export dataset to JSONL format
pnpm run profile ranker export --output dataset.jsonl
```

## Training the Model

### Basic Training

```bash
cd tools/ml
python train_ranker.py --input dataset.jsonl --output models/pairwise_ranker
```

### Advanced Training Options

```bash
python train_ranker.py \
  --input dataset.jsonl \
  --output models/pairwise_ranker \
  --name custom_ranker \
  --embedding-dim 1536 \
  --hidden-dim 256 \
  --learning-rate 0.001 \
  --batch-size 32 \
  --epochs 50 \
  --margin 1.0
```

### Training Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--input` | Required | Path to JSONL dataset file |
| `--output` | Required | Output directory for model artifacts |
| `--name` | `pairwise_ranker` | Model name prefix |
| `--embedding-dim` | 1536 | Embedding dimension |
| `--hidden-dim` | 256 | Hidden layer dimension |
| `--learning-rate` | 0.001 | Learning rate |
| `--batch-size` | 32 | Batch size |
| `--epochs` | 50 | Number of training epochs |
| `--margin` | 1.0 | Margin for ranking loss |

## Output Files

The training script produces several output files:

### 1. PyTorch Model (`*.pth`)
- Native PyTorch model checkpoint
- Contains trained weights and architecture
- Can be loaded for further training

### 2. ONNX Model (`*.onnx`)
- Optimized model in ONNX format
- Cross-platform and language-agnostic
- Recommended for production inference

### 3. Metadata JSON (`*_metadata.json`)
- Training configuration and statistics
- Loss history and performance metrics
- Dataset information

Example output structure:
```
models/
├── pairwise_ranker.pth        # PyTorch model
├── pairwise_ranker.onnx       # ONNX model
└── pairwise_ranker_metadata.json # Training metadata
```

## Model Architecture

The pairwise ranker uses a simple but effective architecture:

1. **Shared Feature Extractor**: 2-layer MLP with ReLU activation
2. **Scoring Head**: Linear layer to produce scalar scores
3. **Loss Function**: Margin ranking loss

```
Input (embedding + metrics) 
  → Shared MLP (ReLU, Dropout) 
  → Score Head (Linear) 
  → Score Difference (score_a - score_b)
  → Margin Ranking Loss
```

## Dataset Format

The training script expects a JSONL file with the following format:

```json
{"item_a": {...}, "item_b": {...}, "label": 1, "reason_tags": [...], "similarity": 0.85}
{"item_a": {...}, "item_b": {...}, "label": -1, "reason_tags": [...], "similarity": 0.65}
...
```

### Item Structure

Each item should contain:
- `id`: Unique identifier
- `item_type`: Type of item (profile_section, project, skill, etc.)
- `item_reference_id`: Reference to the original item
- `embedding`: Embedding vector (optional)
- `embedding_id`: Reference to embedding (optional)
- `metrics`: Heuristic metrics
- `created_at`: Timestamp

### Label Meaning

- `1`: Item A is preferred over Item B
- `0`: Items are equally preferred
- `-1`: Item B is preferred over Item A

## Training Tips

### 1. Dataset Quality

- **Balance**: Aim for balanced distribution of labels (-1, 0, 1)
- **Diversity**: Include diverse item types and scenarios
- **Size**: Minimum 100-200 samples for reasonable performance

### 2. Hyperparameter Tuning

Start with default parameters and adjust based on validation performance:

- **Learning Rate**: Try 0.01, 0.001, 0.0001
- **Batch Size**: Try 16, 32, 64
- **Margin**: Try 0.5, 1.0, 2.0

### 3. Monitoring Training

Watch the loss curve during training:
- Loss should decrease steadily
- If loss plateaus, try increasing model capacity or learning rate
- If loss oscillates, try decreasing learning rate

## Inference

### Using the Trained Model

The trained model can be used in the main application for ranking:

```typescript
// Load ONNX model in the main application
import { InferenceSession } from 'onnxruntime-web';

const session = await InferenceSession.create('models/pairwise_ranker.onnx');

// Prepare input tensors
const inputA = ... // Feature vector for item A
const inputB = ... // Feature vector for item B

// Run inference
const results = await session.run({
  'input_a': new Float32Array(inputA.flat()),
  'input_b': new Float32Array(inputB.flat())
});

const scoreDiff = results['score_diff'][0];
```

### Ranking Items

```typescript
// Rank a list of items using pairwise comparisons
async function rankItems(items: any[], session: InferenceSession) {
  const scores = await Promise.all(
    items.map(async (item, index) => {
      // Compare with reference item (e.g., first item)
      if (index === 0) return 0;
      
      const scoreDiff = await runInference(session, items[0], item);
      return scoreDiff;
    })
  );
  
  // Sort by score
  return items.sort((a, b) => {
    const scoreA = scores[items.indexOf(a)];
    const scoreB = scores[items.indexOf(b)];
    return scoreB - scoreA; // Higher score first
  });
}
```

## Troubleshooting

### Common Issues

1. **CUDA Out of Memory**: Reduce batch size or use CPU
2. **NaN Loss**: Check dataset for invalid values
3. **Slow Training**: Use smaller model or fewer epochs
4. **Poor Performance**: Collect more diverse data

### Debugging

```bash
# Run with verbose logging
python train_ranker.py --input dataset.jsonl --output models/debug --epochs 5

# Check dataset quality
python -c "
import json
with open('dataset.jsonl') as f:
    data = [json.loads(line) for line in f]
    labels = [row['label'] for row in data]
    print(f'Label distribution: {dict(zip(*np.unique(labels, return_counts=True)))})'
"
```

## Best Practices

1. **Version Control**: Track model versions and datasets
2. **Experimentation**: Log all training runs with parameters
3. **Validation**: Set aside validation data for tuning
4. **Monitoring**: Track model performance in production
5. **Retraining**: Update models periodically with new data

## Example Workflow

```bash
# 1. Collect data
pnpm run profile ranker add-pair --interactive

# 2. Export dataset
pnpm run profile ranker export --output data/dataset.jsonl

# 3. Train model
cd tools/ml
python train_ranker.py --input ../data/dataset.jsonl --output ../models/ranker_v1

# 4. Evaluate model
python -c "
import json
with open('../models/ranker_v1_metadata.json') as f:
    metadata = json.load(f)
    print(f'Final loss: {metadata[\"loss_history\"][-1]:.4f}')
    print(f'Training time: {metadata[\"training_time\"]:.2f}s')
"

# 5. Deploy model
# Copy ONNX model to production directory
cp ../models/ranker_v1.onnx ../public/models/
```

## References

- [PyTorch Documentation](https://pytorch.org/docs/stable/index.html)
- [ONNX Runtime](https://onnxruntime.ai/)
- [Margin Ranking Loss](https://pytorch.org/docs/stable/generated/torch.nn.MarginRankingLoss.html)
- [Pairwise Learning to Rank](https://en.wikipedia.org/wiki/Learning_to_rank#Pairwise_approach)

## License

This training scaffold is provided as-is under the MIT License. Use at your own risk and adapt to your specific needs.