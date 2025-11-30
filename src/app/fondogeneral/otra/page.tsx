"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, Loader2, Lock, TrendingUp, TrendingDown, CreditCard, Banknote, PieChart, BarChart3, Download, Printer, Save, ArrowUpDown, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useActorOwnership } from '@/hooks/useActorOwnership';
import { getDefaultPermissions } from '@/utils/permissions';
import { EmpresasService } from '@/services/empresas';
import {
    MovimientosFondosService,
    type MovementAccountKey,
    type MovementCurrencyKey,
} from '@/services/movimientos-fondos';
import {
    sanitizeFondoEntries,
    isGastoType,
    isIngresoType,
    formatMovementType,
    type FondoEntry,
    type FondoMovementType,
} from '@/app/fondogeneral/components/fondo';
import { PieChart as RechartsPieChart, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Pie } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';

type Classification = 'ingreso' | 'gasto' | 'egreso';

type CurrencyBucket = {
    ingreso: number;
    gasto: number;
    egreso: number;
};

type SummaryRow = {
    paymentType: FondoMovementType;
    label: string;
    classification: Classification;
    totals: Record<MovementCurrencyKey, CurrencyBucket>;
};

const ACCOUNT_LABELS: Record<MovementAccountKey, string> = {
    FondoGeneral: 'Fondo General',
    BCR: 'Cuenta BCR',
    BN: 'Cuenta BN',
    BAC: 'Cuenta BAC',
};

const ACCOUNT_ORDER: MovementAccountKey[] = ['FondoGeneral', 'BCR', 'BN', 'BAC'];
const MOVEMENT_ACCOUNT_SET = new Set<MovementAccountKey>(ACCOUNT_ORDER);
const ALL_COMPANIES_VALUE = '__all_companies__';
const ALL_ACCOUNTS_VALUE = 'all';
type AccountSelectValue = MovementAccountKey | typeof ALL_ACCOUNTS_VALUE;

const isMovementAccountKey = (value: unknown): value is MovementAccountKey =>
    typeof value === 'string' && MOVEMENT_ACCOUNT_SET.has(value as MovementAccountKey);

const formatClassification = (classification: Classification) => {
    if (classification === 'ingreso') return 'Ingreso';
    if (classification === 'gasto') return 'Gasto';
    return 'Egreso';
};

const buildDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function ReporteMovimientosPage() {
    const { user, loading: authLoading } = useAuth();
    const { ownerIds: actorOwnerIds } = useActorOwnership(user);
    const permissions = user?.permissions || getDefaultPermissions(user?.role || 'user');
    const hasGeneralAccess = Boolean(permissions.fondogeneral);
    const assignedCompany = user?.ownercompanie?.trim() ?? '';
    const isAdminUser = user?.role === 'admin' || user?.role === 'superadmin';

    const allowedOwnerIds = useMemo(() => {
        const set = new Set<string>();
        actorOwnerIds.forEach(id => {
            if (id === undefined || id === null) return;
            const normalized = String(id).trim();
            if (normalized) set.add(normalized);
        });
        if (user?.ownerId !== undefined && user?.ownerId !== null) {
            const normalized = String(user.ownerId).trim();
            if (normalized) set.add(normalized);
        }
        return set;
    }, [actorOwnerIds, user?.ownerId]);

    const accessibleAccountKeys = useMemo<MovementAccountKey[]>(() => {
        const list: MovementAccountKey[] = [];
        if (permissions.fondogeneral) list.push('FondoGeneral');
        if (permissions.fondogeneralBCR) list.push('BCR');
        if (permissions.fondogeneralBN) list.push('BN');
        if (permissions.fondogeneralBAC) list.push('BAC');
        return list;
    }, [permissions]);

    const accountSelectOptions = useMemo<(AccountSelectValue)[]>(() => {
        if (accessibleAccountKeys.length > 1) {
            return [ALL_ACCOUNTS_VALUE, ...accessibleAccountKeys];
        }
        return accessibleAccountKeys;
    }, [accessibleAccountKeys]);

    const [companies, setCompanies] = useState<string[]>([]);
    const [companiesLoading, setCompaniesLoading] = useState(false);
    const [companiesError, setCompaniesError] = useState<string | null>(null);
    const [selectedCompany, setSelectedCompany] = useState('');
    const [selectedAccount, setSelectedAccount] = useState<AccountSelectValue | ''>('');
    const [entries, setEntries] = useState<FondoEntry[]>([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [dataError, setDataError] = useState<string | null>(null);
    const [classificationFilter, setClassificationFilter] = useState<'all' | 'gasto' | 'egreso' | 'ingreso'>('all');
    const [selectedMovementTypes, setSelectedMovementTypes] = useState<FondoMovementType[]>([]);
    const [movementTypeSelectorOpen, setMovementTypeSelectorOpen] = useState(false);
    const [showUSD, setShowUSD] = useState(false);
    const movementTypeSelectorRef = useRef<HTMLDivElement | null>(null);

    // New state for enhanced features
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [expandedRows, setExpandedRows] = useState<Set<FondoMovementType>>(new Set());
    const [showCharts, setShowCharts] = useState(true);
    const [savedFilters, setSavedFilters] = useState<Array<{name: string, filters: any}>>([]);
    const [currentFilterName, setCurrentFilterName] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);

    const handleClassificationToggle = useCallback((target: 'gasto' | 'egreso' | 'ingreso') => {
        setClassificationFilter(prev => (prev === target ? 'all' : target));
    }, []);

    const movementTypeMetadata = useMemo(() => {
        const registry = new Map<FondoMovementType, string>();
        entries.forEach(entry => {
            registry.set(entry.paymentType, formatMovementType(entry.paymentType));
        });
        const sorted = Array.from(registry.entries()).sort((a, b) => a[1].localeCompare(b[1], 'es', { sensitivity: 'base' }));
        return {
            options: sorted,
            labelMap: Object.fromEntries(sorted) as Partial<Record<FondoMovementType, string>>,
        };
    }, [entries]);

    const movementTypeOptions = movementTypeMetadata.options;
    const movementTypeLabelMap = movementTypeMetadata.labelMap;

    const toggleMovementType = useCallback((movementType: FondoMovementType) => {
        setSelectedMovementTypes(prev => (prev.includes(movementType)
            ? prev.filter(candidate => candidate !== movementType)
            : [...prev, movementType]));
    }, []);

    const clearMovementTypeFilters = useCallback(() => {
        setSelectedMovementTypes([]);
        setMovementTypeSelectorOpen(false);
    }, []);

    const movementTypeSummaryLabel = useMemo(() => {
        if (selectedMovementTypes.length === 0) return 'Todos los tipos';
        if (selectedMovementTypes.length === 1) {
            const type = selectedMovementTypes[0];
            return movementTypeLabelMap[type] ?? formatMovementType(type);
        }
        return `${selectedMovementTypes.length} tipos seleccionados`;
    }, [selectedMovementTypes, movementTypeLabelMap]);

    const today = useMemo(() => new Date(), []);
    const initialFrom = useMemo(() => {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return buildDateString(start);
    }, [today]);
    const initialTo = useMemo(() => buildDateString(today), [today]);

    const [fromDate, setFromDate] = useState(initialFrom);
    const [toDate, setToDate] = useState(initialTo);

    const dateRangeInvalid = useMemo(() => {
        if (!fromDate || !toDate) return false;
        const from = Date.parse(`${fromDate}T00:00:00`);
        const to = Date.parse(`${toDate}T23:59:59`);
        if (Number.isNaN(from) || Number.isNaN(to)) return false;
        return from > to;
    }, [fromDate, toDate]);

    const currencyFormatters = useMemo(() => ({
        CRC: new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    }), []);

    const formatAmount = useCallback(
        (currency: MovementCurrencyKey, amount: number) => {
            const normalized = Math.trunc(Number.isFinite(amount) ? amount : 0);
            if (normalized === 0) return '—';
            return currencyFormatters[currency].format(normalized);
        },
        [currencyFormatters],
    );

    // Quick filter functions
    const setTodayRange = useCallback(() => {
        const today = new Date();
        const todayStr = buildDateString(today);
        setFromDate(todayStr);
        setToDate(todayStr);
    }, []);

    const setThisWeekRange = useCallback(() => {
        const today = new Date();
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        setFromDate(buildDateString(startOfWeek));
        setToDate(buildDateString(today));
    }, []);

    const setThisMonthRange = useCallback(() => {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        setFromDate(buildDateString(startOfMonth));
        setToDate(buildDateString(today));
    }, []);

    const setLastQuarterRange = useCallback(() => {
        const today = new Date();
        const quarter = Math.floor(today.getMonth() / 3);
        const startOfQuarter = new Date(today.getFullYear(), quarter * 3, 1);
        const endOfQuarter = new Date(today.getFullYear(), (quarter * 3) + 3, 0);
        setFromDate(buildDateString(startOfQuarter));
        setToDate(buildDateString(endOfQuarter));
    }, []);

    const clearAllFilters = useCallback(() => {
        setSelectedMovementTypes([]);
        setClassificationFilter('all');
        setShowUSD(false);
        setSortColumn(null);
        setSortDirection('asc');
        setExpandedRows(new Set());
    }, []);

    // Sorting function
    const handleSort = useCallback((column: string) => {
        if (sortColumn === column) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    }, [sortColumn]);

    // Toggle expanded row
    const toggleExpandedRow = useCallback((paymentType: FondoMovementType) => {
        setExpandedRows(prev => {
            const newSet = new Set(prev);
            if (newSet.has(paymentType)) {
                newSet.delete(paymentType);
            } else {
                newSet.add(paymentType);
            }
            return newSet;
        });
    }, []);

    // Save/load filter configurations
    const saveCurrentFilters = useCallback(() => {
        if (!currentFilterName.trim()) return;
        
        const filters = {
            selectedCompany,
            selectedAccount,
            fromDate,
            toDate,
            selectedMovementTypes,
            classificationFilter,
            showUSD,
        };
        
        setSavedFilters(prev => [...prev, { name: currentFilterName, filters }]);
        setCurrentFilterName('');
    }, [currentFilterName, selectedCompany, selectedAccount, fromDate, toDate, selectedMovementTypes, classificationFilter, showUSD]);

    const loadSavedFilters = useCallback((filters: any) => {
        setSelectedCompany(filters.selectedCompany);
        setSelectedAccount(filters.selectedAccount);
        setFromDate(filters.fromDate);
        setToDate(filters.toDate);
        setSelectedMovementTypes(filters.selectedMovementTypes);
        setClassificationFilter(filters.classificationFilter);
        setShowUSD(filters.showUSD);
    }, []);

    useEffect(() => {
        if (!hasGeneralAccess || authLoading) return;

        if (!isAdminUser) {
            setCompaniesError(null);
            setCompaniesLoading(false);
            if (assignedCompany) {
                setCompanies([assignedCompany]);
                setSelectedCompany(assignedCompany);
            } else {
                setCompanies([]);
                setSelectedCompany('');
            }
            return;
        }

        if (allowedOwnerIds.size === 0) {
            setCompanies([]);
            setSelectedCompany('');
            setCompaniesError('No se encontraron empresas disponibles para tu usuario.');
            setCompaniesLoading(false);
            return;
        }

        let cancelled = false;
        setCompaniesLoading(true);
        setCompaniesError(null);

        const loadCompanies = async () => {
            try {
                const list = await EmpresasService.getAllEmpresas();
                if (cancelled) return;
                const filtered = list.filter(emp => allowedOwnerIds.has((emp.ownerId || '').trim()));
                const names = Array.from(
                    new Set(
                        filtered
                            .map(emp => (emp.name || '').trim())
                            .filter(name => name.length > 0),
                    ),
                ).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
                setCompanies(names);
                setSelectedCompany(prev => {
                    if (prev === ALL_COMPANIES_VALUE) {
                        return names.length > 1 ? ALL_COMPANIES_VALUE : names[0] ?? '';
                    }
                    if (prev && names.includes(prev)) return prev;
                    if (assignedCompany && names.includes(assignedCompany)) return assignedCompany;
                    if (names.length > 1) return ALL_COMPANIES_VALUE;
                    return names[0] ?? '';
                });
            } catch (err) {
                console.error('Error loading empresas for summary report:', err);
                if (!cancelled) {
                    setCompanies([]);
                    setSelectedCompany('');
                    setCompaniesError('No se pudieron cargar las empresas. Inténtalo más tarde.');
                }
            } finally {
                if (!cancelled) {
                    setCompaniesLoading(false);
                }
            }
        };

        void loadCompanies();

        return () => {
            cancelled = true;
        };
    }, [hasGeneralAccess, authLoading, isAdminUser, assignedCompany, allowedOwnerIds]);

    useEffect(() => {
        if (isAdminUser) return;
        if (!assignedCompany) return;
        setSelectedCompany(assignedCompany);
    }, [assignedCompany, isAdminUser]);

    useEffect(() => {
        if (accessibleAccountKeys.length === 0) {
            setSelectedAccount('');
            return;
        }
        setSelectedAccount(prev => {
            if (prev === ALL_ACCOUNTS_VALUE) {
                return accessibleAccountKeys.length > 1 ? ALL_ACCOUNTS_VALUE : accessibleAccountKeys[0];
            }
            if (prev && isMovementAccountKey(prev) && accessibleAccountKeys.includes(prev)) {
                return prev;
            }
            if (accessibleAccountKeys.length > 1) return ALL_ACCOUNTS_VALUE;
            return accessibleAccountKeys[0];
        });
    }, [accessibleAccountKeys]);

    useEffect(() => {
        if (!hasGeneralAccess) {
            setEntries([]);
            setDataLoading(false);
            return;
        }

        const targetCompanies = selectedCompany === ALL_COMPANIES_VALUE
            ? companies
            : selectedCompany
                ? [selectedCompany]
                : [];

        const targetAccounts: MovementAccountKey[] = selectedAccount === ALL_ACCOUNTS_VALUE
            ? accessibleAccountKeys
            : selectedAccount
                ? [selectedAccount as MovementAccountKey]
                : [];

        if (targetCompanies.length === 0 || targetAccounts.length === 0) {
            setEntries([]);
            setDataLoading(false);
            return;
        }

        let cancelled = false;
        setDataLoading(true);
        setDataError(null);

        const loadEntries = async () => {
            try {
                const accountSet = new Set<MovementAccountKey>(targetAccounts);
                const aggregated: FondoEntry[] = [];

                for (const companyName of targetCompanies) {
                    const normalizedCompany = companyName.trim();
                    if (!normalizedCompany) continue;

                    const companyKey = MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
                    let storage = await MovimientosFondosService.getDocument<FondoEntry>(companyKey);
                    if (!storage && typeof window !== 'undefined') {
                        const raw = window.localStorage.getItem(companyKey);
                        if (raw) {
                            try {
                                const parsed = JSON.parse(raw);
                                storage = MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(parsed, normalizedCompany);
                            } catch (parseError) {
                                console.error('Error parsing local Fondo General storage:', parseError);
                            }
                        }
                    }

                    if (!storage) {
                        storage = MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(normalizedCompany);
                    }

                    const ensured = MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(storage, normalizedCompany);
                    const rawMovements = ensured.operations?.movements ?? [];
                    const scoped = rawMovements.reduce<Partial<FondoEntry>[]>((acc, raw) => {
                        if (!raw || typeof raw !== 'object') return acc;
                        const candidate = raw as Partial<FondoEntry>;
                        const movementAccount = isMovementAccountKey(candidate.accountId) ? candidate.accountId : 'FondoGeneral';
                        if (!accountSet.has(movementAccount)) return acc;
                        acc.push({ ...candidate, accountId: movementAccount });
                        return acc;
                    }, []);
                    const sanitized = sanitizeFondoEntries(scoped);
                    aggregated.push(...sanitized);
                }

                if (!cancelled) {
                    const sorted = aggregated.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
                    setEntries(sorted);
                }
            } catch (err) {
                console.error('Error loading Fondo General movements for summary:', err);
                if (!cancelled) {
                    setEntries([]);
                    setDataError('No se pudieron cargar los movimientos.');
                }
            } finally {
                if (!cancelled) {
                    setDataLoading(false);
                }
            }
        };

        void loadEntries();

        return () => {
            cancelled = true;
        };
    }, [selectedCompany, selectedAccount, hasGeneralAccess, companies, accessibleAccountKeys]);

    useEffect(() => {
        setSelectedMovementTypes(prev => {
            if (prev.length === 0) return prev;
            const allowed = new Set(movementTypeOptions.map(([value]) => value));
            const filtered = prev.filter(type => allowed.has(type));
            return filtered.length === prev.length ? prev : filtered;
        });
    }, [movementTypeOptions]);

    useEffect(() => {
        if (!movementTypeSelectorOpen) return;
        const handlePointerDown = (event: MouseEvent) => {
            const container = movementTypeSelectorRef.current;
            if (!container) return;
            if (container.contains(event.target as Node)) return;
            setMovementTypeSelectorOpen(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMovementTypeSelectorOpen(false);
            }
        };
        document.addEventListener('mousedown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [movementTypeSelectorOpen]);

    useEffect(() => {
        if (movementTypeOptions.length === 0) {
            setMovementTypeSelectorOpen(false);
        }
    }, [movementTypeOptions]);

    const summaryRows = useMemo<SummaryRow[]>(() => {
        if (dateRangeInvalid) return [];
        if (!entries.length) return [];

        const fromTimestamp = fromDate ? Date.parse(`${fromDate}T00:00:00`) : Number.NaN;
        const toTimestamp = toDate ? Date.parse(`${toDate}T23:59:59.999`) : Number.NaN;

        const buckets = new Map<FondoMovementType, SummaryRow>();

        entries.forEach(entry => {
            const created = Date.parse(entry.createdAt);
            if (!Number.isNaN(fromTimestamp) && created < fromTimestamp) return;
            if (!Number.isNaN(toTimestamp) && created > toTimestamp) return;

            const classification: Classification = isIngresoType(entry.paymentType)
                ? 'ingreso'
                : isGastoType(entry.paymentType)
                    ? 'gasto'
                    : 'egreso';

            if (classificationFilter !== 'all' && classification !== classificationFilter) return;
            if (selectedMovementTypes.length > 0 && !selectedMovementTypes.includes(entry.paymentType)) return;

            const currency: MovementCurrencyKey = entry.currency === 'USD' ? 'USD' : 'CRC';

            if (!buckets.has(entry.paymentType)) {
                buckets.set(entry.paymentType, {
                    paymentType: entry.paymentType,
                    label: formatMovementType(entry.paymentType),
                    classification,
                    totals: {
                        CRC: { ingreso: 0, gasto: 0, egreso: 0 },
                        USD: { ingreso: 0, gasto: 0, egreso: 0 },
                    },
                });
            }

            const bucket = buckets.get(entry.paymentType)!;
            const currencyTotals = bucket.totals[currency];
            if (classification === 'ingreso') {
                currencyTotals.ingreso += entry.amountIngreso || 0;
            } else if (classification === 'gasto') {
                currencyTotals.gasto += entry.amountEgreso || 0;
            } else {
                currencyTotals.egreso += entry.amountEgreso || 0;
            }
        });

        const rows = Array.from(buckets.values());

        // Apply sorting
        if (sortColumn) {
            rows.sort((a, b) => {
                let aValue: any, bValue: any;
                
                switch (sortColumn) {
                    case 'label':
                        aValue = a.label;
                        bValue = b.label;
                        break;
                    case 'classification':
                        aValue = a.classification;
                        bValue = b.classification;
                        break;
                    case 'ingresoCRC':
                        aValue = a.totals.CRC.ingreso;
                        bValue = b.totals.CRC.ingreso;
                        break;
                    case 'ingresoUSD':
                        aValue = a.totals.USD.ingreso;
                        bValue = b.totals.USD.ingreso;
                        break;
                    case 'gastoCRC':
                        aValue = a.totals.CRC.gasto;
                        bValue = b.totals.CRC.gasto;
                        break;
                    case 'gastoUSD':
                        aValue = a.totals.USD.gasto;
                        bValue = b.totals.USD.gasto;
                        break;
                    case 'egresoCRC':
                        aValue = a.totals.CRC.egreso;
                        bValue = b.totals.CRC.egreso;
                        break;
                    case 'egresoUSD':
                        aValue = a.totals.USD.egreso;
                        bValue = b.totals.USD.egreso;
                        break;
                    default:
                        return 0;
                }
                
                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    const comparison = aValue.localeCompare(bValue, 'es', { sensitivity: 'base' });
                    return sortDirection === 'asc' ? comparison : -comparison;
                }
                
                const numA = Number(aValue) || 0;
                const numB = Number(bValue) || 0;
                return sortDirection === 'asc' ? numA - numB : numB - numA;
            });
        } else {
            // Default sorting by classification then label
            const orderMap: Record<Classification, number> = { ingreso: 0, gasto: 1, egreso: 2 };
            rows.sort((a, b) => {
                const byGroup = orderMap[a.classification] - orderMap[b.classification];
                if (byGroup !== 0) return byGroup;
                return a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });
            });
        }

        return rows;
    }, [entries, fromDate, toDate, dateRangeInvalid, classificationFilter, selectedMovementTypes, sortColumn, sortDirection]);

    // Paginated rows
    const paginatedRows = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return summaryRows.slice(startIndex, endIndex);
    }, [summaryRows, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(summaryRows.length / itemsPerPage);

    // Export functions
    const exportToExcel = useCallback(() => {
        const data = summaryRows.map(row => ({
            'Tipo de Movimiento': row.label,
            'Clasificación': formatClassification(row.classification),
            'Ingresos CRC': row.totals.CRC.ingreso,
            'Ingresos USD': row.totals.USD.ingreso,
            'Gastos CRC': row.totals.CRC.gasto,
            'Gastos USD': row.totals.USD.gasto,
            'Egresos CRC': row.totals.CRC.egreso,
            'Egresos USD': row.totals.USD.egreso,
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Resumen Movimientos');
        XLSX.writeFile(wb, 'resumen-movimientos.xlsx');
    }, [summaryRows]);

    const exportToPDF = useCallback(() => {
        const doc = new jsPDF();
        doc.text('Resumen de Movimientos del Fondo General', 20, 20);
        
        let y = 40;
        summaryRows.forEach(row => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            doc.text(`${row.label} - ${formatClassification(row.classification)}`, 20, y);
            y += 10;
            doc.text(`Ingresos: ${formatAmount('CRC', row.totals.CRC.ingreso)}`, 30, y);
            y += 10;
        });
        
        doc.save('resumen-movimientos.pdf');
    }, [summaryRows, formatAmount]);

    const printReport = useCallback(() => {
        window.print();
    }, []);

    const totals = useMemo(() => {
        return summaryRows.reduce<Record<MovementCurrencyKey, CurrencyBucket>>(
            (acc, row) => {
                (['CRC', 'USD'] as MovementCurrencyKey[]).forEach(currency => {
                    acc[currency].ingreso += row.totals[currency].ingreso;
                    acc[currency].gasto += row.totals[currency].gasto;
                    acc[currency].egreso += row.totals[currency].egreso;
                });
                return acc;
            },
            {
                CRC: { ingreso: 0, gasto: 0, egreso: 0 },
                USD: { ingreso: 0, gasto: 0, egreso: 0 },
            },
        );
    }, [summaryRows]);

    // Net balance calculation
    const netBalance = useMemo(() => ({
        CRC: totals.CRC.ingreso - totals.CRC.gasto - totals.CRC.egreso,
        USD: totals.USD.ingreso - totals.USD.gasto - totals.USD.egreso,
    }), [totals]);

    // Chart data
    const pieChartData = useMemo(() => {
        const currency = showUSD ? 'USD' : 'CRC';
        return summaryRows
            .filter(row => row.totals[currency].gasto > 0)
            .map(row => ({
                name: row.label,
                value: row.totals[currency].gasto,
                percentage: totals[currency].gasto > 0 ? (row.totals[currency].gasto / totals[currency].gasto) * 100 : 0,
            }))
            .sort((a, b) => b.value - a.value);
    }, [summaryRows, totals, showUSD]);

    const barChartData = useMemo(() => {
        const currency = showUSD ? 'USD' : 'CRC';
        return [{
            name: 'Movimientos',
            ingresos: totals[currency].ingreso,
            gastos: totals[currency].gasto,
            egresos: totals[currency].egreso,
        }];
    }, [totals, showUSD]);

    // Active filters summary
    const activeFiltersSummary = useMemo(() => {
        const filters = [];
        if (selectedCompany !== ALL_COMPANIES_VALUE && selectedCompany) filters.push(`Empresa: ${selectedCompany}`);
        if (selectedAccount !== ALL_ACCOUNTS_VALUE && selectedAccount) filters.push(`Cuenta: ${ACCOUNT_LABELS[selectedAccount as MovementAccountKey]}`);
        if (fromDate && toDate) filters.push(`Fechas: ${fromDate} - ${toDate}`);
        if (selectedMovementTypes.length > 0) filters.push(`Tipos: ${selectedMovementTypes.length}`);
        if (classificationFilter !== 'all') filters.push(`Clasificación: ${formatClassification(classificationFilter as Classification)}`);
        return filters;
    }, [selectedCompany, selectedAccount, fromDate, toDate, selectedMovementTypes, classificationFilter]);

    // Movement type icons
    const getMovementIcon = useCallback((classification: Classification) => {
        switch (classification) {
            case 'ingreso': return <TrendingUp className="w-4 h-4 text-green-500" />;
            case 'gasto': return <CreditCard className="w-4 h-4 text-red-500" />;
            case 'egreso': return <Banknote className="w-4 h-4 text-blue-500" />;
        }
    }, []);

    if (authLoading) {
        return (
            <div className="max-w-5xl mx-auto py-8 px-4">
                <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
                    <p className="text-[var(--muted-foreground)]">Cargando permisos...</p>
                </div>
            </div>
        );
    }

    if (!hasGeneralAccess) {
        return (
            <div className="max-w-5xl mx-auto py-8 px-4">
                <div className="flex flex-col items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] text-center">
                    <Lock className="w-10 h-10 text-[var(--muted-foreground)] mb-4" />
                    <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Acceso restringido</h3>
                    <p className="text-[var(--muted-foreground)]">No tienes permisos para acceder al reporte del Fondo General.</p>
                    <p className="text-sm text-[var(--muted-foreground)] mt-2">Contacta a un administrador si crees que es un error.</p>
                </div>
            </div>
        );
    }

    const noCompanyAvailable = !companiesLoading && !isAdminUser && !assignedCompany;
    const accountUnavailable = accessibleAccountKeys.length === 0;

    return (
        <div className="max-w-6xl mx-auto py-8 px-4 space-y-6">
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
                <header className="mb-6">
                    <h1 className="text-2xl font-semibold text-[var(--foreground)]">Resumen por tipo de movimiento</h1>
                    <p className="text-sm text-[var(--muted-foreground)] mt-2">
                        Consulta los movimientos agrupados por categoría dentro del rango de fechas seleccionado. Usa la casilla &quot;Solo gastos&quot; si deseas ocultar egresos bancarios u otros movimientos que no sean gastos operativos.
                    </p>
                </header>

                {/* Summary Cards */}
                {!dataLoading && summaryRows.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-green-800 dark:text-green-200">Total Ingresos</p>
                                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                                        {formatAmount(showUSD ? 'USD' : 'CRC', totals[showUSD ? 'USD' : 'CRC'].ingreso)}
                                    </p>
                                </div>
                                <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
                            </div>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-red-800 dark:text-red-200">Total Gastos</p>
                                    <p className="text-2xl font-bold text-red-900 dark:text-red-100">
                                        {formatAmount(showUSD ? 'USD' : 'CRC', totals[showUSD ? 'USD' : 'CRC'].gasto)}
                                    </p>
                                </div>
                                <CreditCard className="w-8 h-8 text-red-600 dark:text-red-400" />
                            </div>
                        </div>
                        <div className={`border rounded-lg p-4 ${netBalance[showUSD ? 'USD' : 'CRC'] >= 0 ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'}`}>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className={`text-sm font-medium ${netBalance[showUSD ? 'USD' : 'CRC'] >= 0 ? 'text-blue-800 dark:text-blue-200' : 'text-orange-800 dark:text-orange-200'}`}>Balance Neto</p>
                                    <p className={`text-2xl font-bold ${netBalance[showUSD ? 'USD' : 'CRC'] >= 0 ? 'text-blue-900 dark:text-blue-100' : 'text-orange-900 dark:text-orange-100'}`}>
                                        {formatAmount(showUSD ? 'USD' : 'CRC', Math.abs(netBalance[showUSD ? 'USD' : 'CRC']))}
                                        {netBalance[showUSD ? 'USD' : 'CRC'] < 0 && ' (Déficit)'}
                                    </p>
                                </div>
                                {netBalance[showUSD ? 'USD' : 'CRC'] >= 0 ? 
                                    <TrendingUp className="w-8 h-8 text-blue-600 dark:text-blue-400" /> : 
                                    <TrendingDown className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                                }
                            </div>
                        </div>
                    </div>
                )}

                {/* Alert if expenses exceed income */}
                {!dataLoading && summaryRows.length > 0 && totals[showUSD ? 'USD' : 'CRC'].gasto > totals[showUSD ? 'USD' : 'CRC'].ingreso && (
                    <div className="mb-6 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                        <AlertCircle className="h-4 w-4" />
                        <span>¡Alerta! Los gastos superan los ingresos en este período. Revisa tus finanzas.</span>
                    </div>
                )}

                {/* Quick Filters */}
                <div className="mb-6">
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <span className="text-sm font-medium text-[var(--muted-foreground)] mr-2">Rangos rápidos:</span>
                        <button
                            onClick={setTodayRange}
                            className="px-3 py-1 text-xs bg-[var(--muted)] hover:bg-[var(--muted)]/80 text-[var(--foreground)] rounded-md transition-colors"
                        >
                            Hoy
                        </button>
                        <button
                            onClick={setThisWeekRange}
                            className="px-3 py-1 text-xs bg-[var(--muted)] hover:bg-[var(--muted)]/80 text-[var(--foreground)] rounded-md transition-colors"
                        >
                            Esta semana
                        </button>
                        <button
                            onClick={setThisMonthRange}
                            className="px-3 py-1 text-xs bg-[var(--muted)] hover:bg-[var(--muted)]/80 text-[var(--foreground)] rounded-md transition-colors"
                        >
                            Este mes
                        </button>
                        <button
                            onClick={setLastQuarterRange}
                            className="px-3 py-1 text-xs bg-[var(--muted)] hover:bg-[var(--muted)]/80 text-[var(--foreground)] rounded-md transition-colors"
                        >
                            Último trimestre
                        </button>
                        <button
                            onClick={clearAllFilters}
                            className="px-3 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-300 rounded-md transition-colors ml-4"
                        >
                            Limpiar filtros
                        </button>
                    </div>

                    {/* Active Filters Summary */}
                    {activeFiltersSummary.length > 0 && (
                        <div className="mb-4 p-3 bg-[var(--muted)]/10 rounded-md">
                            <p className="text-sm text-[var(--muted-foreground)] mb-2">Filtros activos:</p>
                            <div className="flex flex-wrap gap-2">
                                {activeFiltersSummary.map((filter, index) => (
                                    <span key={index} className="px-2 py-1 text-xs bg-[var(--accent)] text-[var(--accent-foreground)] rounded">
                                        {filter}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Export and Chart Controls */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={exportToExcel}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
                            disabled={summaryRows.length === 0}
                        >
                            <Download className="w-4 h-4" />
                            Excel
                        </button>
                        <button
                            onClick={exportToPDF}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                            disabled={summaryRows.length === 0}
                        >
                            <Download className="w-4 h-4" />
                            PDF
                        </button>
                        <button
                            onClick={printReport}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                        >
                            <Printer className="w-4 h-4" />
                            Imprimir
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowCharts(!showCharts)}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--muted)] hover:bg-[var(--muted)]/80 text-[var(--foreground)] rounded-md transition-colors"
                        >
                            {showCharts ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            {showCharts ? 'Ocultar gráficos' : 'Mostrar gráficos'}
                        </button>
                    </div>
                </div>

                {/* Save Filters */}
                <div className="mb-6">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            placeholder="Nombre de la configuración"
                            value={currentFilterName}
                            onChange={(e) => setCurrentFilterName(e.target.value)}
                            className="px-3 py-2 text-sm border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                        />
                        <button
                            onClick={saveCurrentFilters}
                            disabled={!currentFilterName.trim()}
                            className="flex items-center gap-2 px-3 py-2 text-sm bg-[var(--accent)] hover:bg-[var(--accent)]/80 text-[var(--accent-foreground)] rounded-md transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            Guardar filtros
                        </button>
                    </div>
                    {savedFilters.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                            {savedFilters.map((saved, index) => (
                                <button
                                    key={index}
                                    onClick={() => loadSavedFilters(saved.filters)}
                                    className="px-2 py-1 text-xs bg-[var(--muted)] hover:bg-[var(--muted)]/80 text-[var(--foreground)] rounded transition-colors"
                                >
                                    {saved.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
                    <div className="sm:col-span-2 lg:col-span-4">
                        <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
                            Empresa
                        </label>
                        {isAdminUser ? (
                            <select
                                value={selectedCompany}
                                onChange={event => setSelectedCompany(event.target.value)}
                                className="w-full rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
                                disabled={companiesLoading || companies.length === 0}
                            >
                                {companies.length > 1 && (
                                    <option
                                        value={ALL_COMPANIES_VALUE}
                                        className="text-[var(--foreground)] bg-[var(--card-bg)]"
                                        style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
                                    >
                                        Todas las empresas
                                    </option>
                                )}
                                {companies.map(name => (
                                    <option
                                        key={name}
                                        value={name}
                                        className="text-[var(--foreground)] bg-[var(--card-bg)]"
                                        style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
                                    >
                                        {name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className="rounded-md border border-[var(--input-border)] px-3 py-2 text-sm text-[var(--foreground)] bg-[var(--muted)]/10">
                                {assignedCompany || 'Sin empresa asignada'}
                            </div>
                        )}
                        {companiesError && (
                            <p className="mt-2 text-xs text-red-500 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                <span>{companiesError}</span>
                            </p>
                        )}
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4">
                        <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
                            Cuenta
                        </label>
                        {accountUnavailable ? (
                            <div className="rounded-md border border-[var(--input-border)] px-3 py-2 text-sm text-[var(--foreground)] bg-[var(--muted)]/10">
                                Sin cuentas disponibles
                            </div>
                        ) : accessibleAccountKeys.length === 1 ? (
                            <div className="rounded-md border border-[var(--input-border)] px-3 py-2 text-sm text-[var(--foreground)] bg-[var(--muted)]/10">
                                {ACCOUNT_LABELS[accessibleAccountKeys[0]]}
                            </div>
                        ) : (
                            <select
                                value={selectedAccount}
                                onChange={event => setSelectedAccount(event.target.value as AccountSelectValue)}
                                className="w-full rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
                            >
                                {accountSelectOptions.map(option => (
                                    <option
                                        key={option}
                                        value={option}
                                        className="text-[var(--foreground)] bg-[var(--card-bg)]"
                                        style={{ backgroundColor: 'var(--card-bg)', color: 'var(--foreground)' }}
                                    >
                                        {option === ALL_ACCOUNTS_VALUE ? 'Todas las cuentas' : ACCOUNT_LABELS[option]}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4">
                        <div className="flex flex-col gap-4 sm:flex-row">
                            <div className="flex-1 min-w-[180px]">
                                <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
                                    Desde
                                </label>
                                <input
                                    type="date"
                                    value={fromDate}
                                    max={toDate || undefined}
                                    onChange={event => setFromDate(event.target.value)}
                                    className="w-full rounded-md border border-[var(--input-border)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                />
                            </div>
                            <div className="flex-1 min-w-[180px]">
                                <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide mb-2">
                                    Hasta
                                </label>
                                <input
                                    type="date"
                                    value={toDate}
                                    min={fromDate || undefined}
                                    onChange={event => setToDate(event.target.value)}
                                    className="w-full rounded-md border border-[var(--input-border)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-4">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wide">
                                Tipos de movimiento
                            </label>
                            {selectedMovementTypes.length > 0 && (
                                <button
                                    type="button"
                                    onClick={clearMovementTypeFilters}
                                    className="text-xs text-[var(--accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card-bg)]"
                                >
                                    Limpiar filtros
                                </button>
                            )}
                        </div>
                        {movementTypeOptions.length === 0 ? (
                            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                                No hay tipos de movimiento disponibles con los filtros seleccionados.
                            </p>
                        ) : (
                            <div ref={movementTypeSelectorRef} className="relative mt-2">
                                <button
                                    type="button"
                                    onClick={() => setMovementTypeSelectorOpen(prev => !prev)}
                                    className="flex w-full items-center justify-between rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                >
                                    <span className="truncate pr-3">{movementTypeSummaryLabel}</span>
                                    <ChevronDown className={`h-4 w-4 text-[var(--muted-foreground)] transition-transform ${movementTypeSelectorOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {movementTypeSelectorOpen && (
                                    <div className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] p-3 shadow-lg">
                                        <div className="flex flex-col gap-2">
                                            {movementTypeOptions.map(([movementType, label]) => (
                                                <label key={movementType} className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedMovementTypes.includes(movementType)}
                                                        onChange={() => toggleMovementType(movementType)}
                                                        className="h-4 w-4 rounded border-[var(--input-border)] text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                                    />
                                                    <span>{label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                            Usa el selector desplegable para filtrar la tabla por tipos específicos.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-[var(--input-border)] px-3 py-2 text-sm text-[var(--foreground)] sm:col-span-2 lg:col-span-4 bg-[var(--muted)]/5">
                        <div className="flex flex-wrap items-center gap-4">
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={classificationFilter === 'gasto'}
                                    onChange={() => handleClassificationToggle('gasto')}
                                    className="h-4 w-4 rounded border-[var(--input-border)] text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                />
                                <span>Solo mostrar gastos</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={classificationFilter === 'egreso'}
                                    onChange={() => handleClassificationToggle('egreso')}
                                    className="h-4 w-4 rounded border-[var(--input-border)] text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                />
                                <span>Solo mostrar egresos</span>
                            </label>
                            <label className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={classificationFilter === 'ingreso'}
                                    onChange={() => handleClassificationToggle('ingreso')}
                                    className="h-4 w-4 rounded border-[var(--input-border)] text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                                />
                                <span>Solo mostrar ingresos</span>
                            </label>
                        </div>
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={showUSD}
                                onChange={event => setShowUSD(event.target.checked)}
                                className="h-4 w-4 rounded border-[var(--input-border)] text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                            />
                            <span>Mostrar dólares</span>
                        </label>
                    </div>
                </div>

                {dateRangeInvalid && (
                    <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                        <AlertCircle className="h-4 w-4" />
                        <span>El rango de fechas es inválido. Ajusta las fechas para continuar.</span>
                    </div>
                )}

                {noCompanyAvailable && (
                    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                        Tu usuario no tiene una empresa asignada. Solicita a un administrador que te asigne una antes de consultar el reporte.
                    </div>
                )}

                {accountUnavailable && (
                    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                        No tienes permisos para ninguna cuenta del Fondo General. Pide acceso a un administrador.
                    </div>
                )}

                {dataError && (
                    <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300">
                        <AlertCircle className="h-4 w-4" />
                        <span>{dataError}</span>
                    </div>
                )}

                <div className="mt-6">
                    {dataLoading ? (
                        <div className="flex items-center justify-center py-12 text-[var(--muted-foreground)]">
                            <Loader2 className="h-5 w-5 animate-spin mr-3" />
                            Cargando movimientos...
                        </div>
                    ) : summaryRows.length === 0 ? (
                        <div className="rounded-md border border-[var(--input-border)] bg-[var(--muted)]/10 px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
                            {dateRangeInvalid
                                ? 'Ajusta el rango de fechas para ver resultados.'
                                : 'No hay movimientos que coincidan con los filtros seleccionados.'}
                        </div>
                    ) : (
                        <>
                            {/* Charts Section */}
                            {showCharts && (
                                <div className="mb-6 space-y-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Pie Chart - Expense Distribution */}
                                        {pieChartData.length > 0 && (
                                            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg p-4">
                                                <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                                                    <PieChart className="w-5 h-5" />
                                                    Distribución de Gastos
                                                </h3>
                                                <ResponsiveContainer width="100%" height={300}>
                                                    <RechartsPieChart>
                                                        <Pie
                                                            data={pieChartData}
                                                            cx="50%"
                                                            cy="50%"
                                                            labelLine={false}
                                                            label={({ name, value }) => `${name}: ${((value as number / pieChartData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}%`}
                                                            outerRadius={80}
                                                            fill="#8884d8"
                                                            dataKey="value"
                                                        >
                                                            {pieChartData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={`hsl(${index * 137.5 % 360}, 70%, 50%)`} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip formatter={(value) => formatAmount(showUSD ? 'USD' : 'CRC', value as number)} />
                                                    </RechartsPieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        )}

                                        {/* Bar Chart - Income vs Expenses */}
                                        <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg p-4">
                                            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center gap-2">
                                                <BarChart3 className="w-5 h-5" />
                                                Ingresos vs Gastos vs Egresos
                                            </h3>
                                            <ResponsiveContainer width="100%" height={300}>
                                                <BarChart data={barChartData}>
                                                    <CartesianGrid strokeDasharray="3 3" />
                                                    <XAxis dataKey="name" />
                                                    <YAxis tickFormatter={(value) => formatAmount(showUSD ? 'USD' : 'CRC', value)} />
                                                    <Tooltip formatter={(value) => formatAmount(showUSD ? 'USD' : 'CRC', value as number)} />
                                                    <Legend />
                                                    <Bar dataKey="ingresos" fill="#10b981" name="Ingresos" />
                                                    <Bar dataKey="gastos" fill="#ef4444" name="Gastos" />
                                                    <Bar dataKey="egresos" fill="#3b82f6" name="Egresos" />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="overflow-x-auto rounded-lg border border-[var(--input-border)]">
                            {/* Mobile view for small screens */}
                            <div className="block md:hidden">
                                {paginatedRows.map(row => (
                                    <div key={row.paymentType} className="border-b border-[var(--input-border)] p-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => toggleExpandedRow(row.paymentType)}
                                                    className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                                                >
                                                    {expandedRows.has(row.paymentType) ? <ChevronDown className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-[-90deg]" />}
                                                </button>
                                                {getMovementIcon(row.classification)}
                                                <span className="font-medium">{row.label}</span>
                                            </div>
                                            <span className="text-sm text-[var(--muted-foreground)]">{formatClassification(row.classification)}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div>
                                                <span className="text-green-600 dark:text-green-400">Ingresos:</span>
                                                <div>{formatAmount('CRC', row.totals.CRC.ingreso)}</div>
                                                {showUSD && <div className="text-xs">{formatAmount('USD', row.totals.USD.ingreso)}</div>}
                                            </div>
                                            <div>
                                                <span className="text-red-600 dark:text-red-400">Gastos:</span>
                                                <div>{formatAmount('CRC', row.totals.CRC.gasto)}</div>
                                                {showUSD && <div className="text-xs">{formatAmount('USD', row.totals.USD.gasto)}</div>}
                                            </div>
                                            <div>
                                                <span className="text-blue-600 dark:text-blue-400">Egresos:</span>
                                                <div>{formatAmount('CRC', row.totals.CRC.egreso)}</div>
                                                {showUSD && <div className="text-xs">{formatAmount('USD', row.totals.USD.egreso)}</div>}
                                            </div>
                                        </div>
                                        {expandedRows.has(row.paymentType) && (
                                            <div className="mt-3 pt-3 border-t border-[var(--input-border)]">
                                                <p className="text-sm text-[var(--muted-foreground)]">
                                                    <strong>Detalles del tipo:</strong> {row.label}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Desktop table view */}
                            <table className="hidden md:table min-w-full divide-y divide-[var(--input-border)]">
                                <thead className="bg-[var(--muted)]/10">
                                    <tr className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                                        <th className="px-4 py-3 text-left font-semibold">
                                            <button
                                                onClick={() => handleSort('label')}
                                                className="flex items-center gap-1 hover:text-[var(--foreground)] transition-colors"
                                            >
                                                Tipo de movimiento
                                                <ArrowUpDown className="w-3 h-3" />
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-left font-semibold">
                                            <button
                                                onClick={() => handleSort('classification')}
                                                className="flex items-center gap-1 hover:text-[var(--foreground)] transition-colors"
                                            >
                                                Clasificación
                                                <ArrowUpDown className="w-3 h-3" />
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 text-right font-semibold">
                                            <button
                                                onClick={() => handleSort('ingresoCRC')}
                                                className="flex items-center gap-1 hover:text-[var(--foreground)] transition-colors"
                                            >
                                                Ingresos ₡
                                                <ArrowUpDown className="w-3 h-3" />
                                            </button>
                                        </th>
                                        {showUSD && (
                                            <th className="px-4 py-3 text-right font-semibold">
                                                <button
                                                    onClick={() => handleSort('ingresoUSD')}
                                                    className="flex items-center gap-1 hover:text-[var(--foreground)] transition-colors"
                                                >
                                                    Ingresos $
                                                    <ArrowUpDown className="w-3 h-3" />
                                                </button>
                                            </th>
                                        )}
                                        <th className="px-4 py-3 text-right font-semibold">
                                            <button
                                                onClick={() => handleSort('gastoCRC')}
                                                className="flex items-center gap-1 hover:text-[var(--foreground)] transition-colors"
                                            >
                                                Gastos ₡
                                                <ArrowUpDown className="w-3 h-3" />
                                            </button>
                                        </th>
                                        {showUSD && (
                                            <th className="px-4 py-3 text-right font-semibold">
                                                <button
                                                    onClick={() => handleSort('gastoUSD')}
                                                    className="flex items-center gap-1 hover:text-[var(--foreground)] transition-colors"
                                                >
                                                    Gastos $
                                                    <ArrowUpDown className="w-3 h-3" />
                                                </button>
                                            </th>
                                        )}
                                        <th className="px-4 py-3 text-right font-semibold">
                                            <button
                                                onClick={() => handleSort('egresoCRC')}
                                                className="flex items-center gap-1 hover:text-[var(--foreground)] transition-colors"
                                            >
                                                Egresos ₡
                                                <ArrowUpDown className="w-3 h-3" />
                                            </button>
                                        </th>
                                        {showUSD && (
                                            <th className="px-4 py-3 text-right font-semibold">
                                                <button
                                                    onClick={() => handleSort('egresoUSD')}
                                                    className="flex items-center gap-1 hover:text-[var(--foreground)] transition-colors"
                                                >
                                                    Egresos $
                                                    <ArrowUpDown className="w-3 h-3" />
                                                </button>
                                            </th>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[var(--input-border)] bg-[var(--card-bg)]">
                                    {paginatedRows.map(row => (
                                        <>
                                            <tr key={row.paymentType} className="text-sm text-[var(--foreground)] hover:bg-[var(--muted)]/5 transition-colors">
                                                <td className="px-4 py-3 font-medium flex items-center gap-2">
                                                    <button
                                                        onClick={() => toggleExpandedRow(row.paymentType)}
                                                        className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                                                    >
                                                        {expandedRows.has(row.paymentType) ? <ChevronDown className="w-4 h-4" /> : <ChevronDown className="w-4 h-4 rotate-[-90deg]" />}
                                                    </button>
                                                    {getMovementIcon(row.classification)}
                                                    {row.label}
                                                </td>
                                                <td className="px-4 py-3 text-[var(--muted-foreground)]">{formatClassification(row.classification)}</td>
                                                <td className="px-4 py-3 text-right">{formatAmount('CRC', row.totals.CRC.ingreso)}</td>
                                                {showUSD && <td className="px-4 py-3 text-right">{formatAmount('USD', row.totals.USD.ingreso)}</td>}
                                                <td className="px-4 py-3 text-right">{formatAmount('CRC', row.totals.CRC.gasto)}</td>
                                                {showUSD && <td className="px-4 py-3 text-right">{formatAmount('USD', row.totals.USD.gasto)}</td>}
                                                <td className="px-4 py-3 text-right">{formatAmount('CRC', row.totals.CRC.egreso)}</td>
                                                {showUSD && <td className="px-4 py-3 text-right">{formatAmount('USD', row.totals.USD.egreso)}</td>}
                                            </tr>
                                            {expandedRows.has(row.paymentType) && (
                                                <tr className="bg-[var(--muted)]/10">
                                                    <td colSpan={showUSD ? 8 : 4} className="px-6 py-3">
                                                        <div className="text-sm text-[var(--muted-foreground)]">
                                                            <p><strong>Detalles del tipo:</strong> {row.label}</p>
                                                            <p><strong>Clasificación:</strong> {formatClassification(row.classification)}</p>
                                                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                <div>
                                                                    <p className="text-green-600 dark:text-green-400">Ingresos CRC</p>
                                                                    <p className="font-semibold">{formatAmount('CRC', row.totals.CRC.ingreso)}</p>
                                                                </div>
                                                                {showUSD && (
                                                                    <div>
                                                                        <p className="text-green-600 dark:text-green-400">Ingresos USD</p>
                                                                        <p className="font-semibold">{formatAmount('USD', row.totals.USD.ingreso)}</p>
                                                                    </div>
                                                                )}
                                                                <div>
                                                                    <p className="text-red-600 dark:text-red-400">Gastos CRC</p>
                                                                    <p className="font-semibold">{formatAmount('CRC', row.totals.CRC.gasto)}</p>
                                                                </div>
                                                                {showUSD && (
                                                                    <div>
                                                                        <p className="text-red-600 dark:text-red-400">Gastos USD</p>
                                                                        <p className="font-semibold">{formatAmount('USD', row.totals.USD.gasto)}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))}
                                </tbody>
                                <tfoot className="bg-white/10 border-t border-white/20">
                                    <tr className="text-sm font-semibold text-[var(--foreground)]">
                                        <td className="px-4 py-3" colSpan={2}>Totales</td>
                                        <td className="px-4 py-3 text-right">{formatAmount('CRC', totals.CRC.ingreso)}</td>
                                        {showUSD && <td className="px-4 py-3 text-right">{formatAmount('USD', totals.USD.ingreso)}</td>}
                                        <td className="px-4 py-3 text-right">{formatAmount('CRC', totals.CRC.gasto)}</td>
                                        {showUSD && <td className="px-4 py-3 text-right">{formatAmount('USD', totals.USD.gasto)}</td>}
                                        <td className="px-4 py-3 text-right">{formatAmount('CRC', totals.CRC.egreso)}</td>
                                        {showUSD && <td className="px-4 py-3 text-right">{formatAmount('USD', totals.USD.egreso)}</td>}
                                    </tr>
                                </tfoot>
                            </table>
                            </div>

                            {/* Pagination */}
                            {summaryRows.length > itemsPerPage && (
                                <div className="mt-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-[var(--muted-foreground)]">
                                            Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, summaryRows.length)} de {summaryRows.length} resultados
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={itemsPerPage}
                                            onChange={(e) => {
                                                setItemsPerPage(Number(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            className="px-2 py-1 text-sm border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] rounded"
                                        >
                                            <option value={10}>10 por página</option>
                                            <option value={20}>20 por página</option>
                                            <option value={50}>50 por página</option>
                                            <option value={100}>100 por página</option>
                                        </select>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="px-3 py-1 text-sm border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] rounded disabled:opacity-50"
                                        >
                                            Anterior
                                        </button>
                                        <span className="text-sm text-[var(--muted-foreground)]">
                                            Página {currentPage} de {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="px-3 py-1 text-sm border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] rounded disabled:opacity-50"
                                        >
                                            Siguiente
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
