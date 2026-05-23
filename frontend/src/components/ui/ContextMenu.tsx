import { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}

interface Props {
  items: ContextMenuItem[];
  children: React.ReactNode;
}

interface Pos { top: number; left: number }

export default function ContextMenu({ items, children }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const recalc = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.right });
  }, []);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    recalc();
    setOpen(v => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        triggerRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    function onScroll() { setOpen(false); }
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return (
    <div ref={triggerRef} className="inline-block" onClick={e => e.stopPropagation()}>
      <div onClick={handleOpen}>{children}</div>

      {open && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: 'translateX(-100%)',
            zIndex: 9999,
            boxShadow: '0 8px 24px rgba(15,20,18,0.12)',
          }}
          className="bg-surface border border-border rounded-lg py-1 min-w-[180px]"
          onClick={e => e.stopPropagation()}
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { item.onClick(); setOpen(false); }}
              className={`flex items-center gap-2.5 w-full text-left px-3.5 py-2 text-[13px] transition-colors ${
                item.danger
                  ? 'text-danger hover:bg-danger-soft'
                  : 'text-text hover:bg-surface-2'
              }`}
            >
              {item.icon && <span className="flex-shrink-0 opacity-70">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
