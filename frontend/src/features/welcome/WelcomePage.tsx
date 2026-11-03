import { Link } from 'react-router-dom';
import { Boxes, Check, ChevronRight, ClipboardList, FolderKanban, GitBranch, LifeBuoy, ShieldCheck, ShoppingBag, Truck, UserRoundSearch, Users } from 'lucide-react';

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
  { title: 'Start with a customer', description: 'Capture an enquiry and prepare a quotation.' },
  { title: 'Make the sale', description: 'Create the order, delivery and invoice.' },
  { title: 'Keep stock in view', description: 'Record the movements behind each stock change.' },
  { title: 'Review the accounts', description: 'Follow payments and review accounting entries.' },
];

export function WelcomePage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <a href="#welcome-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-lg focus:bg-white focus:p-3 focus:text-blue-700">
        Skip to content
      </a>
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5 sm:px-10">
          <Link to="/" aria-label="Quick ERP home" className="flex items-center gap-3 rounded-md text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
            <span aria-hidden="true" className="grid size-10 place-items-center rounded-lg bg-[#12306e] text-lg font-black text-white">Q</span>
            <span className="text-xl font-extrabold tracking-tight">Quick ERP</span>
          </Link>
          <nav aria-label="Main navigation" className="flex items-center gap-4 sm:gap-8">
            <a href="#modules" className="hidden rounded-md py-3 text-sm font-medium text-slate-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 sm:block">Explore modules</a>
            <Link to="/login" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-5 text-sm font-semibold text-slate-800 hover:border-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
              Login <ChevronRight size={16} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <main id="welcome-main">
        <section aria-labelledby="welcome-title" className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-14 sm:px-10 sm:py-20 lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:py-24">
          <div>
            <p className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-600">
              <span aria-hidden="true" className="size-2 rounded-full bg-blue-600" />
              Welcome to Quick ERP
            </p>
            <h1 id="welcome-title" className="max-w-xl text-4xl font-bold leading-[1.1] tracking-[-0.035em] text-[#12306e] sm:text-5xl lg:text-[3.6rem]">
              One ERP for your everyday business.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600">
              Quick ERP brings sales, inventory, purchasing, accounting and your team into one system. Manage daily operations and follow the records behind your business, across every branch.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-slate-700">
              {['Follow sales from order to payment', 'See stock across your branches', 'Give your team access to the tools they need'].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check size={18} className="mt-0.5 shrink-0 text-blue-700" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">
                Login to Quick ERP <ChevronRight size={17} aria-hidden="true" />
              </Link>
              <a href="#modules" className="inline-flex min-h-12 items-center rounded-md px-2 text-sm font-semibold text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600">Explore the system</a>
            </div>
          </div>

          <aside aria-labelledby="workflow-title" className="rounded-2xl bg-[#12306e] px-7 py-9 text-white sm:px-9">
            <h2 id="workflow-title" className="text-2xl font-semibold tracking-tight">See how the work connects.</h2>
            <p className="mt-3 text-sm leading-relaxed text-blue-100">Follow a sale through the parts of your business that handle it.</p>
            <ol className="mt-8 space-y-6">
              {workflow.map(({ title, description }, index) => (
                <li key={title} className="flex gap-4">
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full border border-blue-300/50 text-sm font-semibold text-blue-100">{index + 1}</span>
                  <div>
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-blue-100">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </section>

        <section id="modules" aria-labelledby="modules-title" className="scroll-mt-6 border-y border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 sm:py-16">
            <div className="mb-9 max-w-xl">
              <h2 id="modules-title" className="text-2xl font-bold tracking-tight text-slate-900">What you can manage with Quick ERP</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">Connected modules for the tasks your team handles every day.</p>
            </div>
            <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
              {modules.map(({ icon: Icon, title, description }) => (
                <article key={title}>
                  <Icon size={23} className="mb-4 text-blue-700" strokeWidth={1.7} aria-hidden="true" />
                  <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-600">{description}</p>
                </article>
              ))}
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
        <p>&copy; {new Date().getFullYear()} Quick ERP</p>
        <p>Sales, stock, accounts and people. Connected.</p>
      </footer>
    </div>
  );
}
