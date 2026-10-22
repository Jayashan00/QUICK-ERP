import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '@/core/auth/auth-context';

/** Receipt paper: straight sides and a torn (zigzag) bottom edge of 20 teeth. */
const RECEIPT_OUTLINE = `M20 8H240V308${Array.from({ length: 20 }, (_, tooth) => `L${240 - tooth * 11 - 5.5} 318L${240 - (tooth + 1) * 11} 308`).join('')}Z`;

/** A shop receipt drawn in fine lines: the brand panel's one visual element. */
function ReceiptIllustration() {
  const items: Array<[string, string]> = [
    ['Basmati rice 5 kg', '2,450.00'],
    ['Coconut oil 1 L', '890.00'],
    ['Ceylon tea 400 g', '1,150.00'],
    ['Dhal 1 kg', '420.00'],
  ];
  return (
    <svg viewBox="0 0 260 340" role="img" aria-label="A printed sales receipt" className="receipt-print h-auto w-full max-w-[17rem]">
      <path d={RECEIPT_OUTLINE} fill="#1b3c80" stroke="#bcd0ff" strokeOpacity="0.55" strokeWidth="1.2" strokeLinejoin="round" />
      <g fill="#e6eeff" fontFamily="inherit">
        <text x="130" y="42" textAnchor="middle" fontSize="15" fontWeight="700" letterSpacing="0.5">Nimal Stores</text>
        <text x="130" y="60" textAnchor="middle" fontSize="9.5" fillOpacity="0.7">Galle Road, Colombo 03</text>
        <line x1="40" y1="76" x2="220" y2="76" stroke="#bcd0ff" strokeOpacity="0.45" strokeDasharray="3 4" />
        {items.map(([name, amount], index) => (
          <g key={name} fontSize="10.5" fillOpacity="0.9">
            <text x="40" y={100 + index * 24}>{name}</text>
            <text x="220" y={100 + index * 24} textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>{amount}</text>
          </g>
        ))}
        <line x1="40" y1="190" x2="220" y2="190" stroke="#bcd0ff" strokeOpacity="0.45" strokeDasharray="3 4" />
        <text x="40" y="216" fontSize="12" fontWeight="700">Total</text>
        <text x="220" y="216" textAnchor="end" fontSize="12" fontWeight="700" style={{ fontVariantNumeric: 'tabular-nums' }}>LKR 4,910.00</text>
        <text x="40" y="238" fontSize="9.5" fillOpacity="0.7">Paid by card</text>
        <text x="220" y="238" textAnchor="end" fontSize="9.5" fillOpacity="0.7">Stock updated</text>
        <g transform="translate(70 256)" fillOpacity="0.55">
          {[0, 3, 5, 9, 11, 14, 18, 20, 23, 27, 29, 33, 36, 38, 42, 45, 48, 52, 54, 57, 61, 63, 66, 70, 72, 75, 79, 82, 85, 88, 92, 95, 98, 102, 105, 108, 112, 115, 117].map((x, index) => (
            <rect key={x} x={x} y="0" width={index % 3 === 0 ? 2 : 1} height="26" />
          ))}
        </g>
      </g>
    </svg>
  );
}

export function AuthLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50" role="status">
        <div className="spinner" />
        <span className="sr-only">Restoring session</span>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={user?.isSuperAdmin ? '/super-admin/dashboard' : '/dashboard'} replace />;
  }

  const year = new Date().getFullYear();

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] bg-white lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-1">
      {/* Brand panel: a slim band on phones, a full panel on larger screens. */}
      <aside className="relative overflow-hidden bg-[#12306e] px-6 py-6 text-white sm:px-10 lg:flex lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '100% 28px' }}
        />
        <div className="relative flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-lg bg-white text-[15px] font-black text-[#12306e]" aria-hidden="true">Q</span>
          <span className="text-lg font-extrabold tracking-tight">Quick ERP</span>
        </div>

        <div className="relative hidden lg:block">
          <p className="max-w-md text-[2rem] font-bold leading-[1.15] tracking-tight">
            Sales, stock, accounts and people, kept in one set of books.
          </p>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-blue-100/80">
            Every branch and every till works from the same records, updated as they happen.
          </p>
          <div className="mt-10">
            <ReceiptIllustration />
          </div>
        </div>

        <p className="relative hidden text-xs text-blue-100/60 lg:block">&copy; {year} Quick ERP</p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-[400px]">
          <Outlet />
        </div>
        <p className="mx-auto mt-10 w-full max-w-[400px] text-xs text-slate-400 lg:hidden">&copy; {year} Quick ERP</p>
      </main>
    </div>
  );
}