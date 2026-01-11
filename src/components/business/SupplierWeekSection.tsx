import { Truck } from "lucide-react";

export type SupplierWeekVisitDay = "D" | "L" | "M" | "MI" | "J" | "V" | "S";

export type SupplierWeekDayModel = {
    code: SupplierWeekVisitDay;
    label: string;
    date: Date;
    dateKey: number;
    isToday: boolean;
};

export type SupplierWeekProviderRef = { code: string; name: string };

export type SupplierWeekModel = {
    weekStartKey: number;
    days: SupplierWeekDayModel[];
    createByCode: Map<SupplierWeekVisitDay, SupplierWeekProviderRef[]>;
    receiveByCode: Map<SupplierWeekVisitDay, SupplierWeekProviderRef[]>;
};

export type SupplierWeekSectionProps = {
    isSupplierWeekRoute: boolean;
    showSupplierWeekInMenu: boolean;
    companyForProviders: string;
    weeklyProvidersLoading: boolean;
    weeklyProvidersError: string | null;
    weekModel: SupplierWeekModel;
    supplierWeekRangeLabel: string;
    fondoGeneralBalanceCRC: number | null;
    onNavigateSupplierWeek: () => void;
    onPrevWeek: () => void;
    onNextWeek: () => void;

    // Control de pedido (solo ruta)
    selectedDay: SupplierWeekDayModel | null;
    selectedProviderCode: string;
    selectedReceiveDateKey: number | null;
    eligibleProviders: Array<{ code: string; name: string }>;
    orderAmount: string;
    orderSaving: boolean;
    controlLoading: boolean;
    controlError: string | null;
    formatAmount: (amount: number) => string;
    receiveAmountByProviderCodeForDay: (dateKey: number) => Map<string, number>;
    setSelectedCreateDateKey: (dateKey: number | null) => void;
    setSelectedProviderCode: (providerCode: string) => void;
    setSelectedReceiveDateKey: (receiveDateKey: number | null) => void;
    setOrderAmount: (amount: string) => void;
    handleSaveControlPedido: () => void;
};

export function SupplierWeekSection(props: SupplierWeekSectionProps) {
    const {
        isSupplierWeekRoute,
        showSupplierWeekInMenu,
        companyForProviders,
        weeklyProvidersLoading,
        weeklyProvidersError,
        weekModel,
        supplierWeekRangeLabel,
        fondoGeneralBalanceCRC,
        onNavigateSupplierWeek,
        onPrevWeek,
        onNextWeek,
        selectedDay,
        selectedProviderCode,
        selectedReceiveDateKey,
        eligibleProviders,
        orderAmount,
        orderSaving,
        controlLoading,
        controlError,
        formatAmount,
        receiveAmountByProviderCodeForDay,
        setSelectedCreateDateKey,
        setSelectedProviderCode,
        setSelectedReceiveDateKey,
        setOrderAmount,
        handleSaveControlPedido,
    } = props;

    const canSave =
        !orderSaving &&
        Boolean(selectedDay) &&
        Boolean(selectedProviderCode) &&
        Boolean(selectedReceiveDateKey) &&
        Boolean(orderAmount) &&
        Number(orderAmount) > 0;

    if (!(isSupplierWeekRoute || showSupplierWeekInMenu)) {
        return (
            <button
                type="button"
                onClick={onNavigateSupplierWeek}
                className="bg-[var(--card-bg)] dark:bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl shadow-md p-6 flex flex-col items-center transition hover:scale-105 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)] group"
                style={{ minHeight: 160 }}
                aria-label="Abrir Semana actual (proveedores)"
            >
                <Truck className="w-10 h-10 mb-3 text-[var(--primary)] group-hover:scale-110 group-hover:text-[var(--button-hover)] transition-all" />
                <span className="text-lg font-semibold mb-1 text-[var(--foreground)] dark:text-[var(--foreground)] text-center">
                    Semana proveedores
                </span>
                <span className="text-sm text-[var(--muted-foreground)] text-center">
                    Ver crear/recibir pedidos
                </span>
            </button>
        );
    }

    if (!isSupplierWeekRoute) {
        return (
            <button
                type="button"
                onClick={onNavigateSupplierWeek}
                className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl shadow-md p-6 col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4 text-left transition hover:scale-[1.01] hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                style={{ minHeight: 160 }}
                aria-label="Abrir Semana actual (proveedores)"
            >
                <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-[var(--foreground)]">
                            Semana actual (proveedores)
                        </h3>
                        <p className="text-xs text-[var(--muted-foreground)]">
                            Crea pedido y recibe pedido (Domingo a Sábado)
                        </p>
                    </div>
                </div>

                {!companyForProviders ? (
                    <div className="text-sm text-[var(--muted-foreground)]">
                        No se pudo determinar la empresa del usuario.
                    </div>
                ) : weeklyProvidersLoading ? (
                    <div className="text-sm text-[var(--muted-foreground)]">
                        Cargando proveedores...
                    </div>
                ) : weeklyProvidersError ? (
                    <div className="text-sm text-red-500">{weeklyProvidersError}</div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                        {weekModel.days.map((d) => {
                            const createList = weekModel.createByCode.get(d.code) || [];
                            const receiveList = weekModel.receiveByCode.get(d.code) || [];
                            const hasAny = createList.length > 0 || receiveList.length > 0;
                            const todayStyle = d.isToday
                                ? {
                                    borderColor: "var(--success)",
                                    backgroundColor:
                                        "color-mix(in srgb, var(--success) 18%, var(--card-bg))",
                                }
                                : undefined;

                            const amountsMap = receiveAmountByProviderCodeForDay(d.dateKey);
                            const createText = createList.map((p) => p.name).join(", ");
                            const receiveText = receiveList.map((p) => ({
                                name: p.name,
                                amount: amountsMap.get(p.code) || 0,
                            }));
                            const receiveTotal = receiveText.reduce(
                                (sum, row) => sum + (row.amount > 0 ? row.amount : 0),
                                0
                            );
                            const receiveTotalClassName =
                                typeof fondoGeneralBalanceCRC === "number"
                                    ? receiveTotal <= fondoGeneralBalanceCRC
                                        ? "text-[var(--success)]"
                                        : "text-[var(--error)]"
                                    : "text-[var(--muted-foreground)]";

                            return (
                                <div
                                    key={`week-${d.code}`}
                                    className="rounded-lg border border-[var(--input-border)] p-2 bg-[var(--muted)]"
                                    style={todayStyle}
                                >
                                    <div className="flex items-baseline justify-between gap-2">
                                        <div className="text-xs font-semibold text-[var(--foreground)]">
                                            {d.code}
                                        </div>
                                        <div className="text-[10px] text-[var(--muted-foreground)]">
                                            {d.date.getDate()}/{d.date.getMonth() + 1}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-[var(--muted-foreground)] mb-2">
                                        {d.label}
                                    </div>

                                    {!hasAny ? (
                                        <div className="text-[10px] text-[var(--muted-foreground)]">
                                            Sin visitas
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {createList.length > 0 && (
                                                <div>
                                                    <div className="text-[10px] font-semibold text-[var(--foreground)]">
                                                        Crear
                                                    </div>
                                                    <div className="text-[10px] text-[var(--muted-foreground)] break-words">
                                                        {createText}
                                                    </div>
                                                </div>
                                            )}
                                            {receiveList.length > 0 && (
                                                <div>
                                                    <div className="text-[10px] font-semibold text-[var(--foreground)]">
                                                        Recibir
                                                    </div>
                                                    <div className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                                                        <div className="space-y-0.5">
                                                            {receiveText.map((row) => (
                                                                <div
                                                                    key={row.name}
                                                                    className="flex items-baseline justify-between gap-2"
                                                                >
                                                                    <span className="min-w-0 flex-1 truncate">{row.name}</span>
                                                                    <span className="flex-none tabular-nums">
                                                                        {row.amount > 0 ? formatAmount(row.amount) : ""}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            <div className="mt-1 pt-1 border-t border-[var(--input-border)] flex items-baseline justify-between gap-2">
                                                                <span className="font-semibold text-[var(--foreground)]">TOTAL</span>
                                                                <span
                                                                    className={`flex-none tabular-nums font-semibold ${receiveTotalClassName}`}
                                                                >
                                                                    {formatAmount(receiveTotal)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </button>
        );
    }

    return (
        <div
            className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl shadow-md p-6 col-span-1 sm:col-span-2 md:col-span-3 lg:col-span-4"
            style={{ minHeight: 160 }}
        >
            <div className="flex items-center justify-between gap-3 mb-4">
                <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">
                        Semana (proveedores)
                    </h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                        {supplierWeekRangeLabel
                            ? `Semana: ${supplierWeekRangeLabel} (Domingo a Sábado)`
                            : "Crea pedido y recibe pedido (Domingo a Sábado)"}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onPrevWeek}
                        className="px-3 py-2 rounded-md text-sm font-semibold bg-[var(--hover-bg)] border border-[var(--input-border)] text-[var(--foreground)]"
                        aria-label="Semana anterior"
                    >
                        &lt;
                    </button>
                    <button
                        type="button"
                        onClick={onNextWeek}
                        className="px-3 py-2 rounded-md text-sm font-semibold bg-[var(--hover-bg)] border border-[var(--input-border)] text-[var(--foreground)]"
                        aria-label="Semana siguiente"
                    >
                        &gt;
                    </button>
                </div>
            </div>

            {/* Control de pedido (solo en /#SupplierWeek) */}
            <div className="bg-[var(--hover-bg)] rounded-lg p-4 mb-4">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (!canSave) return;
                        handleSaveControlPedido();
                    }}
                >
                    <div className="text-sm font-semibold text-[var(--foreground)] mb-2">
                        Registrar pedido
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <div className="text-xs text-[var(--muted-foreground)] mb-1">
                                Día seleccionado
                            </div>
                            <div className="text-sm text-[var(--foreground)]">
                                {selectedDay
                                    ? `${selectedDay.label} (${selectedDay.date.getDate()}/${selectedDay.date.getMonth() + 1})`
                                    : "Selecciona un día abajo"}
                            </div>
                        </div>

                        <div>
                            <div className="text-xs text-[var(--muted-foreground)] mb-1">
                                Proveedor
                            </div>
                            <select
                                className="w-full bg-[var(--background)] border border-[var(--input-border)] rounded-md px-3 py-2 text-sm text-[var(--foreground)]"
                                value={selectedProviderCode}
                                onChange={(e) => {
                                    setSelectedProviderCode(e.target.value);
                                    setSelectedReceiveDateKey(null);
                                }}
                                disabled={!selectedDay || eligibleProviders.length === 0}
                            >
                                <option value="">
                                    {!selectedDay
                                        ? "Selecciona un día"
                                        : eligibleProviders.length === 0
                                            ? "Sin proveedores para ese día"
                                            : "Selecciona proveedor"}
                                </option>
                                {eligibleProviders.map((p) => (
                                    <option key={`prov-${p.code}`} value={p.code}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <div className="text-xs text-[var(--muted-foreground)] mb-1">
                                Monto
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    inputMode="decimal"
                                    min={0}
                                    step="0.01"
                                    className="flex-1 bg-[var(--background)] border border-[var(--input-border)] rounded-md px-3 py-2 text-sm text-[var(--foreground)]"
                                    value={orderAmount}
                                    onChange={(e) => setOrderAmount(e.target.value)}
                                    disabled={!selectedProviderCode || orderSaving}
                                />
                                <button
                                    type="submit"
                                    disabled={!canSave}
                                    className="px-4 py-2 rounded-md text-sm font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {orderSaving ? "Guardando..." : "Guardar"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {(controlLoading || controlError) && (
                        <div className="mt-3 text-xs">
                            {controlLoading && (
                                <div className="text-[var(--muted-foreground)]">
                                    Cargando control de pedido...
                                </div>
                            )}
                            {controlError && (
                                <div className="text-red-500">{controlError}</div>
                            )}
                        </div>
                    )}
                </form>
            </div>

            {!companyForProviders ? (
                <div className="text-sm text-[var(--muted-foreground)]">
                    No se pudo determinar la empresa del usuario.
                </div>
            ) : weeklyProvidersLoading ? (
                <div className="text-sm text-[var(--muted-foreground)]">
                    Cargando proveedores...
                </div>
            ) : weeklyProvidersError ? (
                <div className="text-sm text-red-500">{weeklyProvidersError}</div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {weekModel.days.map((d) => {
                        const createList = weekModel.createByCode.get(d.code) || [];
                        const receiveList = weekModel.receiveByCode.get(d.code) || [];
                        const hasAny = createList.length > 0 || receiveList.length > 0;
                        const isSelected = selectedDay && selectedDay.dateKey === d.dateKey;
                        const todayStyle = d.isToday
                            ? {
                                borderColor: "var(--success)",
                                backgroundColor:
                                    "color-mix(in srgb, var(--success) 18%, var(--card-bg))",
                            }
                            : undefined;
                        const selectionStyle = isSelected
                            ? {
                                borderColor: "var(--primary)",
                                boxShadow: "0 0 0 1px var(--primary)",
                            }
                            : undefined;

                        const amountsMap = receiveAmountByProviderCodeForDay(d.dateKey);
                        const createText = createList.map((p) => p.name).join(", ");
                        const receiveText = receiveList.map((p) => ({
                            name: p.name,
                            amount: amountsMap.get(p.code) || 0,
                        }));
                        const receiveTotal = receiveText.reduce(
                            (sum, row) => sum + (row.amount > 0 ? row.amount : 0),
                            0
                        );
                        const receiveTotalClassName =
                            typeof fondoGeneralBalanceCRC === "number"
                                ? receiveTotal <= fondoGeneralBalanceCRC
                                    ? "text-[var(--success)]"
                                    : "text-[var(--error)]"
                                : "text-[var(--muted-foreground)]";

                        return (
                            <button
                                type="button"
                                key={`week-${d.code}`}
                                onClick={() => {
                                    setSelectedCreateDateKey(d.dateKey);
                                    setSelectedProviderCode("");
                                    setSelectedReceiveDateKey(null);
                                }}
                                className="rounded-lg border border-[var(--input-border)] p-2 bg-[var(--muted)] text-left cursor-pointer"
                                style={{ ...todayStyle, ...selectionStyle }}
                            >
                                <div className="flex items-baseline justify-between gap-2">
                                    <div className="text-xs font-semibold text-[var(--foreground)]">
                                        {d.code}
                                    </div>
                                    <div className="text-[10px] text-[var(--muted-foreground)]">
                                        {d.date.getDate()}/{d.date.getMonth() + 1}
                                    </div>
                                </div>
                                <div className="text-[10px] text-[var(--muted-foreground)] mb-2">
                                    {d.label}
                                </div>

                                {!hasAny ? (
                                    <div className="text-[10px] text-[var(--muted-foreground)]">
                                        Sin visitas
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {createList.length > 0 && (
                                            <div>
                                                <div className="text-[10px] font-semibold text-[var(--foreground)]">
                                                    Crear
                                                </div>
                                                <div className="text-[10px] text-[var(--muted-foreground)] break-words">
                                                    {createText}
                                                </div>
                                            </div>
                                        )}
                                        {receiveList.length > 0 && (
                                            <div>
                                                <div className="text-[10px] font-semibold text-[var(--foreground)]">
                                                    Recibir
                                                </div>
                                                <div className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                                                    <div className="space-y-0.5">
                                                        {receiveText.map((row) => (
                                                            <div
                                                                key={row.name}
                                                                className="flex items-baseline justify-between gap-2"
                                                            >
                                                                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                                                                <span className="flex-none tabular-nums">
                                                                    {row.amount > 0 ? formatAmount(row.amount) : ""}
                                                                </span>
                                                            </div>
                                                        ))}
                                                        <div className="mt-1 pt-1 border-t border-[var(--input-border)] flex items-baseline justify-between gap-2">
                                                            <span className="font-semibold text-[var(--foreground)]">TOTAL</span>
                                                            <span
                                                                className={`flex-none tabular-nums font-semibold ${receiveTotalClassName}`}
                                                            >
                                                                {formatAmount(receiveTotal)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
