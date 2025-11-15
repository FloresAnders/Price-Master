import React from 'react';
import { Save } from 'lucide-react';
import type { FondoMovementType } from './fondo';

type ProviderOption = {
    code: string;
    name: string;
};

type AgregarMovimientoProps = {
    selectedProvider: string;
    onProviderChange: (value: string) => void;
    providers: ProviderOption[];
    providersLoading: boolean;
    isProviderSelectDisabled: boolean;
    selectedProviderExists: boolean;
    invoiceNumber: string;
    onInvoiceNumberChange: (value: string) => void;
    invoiceValid: boolean;
    invoiceDisabled: boolean;
    paymentType: FondoMovementType;
    isEgreso: boolean;
    egreso: string;
    onEgresoChange: (value: string) => void;
    egresoBorderClass: string;
    ingreso: string;
    onIngresoChange: (value: string) => void;
    ingresoBorderClass: string;
    notes: string;
    onNotesChange: (value: string) => void;
    manager: string;
    onManagerChange: (value: string) => void;
    managerSelectDisabled: boolean;
    employeeOptions: string[];
    employeesLoading: boolean;
    editingEntryId: string | null;
    onCancelEditing: () => void;
    onSubmit: () => void;
    isSubmitDisabled: boolean;
    onFieldKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => void;
    currency?: 'CRC' | 'USD';
    onCurrencyChange?: (c: 'CRC' | 'USD') => void;
};

const AgregarMovimiento: React.FC<AgregarMovimientoProps> = ({
    selectedProvider,
    onProviderChange,
    providers,
    providersLoading,
    isProviderSelectDisabled,
    selectedProviderExists,
    invoiceNumber,
    onInvoiceNumberChange,
    invoiceValid,
    invoiceDisabled,
    isEgreso,
    egreso,
    onEgresoChange,
    egresoBorderClass,
    ingreso,
    onIngresoChange,
    ingresoBorderClass,
    notes,
    onNotesChange,
    manager,
    onManagerChange,
    managerSelectDisabled,
    employeeOptions,
    employeesLoading,
    editingEntryId,
    onCancelEditing,
    onSubmit,
    isSubmitDisabled,
    onFieldKeyDown,
    currency = 'CRC',
    onCurrencyChange,
}) => {
    const invoiceBorderClass = invoiceValid || invoiceNumber.length === 0 ? 'border-[var(--input-border)]' : 'border-red-500';
    const inputFormatterCRC = React.useMemo(
        () => new Intl.NumberFormat('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        [],
    );
    const inputFormatterUSD = React.useMemo(
        () => new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        [],
    );

    const formatInputDisplay = (raw: string) => {
        if (!raw || raw.trim().length === 0) return '';
        const n = Number(raw);
        if (Number.isNaN(n)) return raw;
        return currency === 'USD' ? `$ ${inputFormatterUSD.format(Math.trunc(n))}` : `₡ ${inputFormatterCRC.format(Math.trunc(n))}`;
    };

    const extractDigits = (value: string) => value.replace(/[^0-9]/g, '');

    return (
        <div className="space-y-5">
            <div className="grid gap-4 grid-cols-1">
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        Proveedor
                    </label>
                    <select
                        value={selectedProvider}
                        onChange={event => onProviderChange(event.target.value)}
                        onKeyDown={onFieldKeyDown}
                        className="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                        disabled={isProviderSelectDisabled}
                    >
                        <option value="">
                            {providersLoading ? 'Cargando proveedores...' : 'Seleccionar proveedor'}
                        </option>
                        {selectedProvider && !selectedProviderExists && (
                            <option value={selectedProvider}>{`Proveedor no disponible (${selectedProvider})`}</option>
                        )}
                        {providers.map(p => (
                            <option key={p.code} value={p.code}>{`${p.name} (${p.code})`}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        Numero factura
                    </label>
                    <input
                        placeholder="0000"
                        value={invoiceNumber}
                        onChange={event => onInvoiceNumberChange(event.target.value)}
                        onKeyDown={onFieldKeyDown}
                        className={`w-full p-2 bg-[var(--input-bg)] border ${invoiceBorderClass} rounded`}
                        disabled={invoiceDisabled}
                    />
                </div>

                {/* Tipo ya se determina por el proveedor seleccionado; no se muestra selector aquí */}

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        Monto
                    </label>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-3 text-sm">
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="fg_currency"
                                    value="CRC"
                                    checked={currency === 'CRC'}
                                    onChange={() => onCurrencyChange && onCurrencyChange('CRC')}
                                    className="accent-[var(--accent)]"
                                />
                                <span className="text-xs text-[var(--muted-foreground)]">Colones (₡)</span>
                            </label>
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="fg_currency"
                                    value="USD"
                                    checked={currency === 'USD'}
                                    onChange={() => onCurrencyChange && onCurrencyChange('USD')}
                                    className="accent-[var(--accent)]"
                                />
                                <span className="text-xs text-[var(--muted-foreground)]">Dólares ($)</span>
                            </label>
                        </div>
                        <input
                            placeholder="0"
                            value={formatInputDisplay(isEgreso ? egreso : ingreso)}
                            onChange={event => {
                                const digits = extractDigits(event.target.value);
                                if (isEgreso) onEgresoChange(digits); else onIngresoChange(digits);
                            }}
                            onKeyDown={onFieldKeyDown}
                            className={`flex-1 p-2 bg-[var(--input-bg)] border ${isEgreso ? egresoBorderClass : ingresoBorderClass} rounded`}
                            inputMode="numeric"
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        Observacion
                    </label>
                    <input
                        placeholder="Observacion"
                        value={notes}
                        onChange={event => onNotesChange(event.target.value)}
                        onKeyDown={onFieldKeyDown}
                        className="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                        maxLength={200}
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        Encargado
                    </label>
                    <select
                        value={manager}
                        onChange={event => onManagerChange(event.target.value)}
                        onKeyDown={onFieldKeyDown}
                        className="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                        disabled={managerSelectDisabled}
                    >
                        <option value="">
                            {employeesLoading ? 'Cargando encargados...' : 'Seleccionar encargado'}
                        </option>
                        {employeeOptions.map(name => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex justify-center gap-2">
                {editingEntryId && (
                    <button
                        type="button"
                        className="px-4 py-2 border border-[var(--input-border)] rounded text-[var(--foreground)] hover:bg-[var(--muted)] disabled:opacity-50"
                        onClick={onCancelEditing}
                    >
                        Cancelar
                    </button>
                )}
                <button
                    type="button"
                    className="px-4 py-2 bg-blue-400 text-white rounded hover:bg-blue-500 disabled:opacity-50 inline-flex items-center gap-2"
                    onClick={onSubmit}
                    disabled={isSubmitDisabled}
                >
                    <Save className="w-4 h-4" />
                    {editingEntryId ? 'Actualizar' : 'Guardar'}
                </button>
            </div>
        </div>
    );
};

export default AgregarMovimiento;
