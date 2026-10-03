import type { ButtonHTMLAttributes } from 'react';
export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  return <button className={`uiButton ${variant} ${className}`} {...props} />;
}
