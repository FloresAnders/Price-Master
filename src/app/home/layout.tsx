// app/home/layout.tsx
export const metadata = {
  title: 'Home - Price Master',
  description: 'Acceso especial a Price Master',
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  // Este layout simplemente pasa el children
  // El layout principal maneja el HTML/body/ThemeProvider
  // AuthWrapper detecta /home como ruta pública y no muestra login
  return <>{children}</>;
}
