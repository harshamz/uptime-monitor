import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Uptime Monitor',
  description: 'Monitor your websites for downtime, SSL issues, and more.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
