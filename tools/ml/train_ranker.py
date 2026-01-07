#!/usr/bin/env python3
"""
Pairwise Ranker Training Script

Trains a pairwise ranking model using margin ranking loss.
Input: JSONL dataset from ranker export
Output: ONNX model + metadata JSON

Usage:
    python train_ranker.py --input dataset.jsonl --output model_dir
"""

import argparse
import json
import os
import time
from typing import Dict, List, Tuple

import numpy as np
import onnx
import torch
import torch.nn as nn
import torch.optim as optim
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, Dataset
from tqdm import tqdm

# Set random seeds for reproducibility
np.random.seed(42)
torch.manual_seed(42)

# Constants
DEFAULT_MODEL_NAME = "pairwise_ranker"
DEFAULT_EMBEDDING_DIM = 1536
DEFAULT_HIDDEN_DIM = 256
DEFAULT_LEARNING_RATE = 0.001
DEFAULT_BATCH_SIZE = 32
DEFAULT_EPOCHS = 50
DEFAULT_MARGIN = 1.0


class PairwiseRankingDataset(Dataset):
    """
    Dataset for pairwise ranking.
    Each sample contains two items and a preference label.
    """

    def __init__(self, data: List[Dict], embedding_dim: int = DEFAULT_EMBEDDING_DIM):
        """
        Initialize dataset.

        Args:
            data: List of dataset rows from JSONL
            embedding_dim: Dimension of embedding vectors
        """
        self.data = []
        self.embedding_dim = embedding_dim

        # Process data and extract features
        for row in data:
            try:
                item_a = row["item_a"]
                item_b = row["item_b"]
                label = row["label"]

                # Extract embeddings if available
                emb_a = self._extract_embedding(item_a)
                emb_b = self._extract_embedding(item_b)

                if emb_a is None or emb_b is None:
                    # Skip if embeddings not available
                    continue

                # Extract metrics if available
                metrics_a = self._extract_metrics(item_a)
                metrics_b = self._extract_metrics(item_b)

                # Combine features: embedding + metrics
                features_a = self._combine_features(emb_a, metrics_a)
                features_b = self._combine_features(emb_b, metrics_b)

                self.data.append(
                    {"features_a": features_a, "features_b": features_b, "label": label}
                )

            except Exception as e:
                print(f"Warning: Skipping row due to error: {e}")
                continue

    def _extract_embedding(self, item: Dict) -> np.ndarray:
        """Extract embedding from item or return None."""
        # Check if embedding is directly available
        if "embedding" in item:
            return np.array(item["embedding"])

        # Check if embedding reference is available
        if "embedding_id" in item:
            # In a real implementation, we would look up the embedding
            # For this scaffold, we'll return a mock embedding
            return np.random.randn(self.embedding_dim)

        return None

    def _extract_metrics(self, item: Dict) -> Dict[str, float]:
        """Extract metrics from item."""
        if "metrics" in item and isinstance(item["metrics"], dict):
            return item["metrics"]
        return {}

    def _combine_features(
        self, embedding: np.ndarray, metrics: Dict[str, float]
    ) -> np.ndarray:
        """Combine embedding and metrics into feature vector."""
        # Convert metrics to array
        metrics_array = np.array(list(metrics.values())) if metrics else np.array([])

        # Combine features
        combined = np.concatenate([embedding, metrics_array])

        return combined

    def __len__(self) -> int:
        return len(self.data)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor, int]:
        sample = self.data[idx]

        # Convert to tensors
        features_a = torch.FloatTensor(sample["features_a"])
        features_b = torch.FloatTensor(sample["features_b"])
        label = sample["label"]

        return features_a, features_b, label


class PairwiseRanker(nn.Module):
    """
    Neural network for pairwise ranking.
    Uses margin ranking loss to learn preferences.
    """

    def __init__(self, input_dim: int, hidden_dim: int = DEFAULT_HIDDEN_DIM):
        """
        Initialize the ranker model.

        Args:
            input_dim: Dimension of input features
            hidden_dim: Dimension of hidden layers
        """
        super(PairwiseRanker, self).__init__()

        self.shared_layer = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
        )

        self.score_layer = nn.Linear(hidden_dim, 1)

    def forward(
        self, features_a: torch.Tensor, features_b: torch.Tensor
    ) -> torch.Tensor:
        """
        Forward pass for pairwise ranking.

        Args:
            features_a: Features for item A
            features_b: Features for item B

        Returns:
            Score difference (score_a - score_b)
        """
        # Get scores for each item
        score_a = self.score_layer(self.shared_layer(features_a))
        score_b = self.score_layer(self.shared_layer(features_b))

        # Return score difference
        return score_a - score_b


def load_dataset(file_path: str) -> List[Dict]:
    """
    Load dataset from JSONL file.

    Args:
        file_path: Path to JSONL file

    Returns:
        List of dataset rows
    """
    data = []

    with open(file_path, "r") as f:
        for line in f:
            try:
                row = json.loads(line)
                data.append(row)
            except json.JSONDecodeError as e:
                print(f"Warning: Invalid JSON line: {e}")
                continue

    return data


def train_model(
    dataset: PairwiseRankingDataset,
    output_dir: str,
    model_name: str = DEFAULT_MODEL_NAME,
    hidden_dim: int = DEFAULT_HIDDEN_DIM,
    learning_rate: float = DEFAULT_LEARNING_RATE,
    batch_size: int = DEFAULT_BATCH_SIZE,
    epochs: int = DEFAULT_EPOCHS,
    margin: float = DEFAULT_MARGIN,
) -> Dict:
    """
    Train the pairwise ranker model.

    Args:
        dataset: Training dataset
        output_dir: Directory to save model artifacts
        model_name: Name of the model
        hidden_dim: Hidden layer dimension
        learning_rate: Learning rate
        batch_size: Batch size
        epochs: Number of training epochs
        margin: Margin for ranking loss

    Returns:
        Training metadata
    """
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    # Determine input dimension from dataset
    input_dim = dataset[0][0].shape[0] if len(dataset) > 0 else DEFAULT_EMBEDDING_DIM

    # Initialize model
    model = PairwiseRanker(input_dim, hidden_dim)

    # Use margin ranking loss
    criterion = nn.MarginRankingLoss(margin=margin)

    # Use Adam optimizer
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)

    # Create data loader
    data_loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    # Training metadata
    metadata = {
        "model_name": model_name,
        "input_dim": input_dim,
        "hidden_dim": hidden_dim,
        "learning_rate": learning_rate,
        "batch_size": batch_size,
        "epochs": epochs,
        "margin": margin,
        "dataset_size": len(dataset),
        "training_time": 0,
        "loss_history": [],
    }

    # Training loop
    print(f"Training model {model_name} with {len(dataset)} samples...")

    start_time = time.time()

    for epoch in range(epochs):
        epoch_loss = 0.0

        for batch_features_a, batch_features_b, batch_labels in tqdm(
            data_loader, desc=f"Epoch {epoch + 1}/{epochs}"
        ):
            # Convert labels to target for margin ranking loss
            # For margin ranking loss, target should be 1 if item_a > item_b, -1 otherwise
            targets = torch.where(
                batch_labels > 0,
                torch.ones_like(batch_labels),
                torch.ones_like(batch_labels) * -1,
            )

            # Forward pass
            outputs = model(batch_features_a, batch_features_b)

            # Calculate loss
            loss = criterion(outputs, targets, torch.ones_like(targets))

            # Backward pass and optimize
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()

        # Average loss for the epoch
        avg_loss = epoch_loss / len(data_loader)
        metadata["loss_history"].append(avg_loss)

        print(f"Epoch {epoch + 1}/{epochs} - Loss: {avg_loss:.4f}")

    # Calculate training time
    metadata["training_time"] = time.time() - start_time

    # Save model
    model_path = os.path.join(output_dir, f"{model_name}.pth")
    torch.save(model.state_dict(), model_path)

    # Export to ONNX
    onnx_path = os.path.join(output_dir, f"{model_name}.onnx")

    # Create dummy input for ONNX export
    dummy_input_a = torch.randn(1, input_dim)
    dummy_input_b = torch.randn(1, input_dim)

    # Export model
    torch.onnx.export(
        model,
        (dummy_input_a, dummy_input_b),
        onnx_path,
        export_params=True,
        opset_version=13,
        do_constant_folding=True,
        input_names=["input_a", "input_b"],
        output_names=["score_diff"],
        dynamic_axes={
            "input_a": {0: "batch_size"},
            "input_b": {0: "batch_size"},
            "score_diff": {0: "batch_size"},
        },
    )

    # Save metadata
    metadata_path = os.path.join(output_dir, f"{model_name}_metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nTraining complete!")
    print(f"Model saved to: {model_path}")
    print(f"ONNX model saved to: {onnx_path}")
    print(f"Metadata saved to: {metadata_path}")
    print(f"Training time: {metadata['training_time']:.2f} seconds")
    print(f"Final loss: {metadata['loss_history'][-1]:.4f}")

    return metadata


def main():
    """
    Main function to parse arguments and run training.
    """
    parser = argparse.ArgumentParser(description="Train pairwise ranker model")

    parser.add_argument(
        "--input", type=str, required=True, help="Input JSONL dataset file"
    )
    parser.add_argument(
        "--output", type=str, required=True, help="Output directory for model artifacts"
    )
    parser.add_argument(
        "--name", type=str, default=DEFAULT_MODEL_NAME, help="Model name"
    )
    parser.add_argument(
        "--embedding-dim",
        type=int,
        default=DEFAULT_EMBEDDING_DIM,
        help="Embedding dimension",
    )
    parser.add_argument(
        "--hidden-dim",
        type=int,
        default=DEFAULT_HIDDEN_DIM,
        help="Hidden layer dimension",
    )
    parser.add_argument(
        "--learning-rate",
        type=float,
        default=DEFAULT_LEARNING_RATE,
        help="Learning rate",
    )
    parser.add_argument(
        "--batch-size", type=int, default=DEFAULT_BATCH_SIZE, help="Batch size"
    )
    parser.add_argument(
        "--epochs", type=int, default=DEFAULT_EPOCHS, help="Number of epochs"
    )
    parser.add_argument(
        "--margin", type=float, default=DEFAULT_MARGIN, help="Margin for ranking loss"
    )

    args = parser.parse_args()

    print(f"Pairwise Ranker Training")
    print(f"========================")
    print(f"Input: {args.input}")
    print(f"Output: {args.output}")
    print(f"Model: {args.name}")
    print(f"Embedding Dim: {args.embedding_dim}")
    print(f"Hidden Dim: {args.hidden_dim}")
    print(f"Learning Rate: {args.learning_rate}")
    print(f"Batch Size: {args.batch_size}")
    print(f"Epochs: {args.epochs}")
    print(f"Margin: {args.margin}")
    print()

    # Load dataset
    print("Loading dataset...")
    data = load_dataset(args.input)
    print(f"Loaded {len(data)} rows from dataset")

    if len(data) == 0:
        print("Error: No valid data in dataset")
        return

    # Create dataset
    print("Creating dataset...")
    dataset = PairwiseRankingDataset(data, args.embedding_dim)
    print(f"Created dataset with {len(dataset)} valid samples")

    if len(dataset) == 0:
        print("Error: No valid samples after processing")
        return

    # Train model
    print("Training model...")
    metadata = train_model(
        dataset,
        args.output,
        args.name,
        args.hidden_dim,
        args.learning_rate,
        args.batch_size,
        args.epochs,
        args.margin,
    )

    print("\nTraining completed successfully!")


if __name__ == "__main__":
    main()
