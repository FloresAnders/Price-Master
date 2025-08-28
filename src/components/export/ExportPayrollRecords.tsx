"use client";
import React from 'react';
import { PayrollRecordsService } from '../../services/payroll-records';

export default function ExportPayrollRecords() {
    const handleExport = async () => {
        try {
            const items = await PayrollRecordsService.getAllRecords();
            const data = JSON.stringify(items, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payroll-records-${new Date().toISOString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            alert('Error al exportar payroll-records');
        }
    };

    return (
        <button className="btn btn-sm" onClick={handleExport}>
            Exportar payroll-records
        </button>
    );
}
