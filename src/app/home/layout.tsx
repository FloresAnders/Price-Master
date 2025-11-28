// app/home/layout.tsx
export const metadata = {
  title: 'Home - Time Master',
  description: 'Acceso especial a Time Master',
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  // Este layout simplemente pasa el children
  // El layout principal maneja el HTML/body/ThemeProvider
  // AuthWrapper detecta /home como ruta pública y no muestra login
  return <>{children}</>;
}
