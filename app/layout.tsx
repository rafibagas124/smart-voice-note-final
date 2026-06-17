import './globals.css';

export const metadata = {
  title: 'Smart Voice Note',
  description: 'Aplikasi Catatan Suara Pintar',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}