import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "QuickDine | Exceptional tables. Unforgettable evenings.",
  description:
    "Discover remarkable restaurants, find live table availability, and reserve your next extraordinary dining experience.",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
