#!/usr/bin/env python3
"""
Pairwise Ranker Training Script

Trains a neural network for pairwise ranking using margin ranking loss.
Input: JSONL dataset from ranker export
Output: ONNX model + metadata JSON

Usage:
    python train_ranker.py --input dataset.jsonl --output models/
"""

import argparse
import hashlib
import json
import os
import sys
import time
from typing import Dict, List, Tuple, Optional
from datetime import datetime

import numpy as np
import onnx
import onnxruntime
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm

# Set random seeds for reproducibility
np.random.seed(42)
torch.manual_seed(42)

# Constants
DEFAULT_MODEL_NAME = "ranker"
DEFAULT_EMBEDDING_DIM = 1536
DEFAULT_METRICS_DIM = 6
DEFAULT_HIDDEN_DIM = 128
DEFAULT_LEARNING_RATE = 0.001
DEFAULT_BATCH_SIZE = 32
DEFAULT_EPOCHS = 50
DEFAULT_MARGIN = 0.5
MIN_PAIRS_REQUIRED = 10


class PairwiseRankingDataset(Dataset):
    """Dataset for pairwise ranking training."""

    def __init__(
        self,
        data: List[Dict],
        metrics_dim: int = DEFAULT_METRICS_DIM,
        embedding_dim: int = DEFAULT_EMBEDDING_DIM,
    ):
        """Initialize dataset from JSONL rows."""
        self.data = []
        self.metrics_dim = metrics_dim
        self.embedding_dim = embedding_dim
        self.feature_names = []

        for row in data:
            try:
                a_metrics = row.get("a_metrics", [])
                b_metrics = row.get("b_metrics", [])
                a_embedding = row.get("a_embedding", [])
                b_embedding = row.get("b_embedding", [])
                label = row.get("label", 0)

                if (
                    len(a_metrics) != self.metrics_dim
                    or len(b_metrics) != self.metrics_dim
                ):
                    continue

                a_emb = (
                    np.array(a_embedding, dtype=np.float32)
                    if a_embedding
                    else np.zeros(self.embedding_dim, dtype=np.float32)
                )
                b_emb = (
                    np.array(b_embedding, dtype=np.float32)
                    if b_embedding
                    else np.zeros(self.embedding_dim, dtype=np.float32)
                )

                self.data.append(
                    {
                        "a_metrics": np.array(a_metrics, dtype=np.float32),
                        "b_metrics": np.array(b_metrics, dtype=np.float32),
                        "a_embedding": a_emb,
                        "b_embedding": b_emb,
                        "label": label,
                    }
                )

            except Exception as e:
                print(f"Warning: Skipping row due to error: {e}", file=sys.stderr)
                continue

        if self.data:
            self.feature_names = [
                "clarity",
                "impact",
                "relevance",
                "readability",
                "keyword_density",
                "completeness",
            ]

    def __len__(self):
        return len(self.data)

    def __getitem__(self, idx):
        item = self.data[idx]
        return {
            "a_metrics": torch.tensor(item["a_metrics"]),
            "b_metrics": torch.tensor(item["b_metrics"]),
            "a_embedding": torch.tensor(item["a_embedding"]),
            "b_embedding": torch.tensor(item["b_embedding"]),
            "label": torch.tensor(item["label"], dtype=torch.float32),
        }


class PairwiseRankerMLP(nn.Module):
    """Neural network for pairwise ranking."""

    def __init__(
        self, embedding_dim: int, metrics_dim: int, hidden_dim: int = DEFAULT_HIDDEN_DIM
    ):
        super().__init__()
        self.embedding_dim = embedding_dim
        self.metrics_dim = metrics_dim
        self.total_dim = embedding_dim + metrics_dim

        # Shared feature encoder
        self.feature_encoder = nn.Sequential(
            nn.Linear(self.total_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(0.1),
        )

        # Score head
        self.score_head = nn.Linear(hidden_dim // 2, 1)

        # Initialize weights
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                if m.bias is not None:
                    nn.init.zeros_(m.bias)

    def forward(
        self,
        a_embeddings: torch.Tensor,
        a_metrics: torch.Tensor,
        b_embeddings: torch.Tensor,
        b_metrics: torch.Tensor,
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """Forward pass returning scores for both items."""
        # Combine embeddings and metrics
        a_features = torch.cat([a_embeddings, a_metrics], dim=-1)
        b_features = torch.cat([b_embeddings, b_metrics], dim=-1)

        # Encode features
        a_encoded = self.feature_encoder(a_features)
        b_encoded = self.feature_encoder(b_features)

        # Get scores
        a_score = self.score_head(a_encoded).squeeze(-1)
        b_score = self.score_head(b_encoded).squeeze(-1)

        return a_score, b_score, a_score - b_score


def margin_ranking_loss(
    a_scores: torch.Tensor,
    b_scores: torch.Tensor,
    labels: torch.Tensor,
    margin: float = DEFAULT_MARGIN,
) -> torch.Tensor:
    """Margin ranking loss."""
    loss = nn.functional.relu(margin - labels * (a_scores - b_scores))
    return loss.mean()


def compute_accuracy(
    a_scores: torch.Tensor, b_scores: torch.Tensor, labels: torch.Tensor
) -> float:
    """Compute pairwise accuracy."""
    predictions = (a_scores > b_scores).float()
    correct = ((predictions == (labels > 0)).float()).mean()
    return correct.item()


def train_epoch(
    model: nn.Module,
    dataloader: DataLoader,
    optimizer: optim.Optimizer,
    device: torch.device,
    margin: float = DEFAULT_MARGIN,
) -> Tuple[float, float]:
    """Train for one epoch."""
    model.train()
    total_loss = 0.0
    total_acc = 0.0

    for batch in tqdm(dataloader, desc="Training", leave=False):
        a_metrics = batch["a_metrics"].to(device)
        b_metrics = batch["b_metrics"].to(device)
        a_embeddings = batch["a_embedding"].to(device)
        b_embeddings = batch["b_embedding"].to(device)
        labels = batch["label"].to(device)

        optimizer.zero_grad()

        a_scores, b_scores, diff = model(
            a_embeddings, a_metrics, b_embeddings, b_metrics
        )

        loss = margin_ranking_loss(a_scores, b_scores, labels, margin)
        loss.backward()

        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        total_loss += loss.item()
        total_acc += compute_accuracy(a_scores, b_scores, labels)

    return total_loss / len(dataloader), total_acc / len(dataloader)


def evaluate(
    model: nn.Module, dataloader: DataLoader, device: torch.device
) -> Tuple[float, float, List[Dict]]:
    """Evaluate model on validation set."""
    model.eval()
    total_loss = 0.0
    total_acc = 0.0
    predictions = []

    with torch.no_grad():
        for batch in tqdm(dataloader, desc="Evaluating", leave=False):
            a_metrics = batch["a_metrics"].to(device)
            b_metrics = batch["b_metrics"].to(device)
            a_embeddings = batch["a_embedding"].to(device)
            b_embeddings = batch["b_embedding"].to(device)
            labels = batch["label"].to(device)

            a_scores, b_scores, diff = model(
                a_embeddings, a_metrics, b_embeddings, b_metrics
            )

            loss = margin_ranking_loss(a_scores, b_scores, labels)

            total_loss += loss.item()
            total_acc += compute_accuracy(a_scores, b_scores, labels)

            for i in range(a_scores.shape[0]):
                predictions.append(
                    {
                        "a_score": a_scores[i].item(),
                        "b_score": b_scores[i].item(),
                        "label": labels[i].item(),
                        "predicted": (a_scores[i] > b_scores[i]).item(),
                    }
                )

    return total_loss / len(dataloader), total_acc / len(dataloader), predictions


def export_onnx(
    model: nn.Module, embedding_dim: int, metrics_dim: int, output_path: str
) -> None:
    """Export model to ONNX format."""
    model.eval()

    # Create sample inputs
    batch_size = 1
    dummy_a_emb = torch.randn(batch_size, embedding_dim)
    dummy_a_met = torch.randn(batch_size, metrics_dim)
    dummy_b_emb = torch.randn(batch_size, embedding_dim)
    dummy_b_met = torch.randn(batch_size, metrics_dim)

    # Create input names
    input_names = ["a_embedding", "a_metrics", "b_embedding", "b_metrics"]
    output_names = ["a_score", "b_score", "difference"]

    # Export
    torch.onnx.export(
        model,
        (dummy_a_emb, dummy_a_met, dummy_b_emb, dummy_b_met),
        output_path,
        input_names=input_names,
        output_names=output_names,
        opset_version=13,
        dynamic_axes={
            "a_embedding": {0: "batch_size"},
            "a_metrics": {0: "batch_size"},
            "b_embedding": {0: "batch_size"},
            "b_metrics": {0: "batch_size"},
            "a_score": {0: "batch_size"},
            "b_score": {0: "batch_size"},
            "difference": {0: "batch_size"},
        },
    )

    print(f"  ONNX model saved to: {output_path}")


def verify_onnx(model_path: str, embedding_dim: int, metrics_dim: int) -> bool:
    """Verify ONNX model can be loaded and run."""
    try:
        session = onnxruntime.InferenceSession(model_path)

        # Create test inputs
        a_emb = np.random.randn(1, embedding_dim).astype(np.float32)
        a_met = np.random.randn(1, metrics_dim).astype(np.float32)
        b_emb = np.random.randn(1, embedding_dim).astype(np.float32)
        b_met = np.random.randn(1, metrics_dim).astype(np.float32)

        # Run inference
        inputs = {
            "a_embedding": a_emb,
            "a_metrics": a_met,
            "b_embedding": b_emb,
            "b_metrics": b_met,
        }

        outputs = session.run(None, inputs)

        print(f"  ONNX inference verified! Output shapes: {[o.shape for o in outputs]}")
        return True

    except Exception as e:
        print(f"  ONNX verification failed: {e}", file=sys.stderr)
        return False


def main():
    parser = argparse.ArgumentParser(description="Train pairwise ranker model")
    parser.add_argument("--input", "-i", required=True, help="Input JSONL dataset path")
    parser.add_argument(
        "--output", "-o", required=True, help="Output directory for model"
    )
    parser.add_argument(
        "--epochs",
        "-e",
        type=int,
        default=DEFAULT_EPOCHS,
        help="Number of training epochs",
    )
    parser.add_argument(
        "--batch-size", "-b", type=int, default=DEFAULT_BATCH_SIZE, help="Batch size"
    )
    parser.add_argument(
        "--learning-rate",
        "-lr",
        type=float,
        default=DEFAULT_LEARNING_RATE,
        help="Learning rate",
    )
    parser.add_argument(
        "--margin",
        "-m",
        type=float,
        default=DEFAULT_MARGIN,
        help="Margin for ranking loss",
    )
    parser.add_argument(
        "--embedding-dim",
        type=int,
        default=DEFAULT_EMBEDDING_DIM,
        help="Embedding dimension",
    )
    parser.add_argument(
        "--metrics-dim", type=int, default=DEFAULT_METRICS_DIM, help="Metrics dimension"
    )
    parser.add_argument(
        "--hidden-dim",
        type=int,
        default=DEFAULT_HIDDEN_DIM,
        help="Hidden layer dimension",
    )
    parser.add_argument(
        "--val-split", type=float, default=0.2, help="Validation split ratio"
    )
    parser.add_argument("--seed", type=int, default=42, help="Random seed")

    args = parser.parse_args()

    print("=" * 60)
    print("Pairwise Ranker Training")
    print("=" * 60)

    # Set seeds
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)

    # Load dataset
    print(f"\n📂 Loading dataset from: {args.input}")
    if not os.path.exists(args.input):
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)

    data = []
    with open(args.input, "r") as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line))

    print(f"  Loaded {len(data)} rows")

    if len(data) < MIN_PAIRS_REQUIRED:
        print(
            f"Error: Need at least {MIN_PAIRS_REQUIRED} pairs, got {len(data)}",
            file=sys.stderr,
        )
        sys.exit(1)

    # Create dataset
    dataset = PairwiseRankingDataset(data, args.metrics_dim)
    print(f"  Valid pairs: {len(dataset)}")
    print(f"  Metrics features: {dataset.feature_names}")

    # Split train/val
    val_size = int(len(dataset) * args.val_split)
    train_size = len(dataset) - val_size
    train_dataset, val_dataset = torch.utils.data.random_split(
        dataset,
        [train_size, val_size],
        generator=torch.Generator().manual_seed(args.seed),
    )

    train_loader = DataLoader(train_dataset, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False)

    print(f"  Train size: {len(train_dataset)}, Val size: {len(val_dataset)}")

    # Setup device
    device = torch.device("cpu")
    print(f"\n🖥️  Device: {device}")

    # Initialize model
    print(f"\n🧠 Initializing model...")
    model = PairwiseRankerMLP(
        embedding_dim=args.embedding_dim,
        metrics_dim=args.metrics_dim,
        hidden_dim=args.hidden_dim,
    ).to(device)

    num_params = sum(p.numel() for p in model.parameters())
    print(f"  Parameters: {num_params:,}")

    # Optimizer
    optimizer = optim.AdamW(
        model.parameters(), lr=args.learning_rate, weight_decay=0.01
    )
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    # Training loop
    print(f"\n🏃 Starting training for {args.epochs} epochs...")
    best_val_acc = 0.0
    best_epoch = 0

    for epoch in range(args.epochs):
        train_loss, train_acc = train_epoch(
            model, train_loader, optimizer, device, args.margin
        )
        val_loss, val_acc, _ = evaluate(model, val_loader, device)
        scheduler.step()

        if val_acc > best_val_acc:
            best_val_acc = val_acc
            best_epoch = epoch + 1

        if (epoch + 1) % 10 == 0 or epoch == 0:
            print(
                f"  Epoch {epoch + 1:3d}/{args.epochs}: "
                f"train_loss={train_loss:.4f}, train_acc={train_acc:.4f}, "
                f"val_loss={val_loss:.4f}, val_acc={val_acc:.4f}"
            )

    print(f"\n✅ Training complete!")
    print(f"  Best validation accuracy: {best_val_acc:.4f} (epoch {best_epoch})")

    # Final evaluation
    print(f"\n📊 Final evaluation...")
    final_val_acc = 0.0
    final_val_loss = float("inf")
    train_acc = 0.0
    train_loss = float("inf")
    predictions = []

    if len(val_loader) > 0:
        final_val_loss, final_val_acc, predictions = evaluate(model, val_loader, device)

    if len(train_loader) > 0:
        train_loss, train_acc, _ = evaluate(model, train_loader, device)

    # Compute dataset hash
    with open(args.input, "rb") as f:
        dataset_hash = hashlib.sha256(f.read()).hexdigest()

    # Create output directory
    os.makedirs(args.output, exist_ok=True)

    # Export ONNX
    model_filename = f"{DEFAULT_MODEL_NAME}.onnx"
    model_path = os.path.join(args.output, model_filename)

    print(f"\n💾 Exporting model to: {model_path}")
    export_onnx(model, args.embedding_dim, args.metrics_dim, model_path)

    # Verify ONNX
    print("\n🔍 Verifying ONNX model...")
    onnx_valid = verify_onnx(model_path, args.embedding_dim, args.metrics_dim)

    # Write metadata
    metadata = {
        "version": "1.0",
        "embeddingDim": args.embedding_dim,
        "metricsDim": args.metrics_dim,
        "featureNames": dataset.feature_names,
        "datasetHash": dataset_hash,
        "trainMetrics": {
            "trainAccuracy": float(train_acc),
            "trainLoss": float(train_loss),
            "valAccuracy": float(final_val_acc),
            "valLoss": float(final_val_loss),
        },
        "modelConfig": {
            "hiddenDim": args.hidden_dim,
            "learningRate": args.learning_rate,
            "margin": args.margin,
            "batchSize": args.batch_size,
            "epochs": args.epochs,
        },
        "createdAt": datetime.utcnow().isoformat() + "Z",
        "onnxOpSet": 13,
        "onnxValid": onnx_valid,
    }

    metadata_filename = f"{DEFAULT_MODEL_NAME}_metadata.json"
    metadata_path = os.path.join(args.output, metadata_filename)

    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"  Metadata saved to: {metadata_path}")

    # Write active model config
    active_config = {
        "model": model_filename,
        "metadata": metadata_filename,
        "activatedAt": datetime.utcnow().isoformat() + "Z",
    }

    active_path = os.path.join(args.output, "active_model.json")
    with open(active_path, "w") as f:
        json.dump(active_config, f, indent=2)

    print(f"\n📦 Model files created:")
    print(f"  - {model_path}")
    print(f"  - {metadata_path}")
    print(f"  - {active_path}")

    print("\n" + "=" * 60)
    print("Training Complete!")
    print("=" * 60)
    print(f"\n💡 Next steps:")
    print(f"  1. Model is ready at: {model_path}")
    print(f"  2. To activate in CLI: pnpm cli ranker:status")
    print(f"  3. Test with: pnpm cli ranker:smoke")


if __name__ == "__main__":
    main()
