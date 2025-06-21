export interface Migration {
  name: string;
  index: number;
  up: () => Promise<void>;
  down: () => Promise<void>;
}
