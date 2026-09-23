import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'purple';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    error: 'bg-red-100 text-red-700 border-red-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  let variant: BadgeProps['variant'] = 'default';

  if (status === 'Aprobado') variant = 'success';
  if (status === 'En aprobación final') variant = 'info';
  if (status.includes('aprobación') && status !== 'En aprobación final') variant = 'warning';
  if (status === 'En diseño' || status === 'En creación desarrollo' || status === 'En validación diseño') variant = 'purple';
  if (status === 'Cambios solicitados' || status === 'Rechazado') variant = 'error';

  return <Badge variant={variant}>{status}</Badge>;
};
