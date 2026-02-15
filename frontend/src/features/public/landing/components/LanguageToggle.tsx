import { Globe } from 'lucide-react';

export function LanguageToggle() {
  return (
    <button
      className="flex items-center gap-2 rounded-full px-3 py-1.5 transition-all duration-300 hover:bg-white/10"
      aria-label="Change language"
      disabled
    >
      <Globe className="h-4 w-4" />
      <span className="text-sm font-medium">EN</span>
    </button>
  );
}
