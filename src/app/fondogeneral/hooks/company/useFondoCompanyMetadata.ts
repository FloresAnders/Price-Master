"use client";

import { useEffect, useState } from "react";
import { EmpresasService } from "../../../../services/empresas";
import type { Empresas } from "../../../../types/firestore";

type UseFondoCompanyMetadataParams = {
  company: string;
  namespace: string;
};

export function useFondoCompanyMetadata({
  company,
  namespace,
}: UseFondoCompanyMetadataParams) {
  const [companyEmployees, setCompanyEmployees] = useState<string[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [companyData, setCompanyData] = useState<Empresas | null>(null);

  useEffect(() => {
    let isActive = true;
    setCompanyEmployees([]);

    if (!company) {
      setEmployeesLoading(false);
      return () => {
        isActive = false;
      };
    }

    // Solo cargar empleados de la empresa si estamos en fondogeneral (fg) o cajanegra (cn)
    // Para otros fondos (BCR, BN, BAC), no cargar empleados
    if (namespace !== "fg" && namespace !== "cn") {
      setEmployeesLoading(false);
      return () => {
        isActive = false;
      };
    }

    setEmployeesLoading(true);
    EmpresasService.getAllEmpresas()
      .then((empresas) => {
        if (!isActive) return;
        const match = empresas.find(
          (emp) => emp.name?.toLowerCase() === company.toLowerCase(),
        );
        const names =
          match?.empleados?.map((emp) => emp.Empleado).filter(Boolean) ?? [];
        setCompanyEmployees(names as string[]);
      })
      .catch((err) => {
        console.error("Error loading company employees:", err);
        if (isActive) setCompanyEmployees([]);
      })
      .finally(() => {
        if (isActive) setEmployeesLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [company, namespace]);

  useEffect(() => {
    let isActive = true;
    setCompanyData(null);

    if (!company) {
      return () => {
        isActive = false;
      };
    }

    EmpresasService.getAllEmpresas()
      .then((empresas) => {
        if (!isActive) return;
        const match = empresas.find(
          (emp) => emp.name?.toLowerCase() === company.toLowerCase(),
        );
        if (match) {
          setCompanyData(match);
        }
      })
      .catch((err) => {
        console.error("Error loading company data:", err);
        if (isActive) setCompanyData(null);
      });

    return () => {
      isActive = false;
    };
  }, [company]);

  return { companyEmployees, employeesLoading, companyData };
}
