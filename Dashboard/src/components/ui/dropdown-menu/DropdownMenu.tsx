import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface DropdownMenuContextProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextProps | null>(null);

export function DropdownMenu({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(!!open);

  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  const contextValue = {
    open: isOpen,
    onOpenChange: onOpenChange || setIsOpen,
  };

  return (
    <DropdownMenuContext.Provider value={contextValue}>
      <div className="relative">{children}</div>
    </DropdownMenuContext.Provider>
  );
}

export const DropdownMenuTrigger = (
  { children, ...props }:
  { children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>
) => {
  const context = useContext(DropdownMenuContext);
  if (!context) throw new Error('DropdownMenuTrigger must be used within DropdownMenu');

  return (
    <button
      {...props}
      onClick={(e) => {
        e.stopPropagation();
        context.onOpenChange(!context.open);
      }}
      aria-expanded={context.open}
      aria-haspopup="true"
      className="relative"
    >
      {children}
    </button>
  );
};

export const DropdownMenuContent = (
  { children, className, ...props }:
  { children: React.ReactNode; className?: string } & React.DOMAttributes<HTMLElement>
) => {
  const context = useContext(DropdownMenuContext);
  if (!context) throw new Error('DropdownMenuContent must be used within DropdownMenu');

  return (
    <div
      className={`
        z-50 min-w-[8rem]
        px-2 py-1
        bg-surface
        rounded-md border
        border-border
        shadow-lg
        ${className || ''}
      `}
      role="menu"
      aria-orientation="vertical"
      aria-labelledby="menu-button"
      style={{ display: context.open ? 'block' : 'none' }}
      {...props}
    >
      {children}
    </div>
  );
};

export const DropdownMenuItem = (
  { children, className, onClick, ...props }:
  { children: React.ReactNode; className?: string; onClick?: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>
) => {
  const context = useContext(DropdownMenuContext);
  if (!context) throw new Error('DropdownMenuItem must be used within DropdownMenu');

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        if (onClick) onClick();
        context.onOpenChange(false); // Close menu after selection
      }}
      className={`
        flex w-full cursor-default items-center px-2 py-1.5 text-sm
        hover:bg-surface-2
        ${className || ''}
      `}
      role="menuitem"
      {...props}
    >
      {children}
    </button>
  );
};