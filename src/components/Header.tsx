'use client'

import Image from 'next/image';
import { ThemeToggle } from './ThemeToggle';

export default function Header() {
  const handleLogoClick = () => {
    // Navega al HomeMenu (quita el hash)
    window.location.hash = '';
  };

  return (
    <header className="w-full flex items-center justify-between p-4 border-b border-[var(--input-border)] bg-[var(--card-bg)]">
      <button
        onClick={handleLogoClick}
        className="flex items-center gap-2 text-xl font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--tab-text-active)] transition-colors cursor-pointer bg-transparent border-none p-0"
      >
        <Image src="/favicon.ico" alt="Logo" width={28} height={28} className="inline-block align-middle" />
        Price Master
      </button>
      <ThemeToggle />
    </header>
  );
}
