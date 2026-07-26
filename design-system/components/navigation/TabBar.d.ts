export interface TabBarTab { value: string; label: string; }
export interface TabBarProps {
  tabs: TabBarTab[];
  active: string;
  onChange?: (value: string) => void;
}
