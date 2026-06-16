"use client";

import React from "react";
import { Eye, EyeOff, Mail, Plus, Trash2 } from "lucide-react";

import { EmpresasService } from "../../services/empresas";
import type { User } from "../../types/firestore";

type Props = {
  empresasData: any[];
  setEmpresasData: React.Dispatch<React.SetStateAction<any[]>>;
  currentUser: User | null;
  openConfirmModal: (
    title: string,
    message: string,
    onConfirm: () => void,
    opts?: { singleButton?: boolean; singleButtonText?: string },
  ) => void;
  showToast: (
    message: string,
    type?: "success" | "error" | "info" | "warning",
    duration?: number,
  ) => void;
  resolveOwnerIdForActor: (provided?: string) => string | undefined;
  loadData: () => Promise<void>;
};

export default function EmpresasEditorSection({
  empresasData,
  setEmpresasData,
  currentUser,
  openConfirmModal,
  showToast,
  resolveOwnerIdForActor,
  loadData,
}: Props) {
  const [editMode, setEditMode] = React.useState<Record<string, boolean>>({});
  const [correoModalEmpresaIdx, setCorreoModalEmpresaIdx] = React.useState<
    number | null
  >(null);
  const [correoEmail, setCorreoEmail] = React.useState("");
  const [correoPassword, setCorreoPassword] = React.useState("");
  const [showCorreoPassword, setShowCorreoPassword] = React.useState(false);
  const [correoSaving, setCorreoSaving] = React.useState(false);

  const getEmpresaKey = (empresa: any, idx: number) => {
    return empresa?.id || `empresa-${idx}`;
  };

  const isEditingEmpresa = (empresa: any, idx: number) => {
    if (!empresa?.id) return true;
    const key = getEmpresaKey(empresa, idx);
    return Boolean(editMode[key]);
  };

  const [colaboradorOpenMap, setColaboradorOpenMap] = React.useState<
    Record<string, boolean>
  >({});
  const [colaboradorChangedMap, setColaboradorChangedMap] = React.useState<
    Record<string, boolean>
  >({});

  const getColKey = (empresa: any, idx: number, eIdx: number) =>
    `${getEmpresaKey(empresa, idx)}-col-${eIdx}`;

  const isColaboradorOpen = (empresa: any, idx: number, eIdx: number) => {
    const key = getColKey(empresa, idx, eIdx);
    return colaboradorOpenMap[key] ?? false;
  };

  const setColaboradorOpen = (
    empresa: any,
    idx: number,
    eIdx: number,
    value: boolean,
  ) => {
    const key = getColKey(empresa, idx, eIdx);
    setColaboradorOpenMap((prev) => ({ ...prev, [key]: value }));
  };

  const toggleColaborador = (empresa: any, idx: number, eIdx: number) => {
    const key = getColKey(empresa, idx, eIdx);
    setColaboradorOpenMap((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setColChanged = (
    empresa: any,
    idx: number,
    eIdx: number,
    value: boolean,
  ) => {
    const key = getColKey(empresa, idx, eIdx);
    setColaboradorChangedMap((prev) => ({ ...prev, [key]: value }));
  };

  const isColChanged = (empresa: any, idx: number, eIdx: number) => {
    const key = getColKey(empresa, idx, eIdx);
    return Boolean(colaboradorChangedMap[key]);
  };

  const clearColChangedForEmpresa = (empresa: any, idx: number) => {
    const prefix = getEmpresaKey(empresa, idx) + "-col-";
    setColaboradorChangedMap((prev) => {
      const next: Record<string, boolean> = {};
      Object.keys(prev).forEach((k) => {
        if (!k.startsWith(prefix)) next[k] = prev[k];
      });
      return next;
    });
  };

  const openCorreoModal = (empresa: any, idx: number) => {
    setCorreoModalEmpresaIdx(idx);
    setCorreoEmail(empresa?.correoConfigEmail || "");
    setCorreoPassword(empresa?.correoConfigPassword || "");
    setShowCorreoPassword(false);
  };

  const closeCorreoModal = () => {
    if (correoSaving) return;
    setCorreoModalEmpresaIdx(null);
    setCorreoEmail("");
    setCorreoPassword("");
    setShowCorreoPassword(false);
  };

  const saveCorreoConfig = async () => {
    if (correoModalEmpresaIdx === null) return;
    const empresa = empresasData[correoModalEmpresaIdx];
    const email = correoEmail.trim();
    if (!email) {
      showToast("Correo requerido", "error");
      return;
    }
    if (!empresa?.id) {
      showToast("Guarda la empresa antes de configurar correo", "warning");
      return;
    }
    if (!correoPassword.trim()) {
      showToast("Contraseña requerida", "error");
      return;
    }

    setCorreoSaving(true);
    try {
      const patch = {
        correoConfigEmail: email,
        correoConfigPassword: correoPassword,
      };

      await EmpresasService.updateEmpresa(empresa.id, patch);

      setEmpresasData((prev) =>
        prev.map((item, idx) =>
          idx === correoModalEmpresaIdx ? { ...item, ...patch } : item,
        ),
      );

      showToast("Correo configurado", "success");
      closeCorreoModal();
    } catch (error) {
      console.error("Error saving correo config:", error);
      showToast("Error al guardar correo", "error");
    } finally {
      setCorreoSaving(false);
    }
  };
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div>
          <h4 className="text-base sm:text-lg lg:text-xl font-semibold">
            Configuración de Empresas
          </h4>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-0.5 sm:mt-1">
            Gestiona las empresas y sus configuraciones
          </p>
        </div>
        <button
          onClick={() =>
            setEmpresasData((prev) => [
              ...prev,
              {
                ownerId:
                  currentUser && currentUser.eliminate === false
                    ? currentUser.id
                    : "",
                name: "",
                ubicacion: "",
                horarioApertura: "",
                horarioCierre: "",
                cierreFondoVentasMinutesBeforeEnd: 15,
                cierreFondoVentasMinutesAfterEnd: 90,
                mostrarInfoPago: true,
                unicoCierre: false,
                verificacionSistemas: true,
                empleados: [
                  {
                    Empleado: "",
                    hoursPerShift: 8,
                    extraAmount: 0,
                    ccssType: "TC",
                    calculoprecios: false,
                    amboshorarios: false,
                  },
                ],
              },
            ])
          }
          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs sm:text-sm w-full sm:w-auto flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Agregar Empresa</span>
        </button>
      </div>

      {empresasData.map((empresa, idx) => (
        <div
          key={empresa.id || idx}
          className="border border-[var(--input-border)] rounded-lg p-2.5 sm:p-4 lg:p-5 relative"
        >
          {(() => {
            const key = getEmpresaKey(empresa, idx);
            const isEditing = isEditingEmpresa(empresa, idx);

            return (
              <>
                {!isEditing && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
                        <p className="text-[10px] sm:text-xs font-medium text-[var(--muted-foreground)]">
                          Nombre
                        </p>
                        <p className="text-sm sm:text-base font-semibold text-[var(--foreground)] break-words">
                          {empresa.name || "Sin nombre"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
                        <p className="text-[10px] sm:text-xs font-medium text-[var(--muted-foreground)]">
                          Ubicación
                        </p>
                        <p className="text-sm sm:text-base font-semibold text-[var(--foreground)] break-words">
                          {empresa.ubicacion || "Sin ubicación"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
                        <p className="text-[10px] sm:text-xs font-medium text-[var(--muted-foreground)]">
                          Apertura
                        </p>
                        <p className="text-sm sm:text-base font-semibold text-[var(--foreground)] break-words">
                          {empresa.horarioApertura || "Sin horario"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
                        <p className="text-[10px] sm:text-xs font-medium text-[var(--muted-foreground)]">
                          Cierre
                        </p>
                        <p className="text-sm sm:text-base font-semibold text-[var(--foreground)] break-words">
                          {empresa.horarioCierre || "Sin horario"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
                        <p className="text-[10px] sm:text-xs font-medium text-[var(--muted-foreground)]">
                          Cierre FV antes
                        </p>
                        <p className="text-sm sm:text-base font-semibold text-[var(--foreground)] break-words">
                          {empresa.cierreFondoVentasMinutesBeforeEnd ?? 15} min
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
                        <p className="text-[10px] sm:text-xs font-medium text-[var(--muted-foreground)]">
                          Cierre FV despues
                        </p>
                        <p className="text-sm sm:text-base font-semibold text-[var(--foreground)] break-words">
                          {empresa.cierreFondoVentasMinutesAfterEnd ?? 90} min
                        </p>
                      </div>
                      <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
                        <p className="text-[10px] sm:text-xs font-medium text-[var(--muted-foreground)]">
                          Info pago
                        </p>
                        <p className="text-sm sm:text-base font-semibold text-[var(--foreground)] break-words">
                          {empresa.mostrarInfoPago !== false ? "Visible" : "Oculta"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => openCorreoModal(empresa, idx)}
                        className="px-3 py-2 sm:px-4 rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors text-sm sm:text-base flex items-center justify-center gap-2"
                      >
                        <Mail className="w-4 h-4" />
                        Configurar correo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!empresa.id) return;
                          setEditMode((prev) => ({ ...prev, [key]: true }));
                        }}
                        className="px-3 py-2 sm:px-4 rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors text-sm sm:text-base"
                      >
                        Editar
                      </button>
                    </div>
                  </>
                )}

                {isEditing && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1">
                          Nombre de la empresa:
                        </label>
                        <input
                          type="text"
                          value={empresa.name || ""}
                          onChange={(e) => {
                            const copy = [...empresasData];
                            copy[idx] = { ...copy[idx], name: e.target.value };
                            setEmpresasData(copy);
                          }}
                          className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                          style={{
                            background: "var(--input-bg)",
                            color: "var(--foreground)",
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1">
                          Ubicación:
                        </label>
                        <input
                          type="text"
                          value={empresa.ubicacion || ""}
                          onChange={(e) => {
                            const copy = [...empresasData];
                            copy[idx] = {
                              ...copy[idx],
                              ubicacion: e.target.value,
                            };
                            setEmpresasData(copy);
                          }}
                          className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                          style={{
                            background: "var(--input-bg)",
                            color: "var(--foreground)",
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1">
                          Horario de apertura:
                        </label>
                        <input
                          type="time"
                          value={empresa.horarioApertura || ""}
                          onChange={(e) => {
                            const copy = [...empresasData];
                            copy[idx] = {
                              ...copy[idx],
                              horarioApertura: e.target.value,
                            };
                            setEmpresasData(copy);
                          }}
                          className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                          style={{
                            background: "var(--input-bg)",
                            color: "var(--foreground)",
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1">
                          Horario de cierre:
                        </label>
                        <input
                          type="time"
                          value={empresa.horarioCierre || ""}
                          onChange={(e) => {
                            const copy = [...empresasData];
                            copy[idx] = {
                              ...copy[idx],
                              horarioCierre: e.target.value,
                            };
                            setEmpresasData(copy);
                          }}
                          className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                          style={{
                            background: "var(--input-bg)",
                            color: "var(--foreground)",
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1">
                          Cierre FV antes del fin:
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={
                            empresa.cierreFondoVentasMinutesBeforeEnd ?? 15
                          }
                          onChange={(e) => {
                            const copy = [...empresasData];
                            copy[idx] = {
                              ...copy[idx],
                              cierreFondoVentasMinutesBeforeEnd: Math.max(
                                0,
                                parseInt(e.target.value, 10) || 0,
                              ),
                            };
                            setEmpresasData(copy);
                          }}
                          className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                          style={{
                            background: "var(--input-bg)",
                            color: "var(--foreground)",
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-medium mb-1">
                          Cierre FV despues del fin:
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={empresa.cierreFondoVentasMinutesAfterEnd ?? 90}
                          onChange={(e) => {
                            const copy = [...empresasData];
                            copy[idx] = {
                              ...copy[idx],
                              cierreFondoVentasMinutesAfterEnd: Math.max(
                                0,
                                parseInt(e.target.value, 10) || 0,
                              ),
                            };
                            setEmpresasData(copy);
                          }}
                          className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                          style={{
                            background: "var(--input-bg)",
                            color: "var(--foreground)",
                          }}
                        />
                      </div>

                      <label className="flex items-center gap-2 text-xs sm:text-sm">
                        <input
                          type="checkbox"
                          checked={empresa.mostrarInfoPago !== false}
                          onChange={(e) => {
                            const copy = [...empresasData];
                            copy[idx] = {
                              ...copy[idx],
                              mostrarInfoPago: e.target.checked,
                            };
                            setEmpresasData(copy);
                          }}
                        />
                        Mostrar info pago
                      </label>

                      <label className="flex items-center gap-2 text-xs sm:text-sm">
                        <input
                          type="checkbox"
                          checked={empresa.unicoCierre === true}
                          onChange={(e) => {
                            const copy = [...empresasData];
                            copy[idx] = {
                              ...copy[idx],
                              unicoCierre: e.target.checked,
                            };
                            setEmpresasData(copy);
                          }}
                        />
                        Unico cierre
                      </label>

                      <label className="flex items-center gap-2 text-xs sm:text-sm">
                        <input
                          type="checkbox"
                          checked={empresa.verificacionSistemas !== false}
                          onChange={(e) => {
                            const copy = [...empresasData];
                            copy[idx] = {
                              ...copy[idx],
                              verificacionSistemas: e.target.checked,
                            };
                            setEmpresasData(copy);
                          }}
                        />
                        Verificacion de sistemas
                      </label>
                    </div>

                    <div className="mt-4 sm:mt-5">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
                        <label className="block text-xs sm:text-sm font-medium">
                          Colaboradores:
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const copy = [...empresasData];
                              if (!copy[idx].empleados)
                                copy[idx].empleados = [];
                              copy[idx].empleados.push({
                                Empleado: "",
                                hoursPerShift: 8,
                                extraAmount: 0,
                                ccssType: "TC",
                                calculoprecios: false,
                                amboshorarios: false,
                              });
                              const newIndex =
                                (copy[idx].empleados || []).length - 1;
                              setEmpresasData(copy);
                              // open the newly added collaborator and mark as changed
                              setTimeout(() => {
                                setColaboradorOpen(
                                  empresa,
                                  idx,
                                  newIndex,
                                  true,
                                );
                                setColChanged(empresa, idx, newIndex, true);
                              }, 0);
                            }}
                            className="text-xs sm:text-sm bg-green-600 text-white px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md hover:bg-green-700 transition-colors w-full sm:w-auto flex items-center justify-center gap-1.5 whitespace-nowrap"
                          >
                            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>Agregar Colaborador</span>
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2 sm:space-y-3">
                        {empresa.empleados?.map((emp: any, eIdx: number) => {
                          const colOpen = isColaboradorOpen(empresa, idx, eIdx);
                          return (
                            <div key={eIdx}>
                              {!colOpen ? (
                                <div className="p-2 sm:p-3 border border-[var(--input-border)] rounded-lg bg-[var(--card-bg)] flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium flex items-center gap-2">
                                      {emp.Empleado || `N°${eIdx + 1}`}
                                      {isColChanged(empresa, idx, eIdx) && (
                                        <span className="px-2 py-0.5 text-[10px] bg-yellow-100 text-yellow-800 rounded">
                                          Pendiente
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-xs text-[var(--muted-foreground)]">{`${emp.hoursPerShift ?? 8} hrs / turno · ${emp.extraAmount ?? 0}`}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setColaboradorOpen(
                                          empresa,
                                          idx,
                                          eIdx,
                                          true,
                                        )
                                      }
                                      className="px-2 py-1 rounded bg-[var(--accent)] text-white text-xs"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => {
                                        openConfirmModal(
                                          "Eliminar Empleado",
                                          `¿Desea eliminar al empleado ${emp.Empleado || `N°${eIdx + 1}`}?`,
                                          () => {
                                            const copy = [...empresasData];
                                            copy[idx].empleados = copy[
                                              idx
                                            ].empleados.filter(
                                              (_: unknown, i: number) =>
                                                i !== eIdx,
                                            );
                                            setEmpresasData(copy);
                                            clearColChangedForEmpresa(
                                              empresa,
                                              idx,
                                            );
                                          },
                                        );
                                      }}
                                      className="px-2 py-1 rounded bg-red-600 text-white text-xs"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2 sm:p-3 border border-[var(--input-border)] rounded-lg bg-[var(--card-bg)]">
                                  {isColChanged(empresa, idx, eIdx) && (
                                    <div className="flex justify-end mb-2">
                                      <span className="px-2 py-0.5 text-[10px] bg-yellow-100 text-yellow-800 rounded">
                                        Cambios pendientes
                                      </span>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                    <div className="sm:col-span-2">
                                      <label className="block text-[10px] sm:text-xs font-medium mb-1">
                                        Colaborador
                                      </label>
                                      <input
                                        type="text"
                                        value={emp.Empleado}
                                        onChange={(ev) => {
                                          const copy = [...empresasData];
                                          copy[idx].empleados[eIdx].Empleado =
                                            ev.target.value;
                                          setEmpresasData(copy);
                                          setColChanged(
                                            empresa,
                                            idx,
                                            eIdx,
                                            true,
                                          );
                                        }}
                                        className="w-full px-2 sm:px-2.5 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                                        style={{
                                          background: "var(--input-bg)",
                                          color: "var(--foreground)",
                                        }}
                                        placeholder="Nombre"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] sm:text-xs font-medium mb-1">
                                        Horas/turno
                                      </label>
                                      <input
                                        type="number"
                                        value={emp.hoursPerShift ?? 8}
                                        onChange={(ev) => {
                                          const copy = [...empresasData];
                                          copy[idx].empleados[
                                            eIdx
                                          ].hoursPerShift =
                                            parseInt(ev.target.value) || 0;
                                          setEmpresasData(copy);
                                          setColChanged(
                                            empresa,
                                            idx,
                                            eIdx,
                                            true,
                                          );
                                        }}
                                        className="w-full px-2 sm:px-2.5 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                                        style={{
                                          background: "var(--input-bg)",
                                          color: "var(--foreground)",
                                        }}
                                        min="0"
                                        step="0.5"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] sm:text-xs font-medium mb-1">
                                        Monto extra
                                      </label>
                                      <input
                                        type="number"
                                        value={emp.extraAmount ?? 0}
                                        onChange={(ev) => {
                                          const copy = [...empresasData];
                                          copy[idx].empleados[
                                            eIdx
                                          ].extraAmount =
                                            parseFloat(ev.target.value) || 0;
                                          setEmpresasData(copy);
                                          setColChanged(
                                            empresa,
                                            idx,
                                            eIdx,
                                            true,
                                          );
                                        }}
                                        className="w-full px-2 sm:px-2.5 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                                        style={{
                                          background: "var(--input-bg)",
                                          color: "var(--foreground)",
                                        }}
                                        min="0"
                                        step="0.01"
                                      />
                                    </div>
                                    <div className="sm:col-span-2">
                                      <label className="block text-[10px] sm:text-xs font-medium mb-1">
                                        Tipo CCSS
                                      </label>
                                      <select
                                        value={emp.ccssType || "TC"}
                                        onChange={(ev) => {
                                          const copy = [...empresasData];
                                          copy[idx].empleados[eIdx].ccssType =
                                            ev.target.value;
                                          setEmpresasData(copy);
                                          setColChanged(
                                            empresa,
                                            idx,
                                            eIdx,
                                            true,
                                          );
                                        }}
                                        className="w-full px-2 sm:px-2.5 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                                        style={{
                                          background: "var(--input-bg)",
                                          color: "var(--foreground)",
                                        }}
                                      >
                                        <option value="TC">
                                          Tiempo Completo
                                        </option>
                                        <option value="MT">Medio Tiempo</option>
                                      </select>
                                    </div>

                                    <div className="sm:col-span-2">
                                      <label className="block text-[10px] sm:text-xs font-medium mb-1">
                                        Horarios
                                      </label>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <label className="flex items-center gap-2 text-xs sm:text-sm">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(emp.amboshorarios)}
                                            onChange={(ev) => {
                                              const copy = [...empresasData];
                                              copy[idx].empleados[
                                                eIdx
                                              ].amboshorarios =
                                                ev.target.checked;
                                              setEmpresasData(copy);
                                              setColChanged(
                                                empresa,
                                                idx,
                                                eIdx,
                                                true,
                                              );
                                            }}
                                          />
                                          Ambos horarios
                                        </label>

                                        <label className="flex items-center gap-2 text-xs sm:text-sm">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(
                                              emp.calculoprecios,
                                            )}
                                            onChange={(ev) => {
                                              const copy = [...empresasData];
                                              copy[idx].empleados[
                                                eIdx
                                              ].calculoprecios =
                                                ev.target.checked;
                                              setEmpresasData(copy);
                                              setColChanged(
                                                empresa,
                                                idx,
                                                eIdx,
                                                true,
                                              );
                                            }}
                                          />
                                          Cálculo precios
                                        </label>
                                      </div>
                                      <p className="text-[10px] sm:text-xs text-[var(--muted-foreground)] mt-1">
                                        Si “Ambos horarios” está activo, tiene
                                        prioridad.
                                      </p>
                                    </div>

                                    <div className="sm:col-span-2 flex justify-end mt-2 pt-2 border-t border-[var(--input-border)]">
                                      <button
                                        onClick={() =>
                                          setColaboradorOpen(
                                            empresa,
                                            idx,
                                            eIdx,
                                            false,
                                          )
                                        }
                                        className="text-xs sm:text-sm px-3 py-2 border rounded-md"
                                      >
                                        Cerrar
                                      </button>
                                      <button
                                        onClick={() => {
                                          openConfirmModal(
                                            "Eliminar Empleado",
                                            `¿Desea eliminar al empleado ${emp.Empleado || `N°${eIdx + 1}`}?`,
                                            () => {
                                              const copy = [...empresasData];
                                              copy[idx].empleados = copy[
                                                idx
                                              ].empleados.filter(
                                                (_: unknown, i: number) =>
                                                  i !== eIdx,
                                              );
                                              setEmpresasData(copy);
                                              clearColChangedForEmpresa(
                                                empresa,
                                                idx,
                                              );
                                            },
                                          );
                                        }}
                                        className="text-xs sm:text-sm px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center gap-1 ml-2"
                                      >
                                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span className="hidden sm:inline">
                                          Eliminar
                                        </span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => openCorreoModal(empresa, idx)}
                        className="px-3 py-2 sm:px-4 rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors text-sm sm:text-base flex items-center justify-center gap-2"
                      >
                        <Mail className="w-4 h-4" />
                        Configurar correo
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!empresa.id)
                            return setEditMode((prev) => ({
                              ...prev,
                              [key]: false,
                            }));
                          setEditMode((prev) => ({ ...prev, [key]: false }));
                        }}
                        className="px-3 py-2 sm:px-4 rounded-md border border-[var(--input-border)] bg-[var(--muted)]/50 text-[var(--foreground)] hover:bg-[var(--muted)] transition-colors text-sm sm:text-base"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const e = empresasData[idx];
                            if (e.id) {
                              await EmpresasService.updateEmpresa(e.id, e);
                              showToast("Empresa actualizada", "success");
                              setEditMode((prev) => ({
                                ...prev,
                                [key]: false,
                              }));
                              clearColChangedForEmpresa(e, idx);
                            } else {
                              const ownerIdToUse = resolveOwnerIdForActor(
                                e.ownerId,
                              );
                              const idToUse =
                                e.name && e.name.trim() !== ""
                                  ? e.name.trim()
                                  : undefined;
                              if (!idToUse) {
                                showToast(
                                  "El nombre (name) es requerido para crear la empresa con id igual a name",
                                  "error",
                                );
                              } else {
                                try {
                                  await EmpresasService.addEmpresa({
                                    id: idToUse,
                                    ownerId: ownerIdToUse,
                                    name: e.name || "",
                                    ubicacion: e.ubicacion || "",
                                    horarioApertura: e.horarioApertura || "",
                                    horarioCierre: e.horarioCierre || "",
                                    cierreFondoVentasMinutesBeforeEnd:
                                      e.cierreFondoVentasMinutesBeforeEnd,
                                    cierreFondoVentasMinutesAfterEnd:
                                      e.cierreFondoVentasMinutesAfterEnd,
                                    mostrarInfoPago:
                                      e.mostrarInfoPago !== false,
                                    unicoCierre: e.unicoCierre === true,
                                    verificacionSistemas:
                                      e.verificacionSistemas !== false,
                                    empleados: e.empleados || [],
                                  });
                                  await loadData();
                                  showToast("Empresa creada", "success");
                                  setEditMode((prev) => ({
                                    ...prev,
                                    [key]: false,
                                  }));
                                  clearColChangedForEmpresa(e, idx);
                                } catch (err) {
                                  const message =
                                    err && (err as Error).message
                                      ? (err as Error).message
                                      : "Error al guardar empresa";
                                  if (
                                    message.includes(
                                      "maximum allowed companies",
                                    ) ||
                                    message.toLowerCase().includes("max")
                                  ) {
                                    openConfirmModal(
                                      "Límite de empresas",
                                      message,
                                      () => {},
                                      {
                                        singleButton: true,
                                        singleButtonText: "Cerrar",
                                      },
                                    );
                                  } else {
                                    showToast(
                                      "Error al guardar empresa",
                                      "error",
                                    );
                                  }
                                }
                              }
                            }
                          } catch (err) {
                            console.error("Error saving empresa:", err);
                            showToast("Error al guardar empresa", "error");
                          }
                        }}
                        className="px-3 py-2 sm:px-4 rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors text-sm sm:text-base"
                      >
                        Guardar Empresa
                      </button>
                      <button
                        onClick={() =>
                          openConfirmModal(
                            "Eliminar Empresa",
                            "¿Desea eliminar esta empresa?",
                            async () => {
                              try {
                                const e = empresasData[idx];
                                if (e.id)
                                  await EmpresasService.deleteEmpresa(e.id);
                                setEmpresasData((prev) =>
                                  prev.filter((_, i) => i !== idx),
                                );
                                showToast("Empresa eliminada", "success");
                              } catch (err) {
                                console.error("Error deleting empresa:", err);
                                showToast("Error al eliminar empresa", "error");
                              }
                            },
                          )
                        }
                        className="px-3 py-2 sm:px-4 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm sm:text-base"
                      >
                        Eliminar Empresa
                      </button>
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>
      ))}

      {correoModalEmpresaIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-5 shadow-2xl">
            <div className="mb-4">
              <h5 className="text-lg font-semibold text-[var(--foreground)]">
                Configurar correo
              </h5>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {empresasData[correoModalEmpresaIdx]?.name || "Empresa"}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Correo
                </label>
                <input
                  type="email"
                  value={correoEmail}
                  onChange={(e) => setCorreoEmail(e.target.value)}
                  className="w-full rounded-md border border-[var(--input-border)] px-3 py-2 text-sm"
                  style={{
                    background: "var(--input-bg)",
                    color: "var(--foreground)",
                  }}
                  placeholder="correo@empresa.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Contraseña
                </label>
                <div className="flex items-center rounded-md border border-[var(--input-border)] pr-2">
                  <input
                    type={showCorreoPassword ? "text" : "password"}
                    value={correoPassword}
                    onChange={(e) => setCorreoPassword(e.target.value)}
                    className="w-full bg-transparent px-3 py-2 text-sm outline-none"
                    style={{ color: "var(--foreground)" }}
                    placeholder={
                      "Ingresa la contraseña"
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowCorreoPassword((prev) => !prev)}
                    className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  >
                    {showCorreoPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeCorreoModal}
                disabled={correoSaving}
                className="rounded-md border border-[var(--input-border)] px-4 py-2 text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveCorreoConfig}
                disabled={correoSaving}
                className="rounded-md bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                {correoSaving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
