"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { 
    FileText, 
    Lock, 
    Calendar,
    Filter,
    Download,
    Search,
    X,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Building2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getDefaultPermissions } from '@/utils/permissions';
import { MovimientosFondosService, MovementAccountKey } from '@/services/movimientos-fondos';
import { useProviders } from '@/hooks/useProviders';
import { EmpresasService } from '@/services/empresas';
import type { Empresas } from '@/types/firestore';

// Types from fondo.tsx
const FONDO_INGRESO_TYPES = ['VENTAS', 'OTROS INGRESOS'] as const;
const FONDO_EGRESO_TYPES = [
    'COMPRA INVENTARIO',
    'SALARIOS',
    'REPARACION EQUIPO',
    'PAGO TIEMPOS',
    'PAGO BANCA',
    'CARGAS SOCIALES',
    'ELECTRICIDAD',
] as const;

type FondoMovementType = typeof FONDO_INGRESO_TYPES[number] | typeof FONDO_EGRESO_TYPES[number];

type FondoEntry = {
    id: string;
    providerCode: string;
    invoiceNumber: string;
    paymentType: FondoMovementType;
    amountEgreso: number;
    amountIngreso: number;
    manager: string;
    notes: string;
    createdAt: string;
    accountId?: MovementAccountKey;
    currency?: 'CRC' | 'USD';
    isAudit?: boolean;
    originalEntryId?: string;
    auditDetails?: string;
};

const isIngresoType = (type: FondoMovementType) => 
    (FONDO_INGRESO_TYPES as readonly string[]).includes(type);

const formatCurrency = (amount: number, currency: 'CRC' | 'USD') => {
    const formatter = new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
    return formatter.format(amount);
};

const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('es-CR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
};

export default function ReportePage() {
    const { user, loading } = useAuth();
    const permissions = user?.permissions || getDefaultPermissions(user?.role || 'user');
    const hasGeneralAccess = Boolean(permissions.fondogeneral);
    const isAdminUser = user?.role === 'admin';
    const assignedCompany = user?.ownercompanie?.trim() ?? '';
    const ownerId = (user?.ownerId || '').trim();

    // Company selection state
    const [selectedCompany, setSelectedCompany] = useState(assignedCompany);
    const [ownerCompanies, setOwnerCompanies] = useState<Empresas[]>([]);
    const [companiesLoading, setCompaniesLoading] = useState(false);

    // Movements data
    const [allMovements, setAllMovements] = useState<FondoEntry[]>([]);
    const [movementsLoading, setMovementsLoading] = useState(false);
    
    // Providers
    const { providers } = useProviders(selectedCompany);
    const providersMap = useMemo(() => {
        return new Map(providers.map(p => [p.code, p.name]));
    }, [providers]);

    // Filter states
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [selectedProvider, setSelectedProvider] = useState<string>('all');
    const [selectedType, setSelectedType] = useState<FondoMovementType | 'all'>('all');
    const [selectedAccount, setSelectedAccount] = useState<MovementAccountKey | 'all'>('all');
    const [selectedCurrency, setSelectedCurrency] = useState<'CRC' | 'USD' | 'all'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMode, setFilterMode] = useState<'all' | 'ingreso' | 'egreso'>('all');
    const [reportType, setReportType] = useState<'all' | 'solo-gastos' | 'gastos-egresos'>('all');

    // Load companies for admin users
    useEffect(() => {
        if (!isAdminUser || !ownerId) {
            setOwnerCompanies([]);
            return;
        }

        setCompaniesLoading(true);
        EmpresasService.getAllEmpresas()
            .then(empresas => {
                const filtered = empresas.filter(emp => (emp.ownerId || '').trim() === ownerId);
                setOwnerCompanies(filtered.sort((a, b) => 
                    (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' })
                ));
            })
            .catch(err => console.error('Error loading companies:', err))
            .finally(() => setCompaniesLoading(false));
    }, [isAdminUser, ownerId]);

    // Load movements data
    useEffect(() => {
        if (!selectedCompany) {
            setAllMovements([]);
            return;
        }

        const loadMovements = async () => {
            setMovementsLoading(true);
            try {
                const companyKey = MovimientosFondosService.buildCompanyMovementsKey(selectedCompany);
                const storage = await MovimientosFondosService.getDocument<FondoEntry>(companyKey);
                
                if (storage?.operations?.movements) {
                    const movements = storage.operations.movements as FondoEntry[];
                    setAllMovements(movements.sort((a, b) => 
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    ));
                } else {
                    setAllMovements([]);
                }
            } catch (err) {
                console.error('Error loading movements:', err);
                setAllMovements([]);
            } finally {
                setMovementsLoading(false);
            }
        };

        void loadMovements();
    }, [selectedCompany]);

    // Apply filters
    const filteredMovements = useMemo(() => {
        let filtered = allMovements.slice();

        // Filter by date range
        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            filtered = filtered.filter(m => new Date(m.createdAt) >= fromDate);
        }
        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            filtered = filtered.filter(m => new Date(m.createdAt) <= toDate);
        }

        // Filter by provider
        if (selectedProvider !== 'all') {
            filtered = filtered.filter(m => m.providerCode === selectedProvider);
        }

        // Filter by movement type
        if (selectedType !== 'all') {
            filtered = filtered.filter(m => m.paymentType === selectedType);
        }

        // Filter by account
        if (selectedAccount !== 'all') {
            filtered = filtered.filter(m => m.accountId === selectedAccount);
        }

        // Filter by currency
        if (selectedCurrency !== 'all') {
            filtered = filtered.filter(m => m.currency === selectedCurrency);
        }

        // Filter by income/expense mode
        if (filterMode === 'ingreso') {
            filtered = filtered.filter(m => isIngresoType(m.paymentType));
        } else if (filterMode === 'egreso') {
            filtered = filtered.filter(m => !isIngresoType(m.paymentType));
        }

        // Filter by report type
        if (reportType === 'solo-gastos') {
            // Solo gastos específicos (sin egresos bancarios)
            filtered = filtered.filter(m => 
                !isIngresoType(m.paymentType) && 
                !['PAGO TIEMPOS', 'PAGO BANCA'].includes(m.paymentType)
            );
        } else if (reportType === 'gastos-egresos') {
            // Todos los egresos (gastos + egresos)
            filtered = filtered.filter(m => !isIngresoType(m.paymentType));
        }

        // Search filter
        const query = searchQuery.trim().toLowerCase();
        if (query) {
            filtered = filtered.filter(m => {
                const providerName = providersMap.get(m.providerCode) ?? '';
                return (
                    m.invoiceNumber.toLowerCase().includes(query) ||
                    m.notes.toLowerCase().includes(query) ||
                    providerName.toLowerCase().includes(query) ||
                    m.manager.toLowerCase().includes(query) ||
                    m.paymentType.toLowerCase().includes(query)
                );
            });
        }

        return filtered;
    }, [allMovements, dateFrom, dateTo, selectedProvider, selectedType, selectedAccount, 
        selectedCurrency, filterMode, searchQuery, providersMap]);

    // Calculate totals
    const totals = useMemo(() => {
        const crcIngresos = filteredMovements
            .filter(m => m.currency === 'CRC' && isIngresoType(m.paymentType))
            .reduce((sum, m) => sum + m.amountIngreso, 0);
        
        const crcEgresos = filteredMovements
            .filter(m => m.currency === 'CRC' && !isIngresoType(m.paymentType))
            .reduce((sum, m) => sum + m.amountEgreso, 0);
        
        const usdIngresos = filteredMovements
            .filter(m => m.currency === 'USD' && isIngresoType(m.paymentType))
            .reduce((sum, m) => sum + m.amountIngreso, 0);
        
        const usdEgresos = filteredMovements
            .filter(m => m.currency === 'USD' && !isIngresoType(m.paymentType))
            .reduce(( sum, m) => sum + m.amountEgreso, 0);

        // Calculate only expenses (gastos) total
        const crcGastos = filteredMovements
            .filter(m => m.currency === 'CRC' && !isIngresoType(m.paymentType) && 
                !['PAGO TIEMPOS', 'PAGO BANCA'].includes(m.paymentType))
            .reduce((sum, m) => sum + m.amountEgreso, 0);
        
        const usdGastos = filteredMovements
            .filter(m => m.currency === 'USD' && !isIngresoType(m.paymentType) && 
                !['PAGO TIEMPOS', 'PAGO BANCA'].includes(m.paymentType))
            .reduce((sum, m) => sum + m.amountEgreso, 0);

        return {
            crcIngresos,
            crcEgresos,
            crcGastos,
            crcBalance: crcIngresos - crcEgresos,
            usdIngresos,
            usdEgresos,
            usdGastos,
            usdBalance: usdIngresos - usdEgresos,
        };
    }, [filteredMovements]);

    // Export to CSV
    const handleExport = () => {
        if (filteredMovements.length === 0) return;

        const headers = ['Fecha', 'Cuenta', 'Moneda', 'Proveedor', 'Factura', 'Tipo', 'Ingreso', 'Egreso', 'Encargado', 'Notas'];
        const rows = filteredMovements.map(m => [
            formatDate(m.createdAt),
            m.accountId || 'FondoGeneral',
            m.currency || 'CRC',
            providersMap.get(m.providerCode) ?? m.providerCode,
            m.invoiceNumber,
            m.paymentType,
            isIngresoType(m.paymentType) ? m.amountIngreso.toString() : '0',
            !isIngresoType(m.paymentType) ? m.amountEgreso.toString() : '0',
            m.manager,
            m.notes
        ]);

        const csv = [headers, ...rows].map(row => 
            row.map(cell => `"${cell}"`).join(',')
        ).join('\n');

        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `reporte-movimientos-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // Clear all filters
    const clearFilters = () => {
        setDateFrom('');
        setDateTo('');
        setSelectedProvider('all');
        setSelectedType('all');
        setSelectedAccount('all');
        setSelectedCurrency('all');
        setSearchQuery('');
        setFilterMode('all');
        setReportType('all');
    };

    const activeFiltersCount = [
        dateFrom, dateTo, 
        selectedProvider !== 'all',
        selectedType !== 'all',
        selectedAccount !== 'all',
        selectedCurrency !== 'all',
        searchQuery,
        filterMode !== 'all',
        reportType !== 'all'
    ].filter(Boolean).length;

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto py-8 px-4">
                <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
                    <p className="text-[var(--muted-foreground)]">Cargando permisos...</p>
                </div>
            </div>
        );
    }

    if (!hasGeneralAccess) {
        return (
            <div className="max-w-7xl mx-auto py-8 px-4">
                <div className="flex flex-col items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] text-center">
                    <Lock className="w-10 h-10 text-[var(--muted-foreground)] mb-4" />
                    <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Acceso restringido</h3>
                    <p className="text-[var(--muted-foreground)]">No tienes permisos para acceder a los reportes del Fondo General.</p>
                    <p className="text-sm text-[var(--muted-foreground)] mt-2">Contacta a un administrador para obtener acceso.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4">
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <FileText className="w-8 h-8 mr-3 text-[var(--foreground)]" />
                        <h1 className="text-2xl font-bold text-[var(--foreground)]">Reportes de Movimientos</h1>
                    </div>
                    
                    {isAdminUser && ownerCompanies.length > 0 && (
                        <div className="flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-[var(--muted-foreground)]" />
                            <select
                                value={selectedCompany}
                                onChange={(e) => setSelectedCompany(e.target.value)}
                                className="px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            >
                                {ownerCompanies.map(company => (
                                    <option key={company.id} value={company.name}>
                                        {company.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Report Type Selector */}
                <div className="mb-6">
                    <div className="bg-[var(--muted)] border border-[var(--border)] rounded-lg p-4">
                        <h2 className="text-sm font-semibold text-[var(--foreground)] mb-3">Tipo de Reporte</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <button
                                onClick={() => setReportType('all')}
                                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                                    reportType === 'all'
                                        ? 'bg-[var(--accent)] text-white shadow-lg'
                                        : 'bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--input-border)] hover:border-[var(--accent)]'
                                }`}
                            >
                                <div className="text-left">
                                    <div className="font-semibold">Todos los Movimientos</div>
                                    <div className="text-xs opacity-80 mt-1">Ingresos y egresos completos</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setReportType('solo-gastos')}
                                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                                    reportType === 'solo-gastos'
                                        ? 'bg-orange-600 text-white shadow-lg'
                                        : 'bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--input-border)] hover:border-orange-600'
                                }`}
                            >
                                <div className="text-left">
                                    <div className="font-semibold">Solo Gastos</div>
                                    <div className="text-xs opacity-80 mt-1">Gastos operativos únicamente</div>
                                </div>
                            </button>
                            <button
                                onClick={() => setReportType('gastos-egresos')}
                                className={`px-4 py-3 rounded-lg font-medium transition-all ${
                                    reportType === 'gastos-egresos'
                                        ? 'bg-red-600 text-white shadow-lg'
                                        : 'bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--input-border)] hover:border-red-600'
                                }`}
                            >
                                <div className="text-left">
                                    <div className="font-semibold">Gastos y Egresos</div>
                                    <div className="text-xs opacity-80 mt-1">Total de salidas de dinero</div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                    {reportType === 'all' && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">Ingresos CRC</span>
                            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                            {formatCurrency(totals.crcIngresos, 'CRC')}
                        </p>
                    </div>
                    )}

                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-red-700 dark:text-red-400">
                                {reportType === 'solo-gastos' ? 'Gastos CRC' : 
                                 reportType === 'gastos-egresos' ? 'Gastos y Egresos CRC' : 
                                 'Egresos CRC'}
                            </span>
                            <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <p className="text-2xl font-bold text-red-800 dark:text-red-300">
                            {formatCurrency(
                                reportType === 'solo-gastos' ? totals.crcGastos : totals.crcEgresos, 
                                'CRC'
                            )}
                        </p>
                    </div>

                    {reportType === 'all' && (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Balance CRC</span>
                                <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                                {formatCurrency(totals.crcBalance, 'CRC')}
                            </p>
                        </div>
                    )}

                    {reportType === 'all' && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-700 dark:text-green-400">Ingresos USD</span>
                            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                            {formatCurrency(totals.usdIngresos, 'USD')}
                        </p>
                    </div>
                    )}

                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-red-700 dark:text-red-400">
                                {reportType === 'solo-gastos' ? 'Gastos USD' : 
                                 reportType === 'gastos-egresos' ? 'Gastos y Egresos USD' : 
                                 'Egresos USD'}
                            </span>
                            <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                        </div>
                        <p className="text-2xl font-bold text-red-800 dark:text-red-300">
                            {formatCurrency(
                                reportType === 'solo-gastos' ? totals.usdGastos : totals.usdEgresos, 
                                'USD'
                            )}
                        </p>
                    </div>

                    {reportType === 'all' && (
                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Balance USD</span>
                            <DollarSign className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                            {formatCurrency(totals.usdBalance, 'USD')}
                        </p>
                    </div>
                    )}
                </div>

                {/* Filters Section */}
                <div className="bg-[var(--muted)] border border-[var(--border)] rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Filter className="w-5 h-5 text-[var(--foreground)]" />
                            <h2 className="text-lg font-semibold text-[var(--foreground)]">Filtros</h2>
                            {activeFiltersCount > 0 && (
                                <span className="px-2 py-1 bg-[var(--accent)] text-white text-xs rounded-full">
                                    {activeFiltersCount}
                                </span>
                            )}
                        </div>
                        {activeFiltersCount > 0 && (
                            <button
                                onClick={clearFilters}
                                className="flex items-center gap-1 px-3 py-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                            >
                                <X className="w-4 h-4" />
                                Limpiar filtros
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        {/* Date From */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Fecha Desde
                            </label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            />
                        </div>

                        {/* Date To */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Fecha Hasta
                            </label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            />
                        </div>

                        {/* Provider Filter */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                                Proveedor
                            </label>
                            <select
                                value={selectedProvider}
                                onChange={(e) => setSelectedProvider(e.target.value)}
                                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            >
                                <option value="all">Todos los proveedores</option>
                                {providers.map(p => (
                                    <option key={p.code} value={p.code}>
                                        {p.name} ({p.code})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Type Filter */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                                Tipo de Movimiento
                            </label>
                            <select
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value as FondoMovementType | 'all')}
                                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            >
                                <option value="all">Todos los tipos</option>
                                <optgroup label="Ingresos">
                                    {FONDO_INGRESO_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Egresos">
                                    {FONDO_EGRESO_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>

                        {/* Account Filter */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                                Cuenta
                            </label>
                            <select
                                value={selectedAccount}
                                onChange={(e) => setSelectedAccount(e.target.value as MovementAccountKey | 'all')}
                                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            >
                                <option value="all">Todas las cuentas</option>
                                <option value="FondoGeneral">Fondo General</option>
                                <option value="BCR">BCR</option>
                                <option value="BN">BN</option>
                                <option value="BAC">BAC</option>
                            </select>
                        </div>

                        {/* Currency Filter */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                                Moneda
                            </label>
                            <select
                                value={selectedCurrency}
                                onChange={(e) => setSelectedCurrency(e.target.value as 'CRC' | 'USD' | 'all')}
                                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            >
                                <option value="all">Todas las monedas</option>
                                <option value="CRC">CRC (Colones)</option>
                                <option value="USD">USD (Dólares)</option>
                            </select>
                        </div>
                    </div>

                    {/* Filter Mode and Search */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Filter Mode */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                                Filtrar por
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setFilterMode('all')}
                                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                                        filterMode === 'all'
                                            ? 'bg-[var(--accent)] text-white'
                                            : 'bg-[var(--input-bg)] text-[var(--foreground)] border border-[var(--input-border)]'
                                    }`}
                                >
                                    Todos
                                </button>
                                <button
                                    onClick={() => setFilterMode('ingreso')}
                                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                                        filterMode === 'ingreso'
                                            ? 'bg-green-600 text-white'
                                            : 'bg-[var(--input-bg)] text-[var(--foreground)] border border-[var(--input-border)]'
                                    }`}
                                >
                                    Ingresos
                                </button>
                                <button
                                    onClick={() => setFilterMode('egreso')}
                                    className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                                        filterMode === 'egreso'
                                            ? 'bg-red-600 text-white'
                                            : 'bg-[var(--input-bg)] text-[var(--foreground)] border border-[var(--input-border)]'
                                    }`}
                                >
                                    Egresos
                                </button>
                            </div>
                        </div>

                        {/* Search */}
                        <div>
                            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                                <Search className="w-4 h-4 inline mr-1" />
                                Buscar
                            </label>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Factura, notas, proveedor, encargado..."
                                className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--foreground)] placeholder-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                            />
                        </div>
                    </div>
                </div>

                {/* Export Button */}
                <div className="flex justify-between items-center mb-4">
                    <p className="text-[var(--muted-foreground)]">
                        Mostrando {filteredMovements.length} de {allMovements.length} movimientos
                    </p>
                    <button
                        onClick={handleExport}
                        disabled={filteredMovements.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent)]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Exportar CSV
                    </button>
                </div>

                {/* Movements Table */}
                {movementsLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <p className="text-[var(--muted-foreground)]">Cargando movimientos...</p>
                    </div>
                ) : filteredMovements.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <FileText className="w-12 h-12 text-[var(--muted-foreground)] mb-3" />
                        <p className="text-[var(--muted-foreground)]">
                            {allMovements.length === 0 
                                ? 'No hay movimientos registrados para esta empresa'
                                : 'No se encontraron movimientos con los filtros aplicados'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Fecha</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Cuenta</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Moneda</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Proveedor</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Tipo</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold text-[var(--foreground)]">Ingreso</th>
                                    <th className="px-4 py-3 text-right text-sm font-semibold text-[var(--foreground)]">Egreso</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Encargado</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--foreground)]">Factura</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMovements.map((movement) => (
                                    <tr key={movement.id} className="border-b border-[var(--border)] hover:bg-[var(--muted)]/50 transition-colors">
                                        <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                                            {formatDate(movement.createdAt)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                                            {movement.accountId || 'FondoGeneral'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                                            {movement.currency || 'CRC'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                                            {providersMap.get(movement.providerCode) ?? movement.providerCode}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                isIngresoType(movement.paymentType)
                                                    ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                                                    : 'bg-red-500/20 text-red-700 dark:text-red-400'
                                            }`}>
                                                {movement.paymentType}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-green-700 dark:text-green-400">
                                            {movement.amountIngreso > 0 
                                                ? formatCurrency(movement.amountIngreso, movement.currency || 'CRC')
                                                : '-'
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-red-700 dark:text-red-400">
                                            {movement.amountEgreso > 0 
                                                ? formatCurrency(movement.amountEgreso, movement.currency || 'CRC')
                                                : '-'
                                            }
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                                            {movement.manager}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-[var(--muted-foreground)]">
                                            {movement.invoiceNumber || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
