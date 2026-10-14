'use client';

import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/store/useThemeStore';

type Props = {
  className?: string;
  /** Variante compacta para topbar */
  size?: 'sm' | 'md';
};

export function ThemeToggle({ className = '', size = 'md' }: Props) {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === 'dark';
  const iconSize = size === 'sm' ? 16 : 18;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={`inline-flex items-center justify-center rounded-md text-slate-400 hover:text-primary hover:bg-slate-100 transition-colors ${
        size === 'sm' ? 'p-1.5' : 'p-2'
      } ${className}`}
    >
      {isDark ? <Sun size={iconSize} /> : <Moon size={iconSize} />}
    </button>
  );
}
