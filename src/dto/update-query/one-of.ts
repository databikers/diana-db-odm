/** Exactly one of the properties of T: an update names one operator per field. */
export type OneOf<T> = {
  [K in keyof T]: { [P in K]: T[K] } & { [P in Exclude<keyof T, K>]?: never };
}[keyof T];
