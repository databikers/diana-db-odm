type NotObject = string | number;

export type ProjectQueryItem = {
  $sum?: NotObject[];
  $subtract?: NotObject[];
  $divide?: NotObject[];
  $multiply?: NotObject[];
  $ifNull?: NotObject[];
  $push?: NotObject;
  $addToSet?: NotObject[];
  $concatArray?: string;
  $first?: string;
  $concatString?: {
    delimiter: string;
    localField: string;
  };
  $year?: string;
  $month?: string;
  $date?: string;
  $hours?: string;
  $minutes?: string;
  $seconds?: string;
  $dayOfWeek?: string;
  $dayOfYear?: string;
  $timestamp?: string;
  $round?: number;
};

export type ProjectQuery<T> =
  | Partial<Record<keyof T, T[keyof T] | ProjectQueryItem>>
  | Record<string, ProjectQueryItem>;
