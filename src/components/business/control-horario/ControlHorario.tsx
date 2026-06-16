"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Clock, ChevronLeft, ChevronRight, User as UserIcon,
  Lock, Unlock, Eye, EyeOff, Layers, ChevronDown,
  CalendarDays, Download, X,
} from "lucide-react";
import { FondoDateRangeFilters } from "@/app/fondogeneral/components/FondoDateRangeFilters";
import { hasPermission } from "../../../utils/permissions";
import { useControlHorario } from "./hooks/useControlHorario";
import EmployeeTooltipSummary from "./components/EmployeeTooltipSummary";
import {
  isUserAdmin, userCanChangeEmpresa,
  getShiftOptions, getCellStyle, getStateLabel,
} from "./utils";
import type { MappedEmpresa } from "./types";
import type { User as FirestoreUser } from "../../../types/firestore";
import ConfirmModal from "../../ui/ConfirmModal";
import TapTooltip from "../../ui/TapTooltip";
import DelifoodHoursModal from "../../ui/DelifoodHoursModal";

interface Props {
  currentUser?: FirestoreUser | null;
}

export default function ControlHorario({ currentUser }: Props = {}) {
  const h = useControlHorario(currentUser);
  const [selectedEmployee, setSelectedEmployee] = useState("Todos");
  const [, setWorkedRangeCalendarPageSize] = useState<"daily" | number | "all">("all");
  const [, setWorkedRangeCalendarPageIndex] = useState(0);

  if (!hasPermission(h.user?.permissions, "controlhorario")) {
    return (
      <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
        <div className="text-center">
          <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Acceso Restringido</h3>
          <p className="text-[var(--muted-foreground)]">No tienes permisos para acceder al Control de Horario.</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">Contacta a un administrador.</p>
        </div>
      </div>
    );
  }

  if (h.loading) {
    return (
      <div className="max-w-4xl mx-auto bg-[var(--card-bg)] rounded-lg shadow-md border border-[var(--input-border)] p-4 sm:p-6">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500/20 border-t-cyan-500" />
          <div className="text-sm sm:text-lg mt-4 text-[var(--foreground)]">Cargando...</div>
        </div>
      </div>
    );
  }

  if (!h.empresa) {
    if (h.assignedEmpresa) {
      return (
        <div className="max-w-4xl mx-auto bg-[var(--card-bg)] rounded-lg shadow-md border border-[var(--input-border)] p-4 sm:p-6">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500/20 border-t-cyan-500" />
            <div className="text-sm sm:text-lg mt-4 text-[var(--foreground)]">Cargando empresa asignada: {h.assignedEmpresa}</div>
          </div>
        </div>
      );
    }
    if (h.user?.role === "user" && !h.assignedEmpresa) {
      return (
        <div className="max-w-4xl mx-auto bg-[var(--card-bg)] rounded-lg shadow-md border border-[var(--input-border)] p-4 sm:p-6">
          <div className="text-center mb-8">
            <Clock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-red-500" />
            <h3 className="text-xl sm:text-2xl font-bold text-[var(--foreground)] mb-4">Acceso Restringido</h3>
            <p className="text-sm text-[var(--muted-foreground)]">No tienes una empresa asignada. Contacta al administrador.</p>
          </div>
        </div>
      );
    }
    return (
      <div className="max-w-4xl mx-auto bg-[var(--card-bg)] rounded-lg shadow-md border border-[var(--input-border)] p-4 sm:p-6">
        <div className="text-center mb-8">
          <Clock className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-cyan-500" />
          <h3 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent mb-4">Control de Horarios</h3>
          <p className="text-sm text-[var(--muted-foreground)] mb-6">Selecciona una empresa para continuar</p>
        </div>
        <div className="max-w-md mx-auto mb-4">
          <label className="block text-sm font-semibold mb-2 text-[var(--foreground)]">Empresa:</label>
          <select className="w-full px-4 py-2 rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            value={h.empresa}
            onChange={(e) => h.handleEmpresaChange(e.target.value)}
          >
            <option value="">Seleccionar empresa</option>
            {h.empresas.map((item: MappedEmpresa) => (<option key={item.value} value={item.value}>{item.label}</option>))}
          </select>
        </div>
      </div>
    );
  }

  const shiftOptions = getShiftOptions(isUserAdmin(h.user));
  const selectedEmpresaMeta = h.empresas.find((e) => e.value === h.empresa);

  return (
    <>
      <div className="max-w-full mx-auto bg-[var(--card-bg)] rounded-lg shadow-md border border-[var(--input-border)] p-4 sm:p-6">
        {h.saving && (
          <div className="fixed top-16 sm:top-20 right-4 sm:right-6 z-40 px-3 sm:px-4 py-2 rounded-lg bg-cyan-500 text-white flex items-center gap-2 text-sm shadow-lg">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
            Guardando...
          </div>
        )}

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <Clock className="w-12 h-12 sm:w-16 sm:h-16 text-cyan-500" />
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-[var(--foreground)] mb-2 bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">Control de Horarios</h3>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {h.user?.name && <><span className="block sm:inline">Usuario: {h.user.name}</span><span className="hidden sm:inline"> - </span></>}
                  <span className="block sm:inline">Empresa: {h.empresa}</span>
                </p>
              </div>
            </div>
            {userCanChangeEmpresa(h.user) && h.empresas.length > 0 && (
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-500 flex-shrink-0" />
                <select className="px-4 py-2 text-sm rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  value={h.empresa}
                  onChange={(e) => h.handleEmpresaChange(e.target.value)}
                >
                  <option value="">Seleccionar empresa</option>
                  {h.empresas.map((item: MappedEmpresa) => (<option key={item.value} value={item.value}>{item.label}</option>))}
                </select>
              </div>
            )}
          </div>

          {/* Period & Filters */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2">
                <button onClick={() => h.changeMonth("prev")} className="p-2 rounded-lg hover:bg-[var(--muted)] border border-[var(--input-border)]"><ChevronLeft className="w-5 h-5 text-[var(--foreground)]" /></button>
                <h4 className="text-lg font-bold capitalize flex items-center gap-2 text-[var(--foreground)]">
                  {h.monthName}
                  {h.daysToShow.some((day) => { const d = new Date(h.year, h.month, day); const n = new Date(); n.setHours(0, 0, 0, 0); return d < n; }) && (
                    <button onClick={() => {
                      if (h.user?.role === "user") {
                        if (h.editPastDaysEnabled) { h.setUnlockPastDaysModal(true); } else { h.unlockPastDays.setPassword(""); h.setShowUnlockPassword(false); h.setUnlockPastDaysModal(true); }
                      } else { h.setUnlockPastDaysModal(true); }
                    }}
                      className="ml-2 p-1 rounded-full border-2 border-[var(--input-border)] bg-[var(--card-bg)] hover:border-cyan-500"
                      title={h.editPastDaysEnabled ? "Bloquear edición de días pasados" : "Desbloquear días pasados"}
                    >
                      {h.editPastDaysEnabled ? <Unlock className="w-5 h-5 text-cyan-500" /> : <Lock className="w-5 h-5 text-[var(--muted-foreground)]" />}
                    </button>
                  )}
                </h4>
                <button onClick={() => h.changeMonth("next")} className="p-2 rounded-lg hover:bg-[var(--muted)] border border-[var(--input-border)]"><ChevronRight className="w-5 h-5 text-[var(--foreground)]" /></button>
              </div>

              <div className="flex gap-2 flex-wrap">
                {(["1-15", "16-30", "monthly"] as const).map((period) => {
                  const isActive = period === "monthly" ? h.fullMonthView : h.selectedPeriod === period;
                  const label = period === "monthly" ? (h.fullMonthView ? "Quincenal" : "Mensual") : period === "16-30" ? `16-${h.daysInMonth}` : period;
                  return (
                    <button key={period} className={`px-4 py-2 text-xs font-semibold rounded-lg border-2 transition-all ${isActive ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-cyan-500" : "border-[var(--input-border)] text-[var(--foreground)] hover:border-cyan-500"}`}
                      onClick={() => {
                        if (period === "monthly") {
                          if (h.fullMonthView) {
                            h.setSelectedPeriod(new Date().getDate() > 15 ? "16-30" : "1-15");
                            h.setFullMonthView(false);
                          } else { h.setSelectedPeriod("monthly"); h.setFullMonthView(true); }
                        } else {
                          h.setSelectedPeriod(period);
                          h.setViewMode(period === "1-15" ? "first" : "second");
                          h.setFullMonthView(false);
                        }
                      }}
                    >{label}</button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-cyan-500" />
                <select className="px-4 py-2 text-sm rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)]"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                >
                  <option value="Todos">Todos</option>
                  {h.names.map((name, i) => (<option key={`${name}-${i}`} value={name}>{name}</option>))}
                </select>
              </div>
              {isUserAdmin(h.user) && (
                <button onClick={h.openWorkedRangeModal} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg">
                  <CalendarDays className="w-5 h-5" />
                  Exportar Dias/horas
                </button>
              )}
              <button onClick={h.exportQuincenaToPNG} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-lg" disabled={h.isExporting}>
                <ChevronDown className="w-5 h-5" />
                {h.isDelifoodEmpresa ? "Exportar Horas" : "Exportar Quincena"}
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mb-6 p-4 bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg flex flex-wrap gap-6 justify-center">
          {h.isDelifoodEmpresa ? (
            <><LegendItem color="#06b6d4" label="Con horas registradas" /><LegendItem color="var(--card-bg)" label="Sin horas registradas" border /></>
          ) : (
            <><LegendItem color="#0ea5e9" label="N - Nocturno" /><LegendItem color="#eab308" label="D - Diurno" /><LegendItem color="#a855f7" label="L - Libre" /><LegendItem color="#10b981" label="V - Vacaciones" /><LegendItem color="#f59e0b" label="I - Incapacidad" /></>
          )}
        </div>

        {/* Schedule Grid */}
        <div className="overflow-x-auto -mx-4 sm:mx-0" style={{ overflowY: "hidden" }}>
          <div className="min-w-full inline-block">
            <table className="w-full border-collapse border border-[var(--input-border)]">
              <thead>
                <tr>
                  <th className="border border-[var(--input-border)] p-2 font-bold text-center text-[var(--foreground)] min-w-[80px] sm:min-w-[100px] sticky left-0 z-20 text-xs bg-[var(--card-bg)]" style={{ minWidth: "80px", left: 0, height: "40px" }}>Nombre</th>
                  {h.daysToShow.map((day) => {
                    const today = new Date();
                    const isToday = today.getFullYear() === h.year && today.getMonth() === h.month && today.getDate() === day;
                    const dayDate = new Date(h.year, h.month, day);
                    const tooltip = `${dayDate.toLocaleDateString("es-CR", { weekday: "long" }).charAt(0).toUpperCase() + dayDate.toLocaleDateString("es-CR", { weekday: "long" }).slice(1)} ${day} de ${dayDate.toLocaleDateString("es-CR", { month: "long" })} de ${h.year}`;
                    return (
                      <th key={day} className={`border border-[var(--input-border)] p-2 font-bold text-center transition-all text-xs relative bg-[var(--card-bg)] ${isToday ? "bg-gradient-to-b from-green-500 to-green-600 text-white shadow-md" : "hover:bg-[var(--muted)]"}`} style={{ minWidth: h.fullMonthView ? "40px" : "20px", height: "40px", cursor: "pointer" }}>
                        <TapTooltip content={<span className="text-xs whitespace-nowrap">{tooltip}</span>}><span>{day}</span></TapTooltip>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(selectedEmployee === "Todos" ? h.names : [selectedEmployee]).map((name, index) => (
                  <tr key={`${name}-${index}`}>
                    <td className="border border-[var(--input-border)] p-2 font-semibold text-[var(--foreground)] sticky left-0 z-10 cursor-pointer text-xs bg-[var(--card-bg)]" style={{ minWidth: "80px", left: 0, height: "40px" }}>
                      {selectedEmpresaMeta?.mostrarInfoPago !== false ? (
                        <TapTooltip content={
                          <div className="min-w-[180px] text-left whitespace-pre-line">
                            <EmployeeTooltipSummary employeeName={name} empresaValue={h.empresa} empresaLabel={selectedEmpresaMeta?.label}
                              employeeConfig={selectedEmpresaMeta?.employees?.find((e) => e.name === name)} shiftsByDay={h.scheduleData[name]}
                              year={h.year} month={h.month} daysToShow={h.daysToShow} isDelifoodEmpresa={h.isDelifoodEmpresa} delifoodHoursData={h.delifoodHoursData} user={h.user}
                            />
                          </div>
                        }>
                          <span className="block truncate">{name}</span>
                        </TapTooltip>
                      ) : (
                        <span className="block truncate">{name}</span>
                      )}
                    </td>
                    {h.daysToShow.map((day) => {
                      const cellDate = new Date(h.year, h.month, day);
                      const now = new Date(); now.setHours(0, 0, 0, 0);
                      let disabled = cellDate < now && !h.editPastDaysEnabled;

                      if (h.isDelifoodEmpresa) {
                        const hrs = h.delifoodHoursData[name]?.[day.toString()]?.hours || 0;
                        return (
                          <td key={day} className="border border-[var(--input-border)] p-0" style={{ minWidth: h.fullMonthView ? "32px" : "40px" }}>
                            <button onClick={() => !disabled && h.handleDelifoodCellClick(name, day)}
                              className={`w-full h-full p-1 text-center font-semibold cursor-pointer text-xs border-none outline-none ${disabled ? "bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed" : ""}`}
                              style={{ minWidth: h.fullMonthView ? "32px" : "40px", height: "40px", backgroundColor: hrs > 0 ? "#d1fae5" : "var(--card-bg)", color: hrs > 0 ? "#065f46" : "var(--foreground)" }}
                              disabled={disabled}
                            >{hrs > 0 ? `${hrs}h` : "▼"}</button>
                          </td>
                        );
                      }

                      const value = h.scheduleData[name]?.[day.toString()] || "";
                      if (!isUserAdmin(h.user) && ["V", "I"].includes(value)) disabled = true;

                      if (["V", "I"].includes(value) && !isUserAdmin(h.user)) {
                        return (
                          <td key={day} className="border border-[var(--input-border)] p-0" style={{ minWidth: h.fullMonthView ? "32px" : "40px" }}>
                            <div className="w-full h-full p-1 text-center font-semibold text-xs flex items-center justify-center" style={{ ...getCellStyle(value), minWidth: h.fullMonthView ? "32px" : "40px", height: "40px", cursor: "not-allowed" }}
                              title={`${getStateLabel(value)} - Solo ADMIN puede modificar`}>{value}</div>
                          </td>
                        );
                      }

                      return (
                        <td key={day} className="border border-[var(--input-border)] p-0" style={{ minWidth: h.fullMonthView ? "32px" : "40px" }}>
                          <select value={value} onChange={(e) => h.handleCellChange(name, day, e.target.value)}
                            className={`w-full h-full p-1 border-none outline-none text-center font-semibold cursor-pointer text-xs appearance-none ${disabled ? "bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed" : ""}`}
                            style={{ ...getCellStyle(value), minWidth: h.fullMonthView ? "32px" : "40px", height: "40px" }}
                            disabled={disabled}
                          >
                            {shiftOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {h.names.length === 0 && <div className="text-center py-8 text-[var(--tab-text)]">No hay empleados registrados para esta empresa.</div>}
      </div>

      {/* Confirm Modal */}
      <ConfirmModal open={h.confirmModal.open} message={h.confirmModal.message} loading={h.modalLoading} actionType={h.confirmModal.actionType}
        onConfirm={async () => { if (h.confirmModal.onConfirm) await h.confirmModal.onConfirm(); }}
        onCancel={() => h.setConfirmModal({ open: false, message: "", onConfirm: null, actionType: "assign" })}
      />

      {/* Worked Days/Hours Modal */}
      {h.workedRangeModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 p-4" onClick={h.closeWorkedRangeModal}>
          <div className="w-full max-w-2xl rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[var(--input-border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-cyan-500" />
                <h2 className="text-lg font-bold">Exportar Dias/horas</h2>
              </div>
              <button type="button" onClick={h.closeWorkedRangeModal} className="rounded-full p-2 hover:bg-[var(--muted)]" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <FondoDateRangeFilters
                quickRange={h.workedRangeQuickRange}
                todayKey={h.workedRangeTodayKey}
                fromFilter={h.workedRangeStartDate}
                toFilter={h.workedRangeEndDate}
                calendarFromOpen={h.workedRangeFromCalendarOpen}
                calendarToOpen={h.workedRangeToCalendarOpen}
                calendarFromMonth={h.workedRangeFromCalendarMonth}
                calendarToMonth={h.workedRangeToCalendarMonth}
                formatKeyToDisplay={h.formatWorkedRangeDateToDisplay}
                setQuickRange={h.setWorkedRangeQuickRange}
                setFromFilter={h.setWorkedRangeStartDate}
                setToFilter={h.setWorkedRangeEndDate}
                setPageSize={setWorkedRangeCalendarPageSize}
                setPageIndex={setWorkedRangeCalendarPageIndex}
                setCalendarFromOpen={h.setWorkedRangeFromCalendarOpen}
                setCalendarToOpen={h.setWorkedRangeToCalendarOpen}
                setCalendarFromMonth={h.setWorkedRangeFromCalendarMonth}
                setCalendarToMonth={h.setWorkedRangeToCalendarMonth}
                fromCalendarRef={h.workedRangeFromCalendarRef}
                toCalendarRef={h.workedRangeToCalendarRef}
                fromButtonRef={h.workedRangeFromButtonRef}
                toButtonRef={h.workedRangeToButtonRef}
                showTopBorder={false}
                disableFuture={false}
              />

              <div className="flex flex-col justify-end gap-2 sm:flex-row">
                {h.workedRangeGenerated && h.workedRangeRows.length > 0 && (
                  <button
                    type="button"
                    onClick={h.exportWorkedRangeImage}
                    disabled={h.isExporting}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] hover:border-cyan-500 disabled:opacity-60"
                  >
                    <Download className="h-4 w-4" />
                    Exportar imagen
                  </button>
                )}
                <button
                  type="button"
                  onClick={h.generateWorkedRange}
                  disabled={h.isGeneratingWorkedRange}
                  className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {h.isGeneratingWorkedRange ? "Generando..." : "Generar"}
                </button>
              </div>

              {h.workedRangeGenerated && (
                <div className="max-h-[50vh] overflow-auto rounded-lg border border-[var(--input-border)]">
                  <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-[var(--card-bg)]">
                      <tr>
                        <th className="border-b border-[var(--input-border)] px-3 py-2 text-left">Empleado</th>
                        <th className="border-b border-[var(--input-border)] px-3 py-2 text-right">Dias</th>
                        <th className="border-b border-[var(--input-border)] px-3 py-2 text-right">Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {h.workedRangeRows.length > 0 ? (
                        h.workedRangeRows.map((row) => (
                          <tr key={row.employeeName} className="odd:bg-[var(--muted)]/30">
                            <td className="border-b border-[var(--input-border)] px-3 py-2 font-medium">{row.employeeName}</td>
                            <td className="border-b border-[var(--input-border)] px-3 py-2 text-right">{row.workedDays}</td>
                            <td className="border-b border-[var(--input-border)] px-3 py-2 text-right">{row.totalHours}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-[var(--muted-foreground)]">No hay empleados con dias/horas en el rango.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Unlock Past Days Modal */}
      {h.unlockPastDaysModal && h.user?.role === "user" && !h.editPastDaysEnabled ? (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60" onClick={(e) => e.stopPropagation()}>
          <div className="bg-[var(--card-bg)] text-[var(--foreground)] rounded-lg shadow-2xl p-4 sm:p-6 w-full max-w-xs sm:max-w-sm border border-[var(--input-border)] flex flex-col items-center mx-2" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-2">
              <Lock className="h-5 w-5 text-[var(--foreground)]" />
              <h2 className="text-lg font-bold">Confirmar acción</h2>
            </div>
            <p className="mb-4 text-sm text-center w-full">¿Quieres desbloquear la edición de días pasados?</p>
            <p className="mb-3 text-sm text-center text-[var(--muted-foreground)]">Ingresa tu contraseña. El desbloqueo durará 5 minutos.</p>
            <div className="w-full mb-3 relative">
              <input type={h.showUnlockPassword ? "text" : "password"} value={h.unlockPastDays.password}
                onChange={(e) => h.unlockPastDays.setPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") h.unlockPastDays.unlock(); }}
                placeholder="Contraseña"
                className="w-full pr-10 pl-3 py-2 border-2 border-[var(--input-border)] rounded-lg bg-[var(--card-bg)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-cyan-500"
                autoFocus disabled={h.unlockPastDays.submitting}
              />
              <button type="button" onClick={() => h.setShowUnlockPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-cyan-500">
                {h.showUnlockPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {h.unlockPastDays.error && <p className="text-red-500 text-sm mb-3">{h.unlockPastDays.error}</p>}
            <div className="flex justify-center gap-2 mt-2 w-full">
              <button className="px-4 py-2 rounded bg-[var(--button-bg)] text-[var(--button-text)] disabled:opacity-60"
                onClick={() => { h.setUnlockPastDaysModal(false); h.unlockPastDays.setPassword(""); }}
                disabled={h.unlockPastDays.submitting} type="button">Cancelar</button>
              <button className="px-4 py-2 rounded bg-gradient-to-r from-cyan-500 to-blue-500 text-white disabled:opacity-60"
                onClick={() => h.unlockPastDays.unlock()}
                disabled={h.unlockPastDays.submitting || h.unlockPastDays.password.length === 0} type="button">
                {h.unlockPastDays.submitting ? <svg className="animate-spin h-4 w-4 mr-1 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg> : <Unlock className="h-4 w-4" />}
                Desbloquear
              </button>
            </div>
          </div>
        </div>
      ) : (
        <ConfirmModal open={h.unlockPastDaysModal}
          message={h.editPastDaysEnabled ? "¿Quieres volver a bloquear la edición de días pasados?" : "¿Quieres desbloquear la edición de días pasados?"}
          actionType={h.editPastDaysEnabled ? "delete" : "assign"}
          onConfirm={() => {
            if (h.user?.role === "user") h.unlockPastDays.lockNow();
            else h.setEditPastDaysEnabled((e: boolean) => !e);
            h.setUnlockPastDaysModal(false);
          }}
          onCancel={() => h.setUnlockPastDaysModal(false)}
        />
      )}

      {/* QR Modal */}
      {h.qrState.show && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] text-[var(--foreground)] rounded-xl shadow-2xl p-6 max-w-sm w-full flex flex-col items-center border border-[var(--input-border)]">
            <h3 className="text-lg font-bold mb-4">Descargar en tu móvil</h3>
            <Image src={h.qrState.dataURL} alt="QR" className="mb-4 rounded-lg border-2 border-[var(--input-border)]" width={300} height={300} unoptimized />
            <div className="text-xs text-[var(--muted-foreground)] mb-4">Escanea este QR para descargar la imagen</div>
            <div className="flex gap-3 w-full">
              <button onClick={h.closeQR} className="flex-1 px-4 py-2 rounded-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)]">Cerrar</button>
              <button onClick={() => {
                if (h.qrState.imageBlob) {
                  const url = URL.createObjectURL(h.qrState.imageBlob);
                  const a = document.createElement("a");
                  a.href = url; a.download = `horario-${h.empresa}-${new Date().toISOString().split("T")[0]}.png`;
                  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                  h.showToast("Horario descargado exitosamente", "success");
                }
              }} className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white">Descargar Horario</button>
            </div>
            {h.qrState.countdown !== null && h.qrState.countdown > 0 && (
              <div className="text-xs text-red-500 mt-2">Expira en {h.qrState.countdown}s</div>
            )}
          </div>
        </div>
      )}

      {h.qrState.countdown !== null && h.qrState.countdown > 0 && (
        <div className="fixed bottom-4 right-4 z-50 bg-[var(--card-bg)] text-[var(--foreground)] px-4 py-2 rounded-lg border border-[var(--input-border)] shadow-lg animate-pulse font-semibold text-sm">
          QR expira en {h.qrState.countdown}s
        </div>
      )}

      {h.isDelifoodEmpresa && (
        <DelifoodHoursModal isOpen={h.delifoodModal.isOpen}
          onClose={() => h.setDelifoodModal({ isOpen: false, employeeName: "", day: 0, currentHours: 0 })}
          onSave={h.handleDelifoodHoursSave}
          employeeName={h.delifoodModal.employeeName} day={h.delifoodModal.day}
          month={h.month} year={h.year} empresaValue={h.empresa} currentHours={h.delifoodModal.currentHours}
        />
      )}
    </>
  );
}

function LegendItem({ color, label, border }: { color: string; label: string; border?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-md shadow-sm ${border ? "border-2 border-[var(--input-border)]" : ""}`} style={{ backgroundColor: color }} />
      <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
    </div>
  );
}
