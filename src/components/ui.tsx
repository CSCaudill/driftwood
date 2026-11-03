import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

// ------------------------------------------------------------------ Button

type Variant = 'primary' | 'secondary' | 'quiet' | 'danger';

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'md' | 'sm' | 'lg'; icon?: ReactNode }
>(function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors select-none disabled:opacity-45 disabled:pointer-events-none',
        size === 'sm' && 'h-8 px-3 text-sm rounded-lg',
        size === 'md' && 'h-10 px-4 text-[0.95rem] rounded-xl',
        size === 'lg' && 'h-12 px-5 text-base rounded-2xl',
        variant === 'primary' && 'bg-tide text-paper hover:bg-tide-strong active:bg-tide-strong',
        variant === 'secondary' && 'bg-paper text-ink border border-line hover:bg-sunken',
        variant === 'quiet' && 'text-graphite hover:text-ink hover:bg-sunken',
        variant === 'danger' && 'bg-danger-wash text-danger hover:brightness-95',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  children,
  className,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean }) {
  return (
    <button
      aria-label={label}
      title={label}
      {...rest}
      className={cx(
        'inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
        active ? 'bg-tide-wash text-tide' : 'text-graphite hover:bg-sunken hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * A small "remove" (×) button that is still easy to hit with a finger: the
 * visible circle is compact, but the touch target extends to about 44px.
 * It also keeps focus where it is, so an open keyboard doesn't close and
 * shift the layout before the tap lands.
 */
export function RemoveButton({
  label,
  onRemove,
  className,
  iconSize = 14,
}: {
  label: string;
  onRemove: () => void;
  className?: string;
  iconSize?: number;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        e.stopPropagation();
        onRemove();
      }}
      className={cx(
        // The hit-area span needs a positioned parent; keep callers' absolute positioning intact.
        !/\babsolute\b/.test(className ?? '') && 'relative',
        'inline-flex shrink-0 items-center justify-center rounded-full',
        className,
      )}
    >
      <span aria-hidden className="absolute -inset-2" />
      <X size={iconSize} />
    </button>
  );
}

// ------------------------------------------------------------------ Form fields

export function FieldLabel({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {children}
      </label>
      {hint && <span className="text-xs text-faint">{hint}</span>}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      {...rest}
      className={cx(
        'h-11 w-full rounded-xl border border-line bg-paper px-3.5 text-[0.95rem] placeholder:text-faint',
        'focus:border-tide focus:outline-none focus:ring-3 focus:ring-tide-wash',
        className,
      )}
    />
  );
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        {...rest}
        className={cx(
          'w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-3 placeholder:text-faint',
          'focus:border-tide focus:outline-none focus:ring-3 focus:ring-tide-wash',
          className,
        )}
      />
    );
  },
);

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  label: string;
  size?: 'md' | 'sm';
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-sunken p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-lg font-medium transition-all',
            size === 'md' ? 'h-9 text-sm' : 'h-7 text-xs',
            o.value === value ? 'bg-paper text-ink shadow-raise' : 'text-graphite hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-[0.95rem] font-medium text-ink">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-graphite">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-tide' : 'bg-line',
        )}
      >
        <span
          className={cx(
            'absolute left-0 top-1 h-5 w-5 rounded-full bg-paper shadow-raise transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  );
}

export function Chip({
  selected,
  children,
  onClick,
  className,
}: {
  selected?: boolean;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors',
        selected ? 'border-tide bg-tide-wash text-tide' : 'border-line bg-paper text-graphite hover:text-ink',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ------------------------------------------------------------------ Sheet

/**
 * Bottom sheet on phones, centered dialog on larger screens.
 * Handles focus trapping lightly (initial focus + Escape) and scroll lock.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  headerAction,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  headerAction?: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => {
      const target = panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current;
      target?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="anim-fade absolute inset-0 bg-[var(--overlay)]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cx(
          'anim-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden bg-paper shadow-sheet outline-none',
          'rounded-t-[28px] sm:rounded-3xl',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-xl',
          size === 'lg' && 'sm:max-w-2xl',
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <header className="flex items-center gap-2 px-5 pb-2 pt-3 sm:px-6 sm:pt-5">
          <h2 className="display flex-1 text-lg font-semibold">{title}</h2>
          {headerAction}
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X size={20} />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6">{children}</div>
        {footer && (
          <footer className="safe-bottom border-t border-line bg-paper px-5 py-3 sm:px-6">{footer}</footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function EmptyState({
  title,
  children,
  action,
  art,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  art?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-16 text-center">
      {art}
      <h3 className="display mt-6 text-xl font-semibold">{title}</h3>
      {children && <p className="mt-2 text-graphite">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
