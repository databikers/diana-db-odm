type NUmberOrString = string | number;

export type ProjectQueryItem = {
  $max?: NUmberOrString;
  $min?: NUmberOrString;
  $avg?: NUmberOrString;
  $subtract?: NUmberOrString[];
  $divide?: NUmberOrString[];
  $multiply?: NUmberOrString[];
  $ifNull?: NUmberOrString[];
  $push?: NUmberOrString;
  $addToSet?: NUmberOrString[];
  $concatArray?: string;
  $first?: string;
  $last?: string;
  $concat?: {
    delimiter: string;
    parts: string[];
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
