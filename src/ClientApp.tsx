'use client';

import App from '@/App';
import { ThemeProvider } from '@/components/theme/ThemeProvider';

export default function ClientApp() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}
