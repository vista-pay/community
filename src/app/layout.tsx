import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/providers/toast-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'Rendi Community Portal',
    template: '%s · Rendi Community Portal',
  },
  description:
    'Run your cooperative or association on Rendi: members, contributions, Ajo, loans, savings, books and governance.',
};

/**
 * `suppressHydrationWarning` on both the html and body elements.
 *
 * Browser extensions write their own attributes onto these two before React
 * hydrates — a password manager, an accounting add-on stamping
 * `data-qb-installed`, a theme switcher — and React then reports a mismatch
 * it cannot patch up. Nothing is actually wrong with the markup, and no code
 * change here can stop an extension touching the document.
 *
 * The suppression is deliberately limited to these two elements and does not
 * descend into the tree, so a real mismatch inside the app is still reported.
 * `<body>` already carried it; `<html>` is where the attributes in question
 * actually land.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full font-sans antialiased" suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
