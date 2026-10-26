import type { CSSProperties } from "react";
import FestivityArtwork from "../../assets/FestivityArtwork";
import type { FestivityConfig, FestivityId } from "../../types";
import styles from "../../styles/seasonal-effects.module.css";

interface FestivityEffectProps {
  config: FestivityConfig;
  animate: boolean;
}

interface FestivityVisualProfile {
  motion: string;
  motionClass: string;
  particleKind: string;
  particleCount: number;
}

export const FESTIVITY_VISUAL_PROFILES = {
  "new-year": { motion: "firework-burst", motionClass: "motionBurst", particleKind: "spark", particleCount: 12 },
  "holy-thursday": { motion: "palm-sway", motionClass: "motionPalm", particleKind: "leaf", particleCount: 6 },
  "good-friday": { motion: "horizon-glow", motionClass: "motionHorizon", particleKind: "none", particleCount: 0 },
  "juan-santamaria": { motion: "ribbon-reveal", motionClass: "motionRibbon", particleKind: "ember", particleCount: 8 },
  "workers-day": { motion: "gear-turn", motionClass: "motionGear", particleKind: "bolt", particleCount: 5 },
  nicoya: { motion: "canopy-drift", motionClass: "motionCanopy", particleKind: "leaf", particleCount: 8 },
  "virgen-angeles": { motion: "pilgrimage-lights", motionClass: "motionPilgrimage", particleKind: "light", particleCount: 6 },
  "mothers-day": { motion: "petal-float", motionClass: "motionPetals", particleKind: "petal", particleCount: 10 },
  "afro-culture": { motion: "pattern-rhythm", motionClass: "motionRhythm", particleKind: "note", particleCount: 7 },
  "army-abolition": { motion: "dove-glide", motionClass: "motionDove", particleKind: "feather", particleCount: 4 },
  christmas: { motion: "snow-twinkle", motionClass: "motionSnow", particleKind: "snow", particleCount: 12 },
  "year-end": { motion: "clock-sweep", motionClass: "motionClock", particleKind: "spark", particleCount: 10 },
} satisfies Record<FestivityId, FestivityVisualProfile>;

const particles = Array.from({ length: 12 }, (_, index) => ({
  x: `${7 + ((index * 29) % 88)}%`,
  size: `${6 + (index % 4) * 2}px`,
  delay: `${(index % 6) * 90}ms`,
  drift: `${((index % 5) - 2) * 18}px`,
  rotation: `${index * 31}deg`,
  burstX: `${((index % 4) - 1.5) * 58}px`,
  burstY: `${(Math.floor(index / 4) - 1) * 52}px`,
}));

export default function FestivityEffect({ config, animate }: FestivityEffectProps) {
  if (config.intensity === "off") return null;
  const profile = FESTIVITY_VISUAL_PROFILES[config.id];
  return (
    <div
      className={`decorativeLayer ${styles.decorativeLayer} ${styles[config.id]} ${styles[profile.motionClass]} ${config.intensity === "subtle" ? styles.subtle : ""} ${animate ? styles.animate : ""}`}
      data-festivity-id={config.id}
      data-motion-profile={profile.motion}
      aria-hidden="true"
    >
      <FestivityArtwork id={config.id} className={`${styles.artwork} ${styles.artworkLeft}`} />
      <FestivityArtwork id={config.id} className={`${styles.artwork} ${styles.artworkRight}`} />
      {particles.slice(0, profile.particleCount).map((particle, index) => (
        <i
          key={index}
          className={styles.particle}
          data-festivity-particle=""
          data-particle-kind={profile.particleKind}
          style={{
            "--particle-x": particle.x,
            "--particle-size": particle.size,
            "--particle-delay": particle.delay,
            "--particle-drift": particle.drift,
            "--particle-rotation": particle.rotation,
            "--particle-burst-x": particle.burstX,
            "--particle-burst-y": particle.burstY,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
