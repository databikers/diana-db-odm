export type VectorMetric = 'euclidean' | 'cosine' | 'dot';

export type VectorNeighborsQuery = {
  vector: number[];
  /** How many nearest documents to return (default 10). */
  count?: number;
  /** euclidean (default): straight-line distance; cosine: 1 - cosine similarity; dot: highest dot product first. */
  metric?: VectorMetric;
  /** Only documents at most this far away (euclidean and cosine). */
  maxDistance?: number;
};

export type VectorDirectionQuery = {
  vector: number[];
  /** Cosine similarity from -1 (opposite) to 1 (same direction); documents at least this similar match. */
  minSimilarity: number;
  /** Keep only the most similar documents. */
  count?: number;
};

export type VectorFindQuery = {
  $neighbors?: VectorNeighborsQuery;
  $direction?: VectorDirectionQuery;
};
