import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fondo General | Time Master",
};

export default function FondoGeneralLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
