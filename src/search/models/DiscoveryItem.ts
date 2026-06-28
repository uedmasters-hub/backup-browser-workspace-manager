export interface DiscoveryItem {
  id: string;

  title: string;

  subtitle?: string;

  icon?: string;

  badge?: string;

  action: () => void;
}