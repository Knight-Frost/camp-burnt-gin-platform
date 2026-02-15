import { ReactNode } from 'react';
import { Stack } from '@/ui/components';
import { cn } from '@/shared/utils/cn';

export interface HeaderProps {
  logo?: ReactNode;
  navigation?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function Header({ logo, navigation, actions, className }: HeaderProps) {
  return (
    <div className={cn('h-16', className)}>
      <Stack
        direction="horizontal"
        align="center"
        justify="between"
        className="h-full px-4 sm:px-6 lg:px-8"
      >
        {/* Logo */}
        {logo && <div className="flex-shrink-0">{logo}</div>}

        {/* Navigation */}
        {navigation && (
          <nav className="hidden flex-1 px-8 md:block" aria-label="Primary navigation">
            {navigation}
          </nav>
        )}

        {/* Actions (user menu, notifications, etc.) */}
        {actions && <div className="flex items-center gap-4">{actions}</div>}
      </Stack>
    </div>
  );
}
