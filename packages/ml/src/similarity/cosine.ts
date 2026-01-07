export class CosineSimilarity {
  /**
   * Calculate cosine similarity between two vectors
   * @param vectorA First vector
   * @param vectorB Second vector
   * @returns Cosine similarity score between -1 and 1
   */
  static calculate(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      throw new Error('Vectors must have the same dimension');
    }

    if (vectorA.length === 0 || vectorB.length === 0) {
      return 0;
    }

    // Calculate dot product
    const dotProduct = vectorA.reduce((sum, val, i) => sum + val * vectorB[i], 0);

    // Calculate magnitudes
    const magnitudeA = Math.sqrt(vectorA.reduce((sum, val) => sum + val * val, 0));
    const magnitudeB = Math.sqrt(vectorB.reduce((sum, val) => sum + val * val, 0));

    // Avoid division by zero
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    // Cosine similarity = dot product / (magnitude A * magnitude B)
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Find top-k most similar vectors to a query vector
   * @param queryVector Query vector
   * @param vectors Array of vectors to search
   * @param k Number of top results to return
   * @returns Array of { index, similarity } sorted by similarity (descending)
   */
  static topKSimilarity(
    queryVector: number[],
    vectors: number[][],
    k: number = 5
  ): Array<{ index: number; similarity: number }> {
    if (vectors.length === 0) {
      return [];
    }

    if (queryVector.length !== vectors[0].length) {
      throw new Error('Query vector dimension does not match target vectors');
    }

    // Calculate similarities
    const similarities = vectors.map((vector, index) => ({
      index,
      similarity: this.calculate(queryVector, vector)
    }));

    // Sort by similarity (descending)
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Return top k
    return similarities.slice(0, k);
  }

  /**
   * Normalize a vector to unit length
   * @param vector Vector to normalize
   * @returns Normalized vector
   */
  static normalize(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) {
      return vector.map(() => 0);
    }
    return vector.map(val => val / magnitude);
  }

  /**
   * Calculate average vector from multiple vectors
   * @param vectors Array of vectors
   * @returns Average vector
   */
  static average(vectors: number[][]): number[] {
    if (vectors.length === 0) {
      return [];
    }

    const dimension = vectors[0].length;
    const sum = Array.from({ length: dimension }, () => 0);

    vectors.forEach(vector => {
      if (vector.length !== dimension) {
        throw new Error('All vectors must have the same dimension');
      }
      vector.forEach((val, i) => {
        sum[i] += val;
      });
    });

    return sum.map(val => val / vectors.length);
  }
}