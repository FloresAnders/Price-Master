"use client";

import React from 'react';
import type { ReactElement } from 'react';
import {
    ExportCcssConfig,
    ImportCcssConfig,
    ExportEmpresas,
    ImportEmpresas,
    ExportPayrollRecords,
    ImportPayrollRecords,
    ExportScans,
    ImportScans,
    ExportSchedules,
    ImportSchedules,
    ExportSessionStatus,
    ImportSessionStatus,
    ExportSorteos,
    ImportSorteos,
    ExportUsers,
    ImportUsers
} from '.';

type Props = {
    open: boolean;
    onClose: () => void;
    title?: string;
};

export default function ExportModal({ open, onClose, title = 'Exportar / Importar datos' }: Props): ReactElement | null {
    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-[var(--card-bg)] rounded-xl p-6 w-full max-w-2xl shadow-2xl border border-[var(--input-border)]">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button onClick={onClose} className="text-sm text-[var(--muted-foreground)]">Cerrar</button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    <p className="text-sm text-[var(--muted-foreground)]">Seleccione una colección y use los botones Exportar / Importar.</p>

                    <div className="divide-y border-t border-b mt-2">
                        {/* Row: ccss-config */}
                        <div className="flex items-center justify-between py-3">
                            <div className="font-medium">CCSS Config</div>
                            <div className="flex gap-2">
                                <ExportCcssConfig />
                                <ImportCcssConfig />
                            </div>
                        </div>

                        {/* Row: locations */}
                        <div className="flex items-center justify-between py-3">
                            <div className="font-medium">Empresas</div>
                            <div className="flex gap-2">
                                <ExportEmpresas />
                                <ImportEmpresas />
                            </div>
                        </div>

                        {/* Row: payroll-records */}
                        <div className="flex items-center justify-between py-3">
                            <div className="font-medium">Payroll Records</div>
                            <div className="flex gap-2">
                                <ExportPayrollRecords />
                                <ImportPayrollRecords />
                            </div>
                        </div>

                        {/* Row: scans */}
                        <div className="flex items-center justify-between py-3">
                            <div className="font-medium">Scans</div>
                            <div className="flex gap-2">
                                <ExportScans />
                                <ImportScans />
                            </div>
                        </div>

                        {/* Row: schedules */}
                        <div className="flex items-center justify-between py-3">
                            <div className="font-medium">Schedules</div>
                            <div className="flex gap-2">
                                <ExportSchedules />
                                <ImportSchedules />
                            </div>
                        </div>

                        {/* Row: session_status */}
                        <div className="flex items-center justify-between py-3">
                            <div className="font-medium">Session Status</div>
                            <div className="flex gap-2">
                                <ExportSessionStatus />
                                <ImportSessionStatus />
                            </div>
                        </div>

                        {/* Row: sorteos */}
                        <div className="flex items-center justify-between py-3">
                            <div className="font-medium">Sorteos</div>
                            <div className="flex gap-2">
                                <ExportSorteos />
                                <ImportSorteos />
                            </div>
                        </div>

                        {/* Row: users */}
                        <div className="flex items-center justify-between py-3">
                            <div className="font-medium">Users</div>
                            <div className="flex gap-2">
                                <ExportUsers />
                                <ImportUsers />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end mt-4">
                    <button onClick={onClose} className="px-3 py-2 bg-blue-600 text-white rounded-md">Cerrar</button>
                </div>
            </div>
        </div>
    );
}
