/** Keys of the documents, `_id` included, each ascending (1) or descending (-1). */
export type Sorting<T> = Partial<Record<keyof T | '_id', -1 | 1>>;
