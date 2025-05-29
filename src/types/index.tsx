export type ActiveTab = 'scanner' | 'calculator' | 'converter' | 'history';

export interface TabConfig {
  id: ActiveTab;
  name: string;
  icon: string;
  description: string;
  badge?: number | string;
}