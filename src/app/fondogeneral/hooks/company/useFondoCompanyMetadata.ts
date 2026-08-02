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
  const shouldLoadEmployees =
    Boolean(company) &&
    (namespace === "fg" ||
      namespace === "cn" ||
      namespace === "tc" ||
      namespace === "ti");
  const employeesKey = shouldLoadEmployees ? `${namespace}:${company}` : "";
  const [companyEmployeesState, setCompanyEmployeesState] = useState<{
    key: string;
    employees: string[];
  }>({ key: "", employees: [] });
  const [rawEmployeesLoading, setRawEmployeesLoading] = useState(false);
  const [companyDataState, setCompanyDataState] = useState<{
    company: string;
    data: Empresas | null;
  }>({ company: "", data: null });
  const companyEmployees =
    companyEmployeesState.key === employeesKey
      ? companyEmployeesState.employees
      : [];
  const employeesLoading = shouldLoadEmployees && rawEmployeesLoading;
  const companyData =
    companyDataState.company === company ? companyDataState.data : null;

  useEffect(() => {
    let isActive = true;

    // Solo cargar empleados de la empresa si estamos en fondogeneral (fg), cajanegra (cn), tucan (tc) o tiempos (ti)
    // Para otros fondos (BCR, BN, BAC), no cargar empleados
    if (!shouldLoadEmployees) {
      return () => {
        isActive = false;
      };
    }

    const loadEmployees = async () => {
      setRawEmployeesLoading(true);
      try {
        const empresas = await EmpresasService.getAllEmpresas();
        if (!isActive) return;
        const match = empresas.find(
          (emp) => emp.name?.toLowerCase() === company.toLowerCase(),
        );
        const names =
          match?.empleados?.map((emp) => emp.Empleado).filter(Boolean) ?? [];
        setCompanyEmployeesState({
          key: employeesKey,
          employees: names as string[],
        });
      } catch (err) {
        console.error("Error loading company employees:", err);
        if (isActive) {
          setCompanyEmployeesState({ key: employeesKey, employees: [] });
        }
      } finally {
        if (isActive) setRawEmployeesLoading(false);
      }
    };

    void loadEmployees();

    return () => {
      isActive = false;
    };
  }, [company, employeesKey, shouldLoadEmployees]);

  useEffect(() => {
    let isActive = true;

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
          setCompanyDataState({ company, data: match });
        } else {
          setCompanyDataState({ company, data: null });
        }
      })
      .catch((err) => {
        console.error("Error loading company data:", err);
        if (isActive) setCompanyDataState({ company, data: null });
      });

    return () => {
      isActive = false;
    };
  }, [company]);

  return { companyEmployees, employeesLoading, companyData };
}
