"use client";

import { motion } from "framer-motion";
import { XCircle } from "lucide-react";

export function BaseModal({ isOpen, onClose, title, children }: {
  isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }} transition={{ type: "spring", damping: 30, stiffness: 260 }}
        className="bg-[#0d1117] rounded-2xl shadow-2xl border border-white/10 w-full max-w-[24rem] p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/20 hover:text-white/50 transition-colors" aria-label="Cerrar">
          <XCircle className="w-5 h-5" />
        </button>
        <h2 className="text-center font-semibold mb-4 text-white/80 text-base">{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  );
}
