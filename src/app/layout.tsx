import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "@/styles/globals.css";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-nunito",
});

export const metadata: Metadata = {
  title: "Duobingo",
  description: "Learn languages with playful lessons and immersive 3D worlds",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={nunito.variable}>{children}</body>
    </html>
  );
}
