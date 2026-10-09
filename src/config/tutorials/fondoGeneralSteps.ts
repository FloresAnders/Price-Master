export type FondoGeneralTutorialSystem = "tucan" | "contica" | "tm" | "tiempos";

export type FondoGeneralTutorialStep = {
  id: string;
  number: number;
  system: FondoGeneralTutorialSystem;
  title: string;
  description: string;
  image?: string;
  targetSelector?: string;
  alt?: string;
};

export const fondoGeneralSteps: FondoGeneralTutorialStep[] = [
  {
    id: "tucan-login",
    number: 1,
    system: "tucan",
    title: "Ingrese a Tucán",
    description:
      "Escriba las credenciales asignadas a la sucursal y pulse Ingresar para acceder al sistema Tucán.",
    image: "/tutorials/fondo-general/1.webp",
    alt: "Pantalla de inicio de sesión de Tucán con el botón Ingresar señalado",
  },
  {
    id: "tucan-scroll-reports",
    number: 2,
    system: "tucan",
    title: "Desplácese hasta Reportes",
    description:
      "En el menú lateral izquierdo, baje hasta el final para encontrar la opción Reportes.",
    image: "/tutorials/fondo-general/2.webp",
    alt: "Menú principal de Tucán con una indicación para bajar hasta la opción Reportes",
  },
  {
    id: "tucan-open-reports",
    number: 3,
    system: "tucan",
    title: "Abra Reportes",
    description:
      "Cuando la opción Reportes esté visible en el menú lateral, selecciónela para mostrar sus consultas disponibles.",
    image: "/tutorials/fondo-general/3.webp",
    alt: "Menú lateral de Tucán con la opción Reportes señalada",
  },
  {
    id: "tucan-cashier-payments",
    number: 4,
    system: "tucan",
    title: "Seleccione Pagos de un Cajero",
    description:
      "Dentro de Reportes, elija Pagos de un Cajero para consultar las transacciones que se usarán en el cierre.",
    image: "/tutorials/fondo-general/4.webp",
    alt: "Submenú Reportes de Tucán con Pagos de un Cajero señalado",
  },
  {
    id: "tucan-generate-report",
    number: 5,
    system: "tucan",
    title: "Configure la fecha y genere el reporte",
    description:
      "Revise la fecha inicial y final, el corresponsal y los demás filtros; luego pulse Generar Reporte. Si el cierre se realiza después de medianoche, consulte la fecha operativa del día anterior.",
    image: "/tutorials/fondo-general/5.webp",
    alt: "Formulario Pagos de un Cajero con el botón Generar Reporte y la fecha operativa señalados",
  },
  {
    id: "tucan-scroll-report",
    number: 6,
    system: "tucan",
    title: "Desplácese por el reporte",
    description:
      "Después de generar el reporte, baje por el contenido hasta llegar al resumen de Transacciones en Colones.",
    image: "/tutorials/fondo-general/6.webp",
    alt: "Reporte de Pagos de un Cajero con una flecha que indica desplazarse hacia abajo",
  },
  {
    id: "tucan-total-general",
    number: 7,
    system: "tucan",
    title: "Copie el Total General de Tucán",
    description:
      "En Transacciones en Colones, copie el importe de Total General. Ese es el valor que debe ingresar en el campo Tucán del cierre de Fondo General.",
    image: "/tutorials/fondo-general/7.webp",
    alt: "Reporte de Tucán con la fila Total General de transacciones en colones señalada",
  },
  {
    id: "contica-products-sold",
    number: 8,
    system: "contica",
    title: "Abra Productos vendidos en Contica",
    description:
      "Desde los accesos rápidos de Contica, seleccione Productos vendidos para abrir el reporte requerido.",
    image: "/tutorials/fondo-general/8.webp",
    alt: "Pantalla principal de Contica con el acceso Productos vendidos señalado",
  },
  {
    id: "contica-open-filters",
    number: 9,
    system: "contica",
    title: "Abra los filtros de Productos vendidos",
    description:
      "En la pantalla Productos vendidos, pulse Filtros para mostrar las opciones avanzadas de la consulta.",
    image: "/tutorials/fondo-general/9.webp",
    alt: "Reporte Productos vendidos de Contica con el botón Filtros señalado",
  },
  {
    id: "contica-grouping-menu",
    number: 10,
    system: "contica",
    title: "Abra la agrupación del reporte",
    description:
      "En los filtros, abra la lista Agrupar por para cambiar la forma en que Contica organiza los resultados.",
    image: "/tutorials/fondo-general/10.webp",
    alt: "Filtros de Productos vendidos con la lista Agrupar por abierta",
  },
  {
    id: "contica-group-by-seller",
    number: 11,
    system: "contica",
    title: "Agrupe por vendedor",
    description:
      "Seleccione Agrupar por vendedor para obtener una fila separada por cada usuario que realizó ventas.",
    image: "/tutorials/fondo-general/11.webp",
    alt: "Lista de agrupación de Contica con la opción Agrupar por vendedor señalada",
  },
  {
    id: "contica-r08-t11",
    number: 12,
    system: "contica",
    title: "Consulte R08 y T11 por vendedor",
    description:
      "Seleccione la fecha operativa, busque R08 y pulse Filtrar. Tome la Venta Total de cada vendedor para ingresar el importe del usuario correspondiente en R08. Repita la misma consulta buscando T11 para completar ese campo.",
    image: "/tutorials/fondo-general/12.webp",
    alt: "Resultados de Contica filtrados por R08 y agrupados por vendedor con Venta Total señalada",
  },
  {
    id: "tm-tiempos-report",
    number: 13,
    system: "tm",
    title: "Consulte el Total vendido en Reporte Tiempos",
    description:
      "En TimeMaster abra Reporte Tiempos, confirme la empresa y la fecha operativa, pulse Actualizar y copie el Total vendido para usarlo como valor de Tiempos.",
    image: "/tutorials/fondo-general/13.webp",
    alt: "Reporte Tiempos de TimeMaster con la fecha, Actualizar y Total vendido señalados",
  },
  {
    id: "tiempos-open-balances",
    number: 14,
    system: "tiempos",
    title: "Abra Gestión de balances si necesita validar",
    description:
      "Si necesita confirmar el total de Tiempos, pulse el balance mostrado en la barra superior de Gestor Web para entrar a Gestión de balances.",
    image: "/tutorials/fondo-general/14.webp",
    alt: "Pantalla de Gestor Web con el acceso Balance de la barra superior señalado",
  },
  {
    id: "tiempos-filter-balances",
    number: 15,
    system: "tiempos",
    title: "Filtre Gestión de balances por fecha",
    description:
      "Revise las fechas Desde y Hasta, pulse Aplicar y después abra la pestaña Por evento para consultar el resumen del período.",
    image: "/tutorials/fondo-general/15.webp",
    alt: "Gestión de balances con las fechas, el botón Aplicar y la pestaña Por evento señalados",
  },
  {
    id: "tiempos-sales-total",
    number: 16,
    system: "tiempos",
    title: "Tome el total de Ventas para Tiempos",
    description:
      "En la vista Por evento, use el total de Ventas como valor de Tiempos. Si corresponde al cierre del turno D, comunique ese mismo total al compañero del turno N para que ambos utilicen la misma base acumulada.",
    image: "/tutorials/fondo-general/16.webp",
    alt: "Gestión de balances por evento con el total de Ventas señalado para Tiempos",
  },
  {
    id: "tm-verification-fields",
    number: 17,
    system: "tm",
    title: "Ingrese los cuatro importes en el cierre",
    description:
      "Ingrese en sus campos correspondientes los valores obtenidos para R08, Tucán, T11 y Tiempos. La guía no modifica ninguno de estos importes.",
    targetSelector: '[data-tour="fondo-verificacion-campos"]',
  },
  {
    id: "tm-verification-results",
    number: 18,
    system: "tm",
    title: "Revise las diferencias antes de guardar",
    description:
      "Revise el estado y las diferencias calculadas entre Contica, Tucán y Tiempos antes de guardar. Terminar la guía no confirma ni guarda el cierre.",
    targetSelector: '[data-tour="fondo-verificacion-resultado"]',
  },
];
