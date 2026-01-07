import { EmbeddingProvider, EmbeddingInput, EmbeddingOutput } from './provider';

export class StubEmbeddingProvider implements EmbeddingProvider {
  private model: string;
  private dimensions: number;

  constructor(model: string = 'stub-embedding-model', dimensions: number = 1536) {
    this.model = model;
    this.dimensions = dimensions;
  }

  async embed(input: EmbeddingInput): Promise<EmbeddingOutput> {
    // Generate deterministic mock embeddings based on text content
    const embeddings = input.texts.map(text => {
      // Simple hash-based embedding for determinism
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        hash = (hash << 5) - hash + text.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
      }

      // Generate embedding based on hash
      return Array.from({ length: this.dimensions }, (_, i) => {
        // Use hash to create semi-deterministic values
        return (Math.sin(hash + i) * 0.5 + 0.5) * 2 - 1; // Range: [-1, 1]
      });
    });

    return {
      embeddings,
      model: this.model,
      dimensions: this.dimensions,
      usage: {
        prompt_tokens: input.texts.reduce((sum, text) => sum + text.length, 0),
        total_tokens: input.texts.reduce((sum, text) => sum + text.length, 0)
      }
    };
  }

  getModel(): string {
    return this.model;
  }

  getDimensions(): number {
    return this.dimensions;
  }

  isAvailable(): boolean {
    return true; // Stub provider is always available
  }
}