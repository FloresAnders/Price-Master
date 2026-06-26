"use client";

import { useState } from "react";
import { SchedulesService } from "../../../../services/schedules";
import type { ScheduleData, DelifoodHoursData, ConfirmModalState, DelifoodModalState } from "../types";

interface Props {
  empresa: string;
  empresas: { value: string; employees?: { name: string; hoursPerShift?: number }[] }[];
  scheduleData: ScheduleData;
  setScheduleData: (cb: (prev: ScheduleData) => ScheduleData) => void;
  delifoodHoursData: DelifoodHoursData;
  setDelifoodHoursData: (cb: (prev: DelifoodHoursData) => DelifoodHoursData) => void;
  year: number;
  month: number;
  user: { role?: string } | null;
  showToast: (msg: string, type: "success" | "error" | "warning") => void;
  isDelifoodEmpresa: boolean;
}

export function useShiftManagement(props: Props) {
  const {
    empresa, empresas, scheduleData, setScheduleData,
    delifoodHoursData, setDelifoodHoursData,
    year, month, user, showToast,
  } = props;

  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    open: false, message: "", onConfirm: null, actionType: "assign",
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [delifoodModal, setDelifoodModal] = useState<DelifoodModalState>({
    isOpen: false, employeeName: "", day: 0, currentHours: 0,
  });
  const [pendingCellValues, setPendingCellValues] = useState<ScheduleData>({});

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const canEditDate = (day: number) => {
    if (user?.role !== "user") return true;
    const cellDate = new Date(year, month, day);
    cellDate.setHours(0, 0, 0, 0);
    const ref = new Date();
    const quincenaStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() <= 15 ? 1 : 16);
    return cellDate >= quincenaStart;
  };

  const updateScheduleCell = async (employeeName: string, day: string, newValue: string) => {
    const currentValue = scheduleData[employeeName]?.[day] || "";
    const setPendingValue = () => {
      setPendingCellValues((prev) => ({
        ...prev,
        [employeeName]: { ...(prev[employeeName] || {}), [day]: newValue },
      }));
    };
    const clearPendingValue = () => {
      setPendingCellValues((prev) => {
        if (!prev[employeeName] || !(day in prev[employeeName])) return prev;
        const nextEmployee = { ...prev[employeeName] };
        delete nextEmployee[day];
        const next = { ...prev };
        if (Object.keys(nextEmployee).length > 0) next[employeeName] = nextEmployee;
        else delete next[employeeName];
        return next;
      });
    };

    if (newValue && ["V", "I"].includes(newValue) && !isAdmin) {
      showToast(`Solo ADMIN puede asignar "${newValue === "V" ? "Vacaciones" : "Incapacidad"}.`, "error");
      return;
    }

    if (newValue && ["N", "D"].includes(newValue)) {
      const existing = Object.keys(scheduleData).find(
        (emp) => emp !== employeeName && scheduleData[emp]?.[day] === newValue,
      );
      if (existing) {
        showToast(`"${newValue}" ya asignado a ${existing} el día ${day}.`, "error");
        return;
      }
    }

    if (newValue === "L") {
      const count = Object.keys(scheduleData).filter(
        (emp) => emp !== employeeName && scheduleData[emp]?.[day] === "L",
      ).length;
      if (count >= 2) {
        showToast(`Máximo 2 empleados con "L" el día ${day}.`, "error");
        return;
      }
    }

    const needsConfirm = !currentValue && ["N", "D", "L", "V", "I"].includes(newValue);
    const needsChangeConfirm = currentValue && ["N", "D", "L", "V", "I"].includes(currentValue) && currentValue !== newValue;

    if (needsConfirm || needsChangeConfirm) {
      const stateLabels: Record<string, string> = { V: "Vacaciones", I: "Incapacidad", L: "Libre", N: "Nocturno", D: "Diurno" };
      let msg: string;
      let actionType: "assign" | "delete" | "change" = needsChangeConfirm ? "change" : "assign";

      if (needsChangeConfirm && (newValue === "" || newValue.trim() === "")) {
        msg = `¿Eliminar "${stateLabels[currentValue]}" de ${employeeName} el día ${day}?`;
        actionType = "delete";
      } else if (needsChangeConfirm) {
        msg = `¿Cambiar a ${employeeName} el día ${day} de "${stateLabels[currentValue]}" a "${stateLabels[newValue]}"?`;
      } else {
        msg = newValue === "V" ? `¿Vacaciones a ${employeeName} el día ${day}?`
          : newValue === "I" ? `¿Incapacidad a ${employeeName} el día ${day}?`
          : `¿Asignar "${newValue}" a ${employeeName} el día ${day}?`;
      }

      setPendingValue();
      setConfirmModal({
        open: true, message: msg,
        onConfirm: async () => {
          setModalLoading(true);
          await doUpdate();
          setModalLoading(false);
          setConfirmModal({ open: false, message: "", onConfirm: null, actionType: "assign" });
        },
        actionType,
      });
      return;
    }

    setPendingValue();
    await doUpdate();

    async function doUpdate() {
      try {
        setSaving(true);
        const hoursPerShift = empresas
          .find((e) => e.value === empresa)
          ?.employees?.find((e) => e.name === employeeName)?.hoursPerShift;
        await SchedulesService.updateScheduleShift(empresa, employeeName, year, month, parseInt(day), newValue, { horasPorDia: hoursPerShift });
        setScheduleData((prev) => ({
          ...prev,
          [employeeName]: { ...(prev[employeeName] || {}), [day]: newValue },
        }));
        clearPendingValue();
        showToast(newValue.trim() ? "Horario actualizado" : "Turno eliminado", "success");
      } catch {
        clearPendingValue();
        showToast("Error al actualizar el horario", "error");
      } finally {
        setSaving(false);
      }
    }
  };

  const cancelConfirmModal = () => {
    setPendingCellValues({});
    setConfirmModal({ open: false, message: "", onConfirm: null, actionType: "assign" });
  };

  const handleCellChange = (employeeName: string, day: number, value: string) => {
    if (!canEditDate(day)) {
      showToast("No puedes editar días de quincenas pasadas.", "warning");
      return;
    }
    const currentValue = scheduleData[employeeName]?.[day.toString()] || "";
    if (!isAdmin && ["V", "I"].includes(currentValue)) {
      showToast(`Solo ADMIN puede modificar "${currentValue === "V" ? "Vacaciones" : "Incapacidad"}.`, "error");
      return;
    }
    updateScheduleCell(employeeName, day.toString(), value);
  };

  const handleDelifoodCellClick = (employeeName: string, day: number) => {
    if (!canEditDate(day)) {
      showToast("No puedes editar días de quincenas pasadas.", "warning");
      return;
    }
    const currentHours = delifoodHoursData[employeeName]?.[day.toString()]?.hours || 0;
    setDelifoodModal({ isOpen: true, employeeName, day, currentHours });
  };

  const handleDelifoodHoursSave = async (hours: number) => {
    const { employeeName, day } = delifoodModal;
    if (!empresa || !employeeName) return;

    if (!canEditDate(day)) {
      showToast("No puedes editar días de quincenas pasadas.", "warning");
      return;
    }

    try {
      setSaving(true);
      await SchedulesService.updateScheduleHours(empresa, employeeName, year, month, day, hours);
      setDelifoodHoursData((prev) => {
        const next = { ...prev };
        if (hours <= 0) {
          if (next[employeeName]) delete next[employeeName][day.toString()];
        } else {
          if (!next[employeeName]) next[employeeName] = {};
          next[employeeName][day.toString()] = { hours };
        }
        return next;
      });
      showToast(hours <= 0 ? "Registro eliminado" : "Horas guardadas", "success");
    } catch {
      showToast("Error al guardar horas", "error");
    } finally {
      setSaving(false);
      setDelifoodModal({ isOpen: false, employeeName: "", day: 0, currentHours: 0 });
    }
  };

  return {
    saving, confirmModal, setConfirmModal, modalLoading,
    delifoodModal, setDelifoodModal,
    pendingCellValues, cancelConfirmModal,
    updateScheduleCell, handleCellChange, handleDelifoodCellClick, handleDelifoodHoursSave,
  };
}
