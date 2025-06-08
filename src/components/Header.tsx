'use client'

import { ThemeToggle } from './ThemeToggle';

export default function Header() {
  return (
    <header className="w-full flex items-center justify-between p-4 border-b border-[var(--input-border)] bg-[var(--card-bg)]">
      <span className="text-xl font-bold tracking-tight text-[var(--foreground)]">Price Master</span>
      <ThemeToggle />
    </header>
  );
}
