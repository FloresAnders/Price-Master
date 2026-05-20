"use client";

import React, { useEffect, useMemo, useState } from "react";
import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import { X, Lock, LockOpen, Plus, Edit, Trash2, CalendarDays } from "lucide-react";
import { useProviders } from "../../hooks/useProviders";

type FacturaEntry = {
  id: string;
  type: "FC" | "NC";
  providerCode: string;
  providerName: string;
  invoiceNumber: string;
  amount: number;
  amountThousands: number;
  receptionDate: string; // ISO date
  createdAt: string; // ISO
};

const STORAGE_KEY = "facturasCredito_list_v1";

export default function FacturasCreditoPage() {
  const [entries, setEntries] = useState<FacturaEntry[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // form
  const [type, setType] = useState<"FC" | "NC">("FC");
  const [providerCode, setProviderCode] = useState("");
  const [providerName, setProviderName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [amountRaw, setAmountRaw] = useState("");
  const [receptionDate, setReceptionDate] = useState("");
  const [autoCloseLocked, setAutoCloseLocked] = useState(false);

  // company sync key used elsewhere in the app (optional)
  const SHARED_COMPANY_STORAGE_KEY = "fg_selected_company_shared";
  const company = typeof window !== "undefined" ? localStorage.getItem(SHARED_COMPANY_STORAGE_KEY) || "" : "";
  const { providers, loading: providersLoading } = useProviders(company || undefined);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEntries(JSON.parse(raw) as FacturaEntry[]);
    } catch {
      setEntries([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // ignore
    }
  }, [entries]);

  const resetForm = () => {
    setType("FC");
    setProviderCode("");
    setProviderName("");
    setInvoiceNumber("");
    setAmountRaw("");
    setReceptionDate("");
    setEditingId(null);
  };

  const openNew = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const openEdit = (id: string) => {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    setEditingId(id);
    setType(e.type);
    setProviderCode(e.providerCode);
    setProviderName(e.providerName);
    setInvoiceNumber(e.invoiceNumber);
    setAmountRaw(String(e.amount));
    setReceptionDate(e.receptionDate.split("T")[0] || "");
    setDrawerOpen(true);
  };

  const removeEntry = (id: string) => {
    if (!confirm("Eliminar factura/nota?")) return;
    setEntries((prev) => prev.filter((p) => p.id !== id));
  };

  const parseAmount = (s: string) => {
    const digits = s.replace(/[^0-9.-]/g, "");
    const n = Number(digits || 0);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  };

  const saveForm = () => {
    const amount = parseAmount(amountRaw);
    const amountThousands = Math.floor(amount / 1000) * 1000;
    const now = new Date().toISOString();

    // resolve provider name if selected from providers list
    let resolvedProviderName = providerName;
    if (!resolvedProviderName && providerCode) {
      const prov = providers.find((p) => p.code === providerCode);
      if (prov) resolvedProviderName = prov.name || prov.code;
    }

    if (editingId) {
      setEntries((prev) =>
        prev
          .map((p) =>
            p.id === editingId
              ? {
                  ...p,
                  type,
                  providerCode: providerCode || p.providerCode,
                  providerName: resolvedProviderName || p.providerName,
                  invoiceNumber,
                  amount,
                  amountThousands,
                  receptionDate: receptionDate ? new Date(receptionDate).toISOString() : p.receptionDate,
                }
              : p,
          )
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      );
    } else {
      const entry: FacturaEntry = {
        id: String(Date.now()),
        type,
        providerCode: providerCode || "",
        providerName: resolvedProviderName || providerCode || "",
        invoiceNumber,
        amount,
        amountThousands,
        receptionDate: receptionDate ? new Date(receptionDate).toISOString() : now,
        createdAt: now,
      };
      setEntries((prev) => [entry, ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }

    setDrawerOpen(false);
    setAutoCloseLocked(false);
    resetForm();
  };

  const formattedAmount = useMemo(() => {
    const n = parseAmount(amountRaw);
    return new Intl.NumberFormat("es-CR").format(n);
  }, [amountRaw]);

  return (
    <div className="max-w-7xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Facturas / Notas Crédito</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openNew}
              className="inline-flex items-center gap-2 rounded border border-[var(--accent)] bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95" disabled
            >
              <Plus className="w-4 h-4"/> Agregar
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {entries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--input-border)] bg-[var(--card-bg)]/60 p-6 text-center text-[var(--muted-foreground)]">
              {/*No hay facturas o notas registradas. */}
              En mantenimiento: sección para registrar facturas de crédito y notas de crédito. Próximamente podrás llevar un control detallado de tus facturas, con opciones para agregar, editar y eliminar registros fácilmente. ¡Mantente atento a las actualizaciones! <CalendarDays className="w-5 h-5 inline-block ml-2" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/80 text-white shadow-sm">
              <div className="divide-y divide-[var(--input-border)]">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 p-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <div className="rounded px-2 py-1 text-xs font-semibold bg-cyan-900/30 border border-cyan-700/25">{e.type}</div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{e.providerName || e.providerCode}</div>
                          <div className="text-xs text-[var(--muted-foreground)]">{e.invoiceNumber} · {new Intl.NumberFormat('es-CR').format(e.amount)} ₡</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-[var(--muted-foreground)]">{new Date(e.receptionDate).toLocaleDateString('es-CR')}</div>
                      <button onClick={() => openEdit(e.id)} className="p-2 rounded hover:bg-[var(--muted)]/20">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeEntry(e.id)} className="p-2 rounded hover:bg-[var(--muted)]/20">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => {
          if (autoCloseLocked) return;
          setDrawerOpen(false);
          resetForm();
        }}
        PaperProps={{
          sx: { width: { xs: "100vw", sm: 520 }, maxWidth: "100vw", bgcolor: "#0d1117", color: "#ffffff" },
        }}
      >
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", px: 3, py: 2, position: "relative" }}>
            <Typography variant="h6" component="h3" sx={{ fontWeight: 600, textAlign: "center", width: "100%" }}>
              {editingId ? `Editar ${invoiceNumber || "factura"}` : "Agregar FC/NC"}
            </Typography>
            <Box sx={{ position: "absolute", right: 12, display: "flex", alignItems: "center", gap: 1 }}>
              <IconButton aria-label="Auto lock" onClick={() => setAutoCloseLocked((p) => !p)} sx={{ color: "var(--foreground)" }}>
                {autoCloseLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
              </IconButton>
              <IconButton aria-label="Cerrar" onClick={() => { setDrawerOpen(false); resetForm(); }} sx={{ color: "var(--foreground)" }}>
                <X className="w-4 h-4" />
              </IconButton>
            </Box>
          </Box>
          <Divider sx={{ borderColor: "var(--input-border)" }} />
          <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2 }}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Tipo</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setType('FC')} className={`h-10 flex-1 rounded border px-3 ${type==='FC'? 'border-cyan-300/45 bg-cyan-500/25 text-cyan-50':'border-cyan-700/35 bg-cyan-950/25'}`}>Factura (FC)</button>
                    <button type="button" onClick={() => setType('NC')} className={`h-10 flex-1 rounded border px-3 ${type==='NC'? 'border-amber-400/45 bg-amber-500/12 text-amber-200':'border-cyan-700/35 bg-cyan-950/25'}`}>Nota crédito (NC)</button>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Proveedor</label>
                  <div className="relative">
                    <input
                      value={providerName}
                      onChange={(e) => { setProviderName(e.target.value); setProviderCode(""); }}
                      placeholder={providersLoading ? 'Cargando proveedores...' : 'Buscar proveedor...'}
                      className="h-11 w-full rounded border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)]"
                    />
                    <select className="absolute right-2 top-2 h-7 rounded bg-transparent border border-transparent text-[var(--muted-foreground)]" value={providerCode} onChange={(e)=>{ const code=e.target.value; setProviderCode(code); const p = providers.find(p=>p.code===code); if(p) setProviderName(p.name); }}>
                      <option value="">--</option>
                      {!providersLoading && providers.map((p)=> (
                        <option key={p.code} value={p.code}>{p.name} ({p.code})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Número de documento</label>
                <input value={invoiceNumber} onChange={(e)=>setInvoiceNumber(e.target.value)} className="h-11 w-full rounded border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)]" placeholder="0000" />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Monto</label>
                <div className="grid grid-cols-1 gap-2">
                  <input value={amountRaw} onChange={(e)=>setAmountRaw(e.target.value)} placeholder="0" className="h-11 w-full rounded border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-lg font-semibold text-[var(--foreground)]" />
                  <div className="text-xs text-[var(--muted-foreground)]">Monto formateado: {formattedAmount} · Miles: {new Intl.NumberFormat('es-CR').format(Math.floor(parseAmount(amountRaw)/1000)*1000)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Fecha recepción</label>
                  <input type="date" value={receptionDate} onChange={(e)=>setReceptionDate(e.target.value)} className="h-11 w-full rounded border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)]" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Hora (opcional)</label>
                  <div className="h-11 w-full rounded border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] flex items-center">--:--</div>
                </div>
              </div>

              <div className="text-right">
                <button type="button" onClick={()=>{ setDrawerOpen(false); resetForm(); }} className="inline-flex h-10 items-center justify-center gap-2 rounded border px-4 text-sm font-semibold">Cancelar</button>
                <button type="button" onClick={saveForm} className="inline-flex h-10 items-center justify-center gap-2 ml-2 rounded border border-cyan-400/45 bg-cyan-500/20 px-4 text-sm font-semibold text-cyan-50">{editingId? 'Actualizar' : 'Guardar'}</button>
              </div>
            </div>
          </Box>
        </Box>
      </Drawer>
    </div>
  );
}
