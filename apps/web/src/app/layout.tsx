import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Amplyra AI — Your Marketing Team. Powered by AI. Amplified by Creators.',
  description:
    'AI-powered Marketing Operating System and Creator Collaboration Marketplace for businesses and creators across Nigeria, Africa, and beyond.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
