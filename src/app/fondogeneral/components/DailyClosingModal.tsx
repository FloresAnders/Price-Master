import React, { useEffect, useMemo, useState } from 'react';

const CRC_DENOMINATIONS = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25] as const;
const USD_DENOMINATIONS = [100, 50, 20, 10, 5, 1] as const;

type CountState = Record<number, string>;

const buildInitialCounts = (denominations: readonly number[]): CountState => {
    return denominations.reduce<CountState>((acc, denom) => {
        acc[denom] = '';
        return acc;
    }, {} as CountState);
};

export type DailyClosingFormValues = {
    closingDate: string;
    manager: string;
    notes: string;
    totalCRC: number;
    totalUSD: number;
    breakdownCRC: Record<number, number>;
    breakdownUSD: Record<number, number>;
};

type DailyClosingModalProps = {
    open: boolean;
    onClose: () => void;
    onConfirm: (values: DailyClosingFormValues) => void;
    employees: string[];
    loadingEmployees: boolean;
    currentBalanceCRC: number;
    currentBalanceUSD: number;
};

const DailyClosingModal: React.FC<DailyClosingModalProps> = ({
    open,
    onClose,
    onConfirm,
    employees,
    loadingEmployees,
    currentBalanceCRC,
    currentBalanceUSD,
}) => {
    const [closingDateISO, setClosingDateISO] = useState(() => new Date().toISOString());
    const [manager, setManager] = useState('');
    const [notes, setNotes] = useState('');
    const [crcCounts, setCrcCounts] = useState<CountState>(() => buildInitialCounts(CRC_DENOMINATIONS));
    const [usdCounts, setUsdCounts] = useState<CountState>(() => buildInitialCounts(USD_DENOMINATIONS));

    const crcFormatter = useMemo(
        () => new Intl.NumberFormat('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        [],
    );
    const usdFormatter = useMemo(
        () => new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        [],
    );
    const closingDateFormatter = useMemo(
        () => new Intl.DateTimeFormat('es-CR', { dateStyle: 'long', timeStyle: 'short' }),
        [],
    );

    const formatCurrency = (currency: 'CRC' | 'USD', value: number) =>
        currency === 'USD'
            ? `$ ${usdFormatter.format(Math.trunc(value))}`
            : `₡ ${crcFormatter.format(Math.trunc(value))}`;

    const normalizeCount = (raw: string) => {
        if (!raw) return 0;
        const parsed = Number.parseInt(raw, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };

    const totalCRC = useMemo(() => CRC_DENOMINATIONS.reduce((sum, denom) => sum + denom * normalizeCount(crcCounts[denom]), 0), [crcCounts]);
    const totalUSD = useMemo(() => USD_DENOMINATIONS.reduce((sum, denom) => sum + denom * normalizeCount(usdCounts[denom]), 0), [usdCounts]);

    const diffCRC = totalCRC - Math.trunc(currentBalanceCRC);
    const diffUSD = totalUSD - Math.trunc(currentBalanceUSD);

    const differenceLabel = (currency: 'CRC' | 'USD', diff: number) => {
        if (diff === 0) return 'sin diferencias';
        const sign = diff > 0 ? '+' : '-';
        return `${sign} ${formatCurrency(currency, Math.abs(diff))}`;
    };

    useEffect(() => {
        if (!open) return;
        setClosingDateISO(new Date().toISOString());
        setNotes('');
        setCrcCounts(buildInitialCounts(CRC_DENOMINATIONS));
        setUsdCounts(buildInitialCounts(USD_DENOMINATIONS));
    }, [open]);

    useEffect(() => {
        if (!open) return;
        if (employees.length > 0) {
            setManager(prev => {
                if (prev && employees.includes(prev)) {
                    return prev;
                }
                return employees[0];
            });
        } else {
            setManager('');
        }
    }, [open, employees]);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    const handleCountChange = (currency: 'CRC' | 'USD', denom: number, value: string) => {
        const sanitized = value.replace(/[^0-9]/g, '');
        if (currency === 'CRC') {
            setCrcCounts(prev => ({ ...prev, [denom]: sanitized }));
        } else {
            setUsdCounts(prev => ({ ...prev, [denom]: sanitized }));
        }
    };

    const buildBreakdown = (counts: CountState, denominations: readonly number[]) => {
        return denominations.reduce<Record<number, number>>((acc, denom) => {
            acc[denom] = normalizeCount(counts[denom]);
            return acc;
        }, {});
    };

    const handleSubmit = () => {
        const trimmedManager = manager.trim();
        if (!trimmedManager) return;

        onConfirm({
            closingDate: closingDateISO,
            manager: trimmedManager,
            notes,
            totalCRC,
            totalUSD,
            breakdownCRC: buildBreakdown(crcCounts, CRC_DENOMINATIONS),
            breakdownUSD: buildBreakdown(usdCounts, USD_DENOMINATIONS),
        });
    };

    const handleClearCounts = () => {
        setCrcCounts(buildInitialCounts(CRC_DENOMINATIONS));
        setUsdCounts(buildInitialCounts(USD_DENOMINATIONS));
    };

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-3xl rounded border border-[var(--input-border)] bg-[#1f262a] text-white shadow-lg max-h-[80vh] overflow-hidden flex flex-col"
                onClick={event => event.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 p-5 pb-0">
                    <h3 className="text-lg font-semibold">Cierre diario del fondo</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded border border-[var(--input-border)] px-2 py-1 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                    >
                        Cerrar
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    <div className="grid gap-4 md:grid-cols-2">
                        <section>
                            <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Efectivo (colones)</h4>
                            <div className="space-y-2">
                                {CRC_DENOMINATIONS.map(denom => {
                                    const quantity = normalizeCount(crcCounts[denom]);
                                    const lineTotal = denom * quantity;
                                    return (
                                        <div key={denom} className="flex items-center gap-3">
                                            <label className="w-20 text-xs text-[var(--muted-foreground)]">
                                                {denom.toLocaleString('es-CR')}
                                            </label>
                                            <input
                                                value={crcCounts[denom] ?? ''}
                                                onChange={event => handleCountChange('CRC', denom, event.target.value)}
                                                className="w-24 rounded border border-[var(--input-border)] bg-[var(--input-bg)] p-2 text-sm"
                                                inputMode="numeric"
                                            />
                                            <div className="flex-1 text-right text-xs text-[var(--muted-foreground)]">
                                                {formatCurrency('CRC', lineTotal)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                                Total: {formatCurrency('CRC', totalCRC)}
                            </div>
                            <div className="text-xs text-[var(--muted-foreground)]">
                                Saldo registrado: {formatCurrency('CRC', currentBalanceCRC)} · Diferencia: {differenceLabel('CRC', diffCRC)}
                            </div>
                        </section>

                        <section>
                            <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">Efectivo (dólares)</h4>
                            <div className="space-y-2">
                                {USD_DENOMINATIONS.map(denom => {
                                    const quantity = normalizeCount(usdCounts[denom]);
                                    const lineTotal = denom * quantity;
                                    return (
                                        <div key={denom} className="flex items-center gap-3">
                                            <label className="w-20 text-xs text-[var(--muted-foreground)]">
                                                {denom}
                                            </label>
                                            <input
                                                value={usdCounts[denom] ?? ''}
                                                onChange={event => handleCountChange('USD', denom, event.target.value)}
                                                className="w-24 rounded border border-[var(--input-border)] bg-[var(--input-bg)] p-2 text-sm"
                                                inputMode="numeric"
                                            />
                                            <div className="flex-1 text-right text-xs text-[var(--muted-foreground)]">
                                                {formatCurrency('USD', lineTotal)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                                Total: {formatCurrency('USD', totalUSD)}
                            </div>
                            <div className="text-xs text-[var(--muted-foreground)]">
                                Saldo registrado: {formatCurrency('USD', currentBalanceUSD)} · Diferencia: {differenceLabel('USD', diffUSD)}
                            </div>
                        </section>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                                Fecha de cierre
                            </label>
                            <div className="rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm text-[var(--foreground)]">
                                {closingDateFormatter.format(new Date(closingDateISO))}
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                                Encargado
                            </label>
                            {employees.length > 0 ? (
                                <select
                                    value={manager}
                                    onChange={event => setManager(event.target.value)}
                                    className="rounded border border-[var(--input-border)] bg-[var(--input-bg)] p-2 text-sm"
                                    disabled={loadingEmployees}
                                >
                                    <option value="">Seleccionar encargado</option>
                                    {employees.map(name => (
                                        <option key={name} value={name}>
                                            {name}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    value={manager}
                                    onChange={event => setManager(event.target.value)}
                                    className="rounded border border-[var(--input-border)] bg-[var(--input-bg)] p-2 text-sm"
                                    placeholder="Nombre del encargado"
                                />
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                            Observaciones
                        </label>
                        <textarea
                            value={notes}
                            onChange={event => setNotes(event.target.value)}
                            className="min-h-[80px] rounded border border-[var(--input-border)] bg-[var(--input-bg)] p-2 text-sm"
                            maxLength={400}
                            placeholder="Notas adicionales del cierre"
                        />
                    </div>
                </div>

                <div className="px-5 pb-5 pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--input-border)]">
                    <button
                        type="button"
                        onClick={handleClearCounts}
                        className="rounded border border-[var(--input-border)] px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                    >
                        Limpiar conteo
                    </button>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded border border-[var(--input-border)] px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={manager.trim().length === 0}
                            className="rounded bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
                        >
                            Crear cierre
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DailyClosingModal;
