import type { ReactNode } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export type ThemeMode = 'light' | 'dark' | 'auto';

export function ThemeToggle({ theme, onChange }: { theme: ThemeMode; onChange: (mode: ThemeMode) => void }) {
  const btn = (mode: ThemeMode, icon: ReactNode, label: string) => (
    <button
      type="button"
      onClick={() => onChange(mode)}
      title={label}
      aria-label={label}
      className={`p-1.5 rounded transition-colors ${
        theme === mode ? 'bg-[#C8102E] text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
      {btn('light', <Sun size={16} />, 'Light mode')}
      {btn('dark', <Moon size={16} />, 'Dark mode')}
      {btn('auto', <Monitor size={16} />, 'Auto (system)')}
    </div>
  );
}
