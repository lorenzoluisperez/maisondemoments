import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Maison de Moments · Interactive Invitation Atelier",
  description: "Original artwork and thoughtful interactions, composed into premium digital invitations.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
