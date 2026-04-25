'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  const router = useRouter();
  const pathname = usePathname();
  const logoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pathname && pathname.startsWith('/mobile-scan/')) {
      const code = pathname.split('/mobile-scan/')[1]?.replace(/\/$/, '');
      if (code) {
        router.replace(`/mobile-scan?code=${encodeURIComponent(code)}`);
        return;
      }
    }
  }, [pathname, router]);

  // Drag logic
  useEffect(() => {
    const el = logoRef.current;
    if (!el) return;
    let dragging = false;
    let ox = 0, oy = 0;

    const onMouseDown = (e: MouseEvent) => {
      dragging = true;
      const r = el.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      el.style.animation = 'none';
      el.style.position = 'fixed';
      el.style.zIndex = '100';
      el.style.cursor = 'grabbing';
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      el.style.left = e.clientX - ox + 'px';
      el.style.top = e.clientY - oy + 'px';
      el.style.right = 'auto';
    };
    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      el.style.animation = '';
      el.style.cursor = 'grab';
    };
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      dragging = true;
      const r = el.getBoundingClientRect();
      ox = t.clientX - r.left;
      oy = t.clientY - r.top;
      el.style.animation = 'none';
      el.style.position = 'fixed';
      el.style.zIndex = '100';
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging) return;
      const t = e.touches[0];
      el.style.left = t.clientX - ox + 'px';
      el.style.top = t.clientY - oy + 'px';
      el.style.right = 'auto';
    };
    const onTouchEnd = () => {
      dragging = false;
      el.style.animation = '';
    };

    el.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);

    return () => {
      el.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      el.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  if (pathname && pathname.startsWith('/mobile-scan/')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Redireccionando...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">Por favor espera</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;800&display=swap');

        .not-found-root {
          font-family: 'Space Mono', monospace;
        }

        /* Stars */
        .nf-star {
          position: absolute;
          background: white;
          border-radius: 50%;
          animation: nf-twinkle var(--d, 3s) ease-in-out infinite;
          animation-delay: var(--delay, 0s);
          opacity: var(--op, 0.7);
        }
        @keyframes nf-twinkle {
          0%, 100% { opacity: var(--op, 0.7); transform: scale(1); }
          50% { opacity: 0.1; transform: scale(0.5); }
        }

        /* Logo float */
        .nf-logo-wrap {
          position: absolute;
          top: 10%;
          right: 8%;
          animation: nf-float 6s ease-in-out infinite;
          filter: drop-shadow(0 0 24px rgba(199,125,255,0.6));
          cursor: grab;
          user-select: none;
        }
        @keyframes nf-float {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-28px) rotate(4deg); }
        }

        .nf-code {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.05em;
  background: linear-gradient(135deg, #1d4ed8 0%, #60a5fa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: nf-glitch 4s infinite;
}
@keyframes nf-glitch {
  0%, 90%, 100% { text-shadow: none; transform: none; }
  91% { transform: translate(-2px, 0); }
  92% { transform: translate(2px, 0); }
  93% { transform: none; }
  94% { transform: translate(1px, -1px); }
  95% { transform: none; }
}

        /* Cursor blink */
        .nf-cursor {
          display: inline-block;
          width: 8px;
          height: 1em;
          background: #ff4d6d;
          margin-left: 4px;
          animation: nf-blink 1s step-end infinite;
          vertical-align: text-bottom;
        }
        @keyframes nf-blink {
          0%, 100% { opacity: 1; } 50% { opacity: 0; }
        }

        /* Signal */
        .nf-signal {
          position: absolute;
          bottom: 15%;
          left: 6%;
          width: 60px;
          height: 60px;
          opacity: 0.4;
        }
        .nf-signal-ring {
          position: absolute;
          border: 1.5px solid #c77dff;
          border-radius: 50%;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%) scale(0);
          animation: nf-pulse 2.5s ease-out infinite;
        }
        .nf-signal-ring:nth-child(2) { animation-delay: 0.8s; }
        .nf-signal-ring:nth-child(3) { animation-delay: 1.6s; }
        @keyframes nf-pulse {
          0%   { transform: translate(-50%,-50%) scale(0); opacity:1; width:10px; height:10px; }
          100% { transform: translate(-50%,-50%) scale(1); opacity:0; width:80px; height:80px; }
        }
        .nf-signal-dot {
          width: 8px; height: 8px;
          background: #c77dff;
          border-radius: 50%;
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 10px #c77dff;
        }

        /* Planet */
        .nf-planet {
          position: absolute;
          bottom: -40px;
          left: -40px;
          width: 180px;
          height: 180px;
          background: radial-gradient(circle at 35% 35%, #1a1a3e, #0a0a1a);
          border-radius: 50%;
          border: 1px solid #2a2a4a;
          opacity: 0.5;
          box-shadow: inset -20px -20px 40px rgba(199,125,255,0.1);
        }
        .nf-planet::after {
          content: '';
          position: absolute;
          top: 40%; left: -30%;
          width: 160%; height: 30%;
          border: 1px solid rgba(199,125,255,0.2);
          border-radius: 50%;
          transform: rotate(-15deg);
        }

        /* Buttons */
        .nf-btn {
          font-family: 'Space Mono', monospace;
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 0.75rem 1.5rem;
          border-radius: 2px;
          transition: all 0.2s;
          font-weight: 700;
          text-decoration: none;
          display: inline-block;
        }
        .nf-btn-primary {
          background: #ff4d6d;
          color: white;
        }
        .nf-btn-primary:hover {
          background: white;
          color: #ff4d6d;
          box-shadow: 0 0 30px rgba(255,77,109,0.5);
        }
        .nf-btn-ghost {
          background: transparent;
          color: #c77dff;
          border: 1px solid #c77dff;
        }
        .nf-btn-ghost:hover {
          background: #c77dff;
          color: #05050f;
          box-shadow: 0 0 30px rgba(199,125,255,0.4);
        }

        /* Stars gen */
        #nf-stars { position: absolute; inset: 0; pointer-events: none; }
      `}</style>

      <div
        className="not-found-root min-h-screen flex items-center justify-center overflow-hidden relative"
        style={{ background: '#05050f', color: '#e0e0ff' }}
      >
        {/* Stars */}
        <div id="nf-stars" ref={(el) => {
          if (!el || el.children.length > 0) return;
          for (let i = 0; i < 120; i++) {
            const s = document.createElement('div');
            s.className = 'nf-star';
            const size = Math.random() * 2.5 + 0.5;
            s.style.cssText = `width:${size}px;height:${size}px;top:${Math.random() * 100}%;left:${Math.random() * 100}%;--d:${2 + Math.random() * 4}s;--delay:${Math.random() * 4}s;--op:${0.3 + Math.random() * 0.7};`;
            el.appendChild(s);
          }
        }} />

        {/* Planet deco */}
        <div className="nf-planet" />

        {/* Signal */}
        <div className="nf-signal">
          <div className="nf-signal-dot" />
          <div className="nf-signal-ring" />
          <div className="nf-signal-ring" />
          <div className="nf-signal-ring" />
        </div>

        {/* Draggable Logo */}
        <div className="nf-logo-wrap" ref={logoRef} title="¡Arrástralo!">
          <Image
            src="/Logos/LogoBlanco.png"
            alt="Logo"
            width={110}
            height={110}
            style={{ objectFit: 'contain', pointerEvents: 'none' }}
            draggable={false}
          />
        </div>

        {/* Main content */}
        <div className="text-center z-10 px-8 max-w-lg">
          <div className="nf-code" style={{ fontSize: 'clamp(6rem, 20vw, 10rem)' }}>
            404
          </div>

          <div style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(1rem, 3vw, 1.4rem)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginTop: '0.25rem',
          }}>
            Página perdida en el espacio
          </div>

          <p style={{ color: '#6b6b8a', fontSize: '0.8rem', marginTop: '1rem', lineHeight: 1.8 }}>
            Hemos buscado en toda la galaxia...<br />
            esta página no orbita aquí.<span className="nf-cursor" />
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2.5rem', flexWrap: 'wrap' }}>
            <Link href="/" className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors font-medium">
              ← Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}