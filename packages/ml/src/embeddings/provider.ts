import { z } from 'zod';

export const EmbeddingInputSchema = z.object({
  texts: z.array(z.string()),
  model: z.string().optional(),
  dimensions: z.number().optional(),
});

export type EmbeddingInput = z.infer<typeof EmbeddingInputSchema>;

export const EmbeddingOutputSchema = z.object({
  embeddings: z.array(z.array(z.number())),
  model: z.string(),
  dimensions: z.number(),
  usage: z.object({
    prompt_tokens: z.number(),
    total_tokens: z.number(),
  }).optional(),
});

export type EmbeddingOutput = z.infer<typeof EmbeddingOutputSchema>;

export interface EmbeddingProvider {
  embed(input: EmbeddingInput): Promise<EmbeddingOutput>;
  getModel(): string;
  getDimensions(): number;
  isAvailable(): boolean;
}

export class EmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmbeddingError';
  }
}