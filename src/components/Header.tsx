'use client'

import Image from 'next/image';
import { ThemeToggle } from './ThemeToggle';
import { Menu } from 'lucide-react';
import React from 'react';

interface Tab {
  id: string;
  name: string;
  icon: React.ElementType;
}

interface HeaderProps {
  tabs?: Tab[];
  activeTab?: string | null;
  setActiveTab?: (tab: string) => void;
  mobileTabsOpen?: boolean;
  setMobileTabsOpen?: (open: boolean) => void;
}

export default function Header({ tabs, activeTab, setActiveTab, mobileTabsOpen, setMobileTabsOpen }: HeaderProps) {
  const handleLogoClick = () => {
    // Navega al HomeMenu (quita el hash)
    window.location.hash = '';
  };

  return (
    <header className="w-full flex flex-col gap-2 items-center justify-between p-4 border-b border-[var(--input-border)] bg-transparent backdrop-blur-sm">
      <div className="w-full flex items-center justify-between">
        <button
          onClick={handleLogoClick}
          className="flex items-center gap-2 text-xl font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--tab-text-active)] transition-colors cursor-pointer bg-transparent border-none p-0"
        >
          <Image src="/favicon.ico" alt="Logo" width={28} height={28} className="inline-block align-middle" />
          Price Master
        </button>
        <ThemeToggle />
      </div>
      {/* Tabs solo si no está en HomeMenu y hay tabs */}
      {tabs && activeTab && setActiveTab && (
        <nav className="w-full">
          {/* Menú hamburguesa solo en móvil */}
          <div className="sm:hidden flex items-center justify-between mb-2">
            <button
              className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--tab-text-active)]"
              onClick={() => setMobileTabsOpen && setMobileTabsOpen(!mobileTabsOpen)}
              aria-label="Abrir menú de pestañas"
            >
              <Menu className="w-7 h-7 text-[var(--tab-text-active)]" />
            </button>
            <span className="text-lg font-bold text-[var(--tab-text-active)]">
              {tabs.find(t => t.id === activeTab)?.name}
            </span>
          </div>
          {/* Tabs verticales en móvil, horizontales en desktop */}
          <div className={`sm:flex -mb-px ${mobileTabsOpen ? '' : 'hidden'} sm:space-x-8 flex-col sm:flex-row space-y-2 sm:space-y-0 mt-2 sm:mt-0`}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); if (setMobileTabsOpen) setMobileTabsOpen(false); }}
                className={`group relative py-3 px-2 text-center text-sm font-medium transition-colors flex items-center justify-center
                  ${activeTab === tab.id
                    ? 'text-[var(--tab-text-active)] border-b-2 border-[var(--tab-border-active)] sm:border-b-2'
                    : 'text-[var(--tab-text)] border-b-2 border-[var(--tab-border)] hover:text-[var(--tab-hover-text)] sm:border-b-2'
                  } ${mobileTabsOpen ? 'w-full' : ''}`}
              >
                <tab.icon className="w-5 h-5 mr-2" />
                <span>{tab.name}</span>
              </button>
            ))}
          </div>
          <div className="hidden sm:flex -mb-px space-x-8">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative flex-1 py-4 px-1 text-center text-sm font-medium transition-colors
                  ${activeTab === tab.id
                    ? 'text-[var(--tab-text-active)] border-b-2 border-[var(--tab-border-active)]'
                    : 'text-[var(--tab-text)] border-b-2 border-[var(--tab-border)] hover:text-[var(--tab-hover-text)]'
                  }`}
              >
                <div className="flex items-center justify-center space-x-2">
                  <tab.icon className="w-5 h-5" />
                  <span className="hidden sm:inline">{tab.name}</span>
                </div>
              </button>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
