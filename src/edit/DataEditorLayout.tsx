import Footer from '../components/layout/Footer';

export default function DataEditorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-[var(--background)]">
      <main className="flex-1 w-full max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-2 sm:p-4 md:p-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
