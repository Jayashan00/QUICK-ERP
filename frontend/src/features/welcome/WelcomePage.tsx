import { useState } from 'react';
import vyroIcon from '@/assets/vyro-icon.png';
import { Link } from 'react-router-dom';
import { Boxes, ChevronRight, ClipboardList, FolderKanban, GitBranch, LifeBuoy, RotateCcw, ShieldCheck, ShoppingBag, Truck, UserRoundSearch, Users } from 'lucide-react';

import './welcome.css';

const modules = [
  { icon: ShoppingBag, title: 'Sales & POS', description: 'Manage quotations, orders, invoices and returns. Handle checkout, receipts and shifts at your point of sale.' },
  { icon: Boxes, title: 'Inventory & stock', description: 'Track products across warehouses and branches, with transfers, stock counts, batches and a movement history.' },
  { icon: Truck, title: 'Purchasing & suppliers', description: 'Compare supplier quotations, approve purchase orders, receive goods and match supplier invoices.' },
  { icon: ClipboardList, title: 'Accounting & reports', description: 'Manage receivables, payables, journals and bank matching. Review your ledger and financial reports.' },
  { icon: UserRoundSearch, title: 'CRM & customers', description: 'Follow leads, customer activities and opportunities from the first conversation through to a quotation.' },
  { icon: Users, title: 'HR & payroll', description: 'Keep employee records together with attendance, leave, overtime, payroll and payslips.' },
  { icon: FolderKanban, title: 'Projects & documents', description: 'Plan milestones and tasks, approve timesheets and organize the documents linked to your work.' },
  { icon: LifeBuoy, title: 'Support & notifications', description: 'Track support tickets, share notices and keep up with approvals and operational alerts.' },
];

const workflow = [
  { icon: UserRoundSearch, title: 'Quotation accepted', description: 'The customer approves the price.' },
  { icon: ShoppingBag, title: 'Sales order created', description: 'The team prepares the order.' },
  { icon: Boxes, title: 'Stock dispatched', description: 'Inventory records the outgoing goods.' },
  { icon: ClipboardList, title: 'Payment recorded', description: 'Accounts records the payment against the invoice.' },
];

export function WelcomePage() {
  const [replay, setReplay] = useState(0);
  const [selectedModule, setSelectedModule] = useState(0);
  const { icon: ModuleIcon, title: moduleTitle, description: moduleDescription } = modules[selectedModule];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <a href="#welcome-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-lg focus:bg-white focus:p-3 focus:text-blue-700">
        Skip to content
      </a>
      <header className="border-b border-white/10 bg-[#141023] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 sm:px-10">
          <Link to="/" aria-label="VYRO home" className="flex items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300">
            <img src={vyroIcon} alt="" width={40} height={40} className="size-10 shrink-0" />
            <span className="text-xl font-extrabold tracking-wide">VYRO</span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-6">
            <a href="#modules" className="hidden rounded-md py-3 text-sm font-medium text-violet-200 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300 sm:block">Explore modules</a>
            <Link to="/login" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/25 px-4 text-sm font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300">
              Sign in <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <main id="welcome-main">
        <section aria-labelledby="welcome-title" className="vyro-welcome-hero text-white">
          <div className="relative mx-auto max-w-7xl px-6 pb-12 pt-16 sm:px-10 sm:pb-20 sm:pt-24">
            <div className="vyro-hero-copy mx-auto max-w-4xl text-center">
              <p className="mb-5 text-sm font-semibold text-violet-200">VYRO ERP</p>
              <h1 id="welcome-title" className="mx-auto max-w-4xl text-4xl font-bold leading-[1.04] tracking-[-0.055em] sm:text-6xl lg:text-7xl xl:text-[5.5rem]">
                Run your business <span className="text-violet-300">in one place.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-violet-100 sm:text-lg">
                Manage sales, inventory, purchasing and accounts in one workspace. Follow the same records as work moves between teams and branches.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
                <Link to="/login" className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-violet-200 px-5 text-sm font-bold text-[#25194b] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300">
                  Open workspace <ChevronRight size={17} aria-hidden="true" />
                </Link>
                <a href="#modules" className="inline-flex min-h-12 items-center rounded-md text-sm font-semibold text-violet-100 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300">Explore modules</a>
              </div>
            </div>

            <div className="vyro-preview mx-auto mt-12 max-w-5xl overflow-hidden rounded-2xl border border-violet-300/35 bg-[#171025] shadow-2xl sm:mt-16">
              <div className="flex items-center justify-between gap-3 border-b border-white/15 px-5 py-4 sm:px-7">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <img src={vyroIcon} alt="" width={22} height={22} /> VYRO Workspace
                </span>
                <span className="text-xs text-violet-200">Product preview</span>
              </div>
              <div className="grid lg:grid-cols-[1.35fr_1fr]">
                <div key={replay} className="min-w-0 p-5 sm:p-7">
                  <p className="text-sm text-violet-300">Sales overview</p>
                  <p className="mt-2 text-2xl font-semibold">From order to payment</p>
                  <svg viewBox="0 0 420 145" className="mt-6 w-full" role="img" aria-label="Illustrative sales trend">
                    <defs>
                      <linearGradient id="vyro-chart-fill" x2="0" y2="1">
                        <stop stopColor="#a78bfa" stopOpacity=".42" />
                        <stop offset="1" stopColor="#a78bfa" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d="M0 20H420 M0 55H420 M0 90H420 M0 125H420" fill="none" stroke="#fff" strokeOpacity=".13" />
                    <path d="M0 119 C35 119 41 87 75 87 S118 107 149 96 S188 56 220 63 S260 84 292 54 S338 55 362 36 S397 28 420 11 V145 H0Z" fill="url(#vyro-chart-fill)" />
                    <path className="vyro-chart-line" pathLength="1" d="M0 119 C35 119 41 87 75 87 S118 107 149 96 S188 56 220 63 S260 84 292 54 S338 55 362 36 S397 28 420 11" fill="none" stroke="#c4a8ff" strokeWidth="3" />
                  </svg>
                  <div className="mt-3 flex justify-between text-xs text-violet-200" aria-hidden="true">
                    <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span>
                  </div>
                </div>
                <aside aria-labelledby="workflow-title" className="min-w-0 border-t border-white/15 bg-[#211637] lg:border-l lg:border-t-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/15 px-5 py-5 sm:px-7">
                    <div>
                      <p className="text-xs font-medium text-violet-300">Example workflow</p>
                      <h2 id="workflow-title" className="mt-1 text-lg font-semibold">Follow a sale</h2>
                    </div>
                    <button type="button" onClick={() => setReplay((value) => value + 1)} className="hidden min-h-10 items-center gap-2 rounded-lg border border-white/20 px-3 text-xs font-semibold text-violet-100 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-300 motion-safe:inline-flex">
                      <RotateCcw size={14} aria-hidden="true" /> Replay
                    </button>
                  </div>
                  <ol key={replay} className="vyro-workflow px-5 py-3 sm:px-7">
                    {workflow.map(({ icon: Icon, title, description }) => (
                      <li key={title} className="vyro-workflow-step relative flex items-start gap-4 py-3">
                        <span className="vyro-workflow-icon relative z-[1] grid size-10 shrink-0 place-items-center rounded-lg border border-violet-300/30 bg-[#30204f] text-violet-200">
                          <Icon size={19} aria-hidden="true" />
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold">{title}</h3>
                          <p className="mt-1 text-sm leading-snug text-violet-200">{description}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </aside>
              </div>
            </div>
          </div>
        </section>

        <section id="modules" aria-labelledby="modules-title" className="scroll-mt-6 border-b border-violet-100 bg-[#faf7ff]">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 sm:py-16">
            <div className="mb-9 max-w-xl">
              <h2 id="modules-title" className="text-2xl font-bold tracking-tight text-slate-900">What you can manage with VYRO</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">Connected modules for the tasks your team handles every day.</p>
            </div>
            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
              <div role="group" aria-label="Choose an ERP module" className="grid grid-cols-2 gap-2">
                {modules.map(({ icon: Icon, title }, index) => (
                  <button key={title} type="button" aria-pressed={selectedModule === index} aria-controls="vyro-module-detail" onClick={() => setSelectedModule(index)} className="vyro-module-choice flex min-h-14 items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-[#25194b] hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 sm:gap-3 sm:px-4">
                    <Icon size={19} className="shrink-0" aria-hidden="true" /> {title}
                  </button>
                ))}
              </div>
              <div id="vyro-module-detail" aria-live="polite" className="flex min-h-56 items-center rounded-2xl bg-[#25173d] p-6 text-white sm:p-8">
                <div key={moduleTitle} className="vyro-module-detail">
                  <ModuleIcon size={30} className="mb-4 text-violet-300" aria-hidden="true" />
                  <h3 className="text-2xl font-semibold tracking-tight">{moduleTitle}</h3>
                  <p className="mt-3 max-w-md leading-relaxed text-violet-100">{moduleDescription}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="team-title" className="mx-auto max-w-6xl px-6 py-14 sm:px-10 sm:py-16">
          <h2 id="team-title" className="text-2xl font-bold tracking-tight">Built around your branches and your team</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div className="flex items-start gap-4">
              <GitBranch size={24} className="mt-1 shrink-0 text-blue-700" aria-hidden="true" />
              <div>
                <h3 className="font-semibold">Manage more than one branch</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Work with branch-specific sales and stock records, switch between your permitted branches and review reports across your operations.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <ShieldCheck size={24} className="mt-1 shrink-0 text-blue-700" aria-hidden="true" />
              <div>
                <h3 className="font-semibold">Give each person the right access</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">Use roles and permissions to control access to modules and actions, with approval workflows and audit records for review.</p>
              </div>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-xl border border-slate-200 bg-slate-50 p-7 sm:flex-row sm:items-center sm:p-8">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Ready to open your workspace?</h2>
              <p className="mt-2 text-sm text-slate-600">Sign in with the account provided by your company.</p>
            </div>
            <Link to="/login" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
              Go to login <ChevronRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-7 text-xs text-slate-500 sm:px-10">
        <p>&copy; {new Date().getFullYear()} VYRO</p>
        <p>Sales, stock, accounts and people. Connected.</p>
      </footer>
    </div>
  );
}
