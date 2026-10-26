import type { FestivityId } from "../types";

interface FestivityArtworkProps {
  id: FestivityId;
  className?: string;
}

const line = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 3.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  vectorEffect: "non-scaling-stroke",
} as const;

export default function FestivityArtwork({ id, className }: FestivityArtworkProps) {
  const common = {
    className,
    viewBox: "0 0 160 100",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    "data-testid": `festivity-artwork-${id}`,
    "data-artwork-symbol": id,
  };

  switch (id) {
    case "new-year":
      return (
        <svg {...common}>
          <g data-part="firework" {...line}>
            <path d="M80 13v17M80 62v17M44 46h17M99 46h17M55 21l12 13M93 58l12 13M105 21 93 34M67 58 55 71" />
            <circle cx="80" cy="46" r="7" fill="var(--festivity-accent)" stroke="none" />
          </g>
          <g data-part="spark" fill="currentColor">
            <circle cx="29" cy="24" r="3" /><circle cx="130" cy="31" r="4" /><circle cx="26" cy="75" r="4" /><circle cx="134" cy="77" r="3" />
          </g>
          <path d="m39 50 4 5-5 4-4-5 5-4Zm84-34 4 5-5 4-4-5 5-4Z" fill="var(--festivity-accent)" />
        </svg>
      );
    case "holy-thursday":
      return (
        <svg {...common}>
          <g data-part="chalice" {...line}>
            <path d="M58 22h44l-5 24c-2 11-8 17-17 17s-15-6-17-17l-5-24Z" />
            <path d="M80 63v17M66 85h28" />
          </g>
          <path d="M64 35c10 4 22 4 32 0" stroke="var(--festivity-accent)" strokeWidth="4" strokeLinecap="round" />
          <g data-part="bread">
            <path d="M24 70c0-13 10-21 23-21s23 8 23 21H24Z" fill="var(--festivity-accent)" opacity=".82" />
            <path d="m39 57-5 8m17-8-5 8m16-5-5 7" {...line} strokeWidth="2.5" />
          </g>
          <path d="M110 84c2-22 10-38 27-51m-16 14c6-1 11 1 15 5m-22 8c6 0 11 2 15 7" {...line} data-part="olive" />
        </svg>
      );
    case "good-friday":
      return (
        <svg {...common}>
          <circle data-part="glow" cx="80" cy="42" r="23" fill="var(--festivity-accent)" opacity=".42" />
          <path d="M12 82c23-16 46-19 68-7 22-12 45-9 68 7" {...line} />
          <g data-part="cross" {...line} strokeWidth="4"><path d="M80 24v54M64 42h32" /></g>
          <path d="M22 89h116" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".48" />
        </svg>
      );
    case "juan-santamaria":
      return (
        <svg {...common}>
          <g data-part="torch" {...line}>
            <path d="m66 39 13 48 14-4-13-47" fill="var(--festivity-accent)" opacity=".4" />
            <path d="M69 38h13" />
            <path d="M76 35c-9-10 3-15 1-25 13 8 20 19 9 30-4 4-12 4-17-2" fill="var(--festivity-accent)" stroke="currentColor" />
          </g>
          <g data-part="ribbon" {...line} strokeWidth="5">
            <path d="M28 29c11 8 22 12 34 12" stroke="#0b3b8f" /><path d="M25 39c12 8 24 12 37 12" stroke="#f8fafc" /><path d="M23 49c13 8 26 12 40 12" stroke="#ce1126" />
          </g>
          <path d="m114 22 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1 3-7Z" fill="currentColor" />
        </svg>
      );
    case "workers-day":
      return (
        <svg {...common}>
          <g data-part="gear">
            <path d="m80 12 8 8 11-2 4 11 11 4-2 11 8 8-8 8 2 11-11 4-4 11-11-2-8 8-8-8-11 2-4-11-11-4 2-11-8-8 8-8-2-11 11-4 4-11 11 2 8-8Z" fill="currentColor" />
            <circle cx="80" cy="52" r="17" fill="var(--festivity-accent)" /><circle cx="80" cy="52" r="7" fill="var(--festivity-primary)" />
          </g>
          <path data-part="tool" d="m27 80 31-31m-34 19 14 14m-9-19 14 14" {...line} strokeWidth="5" />
        </svg>
      );
    case "nicoya":
      return (
        <svg {...common}>
          <circle data-part="sun" cx="128" cy="24" r="12" fill="var(--festivity-accent)" />
          <g data-part="canopy">
            <path d="M78 85V55c-9-4-14-11-16-20m16 31c11-5 18-12 22-23" {...line} strokeWidth="5" />
            <path d="M77 59C58 60 39 52 31 36c13-13 35-11 46 4 8-20 33-28 50-16 0 20-21 36-50 35Z" fill="currentColor" />
            <path d="M45 39c11 8 22 12 33 13m34-21C99 38 89 46 78 53" stroke="var(--festivity-accent)" strokeWidth="3" strokeLinecap="round" opacity=".85" />
          </g>
          <path d="M15 87h130" {...line} />
        </svg>
      );
    case "virgen-angeles":
      return (
        <svg {...common}>
          <g data-part="basilica" {...line}>
            <path d="M45 86V45c0-22 14-34 35-34s35 12 35 34v41" /><path d="M59 86V49c0-14 9-22 21-22s21 8 21 22v37M80 12V5m-5 4h10" />
          </g>
          <path data-part="path" d="M68 87c2-17 7-28 12-36 5 8 10 19 12 36" fill="var(--festivity-accent)" opacity=".66" />
          <g data-part="lights" fill="currentColor"><circle cx="28" cy="67" r="4" /><circle cx="22" cy="81" r="3" /><circle cx="132" cy="67" r="4" /><circle cx="138" cy="81" r="3" /></g>
        </svg>
      );
    case "mothers-day":
      return (
        <svg {...common}>
          <path data-part="heart" d="M80 85S35 62 35 34c0-17 22-23 45-2 23-21 45-15 45 2 0 28-45 51-45 51Z" fill="var(--festivity-accent)" />
          <g data-part="bouquet" fill="currentColor">
            <circle cx="45" cy="24" r="8" /><circle cx="35" cy="34" r="8" /><circle cx="55" cy="34" r="8" /><circle cx="115" cy="24" r="8" /><circle cx="105" cy="34" r="8" /><circle cx="125" cy="34" r="8" />
            <circle cx="45" cy="32" r="4" fill="var(--festivity-accent)" /><circle cx="115" cy="32" r="4" fill="var(--festivity-accent)" />
          </g>
          <path d="M45 41c8 11 18 18 35 23m35-23c-8 11-18 18-35 23" {...line} strokeWidth="2.5" />
        </svg>
      );
    case "afro-culture":
      return (
        <svg {...common}>
          <g data-part="calypso" {...line}>
            <path d="M52 73c-13 16-37 1-26-16 7-10 19-8 27-1l29-35 11 9-28 36c3 10-4 19-13 19" fill="var(--festivity-accent)" opacity=".78" />
            <path d="m82 21 16-8 12 9-17 8M58 55l10 8M48 61l10 8" />
          </g>
          <g data-part="rhythm" fill="currentColor">
            <path d="M116 37v31c0 8-13 10-16 3-2-6 7-12 16-8V43l19-5v24c0 8-13 10-16 3-2-6 7-12 16-8V32l-19 5Z" />
            <path d="m21 24 7-9 7 9-7 9-7-9Zm16 0 7-9 7 9-7 9-7-9Z" fill="var(--festivity-accent)" />
          </g>
        </svg>
      );
    case "army-abolition":
      return (
        <svg {...common}>
          <g data-part="dove">
            <path d="M18 56c25-3 39-18 51-39 8 17 21 24 42 25 14 0 24 8 30 21-21-7-38-5-52 9-14 13-34 14-58 5 14-4 24-11 31-22-17 6-31 6-44 1Z" fill="currentColor" />
            <path d="M91 56c14-7 26-8 39-4" stroke="var(--festivity-accent)" strokeWidth="4" strokeLinecap="round" /><circle cx="113" cy="47" r="2.5" fill="var(--festivity-accent)" />
          </g>
          <path data-part="olive" d="M96 70c13 1 25 7 34 18m-22-13c3 6 2 10-1 14m11-8c5 3 9 3 13 2" {...line} strokeWidth="2.5" />
        </svg>
      );
    case "christmas":
      return (
        <svg {...common}>
          <path data-part="star" d="m80 5 6 13 14 2-10 10 2 14-12-7-12 7 2-14-10-10 14-2 6-13Z" fill="var(--festivity-accent)" />
          <g data-part="tree">
            <path d="m80 27-25 28h13L48 78h64L92 55h13L80 27Z" fill="currentColor" /><path d="M75 78h10v12H75z" fill="var(--festivity-accent)" />
            <path d="M63 57c11 5 23 5 34 0M57 70c15 6 31 6 46 0" stroke="var(--festivity-accent)" strokeWidth="3" strokeLinecap="round" />
            <g fill="#f8fafc"><circle cx="75" cy="49" r="3" /><circle cx="88" cy="61" r="3" /><circle cx="69" cy="69" r="3" /></g>
          </g>
        </svg>
      );
    case "year-end":
      return (
        <svg {...common}>
          <g data-part="clock" {...line}>
            <circle cx="80" cy="52" r="37" strokeWidth="5" /><path d="M80 20v5m0 54v5M48 52h5m54 0h5" />
            <path data-part="clock-hand" d="M80 52V28m0 24 19 11" strokeWidth="5" /><circle cx="80" cy="52" r="4" fill="var(--festivity-accent)" stroke="none" />
          </g>
          <g data-part="confetti" fill="var(--festivity-accent)"><circle cx="25" cy="18" r="4" /><circle cx="137" cy="29" r="4" /><path d="m24 76 8 3-4 8-8-4 4-7Zm108-64 8 3-4 8-8-4 4-7Z" /></g>
        </svg>
      );
  }
}
