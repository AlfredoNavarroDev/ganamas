import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AmbientBackground } from "@/components/ambient-background";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ganamas",
  description:
    "Registro rápido de ventas y compras, con corte semanal y alertas de stock bajo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AmbientBackground />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
