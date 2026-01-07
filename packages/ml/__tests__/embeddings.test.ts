import { StubEmbeddingProvider } from '../src/embeddings/stub';
import { EmbeddingInputSchema } from '../src/embeddings/provider';

describe('Embedding Providers', () => {
  test('StubEmbeddingProvider generates deterministic embeddings', async () => {
    const provider = new StubEmbeddingProvider('test-model', 128);

    const input: EmbeddingInput = {
      texts: ['Hello world', 'Goodbye world'],
      model: 'test-model'
    };

    const result1 = await provider.embed(input);
    const result2 = await provider.embed(input);

    // Should be deterministic
    expect(result1.embeddings[0]).toEqual(result2.embeddings[0]);
    expect(result1.embeddings[1]).toEqual(result2.embeddings[1]);

    // Should have correct dimensions
    expect(result1.embeddings[0].length).toBe(128);
    expect(result1.embeddings[1].length).toBe(128);

    // Should have correct model info
    expect(result1.model).toBe('test-model');
    expect(result1.dimensions).toBe(128);
  });

  test('EmbeddingInputSchema validates correctly', () => {
    const validInput = {
      texts: ['test1', 'test2'],
      model: 'test-model',
      dimensions: 128
    };

    const result = EmbeddingInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test('StubEmbeddingProvider is always available', () => {
    const provider = new StubEmbeddingProvider();
    expect(provider.isAvailable()).toBe(true);
  });

  test('StubEmbeddingProvider returns correct model info', () => {
    const provider = new StubEmbeddingProvider('custom-model', 256);
    expect(provider.getModel()).toBe('custom-model');
    expect(provider.getDimensions()).toBe(256);
  });
});