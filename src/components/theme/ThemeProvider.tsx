'use client';

import { useEffect } from 'react';
import { useThemeStore } from '@/store/useThemeStore';

/** Aplica el tema guardado / del sistema tras montar (el script inline evita el flash). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useThemeStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return children;
}
