import { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

export interface AppShellProps {
  header: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AppShell({ header, sidebar, children, className }: AppShellProps) {
  return (
    <div className={cn('min-h-screen bg-neutral-50 dark:bg-neutral-900', className)}>
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/80 backdrop-blur-sm dark:border-neutral-800 dark:bg-neutral-900/80">
        {header}
      </header>

      <div className="flex">
        {/* Sidebar */}
        {sidebar && (
          <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:block">
            <div className="h-full overflow-y-auto p-6">{sidebar}</div>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
