import type { Metadata, Viewport } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gorilla Simulator — 1 gorila vs. 1000 homens",
  description:
    "Quantos homens são necessários para derrotar um gorila? Simule a batalha em 3D, com física em tempo real, direto no navegador.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // Pinch-zoom da página brigaria com os gestos da câmera 3D
  userScalable: false,
  themeColor: "#0c0a14",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} overflow-hidden overscroll-none bg-black antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
