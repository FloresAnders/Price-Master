"use client";

import { useState, useEffect } from "react";
import { EmpresasService } from "../../../../services/empresas";
import { useAuth } from "../../../../hooks/useAuth";
import useToast from "../../../../hooks/useToast";
import { useUnlockPastDays } from "../../../../hooks/useUnlockPastDays";
import { filterEmpresasByUser, resolveEmpresaValue } from "../utils";
import type { MappedEmpresa } from "../types";
import type { User as FirestoreUser } from "../../../../types/firestore";
import { useCalendarState } from "./useCalendarState";
import { useScheduleData } from "./useScheduleData";
import { useShiftManagement } from "./useShiftManagement";
import { useIncompleteDaysAlert } from "./useIncompleteDaysAlert";
import { useScheduleExport } from "./useScheduleExport";

export function useControlHorario(propUser?: FirestoreUser | null) {
  const { user: authUser } = useAuth();
  const { showToast } = useToast();
  const unlockPastDays = useUnlockPastDays();

  const user = propUser || authUser;
  const assignedEmpresa = user?.ownercompanie;

  // Empresa loading
  const [empresas, setEmpresas] = useState<MappedEmpresa[]>([]);
  const [loading, setLoading] = useState(true);
  const [empresa, setEmpresa] = useState("");
  const [assignedEmpresaValue, setAssignedEmpresaValue] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const all = await EmpresasService.getAllEmpresas();
        const mapped = filterEmpresasByUser(all, user);
        setEmpresas(mapped);
        if (assignedEmpresa && mapped.length > 0) {
          const r = resolveEmpresaValue(assignedEmpresa, mapped);
          if (r) { setAssignedEmpresaValue(r); if (!empresa) setEmpresa(r); }
          else setAssignedEmpresaValue(null);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [user, assignedEmpresa, empresa]);

  useEffect(() => {
    if (!user) return;
    if (user.role === "user" && assignedEmpresaValue) setEmpresa(assignedEmpresaValue);
    else if (assignedEmpresaValue && !empresa) setEmpresa(String(assignedEmpresaValue));
  }, [user, empresa, assignedEmpresa, assignedEmpresaValue]);

  useEffect(() => {
    const forced = assignedEmpresaValue;
    if (user?.role === "user" && forced && empresa && empresa !== forced) {
      setEmpresa(forced);
      showToast(`Acceso restringido a: ${forced}`, "error");
    }
  }, [empresa, user, assignedEmpresaValue, assignedEmpresa, showToast]);

  const handleEmpresaChange = (newEmpresa: string) => {
    if (user?.role === "user") { showToast("No puedes cambiar de empresa", "error"); return; }
    setEmpresa(newEmpresa);
  };

  // Unlock past days
  const [editPastDaysEnabled, setEditPastDaysEnabled] = useState(false);
  const [unlockPastDaysModal, setUnlockPastDaysModal] = useState(false);
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);

  useEffect(() => {
    if (user?.role === "user") setEditPastDaysEnabled(unlockPastDays.unlocked);
    else if (user?.role === "admin" || user?.role === "superadmin") setEditPastDaysEnabled(true);
  }, [unlockPastDays.unlocked, user?.role]);

  useEffect(() => {
    if (unlockPastDays.unlocked && unlockPastDaysModal) setUnlockPastDaysModal(false);
  }, [unlockPastDays.unlocked, unlockPastDaysModal]);

  // Sub-hooks
  const cal = useCalendarState();
  const isDelifoodEmpresa = empresa.toLowerCase().includes("delifood");
  const names = Array.from(new Set(empresas.find((l) => l.value === empresa)?.names || []));

  const sd = useScheduleData({
    empresa, namesList: names,
    year: cal.year, month: cal.month,
    selectedPeriod: cal.selectedPeriod, fullMonthView: cal.fullMonthView,
    daysInMonth: cal.daysInMonth,
    isDelifoodEmpresa, user, assignedEmpresaValue, showToast,
  });

  const shift = useShiftManagement({
    empresa, empresas, isDelifoodEmpresa,
    scheduleData: sd.scheduleData, setScheduleData: sd.setScheduleData,
    delifoodHoursData: sd.delifoodHoursData, setDelifoodHoursData: sd.setDelifoodHoursData,
    year: cal.year, month: cal.month, user, showToast,
  });

  useIncompleteDaysAlert({
    empresa, isDelifoodEmpresa,
    year: cal.year, month: cal.month,
    selectedPeriod: cal.selectedPeriod, fullMonthView: cal.fullMonthView,
    daysInMonth: cal.daysInMonth,
    scheduleData: sd.scheduleData, empresas, showToast,
  });

  const exp = useScheduleExport({
    user, names, empresa, empresas,
    daysToShow: cal.daysToShow,
    fullMonthView: cal.fullMonthView, viewMode: cal.viewMode,
    monthName: cal.monthName, month: cal.month, year: cal.year,
    selectedPeriod: cal.selectedPeriod, isDelifoodEmpresa,
    scheduleData: sd.scheduleData, delifoodHoursData: sd.delifoodHoursData, showToast,
  });

  return {
    showToast,
    user, empresas, loading, empresa, setEmpresa,
    assignedEmpresa, assignedEmpresaValue,
    scheduleData: sd.scheduleData,
    saving: shift.saving,
    selectedPeriod: cal.selectedPeriod, setSelectedPeriod: cal.setSelectedPeriod,
    fullMonthView: cal.fullMonthView, setFullMonthView: cal.setFullMonthView,
    viewMode: cal.viewMode, setViewMode: cal.setViewMode,
    confirmModal: shift.confirmModal, setConfirmModal: shift.setConfirmModal,
    modalLoading: shift.modalLoading,
    editPastDaysEnabled, setEditPastDaysEnabled,
    unlockPastDaysModal, setUnlockPastDaysModal,
    showUnlockPassword, setShowUnlockPassword,
    unlockPastDays,
    isExporting: exp.isExporting,
    qrState: exp.qrState, setQrState: exp.setQrState,
    isDelifoodEmpresa, names,
    year: cal.year, month: cal.month, monthName: cal.monthName, daysInMonth: cal.daysInMonth, daysToShow: cal.daysToShow,
    delifoodHoursData: sd.delifoodHoursData,
    delifoodModal: shift.delifoodModal, setDelifoodModal: shift.setDelifoodModal,
    handleEmpresaChange,
    changeMonth: cal.changeMonth,
    updateScheduleCell: shift.updateScheduleCell,
    handleCellChange: shift.handleCellChange,
    handleDelifoodCellClick: shift.handleDelifoodCellClick,
    handleDelifoodHoursSave: shift.handleDelifoodHoursSave,
    exportScheduleAsImage: exp.exportScheduleAsImage,
    exportQuincenaToPNG: exp.exportQuincenaToPNG,
    workedRangeModalOpen: exp.workedRangeModalOpen,
    workedRangeStartDate: exp.workedRangeStartDate,
    workedRangeEndDate: exp.workedRangeEndDate,
    workedRangeRows: exp.workedRangeRows,
    workedRangeGenerated: exp.workedRangeGenerated,
    isGeneratingWorkedRange: exp.isGeneratingWorkedRange,
    workedRangeQuickRange: exp.workedRangeQuickRange,
    workedRangeTodayKey: exp.workedRangeTodayKey,
    workedRangeFromCalendarOpen: exp.workedRangeFromCalendarOpen,
    workedRangeToCalendarOpen: exp.workedRangeToCalendarOpen,
    workedRangeFromCalendarMonth: exp.workedRangeFromCalendarMonth,
    workedRangeToCalendarMonth: exp.workedRangeToCalendarMonth,
    workedRangeFromCalendarRef: exp.workedRangeFromCalendarRef,
    workedRangeToCalendarRef: exp.workedRangeToCalendarRef,
    workedRangeFromButtonRef: exp.workedRangeFromButtonRef,
    workedRangeToButtonRef: exp.workedRangeToButtonRef,
    openWorkedRangeModal: exp.openWorkedRangeModal,
    closeWorkedRangeModal: exp.closeWorkedRangeModal,
    setWorkedRangeStartDate: exp.setWorkedRangeStartDate,
    setWorkedRangeEndDate: exp.setWorkedRangeEndDate,
    setWorkedRangeQuickRange: exp.setWorkedRangeQuickRange,
    setWorkedRangeFromCalendarOpen: exp.setWorkedRangeFromCalendarOpen,
    setWorkedRangeToCalendarOpen: exp.setWorkedRangeToCalendarOpen,
    setWorkedRangeFromCalendarMonth: exp.setWorkedRangeFromCalendarMonth,
    setWorkedRangeToCalendarMonth: exp.setWorkedRangeToCalendarMonth,
    generateWorkedRange: exp.generateWorkedRange,
    exportWorkedRangeImage: exp.exportWorkedRangeImage,
    formatWorkedRangeDateToDisplay: exp.formatWorkedRangeDateToDisplay,
    closeQR: exp.closeQR,
  };
}
