import { useEffect, useState, type FormEvent } from 'react';
import vyroIcon from '@/assets/vyro-icon.png';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Boxes, Check, ChevronRight, ClipboardList, CloudCog, FileText, FolderKanban, GitBranch, PackageCheck, ShieldCheck, ShoppingBag, Truck, UserRoundSearch, Users, Wallet } from 'lucide-react';
import { saveInquiry } from '@/features/inquiry-admin/inquiryStorage';

import './welcome.css';

const workflow = [
  { icon: UserRoundSearch, title: 'Quote', description: 'Prepare a price for the customer.' },
  { icon: ShoppingBag, title: 'Order', description: 'Turn the accepted quote into work.' },
  { icon: PackageCheck, title: 'Fulfil', description: 'Reserve and dispatch the stock.' },
  { icon: Wallet, title: 'Collect', description: 'Record payment against the invoice.' },
];

const stories = [
  {
    icon: ShoppingBag,
    label: 'Sales, POS & customers',
    title: 'Stay with the sale from first contact to payment.',
    description: 'Keep quotes, orders, customer history and payments together. Your counter team can use the same product and stock records as the sales team.',
    points: ['Track leads and opportunities', 'Create quotes, orders and invoices', 'Take counter sales and record returns'],
    preview: 'sales',
  },
  {
    icon: Boxes,
    label: 'Products, stock & purchasing',
    title: 'Know what you have, where it is, and what to order.',
    description: 'Manage the catalog and follow stock across locations. Compare supplier offers, receive goods and review movements when quantities change.',
    points: ['Track batches, serials and expiry dates', 'Transfer, count and adjust stock', 'Compare supplier quotes and receive orders'],
    preview: 'stock',
  },
  {
    icon: Wallet,
    label: 'Finance & reporting',
    title: 'Follow the numbers back to the work that created them.',
    description: 'Review accounting records alongside the transactions behind them. Use reports for sales, purchasing, stock, finance, HR, projects and POS.',
    points: ['Review receivables and payables', 'Match bank activity and manage journals', 'Explore dashboards and detailed reports'],
    preview: 'finance',
  },
  {
    icon: Users,
    label: 'People, projects & documents',
    title: 'Give teams a clear place to manage their work.',
    description: 'Keep employee records, attendance, project tasks, timesheets and shared documents organized in the same workspace.',
    points: ['Manage leave, payroll and employee records', 'Plan projects, milestones and timesheets', 'Share documents, notices and support requests'],
    preview: 'team',
  },
];

const platformAreas = [
  { icon: ShoppingBag, title: 'Sales & point of sale', details: 'Quotations, approvals, orders, invoices, payments, deliveries, returns, credit notes, recurring invoices, commissions, POS shifts, receipts, web orders and public storefront.' },
  { icon: Boxes, title: 'Products & inventory', details: 'Products, services, variants, identifiers, categories, brands, price lists, imports, warehouses, stock locations, batches, serials, expiry, transfers, counts, adjustments, reorder and stock reports.' },
  { icon: Truck, title: 'Purchasing & suppliers', details: 'Purchase requests, RFQs, supplier quotations, comparisons, purchase orders, goods receipts, invoice matching, purchase returns, supplier payments and performance.' },
  { icon: Wallet, title: 'Finance & accounting', details: 'Chart of accounts, opening balances, journals, receivables, payables, payments, expenses, bank matching, tax, general ledger, trial balance, budgets, fixed assets and financial reports.' },
  { icon: UserRoundSearch, title: 'CRM & customer records', details: 'Leads, activities, reminders, opportunities, sales pipeline, customer profiles, purchase history and supplier contacts.' },
  { icon: Users, title: 'HR & payroll', details: 'Employees, departments, attendance, rosters, leave, overtime, payroll, payslips, recruitment, onboarding, training, performance, policies, assets and exits.' },
  { icon: FolderKanban, title: 'Projects & delivery', details: 'Projects, milestones, tasks, dependencies, timesheets, approvals, project expenses, billing, profitability and reports.' },
  { icon: ClipboardList, title: 'Reports & analytics', details: 'Dashboards and 63 service-derived reports across sales, CRM, purchasing, inventory, finance, HR, projects and POS.' },
  { icon: FileText, title: 'Documents, support & updates', details: 'Shared documents, versions, expiry reminders, support tickets, notifications, notices, acknowledgements and templates.' },
  { icon: ShieldCheck, title: 'Company, access & controls', details: 'Company profile, branches, departments, users, roles, permissions, login activity, audit logs, localization, numbering and settings.' },
  { icon: CloudCog, title: 'Sync & continuity', details: 'Sync queue, retry status, offline POS and stock activity, conflict review and operational alerts.' },
];

function PreviewPanel({ kind }: { kind: string }) {
  return (
    <div className="vyro-screen" role="group" aria-label="Illustrative product screen">
      <div className="vyro-screen-bar">
        <div className="flex items-center gap-2"><span className="vyro-screen-dot" /><span className="vyro-screen-dot" /><span className="vyro-screen-dot" /></div>
        <span className="vyro-screen-label">Example workspace</span>
      </div>
      {kind === 'sales' && (
        <div className="vyro-screen-content">
          <div className="flex items-start justify-between gap-4"><div><p className="vyro-screen-kicker">Sales pipeline</p><h3 className="vyro-screen-title">Recent orders</h3></div><span className="vyro-screen-button">New order +</span></div>
          <div className="vyro-table-head"><span>Customer</span><span>Amount</span><span>Status</span></div>
          {[['Nila Electronics', 'Rs 48,500', 'Preparing'], ['Northbay Retail', 'Rs 26,200', 'Invoiced'], ['Mira Stores', 'Rs 18,750', 'Awaiting']].map(([customer, amount, status]) => <div className="vyro-table-row" key={customer}><span>{customer}</span><span>{amount}</span><span className="vyro-status">{status}</span></div>)}
          <div className="vyro-screen-foot"><span>Quotes</span><span className="vyro-mini-bar"><i style={{ width: '42%' }} /></span><span>Orders</span><span className="vyro-mini-bar"><i style={{ width: '72%' }} /></span><span>Payments</span></div>
        </div>
      )}
      {kind === 'stock' && (
        <div className="vyro-screen-content">
          <div className="flex items-start justify-between gap-4"><div><p className="vyro-screen-kicker">Inventory overview</p><h3 className="vyro-screen-title">Stock to review</h3></div><span className="vyro-screen-button">All locations⌄</span></div>
          <div className="vyro-stock-list">{[['Steel bottle', 'Main warehouse', 'In stock', '78%'], ['Canvas tote', 'City branch', 'Reorder soon', '31%'], ['Desk lamp', 'North branch', 'In stock', '64%']].map(([item, location, status, width]) => <div className="vyro-stock-row" key={item}><span className="vyro-stock-image"><Boxes size={17} /></span><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><strong>{item}</strong><span className={status === 'In stock' ? 'vyro-stock-ok' : 'vyro-stock-low'}>{status}</span></div><span className="vyro-stock-location">{location}</span><span className="vyro-stock-track"><i style={{ width }} /></span></div></div>)}</div>
          <div className="vyro-screen-foot vyro-stock-foot"><span>Warehouses</span><b>04</b><span>Open transfers</span><b>07</b><span>Reorder list</span><b>12 items</b></div>
        </div>
      )}
      {kind === 'finance' && (
        <div className="vyro-screen-content">
          <div className="flex items-start justify-between gap-4"><div><p className="vyro-screen-kicker">Finance overview</p><h3 className="vyro-screen-title">Month at a glance</h3></div><span className="vyro-screen-button">This month⌄</span></div>
          <div className="vyro-finance-metrics"><div><span>Receivables</span><strong>Rs 1.24M</strong><em>Invoices to follow up</em></div><div><span>Payables</span><strong>Rs 860K</strong><em>Supplier commitments</em></div></div>
          <div className="vyro-finance-chart" aria-label="Illustrative income and expense chart"><div className="vyro-chart-lines"><i /><i /><i /><i /></div><div className="vyro-chart-bars">{['42%', '68%', '54%', '81%', '61%', '92%', '73%', '100%', '77%', '89%', '64%', '96%'].map((height, index) => <i key={index} style={{ height }} />)}</div></div>
          <div className="vyro-screen-foot"><span><i className="vyro-legend income" /> Income</span><span><i className="vyro-legend expense" /> Expenses</span><span className="ml-auto">Financial reports <ArrowUpRight size={13} /></span></div>
        </div>
      )}
      {kind === 'team' && (
        <div className="vyro-screen-content">
          <div className="flex items-start justify-between gap-4"><div><p className="vyro-screen-kicker">Team workspace</p><h3 className="vyro-screen-title">Today’s work</h3></div><span className="vyro-screen-button">All teams⌄</span></div>
          <div className="vyro-task-list">{[['Attendance', '3 requests to review', 'amber'], ['Project timesheets', '12 submitted this week', 'violet'], ['Support tickets', '5 open requests', 'blue'], ['Documents', '2 expiry reminders', 'green']].map(([title, detail, tone]) => <div className="vyro-task-row" key={title}><span className={`vyro-task-icon ${tone}`}><Check size={15} /></span><div><strong>{title}</strong><span>{detail}</span></div><ChevronRight size={15} className="ml-auto text-slate-400" /></div>)}</div>
          <div className="vyro-screen-foot"><GitBranch size={14} /><span>Branch access follows each team member’s role</span></div>
        </div>
      )}
    </div>
  );
}

function InquiryForm() {
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setNotice(null);
    try {
      saveInquiry({
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
        company: String(formData.get('company') ?? ''),
        phone: String(formData.get('phone') ?? '') || null,
        interest: String(formData.get('interest') ?? ''),
        message: String(formData.get('message') ?? ''),
      });
      form.reset();
      setNotice({ type: 'success', text: 'Saved in this browser’s preview inbox. This form hasn’t sent your inquiry to VYRO.' });
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'We could not save this preview inquiry.' });
    }
  }

  return (
    <form className="vyro-inquiry-form" onSubmit={handleSubmit}>
      <div className="vyro-honeypot" aria-hidden="true"><label>Leave this field empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="vyro-form-grid">
        <label>Name <span>*</span><input autoComplete="name" name="name" required maxLength={100} /></label>
        <label>Work email <span>*</span><input autoComplete="email" name="email" type="email" required maxLength={254} /></label>
        <label>Company <span>*</span><input autoComplete="organization" name="company" required maxLength={120} /></label>
        <label>Phone <small>Optional</small><input autoComplete="tel" name="phone" type="tel" maxLength={40} /></label>
        <label className="vyro-form-wide">What are you interested in? <span>*</span><select name="interest" defaultValue="" required><option value="" disabled>Select a product area</option><option>Sales, POS & CRM</option><option>Products, inventory & purchasing</option><option>Finance & reports</option><option>HR, projects & documents</option><option>Multi-branch ERP</option><option>Other</option></select></label>
        <label className="vyro-form-wide">How can we help? <span>*</span><textarea name="message" rows={4} required maxLength={2000} placeholder="Tell us a little about your business and what you need." /></label>
      </div>
      <div className="vyro-form-submit-row"><button className="vyro-primary-button" type="submit">Save preview inquiry <ChevronRight size={16} /></button><p>This preview doesn’t send your details to the VYRO team.</p></div>
      {notice && <p className={`vyro-form-notice ${notice.type}`} role="status">{notice.text}</p>}
    </form>
  );
}

export function WelcomePage() {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('.vyro-reveal');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }
    if (!('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="vyro-home min-h-screen text-slate-900">
      <a href="#welcome-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-lg focus:bg-white focus:p-3 focus:text-violet-800">Skip to content</a>
      <header className="vyro-nav">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-10">
          <Link to="/" aria-label="VYRO home" className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-600"><img src={vyroIcon} alt="" width={36} height={36} className="size-9 shrink-0" /><span className="text-lg font-extrabold tracking-[.12em]">VYRO</span></Link>
          <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-8">
            <a href="#product" className="hidden py-3 text-sm font-medium text-slate-600 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-violet-600 sm:block">Product</a>
            <a href="#modules" className="hidden py-3 text-sm font-medium text-slate-600 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-violet-600 md:block">Modules</a>
            <a href="#how-it-works" className="hidden py-3 text-sm font-medium text-slate-600 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-violet-600 md:block">How it works</a>
            <a href="#inquiry" className="hidden py-3 text-sm font-medium text-slate-600 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-violet-600 lg:block">Contact</a>
            <Link to="/login" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#211b31] px-5 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-violet-700">Sign in <ChevronRight size={15} aria-hidden="true" /></Link>
          </nav>
        </div>
      </header>

      <main id="welcome-main">
        <section aria-labelledby="welcome-title" className="vyro-hero">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-14 sm:px-10 sm:pb-20 sm:pt-20 lg:grid-cols-[.85fr_1.15fr] lg:gap-12">
            <div className="vyro-hero-copy max-w-xl">
              <p className="vyro-hero-label"><span /> ERP for the work behind your business</p>
              <h1 id="welcome-title" className="mt-6 text-5xl font-semibold leading-[1.02] tracking-[-.06em] text-[#211b31] sm:text-6xl lg:text-[4.8rem]">One business.<br /><span>One clear view.</span></h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">VYRO connects sales, stock, purchasing, finance and people, so each team can see the work that comes before and after theirs.</p>
              <div className="mt-8 flex flex-wrap items-center gap-4"><Link to="/login" className="vyro-primary-button">Open workspace <ChevronRight size={17} /></Link><a href="#product" className="vyro-text-link">See how it works <ArrowDownRight size={16} /></a></div>
              <div className="vyro-proof-line mt-9"><span><Check size={15} /> Branch-aware work</span><span><Check size={15} /> Role-based access</span><span><Check size={15} /> Connected records</span></div>
            </div>

            <div className="vyro-dashboard-wrap">
              <div className="vyro-dashboard" role="group" aria-label="Example VYRO workspace dashboard">
                <div className="vyro-dashboard-top"><div className="flex items-center gap-3"><img src={vyroIcon} alt="" width={27} height={27} className="size-7" /><div><p className="text-sm font-bold text-slate-900">Workspace overview</p><p className="text-[11px] text-slate-500">Example data · all branches</p></div></div><div className="vyro-avatar">V</div></div>
                <div className="vyro-dashboard-body">
                  <div className="flex items-center justify-between"><div><p className="text-xs text-slate-500">Good morning</p><p className="mt-1 text-lg font-semibold tracking-tight text-slate-900">Here’s what’s happening</p></div><span className="vyro-date-pill">This month⌄</span></div>
                  <div className="vyro-dashboard-metrics">{[{ icon: Wallet, label: 'Revenue', value: 'Rs 2.48M', tone: 'violet' }, { icon: ShoppingBag, label: 'Orders', value: '1,284', tone: 'blue' }, { icon: Boxes, label: 'Stock items', value: '8,420', tone: 'green' }].map(({ icon: Icon, label, value, tone }) => <div className="vyro-dashboard-metric" key={label}><span className={`vyro-dashboard-icon ${tone}`}><Icon size={15} /></span><span>{label}</span><strong>{value}</strong></div>)}</div>
                  <div className="vyro-dashboard-panels">
                    <div className="vyro-chart-panel"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold text-slate-800">Sales performance</p><p className="mt-1 text-[10px] text-slate-500">Revenue across branches</p></div><span className="text-xs font-semibold text-violet-700">Rs 2.48M</span></div><svg viewBox="0 0 420 120" className="mt-3 w-full" role="img" aria-label="Illustrative sales trend"><defs><linearGradient id="vyro-chart-fill" x2="0" y2="1"><stop stopColor="#8b5cf6" stopOpacity=".23" /><stop offset="1" stopColor="#8b5cf6" stopOpacity="0" /></linearGradient></defs><path d="M0 20H420 M0 55H420 M0 90H420" fill="none" stroke="#e9e6ef" /><path d="M0 91 C35 91 43 67 74 70 S117 84 147 66 S187 46 218 54 S257 70 289 43 S334 57 361 30 S396 31 420 13 V120 H0Z" fill="url(#vyro-chart-fill)" /><path className="vyro-chart-stroke" pathLength="1" d="M0 91 C35 91 43 67 74 70 S117 84 147 66 S187 46 218 54 S257 70 289 43 S334 57 361 30 S396 31 420 13" fill="none" stroke="#7651c8" strokeWidth="3" strokeLinecap="round" /></svg><div className="vyro-chart-days"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></div>
                    <div className="vyro-activity-panel"><div className="flex items-center justify-between"><p className="text-xs font-semibold text-slate-800">Recent activity</p><span className="vyro-live-dot" /></div><ul className="mt-3 space-y-3">{[{ icon: ShoppingBag, title: 'Sales order', ref: 'SO-10482 · New order', tone: 'violet' }, { icon: PackageCheck, title: 'Goods received', ref: 'PO-00318 · Main branch', tone: 'green' }, { icon: ClipboardList, title: 'Invoice payment', ref: 'INV-00873 · Recorded', tone: 'blue' }].map(({ icon: Icon, title, ref, tone }) => <li className="flex items-center gap-2.5" key={title}><span className={`vyro-activity-icon ${tone}`}><Icon size={13} /></span><div><p className="text-[11px] font-semibold text-slate-800">{title}</p><p className="text-[10px] text-slate-500">{ref}</p></div></li>)}</ul></div>
                  </div>
                  <div className="vyro-branch-ribbon"><GitBranch size={15} /><span>Branch overview</span><i /> <span>Colombo</span><span>Kandy</span><span>Galle</span></div>
                </div>
              </div>
              <p className="vyro-preview-caption">Illustrative preview. Figures shown are sample data.</p>
            </div>
          </div>
        </section>

        <section className="vyro-work-strip" aria-label="Connected business areas"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 py-5 sm:px-10"><span className="vyro-strip-label">One workspace for</span><span>Sell</span><span>Buy</span><span>Manage stock</span><span>Run finance</span><span>Support teams</span><span>Review performance</span></div></section>

        <section aria-labelledby="benefits-title" className="bg-[#f8f7fa]"><div className="mx-auto max-w-7xl px-5 py-16 sm:px-10 sm:py-20"><div className="vyro-section-heading vyro-reveal"><p className="vyro-section-kicker">Built for day-to-day operations</p><h2 id="benefits-title">Less chasing. A clearer view of the work.</h2><p>Keep teams, branches and business records connected as work moves through your company.</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[{ icon: GitBranch, title: 'See branch activity', detail: 'Review branch-specific records and switch between locations your role allows.' }, { icon: Check, title: 'Follow each transaction', detail: 'Move from quote to order, delivery, invoice and payment with linked records.' }, { icon: ShieldCheck, title: 'Set access by role', detail: 'Give each team member access to the areas and actions they need.' }, { icon: CloudCog, title: 'Keep work moving offline', detail: 'Use offline POS and stock activity, then review sync status and conflicts.' }].map(({ icon: Icon, title, detail }) => <article key={title} className="vyro-reveal rounded-xl border border-[#e7e2ec] bg-white p-5"><span className="grid size-10 place-items-center rounded-lg bg-[#f1ebfa] text-[#7045c2]"><Icon size={19} /></span><h3 className="mt-4 font-semibold text-[#211b31]">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p></article>)}</div></div></section>

        <section id="how-it-works" aria-labelledby="workflow-title" className="vyro-flow-section scroll-mt-6">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-10 sm:py-20"><div className="vyro-section-heading vyro-reveal"><p className="vyro-section-kicker">From quote to payment</p><h2 id="workflow-title">Follow the work as it moves.</h2><p>A simple sale touches several teams. VYRO keeps its records connected along the way.</p></div><ol className="vyro-workflow vyro-reveal">{workflow.map(({ icon: Icon, title, description }, index) => <li className="vyro-workflow-item" key={title}><span className="vyro-flow-index">0{index + 1}</span><span className="vyro-flow-icon"><Icon size={20} /></span><h3>{title}</h3><p>{description}</p>{index < workflow.length - 1 && <ArrowUpRight className="vyro-flow-arrow" size={18} aria-hidden="true" />}</li>)}</ol></div>
        </section>

        <section id="product" aria-labelledby="product-title" className="vyro-stories scroll-mt-6">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-10 sm:py-24"><div className="vyro-section-heading vyro-reveal"><p className="vyro-section-kicker">Made for everyday work</p><h2 id="product-title">The details your teams rely on, in one place.</h2><p>Explore how VYRO brings daily work together across your business.</p></div>
            <div className="vyro-story-list">{stories.map(({ icon: Icon, label, title, description, points, preview }, index) => <article className={`vyro-story vyro-reveal ${index % 2 === 1 ? 'reverse' : ''}`} key={label}><div className="vyro-story-copy"><div className="vyro-story-label"><span><Icon size={17} /></span>{label}</div><h3>{title}</h3><p>{description}</p><ul>{points.map((point) => <li key={point}><Check size={15} />{point}</li>)}</ul></div><PreviewPanel kind={preview} /></article>)}</div>
          </div>
        </section>

        <section id="modules" aria-labelledby="modules-title" className="vyro-module-section scroll-mt-6"><div className="mx-auto max-w-7xl px-5 py-16 sm:px-10 sm:py-20"><div className="vyro-module-heading vyro-reveal"><div><p className="vyro-section-kicker">The full platform</p><h2 id="modules-title">One system, across every department.</h2><p>Browse the main work areas included in VYRO.</p></div><Link to="/login" className="vyro-outline-button">Open workspace <ChevronRight size={16} /></Link></div><div className="vyro-platform-grid">{platformAreas.map(({ icon: Icon, title, details }, index) => <article className={`vyro-platform-item vyro-reveal delay-${index % 3}`} key={title}><span className="vyro-platform-icon"><Icon size={18} /></span><div><h3>{title}</h3><p>{details}</p></div><ChevronRight size={15} className="vyro-platform-chevron" aria-hidden="true" /></article>)}</div></div></section>

        <section aria-labelledby="branches-title" className="vyro-branch-section"><div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-10 sm:py-20 lg:grid-cols-[.85fr_1.15fr]"><div className="vyro-reveal"><p className="vyro-section-kicker">For teams across locations</p><h2 id="branches-title">Keep every branch in view.</h2><p>Work with branch-specific records, switch between locations you can access and review activity across your permitted operations.</p><Link to="/login" className="vyro-text-link mt-6">Sign in to your workspace <ChevronRight size={16} /></Link></div><div className="vyro-branch-visual vyro-reveal"><div className="vyro-branch-center"><img src={vyroIcon} alt="" width={30} height={30} /><div><strong>One company</strong><span>Shared workspace</span></div></div><div className="vyro-branch-nodes"><div><GitBranch size={16} /><strong>Colombo</strong><span>Sales · Stock · Team</span></div><div><GitBranch size={16} /><strong>Kandy</strong><span>Sales · Stock · Team</span></div><div><GitBranch size={16} /><strong>Galle</strong><span>Sales · Stock · Team</span></div></div><div className="vyro-branch-base"><ShieldCheck size={16} />Access follows each user’s role</div></div></div></section>

        <section aria-labelledby="questions-title" className="vyro-faq-section"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-10 sm:py-20 lg:grid-cols-[.7fr_1.3fr]"><div className="vyro-reveal"><p className="vyro-section-kicker">Common questions</p><h2 id="questions-title">A few things to know.</h2><p>This page gives an overview of VYRO and the example screens.</p></div><div className="vyro-faq-list vyro-reveal"><details><summary>What does VYRO bring together?</summary><p>VYRO covers sales, POS, purchasing, products, inventory, finance, CRM, HR, projects, documents, reports and company administration in one ERP workspace.</p></details><details><summary>How do the modules work together?</summary><p>Records can move through connected workflows. For example, a quotation can become a sales order, then a delivery, invoice and payment record.</p></details><details><summary>Can teams work across multiple branches?</summary><p>The workspace includes branch-aware records, branch switching, company-wide views and role-based access controls.</p></details><details><summary>Are the figures in the dashboard preview live?</summary><p>No. The dashboard is an illustrative product preview. Your workspace shows data available to your account.</p></details></div></div></section>

        <section id="inquiry" aria-labelledby="inquiry-title" className="vyro-inquiry-section scroll-mt-6"><div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-10 sm:py-20 lg:grid-cols-[.72fr_1.28fr]"><div className="vyro-inquiry-intro vyro-reveal"><p className="vyro-section-kicker">Talk with our team</p><h2 id="inquiry-title">Tell us what your business needs.</h2><p>Share a few details and the parts of VYRO you’re interested in. We’ll help you find the right place to start.</p><div className="vyro-inquiry-points"><span><Check size={16} /> Sales and operations</span><span><Check size={16} /> Multi-branch setup</span><span><Check size={16} /> Product questions</span></div></div><div className="vyro-inquiry-card vyro-reveal"><div className="vyro-inquiry-card-head"><h3>Send an inquiry</h3><p>Frontend preview only. The form stores entries in this browser.</p></div><InquiryForm /></div></div></section>

        <section className="vyro-final-cta vyro-reveal"><div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-12 sm:flex-row sm:items-center sm:px-10"><div><p className="text-sm font-medium text-violet-200">VYRO ERP</p><h2>Ready to get to work?</h2><p>Sign in with the account provided by your company.</p></div><Link to="/login" className="vyro-final-button">Go to login <ChevronRight size={17} /></Link></div></section>
      </main>

      <footer className="vyro-footer"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-10"><Link to="/" className="flex items-center gap-2 font-bold tracking-[.12em] text-slate-800"><img src={vyroIcon} alt="" width={24} height={24} /> VYRO</Link><p>Sales, stock, accounts and people. Connected.</p><address className="flex flex-wrap gap-x-4 not-italic"><a href="tel:+94117275300">+94 11 727 5300 (Hotline)</a><a href="mailto:info@vyro.com">info@vyro.com</a></address><p>© {new Date().getFullYear()} VYRO</p></div></footer>
    </div>
  );
}
