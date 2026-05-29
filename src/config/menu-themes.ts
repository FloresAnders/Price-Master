export const MENU_CARD_THEMES: Record<
  string,
  {
    glow: string;
    iconBg: string;
    iconText: string;
    ring: string;
    arrow: string;
  }
> = {
  default: {
    glow: "from-sky-500/15 via-transparent to-transparent",
    iconBg: "bg-sky-500/20",
    iconText: "text-sky-200",
    ring: "border-sky-400/20",
    arrow: "text-sky-200",
  },
  scanner: {
    glow: "from-cyan-500/15 via-transparent to-transparent",
    iconBg: "bg-cyan-500/20",
    iconText: "text-cyan-100",
    ring: "border-cyan-400/25",
    arrow: "text-cyan-100",
  },
  calculator: {
    glow: "from-violet-500/15 via-transparent to-transparent",
    iconBg: "bg-violet-500/20",
    iconText: "text-violet-100",
    ring: "border-violet-400/25",
    arrow: "text-violet-100",
  },
  converter: {
    glow: "from-amber-500/15 via-transparent to-transparent",
    iconBg: "bg-amber-500/20",
    iconText: "text-amber-100",
    ring: "border-amber-400/25",
    arrow: "text-amber-100",
  },
  xml: {
    glow: "from-pink-500/15 via-transparent to-transparent",
    iconBg: "bg-pink-500/20",
    iconText: "text-pink-100",
    ring: "border-pink-400/25",
    arrow: "text-pink-100",
  },
  cashcounter: {
    glow: "from-emerald-500/15 via-transparent to-transparent",
    iconBg: "bg-emerald-500/20",
    iconText: "text-emerald-100",
    ring: "border-emerald-400/25",
    arrow: "text-emerald-100",
  },
  fondogeneral: {
    glow: "from-sky-500/15 via-transparent to-transparent",
    iconBg: "bg-sky-500/20",
    iconText: "text-sky-100",
    ring: "border-sky-400/25",
    arrow: "text-sky-100",
  },
  timingcontrol: {
    glow: "from-cyan-500/15 via-transparent to-transparent",
    iconBg: "bg-cyan-500/20",
    iconText: "text-cyan-100",
    ring: "border-cyan-400/25",
    arrow: "text-cyan-100",
  },
  controlhorario: {
    glow: "from-sky-500/15 via-transparent to-transparent",
    iconBg: "bg-sky-500/20",
    iconText: "text-sky-100",
    ring: "border-sky-400/25",
    arrow: "text-sky-100",
  },
  empleados: {
    glow: "from-purple-500/15 via-transparent to-transparent",
    iconBg: "bg-purple-500/20",
    iconText: "text-purple-100",
    ring: "border-purple-400/25",
    arrow: "text-purple-100",
  },
  funciones: {
    glow: "from-teal-500/15 via-transparent to-transparent",
    iconBg: "bg-teal-500/20",
    iconText: "text-teal-100",
    ring: "border-teal-400/25",
    arrow: "text-teal-100",
  },
  recetas: {
    glow: "from-fuchsia-500/15 via-transparent to-transparent",
    iconBg: "bg-fuchsia-500/20",
    iconText: "text-fuchsia-100",
    ring: "border-fuchsia-400/25",
    arrow: "text-fuchsia-100",
  },
  calculohorasprecios: {
    glow: "from-blue-500/15 via-transparent to-transparent",
    iconBg: "bg-blue-500/20",
    iconText: "text-blue-100",
    ring: "border-blue-400/25",
    arrow: "text-blue-100",
  },
  supplierorders: {
    glow: "from-amber-500/15 via-transparent to-transparent",
    iconBg: "bg-amber-500/20",
    iconText: "text-amber-100",
    ring: "border-amber-400/25",
    arrow: "text-amber-100",
  },
  taskboard: {
    glow: "from-cyan-500/15 via-transparent to-transparent",
    iconBg: "bg-cyan-500/20",
    iconText: "text-cyan-100",
    ring: "border-cyan-400/25",
    arrow: "text-cyan-100",
  },
  scanhistory: {
    glow: "from-rose-500/15 via-transparent to-transparent",
    iconBg: "bg-rose-500/20",
    iconText: "text-rose-100",
    ring: "border-rose-400/25",
    arrow: "text-rose-100",
  },
  solicitud: {
    glow: "from-violet-500/15 via-transparent to-transparent",
    iconBg: "bg-violet-500/20",
    iconText: "text-violet-100",
    ring: "border-violet-400/25",
    arrow: "text-violet-100",
  },
  edit: {
    glow: "from-emerald-500/15 via-transparent to-transparent",
    iconBg: "bg-emerald-500/20",
    iconText: "text-emerald-100",
    ring: "border-emerald-400/25",
    arrow: "text-emerald-100",
  },
};

export function getMenuCardTheme(id: string) {
  return MENU_CARD_THEMES[id] || MENU_CARD_THEMES.default;
}
