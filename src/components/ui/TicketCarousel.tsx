import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Filter, Layers, LayoutList } from 'lucide-react';

interface Ticket {
  id: string;
  sorteo: string;
  amount: number;
  time: string;
  code?: string;
}

interface TicketCarouselProps {
  tickets: Ticket[];
  onDelete: (ticket: Ticket) => void;
  onEdit: (ticket: Ticket) => void;
}

export default function TicketCarousel({ tickets, onDelete, onEdit }: TicketCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [filter, setFilter] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [editTicket, setEditTicket] = useState<Ticket | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFields, setEditFields] = useState<{ sorteo: string; amount: number; time: string }>({ sorteo: '', amount: 0, time: '' });
  const [holdingId, setHoldingId] = useState<string | null>(null);
  const holdTimeout = useRef<NodeJS.Timeout | null>(null);

  // Navegación con flechas
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showAll || editModalOpen || showEditConfirm) return;
      if (e.key === 'ArrowLeft') setCurrent(c => (c > 0 ? c - 1 : tickets.length - 1));
      if (e.key === 'ArrowRight') setCurrent(c => (c < tickets.length - 1 ? c + 1 : 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tickets.length, showAll, editModalOpen, showEditConfirm]);

  // Obtener sorteos únicos para el filtro
  const sorteosUnicos = useMemo(() => Array.from(new Set(tickets.map(t => t.sorteo))), [tickets]);

  // Filtrado por sorteo
  const filteredTickets = filter.trim()
    ? tickets.filter(t => t.sorteo === filter.trim())
    : tickets;
  const total = filteredTickets.length;

  if (total === 0) return (
    <div className="w-full flex flex-col items-center text-[var(--tab-text)] py-8">No hay tickets.</div>
  );

  // Responsive: ancho y alto de carta según pantalla (más pequeño en carrusel)
  const cardW = 'min(80vw, 11rem)';
  const cardH = 'min(40vw, 7.5rem)';

  return (
    <div className="w-full flex flex-col items-center">
      {/* Filtro y controles */}
      <div className="flex flex-row gap-2 mb-3 w-full max-w-xs items-center justify-center">
        <div className="flex-1 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-8 h-8 text-[var(--tab-text)]"><Filter className="w-5 h-5" /></span>
          <select
            value={filter}
            onChange={e => { setFilter(e.target.value); setCurrent(0); }}
            className="px-3 py-2 rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--foreground)] w-full min-w-0"
          >
            <option value="">Filtrar por sorteo...</option>
            {sorteosUnicos.map(sorteo => (
              <option key={sorteo} value={sorteo}>{sorteo}</option>
            ))}
          </select>
        </div>
        <button
          className="flex flex-col items-center justify-center px-3 py-2 rounded-md border border-[var(--input-border)] bg-[var(--button-bg)] text-[var(--button-text)] hover:bg-[var(--button-hover)] min-w-[3.5rem] h-12 sm:h-auto"
          onClick={() => setShowAll(v => !v)}
          style={{ aspectRatio: '1/1' }}
        >
          {showAll ? <LayoutList className="w-5 h-5 mb-1" /> : <Layers className="w-5 h-5 mb-1" />}
          <span className="text-xs">{showAll ? 'Uno' : 'Todos'}</span>
        </button>
      </div>

      {/* Vista baraja o todos */}
      {!editModalOpen && !showEditConfirm && (
        !showAll ? (
          <div className="relative flex items-center justify-center select-none w-full" style={{ height: `calc(${cardH} + 2.5rem)`, minHeight: '7.5rem' }}>
            {filteredTickets.map((ticket, idx) => {
              const offset = idx - current;
              // --- NUEVO APILAMIENTO HORIZONTAL ---
              const maxOffset = 5; // máximo de cartas apiladas a cada lado
              const clampedOffset = Math.max(-maxOffset, Math.min(maxOffset, offset));
              const spread = 32; // separación horizontal en px
              const zIndex = 100 - Math.abs(clampedOffset);
              const scale = 1 - 0.06 * Math.abs(clampedOffset); // escala más suave
              const translateX = clampedOffset * spread;
              const translateY = 0; // sin desplazamiento vertical
              const rotate = clampedOffset * 5; // rotación para efecto baraja
              const isActive = idx === current;
              return (
                <div
                  key={ticket.id}
                  className={`absolute left-1/2 top-1/2 transition-all duration-300 cursor-pointer ${isActive ? 'shadow-2xl ring-2 ring-yellow-400' : 'shadow-lg opacity-70 hover:opacity-90'} ${holdingId === ticket.id ? 'scale-90 ring-2 ring-yellow-400' : ''}`}
                  style={{
                    zIndex,
                    transform: `translate(-50%, -50%) translateX(${translateX}px) translateY(${translateY}px) scale(${scale * (holdingId === ticket.id ? 0.90 : 1)}) rotate(${rotate}deg)`,
                    background: 'var(--card-bg)',
                    border: '2px solid var(--input-border)',
                    color: 'var(--foreground)',
                    borderRadius: '1.2rem',
                    width: `calc(${cardW})`,
                    height: `calc(${cardH})`,
                    boxShadow: isActive ? '0 8px 32px #0008' : '0 2px 8px #0006',
                    cursor: isActive ? 'default' : 'pointer',
                    transition: 'all 0.3s cubic-bezier(.4,2,.6,1)',
                    userSelect: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '0.7rem',
                  }}
                  onClick={() => setCurrent(idx)}
                  onMouseDown={() => {
                    setHoldingId(ticket.id);
                    if (holdTimeout.current) clearTimeout(holdTimeout.current);
                    holdTimeout.current = setTimeout(() => {
                      setEditTicket(ticket);
                      setShowEditConfirm(true);
                    }, 1000);
                  }}
                  onMouseUp={() => {
                    setHoldingId(null);
                    if (holdTimeout.current) clearTimeout(holdTimeout.current);
                  }}
                  onMouseLeave={() => {
                    setHoldingId(null);
                    if (holdTimeout.current) clearTimeout(holdTimeout.current);
                  }}
                  tabIndex={0}
                  aria-label={`Ver ticket ${idx + 1}`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-xs uppercase tracking-wide break-words whitespace-pre-line w-4/5" style={{ color: 'var(--foreground)', wordBreak: 'break-word', fontSize: '0.95rem', lineHeight: '1.1rem' }}>{ticket.sorteo}</span>
                    {isActive && (
                      <button onClick={e => { e.stopPropagation(); onDelete(ticket); }} className="text-red-600 hover:text-red-800 ml-2" title="Eliminar" tabIndex={-1}>
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-center items-center">
                    <span className="font-mono text-lg text-green-700 font-bold">₡ {ticket.amount.toLocaleString('es-CR')}</span>
                  </div>
                  <div className="flex justify-end text-xs opacity-70 mt-1" style={{ color: 'var(--foreground)' }}>
                    {ticket.time}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-4 justify-center w-full">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                className={`shadow-lg border-2 border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 ${holdingId === ticket.id ? 'scale-90 ring-2 ring-yellow-400' : ''}`}
                style={{
                  width: 'min(90vw, 10rem)',
                  minHeight: '7.5rem',
                  maxWidth: '100%',
                  boxShadow: holdingId === ticket.id ? '0 8px 32px #0008' : '0 2px 8px #0006',
                  borderColor: 'var(--input-border)',
                  color: 'var(--foreground)',
                  background: 'var(--card-bg)',
                  transition: 'all 0.3s cubic-bezier(.4,2,.6,1)',
                  transform: holdingId === ticket.id ? 'scale(0.90)' : 'scale(1)',
                }}
                onMouseDown={() => {
                  setHoldingId(ticket.id);
                  if (holdTimeout.current) clearTimeout(holdTimeout.current);
                  holdTimeout.current = setTimeout(() => {
                    setEditTicket(ticket);
                    setShowEditConfirm(true);
                  }, 1000);
                }}
                onMouseUp={() => {
                  setHoldingId(null);
                  if (holdTimeout.current) clearTimeout(holdTimeout.current);
                }}
                onMouseLeave={() => {
                  setHoldingId(null);
                  if (holdTimeout.current) clearTimeout(holdTimeout.current);
                }}
                tabIndex={0}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs uppercase tracking-wide break-words whitespace-pre-line w-4/5" style={{ color: 'var(--foreground)', wordBreak: 'break-word', fontSize: '0.95rem', lineHeight: '1.1rem' }}>{ticket.sorteo}</span>
                  <button onClick={() => onDelete(ticket)} className="text-red-600 hover:text-red-800 ml-2" title="Eliminar" tabIndex={-1}>
                    ✕
                  </button>
                </div>
                <div className="flex-1 flex flex-col justify-center items-center">
                  <span className="font-mono text-lg text-green-700 font-bold">₡ {ticket.amount.toLocaleString('es-CR')}</span>
                </div>
                <div className="flex justify-end text-xs opacity-70 mt-1" style={{ color: 'var(--foreground)' }}>
                  {ticket.time}
                </div>
              </div>
            ))}
          </div>
        )
      )}
      {/* Paginador de puntos solo si no está en modo ver todos */}
      {!showAll && !editModalOpen && !showEditConfirm && (
        <div className="flex gap-1 mt-3">
          {filteredTickets.map((_, idx) => (
            <button
              key={idx}
              className={`w-2 h-2 rounded-full ${idx === current ? 'bg-yellow-600' : 'bg-gray-400'}`}
              onClick={() => setCurrent(idx)}
              aria-label={`Ir a ticket ${idx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Modal de confirmación para editar */}
      {showEditConfirm && editTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-[var(--card-bg)] rounded-lg shadow-xl p-6 w-full max-w-xs mx-4">
            <h3 className="text-lg font-semibold mb-4">¿Editar ticket?</h3>
            <div className="mb-4">
              <div className="font-bold">{editTicket.sorteo}</div>
              <div className="font-mono text-green-700">₡ {editTicket.amount.toLocaleString('es-CR')}</div>
              <div className="text-xs opacity-70">{editTicket.time}</div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 px-4 rounded bg-gray-200 dark:bg-gray-700" onClick={() => { setShowEditConfirm(false); setEditTicket(null); }}>Cancelar</button>
              <button className="flex-1 py-2 px-4 rounded bg-blue-600 text-white" onClick={() => { setShowEditConfirm(false); setEditModalOpen(true); setEditFields({ sorteo: editTicket.sorteo, amount: editTicket.amount, time: editTicket.time }); }}>Editar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de edición */}
      {editModalOpen && editTicket && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
          <div className="bg-[var(--card-bg)] rounded-lg shadow-xl p-6 w-full max-w-xs mx-4">
            <h3 className="text-lg font-semibold mb-4">Editar Ticket</h3>
            <div className="mb-4 space-y-2">
              <div>
                <label className="block text-xs mb-1">Sorteo</label>
                <input type="text" className="w-full px-2 py-1 rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--foreground)]" value={editFields.sorteo} onChange={e => setEditFields(f => ({ ...f, sorteo: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1">Monto</label>
                <input
                  type="number"
                  className="w-full px-2 py-1 rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--foreground)]"
                  value={editFields.amount === 0 ? '' : editFields.amount}
                  onChange={e => {
                    const val = e.target.value;
                    setEditFields(f => ({ ...f, amount: val === '' ? 0 : Number(val) }));
                  }}
                  min="0"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Hora</label>
                <input type="text" className="w-full px-2 py-1 rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--foreground)]" value={editFields.time} onChange={e => setEditFields(f => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 px-4 rounded bg-gray-200 dark:bg-gray-700" onClick={() => { setEditModalOpen(false); setEditTicket(null); }}>Cancelar</button>
              <button className="flex-1 py-2 px-4 rounded bg-green-600 text-white" onClick={() => {
                // Propagar el cambio al padre
                onEdit({ ...editTicket, ...editFields });
                setEditModalOpen(false); setEditTicket(null);
              }}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
