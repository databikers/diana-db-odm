export type StringUpdateQuery = {
  $concat: {
    delimiter: string;
    parts: string[];
  };
  $replace: string[];
};
