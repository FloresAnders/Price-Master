// app/home/layout.tsx
export const metadata = {
  title: "Time Master",
  description: "Redirección al inicio de Time Master",
};

export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
