import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PokéGrade MVP",
  description: "Upload Pokémon card images to get a pre-grade estimate"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
