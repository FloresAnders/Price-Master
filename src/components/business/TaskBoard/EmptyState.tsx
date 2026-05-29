"use client";

import { Layout, Plus } from "lucide-react";

type Props = {
  onCreateBoard: () => void;
};

export default function EmptyState({ onCreateBoard }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5">
        <Layout className="w-7 h-7 text-cyan-400" />
      </div>
      <h2 className="text-lg font-semibold text-white/80 mb-2">
        No hay tableros aún
      </h2>
      <p className="text-sm text-white/40 max-w-sm mb-6">
        Crea tu primer tablero para empezar a organizar tus tareas con el equipo.
      </p>
      <button
        onClick={onCreateBoard}
        className="flex items-center gap-2 px-4 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30
          text-cyan-300 rounded-xl text-sm font-medium transition-all
          border border-cyan-500/25 hover:border-cyan-500/40
          shadow-[0_0_20px_rgba(6,182,212,0.1)]"
      >
        <Plus className="w-4 h-4" />
        Crear tablero
      </button>
    </div>
  );
}
