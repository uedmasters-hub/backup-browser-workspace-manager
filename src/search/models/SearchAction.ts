export interface SearchAction {
  id: string;

  label: string;

  icon?: string;

  primary?: boolean;

  run: () => void | Promise<void>;
}