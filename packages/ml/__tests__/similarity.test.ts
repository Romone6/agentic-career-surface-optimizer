import { CosineSimilarity } from '../src/similarity/cosine';

describe('Cosine Similarity', () => {
  test('calculate returns correct similarity for identical vectors', () => {
    const vector = [1, 2, 3];
    const similarity = CosineSimilarity.calculate(vector, vector);
    expect(similarity).toBe(1);
  });

  test('calculate returns correct similarity for orthogonal vectors', () => {
    const vectorA = [1, 0, 0];
    const vectorB = [0, 1, 0];
    const similarity = CosineSimilarity.calculate(vectorA, vectorB);
    expect(similarity).toBe(0);
  });

  test('calculate returns correct similarity for opposite vectors', () => {
    const vectorA = [1, 2, 3];
    const vectorB = [-1, -2, -3];
    const similarity = CosineSimilarity.calculate(vectorA, vectorB);
    expect(similarity).toBe(-1);
  });

  test('topKSimilarity returns correct top results', () => {
    const query = [1, 0, 0];
    const vectors = [
      [1, 0, 0], // Similarity: 1
      [0, 1, 0], // Similarity: 0
      [0, 0, 1], // Similarity: 0
      [0.5, 0.5, 0] // Similarity: ~0.707
    ];

    const results = CosineSimilarity.topKSimilarity(query, vectors, 2);
    expect(results.length).toBe(2);
    expect(results[0].similarity).toBe(1);
    expect(results[0].index).toBe(0);
    expect(results[1].similarity).toBeCloseTo(0.707, 2);
    expect(results[1].index).toBe(3);
  });

  test('normalize creates unit vector', () => {
    const vector = [3, 4, 0];
    const normalized = CosineSimilarity.normalize(vector);
    const magnitude = Math.sqrt(normalized.reduce((sum, val) => sum + val * val, 0));

    expect(magnitude).toBeCloseTo(1, 6);
  });

  test('average calculates correct average', () => {
    const vectors = [
      [1, 2, 3],
      [3, 4, 5],
      [5, 6, 7]
    ];

    const average = CosineSimilarity.average(vectors);
    expect(average).toEqual([3, 4, 5]);
  });

  test('calculate throws error for different dimensions', () => {
    const vectorA = [1, 2, 3];
    const vectorB = [1, 2];
    
    expect(() => {
      CosineSimilarity.calculate(vectorA, vectorB);
    }).toThrow('Vectors must have the same dimension');
  });

  test('topKSimilarity throws error for dimension mismatch', () => {
    const query = [1, 2, 3];
    const vectors = [
      [1, 2], // Different dimension
      [1, 2, 3]
    ];
    
    expect(() => {
      CosineSimilarity.topKSimilarity(query, vectors);
    }).toThrow('Query vector dimension does not match target vectors');
  });

  test('average throws error for different dimensions', () => {
    const vectors = [
      [1, 2, 3],
      [1, 2] // Different dimension
    ];
    
    expect(() => {
      CosineSimilarity.average(vectors);
    }).toThrow('All vectors must have the same dimension');
  });
});