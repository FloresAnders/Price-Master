'use client'

import { ThemeToggle } from './ThemeToggle';

export default function Header() {
  const handleLogoClick = () => {
    // Forzar navegación y cambio de hash
    window.location.href = '/#scanner';
  };

  return (
    <header className="w-full flex items-center justify-between p-4 border-b border-[var(--input-border)] bg-[var(--card-bg)]">
      <button
        onClick={handleLogoClick}
        className="text-xl font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--tab-text-active)] transition-colors cursor-pointer bg-transparent border-none p-0"
      >
        Price Master
      </button>
      <ThemeToggle />
    </header>
  );
}
