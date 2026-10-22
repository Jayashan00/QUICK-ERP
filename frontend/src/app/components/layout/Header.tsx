import { Menu, Search } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GlobalSearchPanel } from '@/features/global-search/components/GlobalSearchPanel';

import { IconButton } from '@/shared/components/common/IconButton';
import { BranchSwitcher } from '@/app/components/navigation/BranchSwitcher';
import { NotificationsMenu } from '@/app/components/navigation/NotificationsMenu';
import { UserMenu } from '@/app/components/navigation/UserMenu';
import { NetworkStatusIndicator } from '@/features/sync';

interface HeaderProps {
  area: 'tenant' | 'super-admin';
  mobileOpen: boolean;
  onToggleMobileNav: () => void;
}

export function Header({ area, mobileOpen, onToggleMobileNav }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const openSearch = useCallback(() => { setSearchOpen(true); searchInputRef.current?.focus(); }, []);
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    requestAnimationFrame(() => Array.from(headerRef.current?.querySelectorAll<HTMLElement>('[aria-label="Open global search"]') ?? []).find(control => control.getClientRects().length > 0)?.focus());
  }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
    };
    document.addEventListener('keydown', shortcut);
    return () => document.removeEventListener('keydown', shortcut);
  }, [openSearch]);
  return (
    <header ref={headerRef} className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-1 border-b border-slate-200 bg-white px-3 sm:gap-2 sm:px-4 lg:px-6 print:hidden">
      <IconButton
        className="lg:hidden"
        onClick={onToggleMobileNav}
        label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={mobileOpen}
        icon={<Menu size={20} />}
      />

      <div className="ml-1 min-w-0 lg:hidden">
        <div className="truncate text-sm font-bold text-slate-900">
          {area === 'super-admin' ? 'Platform Admin' : 'Quick ERP'}
        </div>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        aria-label="Open global search"
        onClick={openSearch}
        aria-haspopup="dialog"
        aria-expanded={searchOpen}
        className="hidden h-9 w-full max-w-56 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 md:flex"
      >
        <Search size={17} />
        <span>Search</span>
        <kbd className="ml-auto rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
          Ctrl K
        </kbd>
      </button>
      <IconButton className="md:hidden" label="Open global search" onClick={openSearch} aria-haspopup="dialog" aria-expanded={searchOpen} icon={<Search size={19} />} />

      {area === 'tenant' && <NetworkStatusIndicator />}
      {area === 'tenant' && <BranchSwitcher />}
      <NotificationsMenu area={area} />
      <UserMenu area={area} />
      {searchOpen && <GlobalSearchPanel onClose={closeSearch} inputRef={searchInputRef} />}
    </header>
  );
}
