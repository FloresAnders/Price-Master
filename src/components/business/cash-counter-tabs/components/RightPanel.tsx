"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Wallet, TrendingUp, Eraser, Download, Upload, DollarSign, Trash2, FileJson, FileText } from "lucide-react";
import type { RightPanelProps, BillsMap } from "../types";
import { denomsByCurrency, fmtCurrency, calcTotal, buildCashCounterExportSummary } from "../utils";
import { BaseModal } from "./BaseModal";
import { buildCashCounterPreviewHtml } from "@/data/cashCounterPreviewTemplate";

export function RightPanel({ data, showExtra, setShowExtra, showBD, setShowBD, onUpdate, onCurrencyOpen, onDelete }: RightPanelProps) {
  const bills = data.bills;
  const extra = data.extraAmount;
  const cur = data.currency;
  const t = calcTotal(bills, extra);
  const denoms = denomsByCurrency(cur);

  const ntf = (b: BillsMap, e: number, c: "CRC" | "USD", a?: number, v?: number) =>
    onUpdate({ ...data, bills: b, extraAmount: e, currency: c, aperturaCaja: a ?? data.aperturaCaja, ventaActual: v ?? data.ventaActual });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const safeName = data.name.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "cash-counter";

  const exportJson = () => {
    const c = JSON.stringify({ name: data.name, bills, extraAmount: extra, currency: cur, aperturaCaja: data.aperturaCaja, ventaActual: data.ventaActual }, null, 2);
    const b = new Blob([c], { type: "application/json" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = `${safeName}.json`;
    a.click();
    URL.revokeObjectURL(u);
    setExportOpen(false);
  };

  const exportPdf = async () => {
    setExportingPdf(true);
    let host: HTMLDivElement | null = null;
    try {
      const { jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;
      const summary = buildCashCounterExportSummary(data);
      {
        host = document.createElement("div");
        host.style.position = "fixed";
        host.style.left = "-10000px";
        host.style.top = "0";
        host.style.width = "1110px";
        host.innerHTML = buildCashCounterPreviewHtml(summary, new Date().toLocaleDateString("es-CR"));
        document.body.appendChild(host);

        const target = host.querySelector(".container") as HTMLElement | null;
        if (!target) throw new Error("Plantilla PDF inválida.");

        const canvas = await html2canvas(target, {
          backgroundColor: "#0c1220",
          scale: 2,
          useCORS: true,
          logging: false,
        } as Parameters<typeof html2canvas>[1] & { backgroundColor: string; scale: number; useCORS: boolean; logging: boolean });

        const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 8;
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;
        const widthFromHeight = (canvas.width * maxHeight) / canvas.height;
        const imgWidth = Math.min(maxWidth, widthFromHeight);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const image = canvas.toDataURL("image/png");

        doc.addImage(image, "PNG", (pageWidth - imgWidth) / 2, margin, imgWidth, imgHeight);

        doc.save(`${safeName}.pdf`);
        setExportOpen(false);
        return;
      }
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
      const today = new Date().toLocaleString("es-CR");
      const diffText = summary.difference.type === "sobrante"
        ? `Sobrante: ${fmtCurrency(summary.difference.amount, cur)}`
        : summary.difference.type === "faltante"
          ? `Faltante: ${fmtCurrency(summary.difference.amount, cur)}`
          : "Sin diferencia";

      doc.setFillColor(13, 17, 23);
      doc.rect(0, 0, 216, 279, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(data.name, 14, 18);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(160, 174, 192);
      doc.text(`Cash Counter • ${today}`, 14, 25);

      doc.setDrawColor(35, 45, 65);
      doc.setFillColor(5, 8, 22);
      doc.roundedRect(14, 34, 188, 40, 3, 3, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);
      doc.text(fmtCurrency(summary.total, cur), 108, 51, { align: "center" });
      doc.setFontSize(9);
      doc.setTextColor(160, 174, 192);
      doc.text("Total contado", 108, 61, { align: "center" });

      const cards = [
        ["Apertura", fmtCurrency(summary.aperturaCaja, cur)],
        ["Venta", fmtCurrency(summary.ventaActual, cur)],
        ["Esperado", fmtCurrency(summary.expectedTotal, cur)],
        ["Estado", diffText],
        ["Billetes", fmtCurrency(summary.billsTotal, cur)],
        ["Extra", fmtCurrency(summary.extraAmount, cur)],
      ];

      cards.forEach(([label, value], index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        const x = 14 + col * 63;
        const y = 84 + row * 24;
        doc.setFillColor(13, 17, 23);
        doc.roundedRect(x, y, 58, 17, 2, 2, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(140, 150, 165);
        doc.text(label, x + 4, y + 6);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(245, 250, 255);
        doc.text(value, x + 4, y + 13, { maxWidth: 50 });
      });

      let y = 140;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(255, 255, 255);
      doc.text("Denominaciones", 14, y);
      y += 8;
      doc.setFontSize(8);
      doc.setTextColor(160, 174, 192);
      doc.text("Denominacion", 14, y);
      doc.text("Cantidad", 100, y, { align: "right" });
      doc.text("Subtotal", 198, y, { align: "right" });
      y += 4;
      doc.setDrawColor(35, 45, 65);
      doc.line(14, y, 202, y);
      y += 8;

      summary.denoms.forEach((denom) => {
        doc.setFont("helvetica", denom.count > 0 ? "bold" : "normal");
        doc.setTextColor(denom.count > 0 ? 245 : 120, denom.count > 0 ? 250 : 130, denom.count > 0 ? 255 : 145);
        doc.text(denom.label, 14, y);
        doc.text(String(denom.count), 100, y, { align: "right" });
        doc.text(fmtCurrency(denom.subtotal, cur), 198, y, { align: "right" });
        y += 7;
      });

      doc.save(`${safeName}.pdf`);
      setExportOpen(false);
    } catch {
      alert("Error exportando PDF.");
    } finally {
      host?.remove();
      setExportingPdf(false);
    }
  };

  return (
    <div className="w-full lg:w-[19.5rem] flex-shrink-0 order-3 lg:order-3">
      <div className="lg:sticky lg:top-20 space-y-3">
        <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/15 border border-cyan-400/25 flex items-center justify-center mx-auto mb-4 shadow-[0_10px_35px_rgba(6,182,212,0.12)]">
            <Wallet className="w-7 h-7 text-cyan-400" />
          </div>
          <p className="text-[10px] text-white/30 uppercase tracking-[0.18em] mb-1.5">Resumen</p>
          <p className="text-[2rem] leading-none font-semibold text-white tracking-tight">{fmtCurrency(t, cur)}</p>
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3 text-xs">
            <div className="text-center"><span className="text-white/45 block mb-0.5">Billetes</span><span className="text-white/90 font-medium">{fmtCurrency(t - extra, cur)}</span></div>
            <div className="text-center"><span className="text-white/45 block mb-0.5">Total Billetes</span><span className="text-white/90 font-medium">{Object.values(bills).reduce((a, b) => a + b, 0)}</span></div>
            <div className="text-center"><span className="text-white/45 block mb-0.5">Extra</span><span className="text-white/90 font-medium">{fmtCurrency(extra, cur)}</span></div>
            <div className="text-center"><span className="text-white/45 block mb-0.5">Activas</span><span className="text-white/90 font-medium">{Object.values(bills).filter((c) => c > 0).length}/{denoms.length}</span></div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-4">
          <p className="text-[10px] text-white/30 uppercase tracking-[0.16em] mb-3">Acciones rápidas</p>
          <div className="space-y-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowExtra(!showExtra)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500/30 to-cyan-500/25 hover:from-emerald-500/40 hover:to-cyan-500/30 text-emerald-50 text-xs font-medium transition-all duration-200 border border-emerald-400/30">
              <Plus className="w-3.5 h-3.5" /> {showExtra ? "Cerrar Extra" : "Monto Adicional"}
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => setShowBD(!showBD)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0d1117] hover:bg-[#0d1117] text-white/75 hover:text-white text-xs font-medium transition-all duration-200 border border-white/10">
              <TrendingUp className="w-3.5 h-3.5" /> {showBD ? "Ocultar Desglose" : "Ver Desglose"}
            </motion.button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-4">
          <p className="text-[10px] text-white/30 uppercase tracking-[0.16em] mb-3">Herramientas</p>
          <div className="flex items-center justify-center gap-2">
            {[
              { icon: Eraser, label: "Limpiar", color: "text-amber-400 hover:text-amber-300", border: "border-amber-400/20 hover:border-amber-400/40", bg: "bg-amber-500/10 hover:bg-amber-500/20", action: () => setClearConfirmOpen(true) },
              { icon: Download, label: "Exportar", color: "text-emerald-400 hover:text-emerald-300", border: "border-emerald-400/20 hover:border-emerald-400/40", bg: "bg-emerald-500/10 hover:bg-emerald-500/20", action: () => setExportOpen(true) },
              { icon: Upload, label: "Importar", color: "text-blue-400 hover:text-blue-300", border: "border-blue-400/20 hover:border-blue-400/40", bg: "bg-blue-500/10 hover:bg-blue-500/20", action: () => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json"; inp.onchange = (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (!f) return; new FileReader().onload = (e) => { try { const p = JSON.parse(e.target?.result as string); if (p && typeof p.name === "string" && typeof p.extraAmount === "number" && (p.currency === "CRC" || p.currency === "USD") && typeof p.bills === "object") { ntf(p.bills, p.extraAmount, p.currency, p.aperturaCaja || 0, p.ventaActual || 0); } else alert("JSON inválido."); } catch { alert("Error."); } }; (new FileReader()).readAsText(f); }; inp.click(); } },
              { icon: DollarSign, label: "Moneda", color: "text-yellow-400 hover:text-yellow-300", border: "border-yellow-400/20 hover:border-yellow-400/40", bg: "bg-yellow-500/10 hover:bg-yellow-500/20", action: onCurrencyOpen },
              { icon: Trash2, label: "Eliminar", color: "text-red-400 hover:text-red-300", border: "border-red-400/20 hover:border-red-400/40", bg: "bg-red-500/10 hover:bg-red-500/20", action: () => setConfirmOpen(true) },
            ].map((b) => (
              <button key={b.label} onClick={b.action} className={`w-8 h-8 rounded-lg ${b.bg} border ${b.border} flex items-center justify-center ${b.color} transition-all`} aria-label={b.label}>
                <b.icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence>
          {showExtra && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border border-white/10 bg-[#0d1117] p-3 space-y-2.5">
              <p className="text-[10px] text-white/35 uppercase tracking-[0.16em]">Extra</p>
              <div className="bg-[#050816] border border-white/10 rounded-xl p-2 flex items-center">
                <input type="text" inputMode="numeric" value={extra === 0 ? "" : fmtCurrency(extra, cur)}
                  onChange={(e) => {
                    let r = e.target.value;
                    if (cur === "CRC") { r = r.replace(/\D/g, ""); ntf(bills, r === "" ? 0 : parseInt(r, 10), cur); }
                    else { r = r.replace(/[^0-9.]/g, ""); const p = parseFloat(r); ntf(bills, isNaN(p) ? 0 : p, cur); }
                  }}
                  className="w-full bg-transparent text-white text-right text-sm focus:outline-none placeholder-white/10" placeholder="0" />
                <button onClick={() => ntf(bills, 0, cur)} className="ml-2 text-white/20 hover:text-red-400/60 transition-colors"><Trash2 className="w-3 h-3" /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {confirmOpen && (
            <BaseModal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirmar eliminación">
              <p className="text-center text-white/80 mb-4">¿Estás seguro de eliminar este contador?</p>
              <div className="flex justify-end gap-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setConfirmOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white">Cancelar</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { onDelete(); setConfirmOpen(false); }} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400"><Trash2 className="w-4 h-4" /> Eliminar</motion.button>
              </div>
            </BaseModal>
          )}
          {clearConfirmOpen && (
            <BaseModal isOpen={clearConfirmOpen} onClose={() => setClearConfirmOpen(false)} title="Confirmar limpieza">
              <p className="text-center text-white/80 mb-4">¿Estás seguro de limpiar este contador?</p>
              <div className="flex justify-end gap-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setConfirmOpen(false)} className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white">Cancelar</motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { const r: BillsMap = {}; denoms.forEach((d) => { r[d.value] = 0; }); ntf(r, 0, cur, 0, 0); setClearConfirmOpen(false); }} className="flex items-center gap-1 px-4 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400"><Eraser className="w-4 h-4" /> Limpiar</motion.button>
              </div>
            </BaseModal>
          )}
          {exportOpen && (
            <BaseModal isOpen={exportOpen} onClose={() => setExportOpen(false)} title="Exportar contador">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={exportJson}
                  className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-left text-emerald-100 transition-all hover:bg-emerald-500/20">
                  <FileJson className="mb-3 h-6 w-6 text-emerald-300" />
                  <p className="text-sm font-semibold">JSON</p>
                  <p className="mt-1 text-xs text-white/35">Datos editables del contador.</p>
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { void exportPdf(); }} disabled={exportingPdf}
                  className="rounded-xl border border-cyan-400/25 bg-cyan-500/10 p-4 text-left text-cyan-100 transition-all hover:bg-cyan-500/20 disabled:cursor-wait disabled:opacity-60">
                  <FileText className="mb-3 h-6 w-6 text-cyan-300" />
                  <p className="text-sm font-semibold">PDF</p>
                  <p className="mt-1 text-xs text-white/35">{exportingPdf ? "Generando..." : "Resumen visual para imprimir."}</p>
                </motion.button>
              </div>
            </BaseModal>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
