'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type Toast = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
};

type ToastInput = Omit<Toast, 'id'>;

const ToastContext = createContext<{ toast: (input: ToastInput) => void } | null>(null);

const styles: Record<ToastType, { icon: typeof CheckCircle2; className: string; iconClassName: string }> = {
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-400/25 bg-emerald-950/90 text-emerald-50',
    iconClassName: 'text-emerald-300',
  },
  error: {
    icon: AlertCircle,
    className: 'border-rose-400/25 bg-rose-950/90 text-rose-50',
    iconClassName: 'text-rose-300',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-amber-400/25 bg-amber-950/90 text-amber-50',
    iconClassName: 'text-amber-300',
  },
  info: {
    icon: Info,
    className: 'border-cyan-400/25 bg-slate-950/90 text-cyan-50',
    iconClassName: 'text-cyan-300',
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setItems((current) => [{ id, ...input }, ...current].slice(0, 4));
    window.setTimeout(() => remove(id), 4200);
  }, [remove]);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-3 top-3 z-50 flex w-[min(380px,calc(100vw-24px))] flex-col gap-3 sm:right-5 sm:top-5">
        {items.map((item) => {
          const config = styles[item.type];
          const Icon = config.icon;
          return (
            <div
              key={item.id}
              className={cn(
                'pointer-events-auto toast-enter flex items-start gap-3 rounded-lg border px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur-xl',
                config.className,
              )}
              role="status"
              aria-live="polite"
            >
              <Icon className={cn('mt-0.5 shrink-0', config.iconClassName)} size={18} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold leading-5">{item.title}</div>
                {item.description && <div className="mt-1 text-xs leading-5 opacity-80">{item.description}</div>}
              </div>
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-white/65 transition hover:bg-white/10 hover:text-white"
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return context.toast;
}
