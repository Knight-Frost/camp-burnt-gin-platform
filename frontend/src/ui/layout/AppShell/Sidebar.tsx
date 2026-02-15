import { ReactNode } from 'react';
import { Stack } from '@/ui/components';
import { cn } from '@/shared/utils/cn';

export interface SidebarProps {
  children: ReactNode;
  className?: string;
}

export function Sidebar({ children, className }: SidebarProps) {
  return (
    <Stack direction="vertical" gap={2} className={cn('w-full', className)}>
      {children}
    </Stack>
  );
}

export interface SidebarSectionProps {
  title?: string;
  children: ReactNode;
}

export function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <div className="space-y-2">
      {title && (
        <h3 className="px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
          {title}
        </h3>
      )}
      <Stack direction="vertical" gap={1}>
        {children}
      </Stack>
    </div>
  );
}

export interface SidebarLinkProps {
  href: string;
  icon?: ReactNode;
  children: ReactNode;
  isActive?: boolean;
}

export function SidebarLink({ href, icon, children, isActive = false }: SidebarLinkProps) {
  return (
    <a
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400'
          : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
      )}
    >
      {icon && <span className="h-5 w-5">{icon}</span>}
      <span>{children}</span>
    </a>
  );
}
