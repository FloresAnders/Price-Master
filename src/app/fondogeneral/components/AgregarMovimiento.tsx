import React from 'react';
import type { FondoMovementType } from './Sections';

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
    onPaymentTypeChange: (value: string) => void;
    movementTypeOptions: readonly string[];
    formatMovementType: (type: string) => string;
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
    paymentType,
    onPaymentTypeChange,
    movementTypeOptions,
    formatMovementType,
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
}) => {
    const invoiceBorderClass = invoiceValid || invoiceNumber.length === 0 ? 'border-[var(--input-border)]' : 'border-red-500';

    return (
        <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
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

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        Tipo
                    </label>
                    <select
                        value={paymentType}
                        onChange={event => onPaymentTypeChange(event.target.value)}
                        onKeyDown={onFieldKeyDown}
                        className="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                        disabled={invoiceDisabled}
                    >
                        {movementTypeOptions.map(option => (
                            <option key={option} value={option}>{formatMovementType(option)}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                        Monto
                    </label>
                    <input
                        placeholder="0"
                        value={isEgreso ? egreso : ingreso}
                        onChange={event =>
                            isEgreso ? onEgresoChange(event.target.value) : onIngresoChange(event.target.value)
                        }
                        onKeyDown={onFieldKeyDown}
                        className={`w-full p-2 bg-[var(--input-bg)] border ${isEgreso ? egresoBorderClass : ingresoBorderClass} rounded`}
                        inputMode="numeric"
                    />
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
                    className="px-4 py-2 bg-[var(--accent)] text-white rounded disabled:opacity-50"
                    onClick={onSubmit}
                    disabled={isSubmitDisabled}
                >
                    {editingEntryId ? 'Actualizar' : 'Guardar'}
                </button>
            </div>
        </div>
    );
};

export default AgregarMovimiento;
