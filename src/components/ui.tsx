import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'primary',
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
  const styles: Record<Variant, string> = {
    primary: 'bg-brand text-white hover:bg-brand-600 active:bg-brand-700',
    secondary: 'bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-50',
    ghost: 'text-neutral-700 hover:bg-neutral-100',
    danger: 'bg-red-600 text-white hover:bg-red-700'
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...rest} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string }) {
  const { label, hint, className = '', ...rest } = props;
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-neutral-700 mb-1">{label}</span>}
      <input
        className={`w-full px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand ${className}`}
        {...rest}
      />
      {hint && <span className="block text-xs text-neutral-500 mt-1">{hint}</span>}
    </label>
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const { label, className = '', ...rest } = props;
  return (
    <label className="block">
      {label && <span className="block text-sm font-medium text-neutral-700 mb-1">{label}</span>}
      <textarea
        className={`w-full px-3 py-2 rounded-lg border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand ${className}`}
        {...rest}
      />
    </label>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-neutral-200 p-4 ${className}`}>{children}</div>;
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-neutral-100 text-neutral-700',
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    blue: 'bg-sky-100 text-sky-800'
  };
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        {title && <h2 className="text-lg font-semibold mb-3">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
