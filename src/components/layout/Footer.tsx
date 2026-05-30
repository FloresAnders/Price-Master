"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useVersion } from "../../hooks/useVersion";
import delikorLogo from "../../../public/Logos/delikor.png";
import tmLogo from "../../../public/Logos/LogoBlanco2.png";

const socialButtonClass =
  "flex h-11 w-11 items-center justify-center rounded-xl border border-black/10 bg-black/5 text-[var(--foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:border-black/20 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20 dark:hover:bg-white/10";

export default function Footer() {
  const { version, isLocalNewer } = useVersion();
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(
    "Time Master",
  )}`;

  useEffect(() => {
    if (!isGitHubModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsGitHubModalOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isGitHubModalOpen]);

  return (
    <footer className="w-full mt-auto px-4 pb-6 sm:pb-8 lg:pl-[var(--admin-sidebar-width)] transition-[padding] duration-300">
      <div className="mx-auto w-full max-w-7xl">
        <div className="relative overflow-hidden rounded-3xl border border-black/10 bg-white/80 text-[var(--foreground)] shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-md dark:border-white/10 dark:bg-[#0b0f17]/80 dark:shadow-[0_25px_70px_rgba(0,0,0,0.6)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_85%_120%,rgba(124,58,237,0.35)_0%,transparent_60%)] opacity-70" />
          <div className="relative flex flex-col gap-6 px-6 py-6 sm:px-8 sm:py-7 md:flex-row md:items-center md:gap-8">
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left md:flex-1">
              <div className="flex items-center gap-4">
                <Image
                  src={tmLogo}
                  alt="Time Master"
                  width={64}
                  height={64}
                  className="h-12 w-auto object-contain"
                />
                <span className="hidden sm:block h-10 w-px bg-black/10 dark:bg-white/10" />
              </div>
              <p className="text-sm text-[var(--muted-foreground)] dark:text-white/70 max-w-[260px]">
                Soluciones inteligentes para optimizar y simplificar tu empresa.
              </p>
            </div>

            <div
              className="hidden md:block h-12 w-px bg-black/10 dark:bg-white/10"
              aria-hidden="true"
            />

            <div className="flex items-center justify-center gap-3 md:flex-none">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className={socialButtonClass}
                aria-label="Visitar nuestra página de Facebook"
              >
                <svg
                  className="h-5 w-5 fill-current"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M18 2h-3a5 5 0 00-5 5v3H6v4h4v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                </svg>
              </a>
              <button
                type="button"
                aria-label="GitHub"
                onClick={() => setIsGitHubModalOpen(true)}
                className={socialButtonClass}
              >
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.021c0 4.428 2.865 8.186 6.839 9.504.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.157-1.11-1.465-1.11-1.465-.908-.62.069-.608.069-.608 1.004.07 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.091-.647.35-1.088.636-1.339-2.221-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.295 2.748-1.025 2.748-1.025.546 1.378.202 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.847-2.337 4.695-4.566 4.944.359.309.678.919.678 1.852 0 1.336-.012 2.417-.012 2.747 0 .267.18.577.688.48C19.138 20.203 22 16.447 22 12.021 22 6.484 17.523 2 12 2z" />
                </svg>
              </button>
              <a
                href={googleSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={socialButtonClass}
                aria-label="Buscar Time Master en Google"
              >
                <svg
                  className="h-5 w-5 fill-current"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M21.8 10.02h-9.18v3.96h5.27c-.23 1.22-1.36 3.59-5.27 3.59-3.18 0-5.76-2.63-5.76-5.87s2.58-5.87 5.76-5.87c1.81 0 3.02.72 3.72 1.35l2.54-2.46C16.29 3.13 14.37 2 12 2 6.48 2 2 6.48 2 12s4.48 10 10 10c5.52 0 10-4.48 10-10 0-.68-.07-1.36-.2-1.98z" />
                </svg>
              </a>
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                className={socialButtonClass}
                aria-label="Visitar nuestro canal de YouTube"
              >
                <svg
                  className="h-5 w-5 fill-current"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.95C18.88 4 12 4 12 4s-6.88 0-8.59.47A2.78 2.78 0 001.46 6.42C1 8.13 1 12 1 12s0 3.87.46 5.58a2.78 2.78 0 001.95 1.95C5.12 20 12 20 12 20s6.88 0 8.59-.47a2.78 2.78 0 001.95-1.95C23 15.87 23 12 23 12s0-3.87-.46-5.58zM10 15.5V8.5l6 3.5-6 3.5z" />
                </svg>
              </a>
            </div>

            <div
              className="hidden md:block h-12 w-px bg-black/10 dark:bg-white/10"
              aria-hidden="true"
            />

            <div className="flex flex-col items-center gap-4 text-center md:flex-1 md:flex-row md:items-center md:justify-end md:text-right">
              <div>
                <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-[var(--foreground)] md:justify-end">
                  <span>
                    © {new Date().getFullYear()}{" "}
                    <span className="font-semibold">Time Master</span>
                  </span>
                  <span className="hidden sm:inline text-[var(--muted-foreground)]">
                    |
                  </span>
                  <span className="rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-[var(--foreground)] dark:border-white/10 dark:bg-white/10">
                    v{version}
                  </span>
                  {isLocalNewer && (
                    <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-300/40 dark:bg-amber-400/20 dark:text-amber-300">
                      PENDIENTE
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Todos los derechos reservados.
                </p>
              </div>

              <div
                className="hidden md:block h-10 w-px bg-black/10 dark:bg-white/10"
                aria-hidden="true"
              />

              <div className="flex flex-col items-center">
                <span className="text-[11px] text-[var(--muted-foreground)]">
                  Sponsored by
                </span>
                <Image
                  src={delikorLogo}
                  alt="Delikor"
                  width={140}
                  height={36}
                  sizes="(min-width: 640px) 180px, 140px"
                  className="h-7 sm:h-9 w-auto object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {isGitHubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-3 sm:px-0 backdrop-blur-sm">
          <div className="bg-[var(--card-bg)] border-2 border-[var(--input-border)] rounded-xl shadow-2xl p-4 sm:p-6 max-w-md w-full relative animate-fade-in mx-2 sm:mx-auto">
            <button
              className="absolute top-2 right-2 text-[var(--tab-text)] hover:text-[var(--tab-hover-text)] text-2xl font-bold focus:outline-none"
              onClick={() => setIsGitHubModalOpen(false)}
              aria-label="Cerrar"
            >
              ×
            </button>
            <div className="flex flex-col items-center gap-4 pt-2">
              <div className="inline-flex items-center rounded-full border-2 border-[var(--input-border)] bg-[var(--muted)] px-3 py-1 text-xs font-semibold tracking-wide text-[var(--foreground)]">
                Equipo
              </div>
              <h2 className="text-xl font-bold text-[var(--foreground)] mb-1 text-center">
                Equipo de Desarrollo
              </h2>
              <p className="text-[var(--tab-text)] mb-6 text-center text-sm leading-relaxed">
                Conoce más sobre los desarrolladores del proyecto
              </p>
            </div>
            <div className="space-y-4">
              <a
                href="https://github.com/alchacas1"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-3 rounded-xl border-2 border-[var(--input-border)] bg-[var(--card-bg)] p-3 shadow-sm cursor-pointer"
                onClick={() => setIsGitHubModalOpen(false)}
              >
                <svg
                  className="w-5 h-5 text-[var(--foreground)]"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-[var(--foreground)] font-medium">
                  Alvaro Chaves C
                </span>
              </a>
              <a
                href="https://github.com/FloresAnders/Price-Master"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center space-x-3 rounded-xl border-2 border-[var(--input-border)] bg-[var(--card-bg)] p-3 shadow-sm cursor-pointer"
                onClick={() => setIsGitHubModalOpen(false)}
              >
                <svg
                  className="w-5 h-5 text-[var(--foreground)]"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-[var(--foreground)] font-medium">
                  Anders Flores M
                </span>
              </a>
              <button
                onClick={() => setIsGitHubModalOpen(false)}
                className="w-full rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] py-2 px-4 font-medium text-[var(--foreground)] transition-all duration-200 hover:border-cyan-500 hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
