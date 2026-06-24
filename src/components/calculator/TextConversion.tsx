"use client";
import React, { useState } from "react";
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ClipboardPaste,
  Copy,
  Lock as LockIcon,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { hasPermission } from "../../utils/permissions";

export default function TextConversion() {
  /* Verificar permisos del usuario */
  const { user } = useAuth();

  const [text, setText] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  const readClipboardText = async (): Promise<string | null> => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        return await navigator.clipboard.readText();
      }
      return null;
    } catch (error) {
      console.error("Error reading from clipboard:", error);
      return null;
    }
  };

  const copyToClipboard = async (value: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    }
  };

  const pasteFromClipboard = async () => {
    try {
      const clipboardText = await readClipboardText();
      if (clipboardText === null) {
        alert(
          "Paste functionality not supported in this browser. Please paste manually.",
        );
        return;
      }
      setText(clipboardText);
    } catch (error) {
      console.error("Error reading from clipboard:", error);
      alert("Unable to access clipboard. Please paste manually.");
    }
  };

  const uppercaseFromClipboardAndCopy = async () => {
    const clipboardText = await readClipboardText();
    if (clipboardText === null && !text) {
      alert(
        "No se pudo leer el portapapeles. Pega manualmente o usa el botón “Pegar”.",
      );
      return;
    }
    const sourceText = clipboardText ?? text;
    const upper = sourceText.toUpperCase();
    setText(upper);
    await copyToClipboard(upper);
  };

  const lowercaseFromClipboardAndCopy = async () => {
    const clipboardText = await readClipboardText();
    if (clipboardText === null && !text) {
      alert(
        "No se pudo leer el portapapeles. Pega manualmente o usa el botón “Pegar”.",
      );
      return;
    }
    const sourceText = clipboardText ?? text;
    const lower = sourceText.toLowerCase();
    setText(lower);
    await copyToClipboard(lower);
  };

  const toTitleCase = (str: string) => {
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase();
    });
  };

  const clearInput = () => {
    setText("");
  };

  if (!hasPermission(user?.permissions, "converter")) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950/70 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
            <LockIcon className="h-6 w-6" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-white">
            Acceso Restringido
          </h3>
          <p className="text-sm text-slate-400">
            No tienes permisos para acceder al Conversor de Texto.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Contacta a un administrador para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full items-top justify-center px-4 py-8 ">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-300">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">Conversor de Texto</h2>
          <p className="mt-2 text-sm text-slate-400">
            Convierte el texto al formato que necesites
          </p>
        </div>

        {copySuccess && (
          <div className="fixed top-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100">
            <Copy className="h-4 w-4" />
            <span>Copiado</span>
          </div>
        )}

        <div className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-6">
            <label className="block text-sm font-semibold text-slate-300 mb-3">
              Texto de entrada
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30 focus:ring-1 focus:ring-cyan-400/20"
              placeholder="Escribe o pega tu texto..."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <button
              onClick={uppercaseFromClipboardAndCopy}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-900/50 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-900/80 hover:border-white/20"
            >
              <ArrowUpAZ className="h-4 w-4" />
              Mayúsculas
            </button>

            <button
              onClick={lowercaseFromClipboardAndCopy}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-900/50 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-900/80 hover:border-white/20"
            >
              <ArrowDownAZ className="h-4 w-4" />
              Minúsculas
            </button>

            <button
              onClick={() => {
                const titleCaseText = toTitleCase(text);
                setText(titleCaseText);
                copyToClipboard(titleCaseText);
              }}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-900/50 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-900/80 hover:border-white/20"
            >
              <Sparkles className="h-4 w-4" />
              Título
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              onClick={pasteFromClipboard}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-900/50 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-900/80 hover:border-white/20"
            >
              <ClipboardPaste className="h-4 w-4" />
              Pegar
            </button>
            <button
              onClick={clearInput}
              className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-slate-900/50 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-900/80 hover:border-white/20"
            >
              <Trash2 className="h-4 w-4" />
              Limpiar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
