'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Badge, MetricCard, Panel } from '@/components/ui';
import { useToast } from '@/components/toast';
import { useDemoUser } from '@/lib/auth';
import { useWorkflowItems, type WorkflowItem } from '@/lib/workflow-store';
import { usePaymentRecords } from '@/lib/payment-store';
import { money, cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, PauseCircle, Plus, Search, WalletCards, Calendar, CreditCard, Receipt, Clock, FileText } from 'lucide-react';

const pageSize = 7;

function paymentTone(status: string) {
  if (status === 'Pending') return 'amber' as const;
  if (status === 'Overdue') return 'rose' as const;
  if (status === 'Partially Paid') return 'amber' as const;
  if (status === 'Paid' || status === 'Ready' || status === 'Success') return 'emerald' as const;
  if (status === 'Failed' || status === 'Payment Failed') return 'rose' as const;
  if (status === 'Hold' || status === 'On Hold') return 'amber' as const;
  return 'slate' as const;
}

export default function PaymentsPage() {
  const user = useDemoUser();
  const { items, update } = useWorkflowItems();
  const { records } = usePaymentRecords();
  const params = useSearchParams();
  const invoiceId = params?.get('invoiceId') ?? '';
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paymentStructureFilter, setPaymentStructureFilter] = useState('all');
  const [page, setPage] = useState(1);

  const rows = useMemo(
    () => items.filter((item) => ['Queued for Payment', 'Paid', 'Payment Failed'].includes(item.status) || ['Ready', 'Paid', 'Failed'].includes(item.paymentStatus)),
    [items],
  );
  const readyRows = rows.filter((item) => item.paymentStatus === 'Ready');
  const paid = rows.filter((item) => item.paymentStatus === 'Paid').length;
  const failedCount = rows.filter((item) => item.paymentStatus === 'Failed').length;
  const heldCount = rows.filter((item) => item.paymentStatus === 'Hold').length;
  const invoiceRecords = useMemo(() => (invoiceId ? records.filter((record) => record.invoiceId === invoiceId) : []), [invoiceId, records]);

  // Enterprise Installment Analytics
  const selectedWorkflowItem = useMemo(() => items.find((i) => i.id === invoiceId), [items, invoiceId]);
  const instStats = useMemo(() => {
    if (!selectedWorkflowItem) return null;
    
    const schedule = selectedWorkflowItem.installmentSchedule || [];
    const invoiceAmount = selectedWorkflowItem.invoiceAmount;
    const gstAmount = selectedWorkflowItem.gstAmount || 0;

    // Aggregate TDS and Charges from associated payment records
    const tdsAmount = invoiceRecords.reduce((sum, r) => sum + (r.taxDeduction || 0), 0);
    const bankCharges = invoiceRecords.reduce((sum, r) => sum + (r.bankCharge || 0), 0);

    // Enterprise Calculation: Final Payable
    const finalPayable = invoiceAmount + gstAmount + bankCharges - tdsAmount;
    
    const totalPaid = schedule.length > 0
      ? schedule.filter(s => s.status === 'Paid').reduce((sum, s) => sum + s.amount, 0)
      : (selectedWorkflowItem.paymentStatus === 'Paid' ? finalPayable : 0);

    const remainingBalance = finalPayable - totalPaid;
    const next = schedule.find(s => s.status !== 'Paid');
    const monthly = selectedWorkflowItem.monthlyInstallmentAmount || (finalPayable / (selectedWorkflowItem.installmentMonths || 1));
    
    return { invoiceAmount, gstAmount, tdsAmount, bankCharges, finalPayable, totalPaid, remainingBalance, nextDue: next?.dueDate, monthly };
  }, [selectedWorkflowItem]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((item) => {
      const byStatus = statusFilter === 'All' || item.paymentStatus === statusFilter || item.status === statusFilter;
      
      const structureMatch = paymentStructureFilter === 'all' || 
                             (paymentStructureFilter === 'full' && (item.paymentStructure === 'full' || !item.paymentStructure)) ||
                             (paymentStructureFilter === 'installment' && item.paymentStructure === 'installment');

      // Combined Search Logic: Invoice #, Vendor, Ref ID, and UTR Number from schedule
      const utrs = (item.installmentSchedule || []).map(s => s.utrNumber).filter(Boolean).join(' ');
      const searchFields = `${item.invoiceNumber} ${item.vendorName} ${item.id} ${utrs} ${item.paymentMode} ${item.status} ${item.paymentStatus}`.toLowerCase();

      return byStatus && structureMatch && (!q || searchFields.includes(q));
    });
  }, [query, rows, statusFilter, paymentStructureFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function execute(item: WorkflowItem, result: 'success' | 'failed' | 'hold') {
    if (result === 'success') {
      if (item.paymentStructure === 'installment' && item.installmentSchedule) {
        const schedule = [...item.installmentSchedule].map(s => ({ ...s }));
        // Find first non-paid installment (Pending or Overdue)
        const nextIdx = schedule.findIndex(s => s.status !== 'Paid');
        
        if (nextIdx !== -1) {
          const inst = schedule[nextIdx];
          const now = new Date().toISOString().split('T')[0];
          
          // Enterprise logic: Update specific installment record
          schedule[nextIdx] = {
            ...inst,
            status: 'Paid',
            paidAmount: inst.amount,
            remainingAmount: 0,
            paidDate: now
          };

          const allPaid = schedule.every(s => s.status === 'Paid');
          const totalPaidSoFar = schedule.filter(s => s.status === 'Paid').reduce((sum, s) => sum + s.amount, 0);
          const totalInvoiceValue = item.invoiceAmount + (item.gstAmount || 0);
          
          update(item.id, { 
            installmentSchedule: schedule,
            status: allPaid ? 'Paid' : 'Queued for Payment',
            paymentStatus: allPaid ? 'Paid' : 'Ready',
            erpSyncStatus: allPaid ? 'Synced' : 'Pending',
            paidInstallmentAmount: totalPaidSoFar,
            remainingInstallmentBalance: totalInvoiceValue - totalPaidSoFar,
            completedInstallments: schedule.filter(s => s.status === 'Paid').length,
            pendingInstallments: schedule.filter(s => s.status !== 'Paid').length
            // Metadata updates for ledger summary visibility
          }, user.role);

          toast({ 
            type: 'success', 
            title: allPaid ? 'Final Installment Paid' : `Installment #${inst.installmentNo} Success`, 
            description: allPaid ? `Liability for ${item.invoiceNumber} fully settled.` : `Paid ${money(inst.amount)}. Next due: ${schedule.find(s => s.status !== 'Paid')?.dueDate || 'N/A'}`
          });
          return;
        }
      }
      update(item.id, { status: 'Paid', paymentStatus: 'Paid', erpSyncStatus: 'Synced' }, user.role);
      toast({ type: 'success', title: 'Payment completed', description: `${item.invoiceNumber} was paid and synced to ERP.` });
    }
    if (result === 'failed') {
      update(item.id, { status: 'Payment Failed', paymentStatus: 'Failed', erpSyncStatus: 'Pending' }, user.role);
      toast({ type: 'error', title: 'Payment failed', description: `${item.invoiceNumber} needs retry or investigation.` });
    }
    if (result === 'hold') {
      update(item.id, { status: 'On Hold', paymentStatus: 'Hold', erpSyncStatus: 'Pending' }, user.role);
      toast({ type: 'warning', title: 'Payment held', description: `${item.invoiceNumber} was placed on hold.` });
    }
  }

  return (
    <div className="space-y-5">
      <Panel
        title="Payment workspace"
        subtitle="Finance Head creates payment instructions only for invoices already approved by L1, L2, or L3."
        action={<Link href="/payments/create" className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"><Plus size={16} />Create payment</Link>}
      >
        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard label="Approved ready" value={readyRows.length} icon={<WalletCards size={18} />} tone="cyan" />
          <MetricCard label="Paid and synced" value={paid} icon={<CheckCircle2 size={18} />} tone="emerald" />
          <MetricCard label="Failures" value={failedCount} icon={<AlertTriangle size={18} />} tone="rose" />
          <MetricCard label="Held" value={heldCount} icon={<PauseCircle size={18} />} tone="amber" />
        </div>
      </Panel>

      {invoiceId && (
        <div className="space-y-4">
          {instStats && (
            <div className="grid gap-2.5 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9">
              <MetricCard label="Total Invoice" value={money(instStats.invoiceAmount)} tone="slate" icon={<FileText size={14} />} />
              <MetricCard label="GST Amount" value={money(instStats.gstAmount)} tone="violet" icon={<Receipt size={14} />} />
              <MetricCard label="TDS Amount" value={`- ${money(instStats.tdsAmount)}`} tone="rose" icon={<Receipt size={14} />} />
              <MetricCard label="Bank Charges" value={money(instStats.bankCharges)} tone="slate" icon={<CreditCard size={14} />} />
              <MetricCard label="Final Payable" value={money(instStats.finalPayable)} tone="cyan" icon={<WalletCards size={14} />} />
              <MetricCard label="Monthly Inst." value={money(instStats.monthly)} tone="cyan" icon={<CreditCard size={14} />} />
              <MetricCard label="Total Paid" value={money(instStats.totalPaid)} tone="emerald" icon={<CheckCircle2 size={14} />} />
              <MetricCard label="Remaining" value={money(instStats.remainingBalance)} tone="amber" icon={<WalletCards size={14} />} />
              <MetricCard label="Next Due" value={instStats.nextDue ? new Date(instStats.nextDue).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'N/A'} tone={instStats.nextDue && new Date(instStats.nextDue) < new Date() ? "rose" : "amber"} icon={<Calendar size={14} />} />
            </div>
          )}
          
          <Panel title={`Payment history for ${selectedWorkflowItem?.invoiceNumber ?? invoiceId}`} subtitle="All historical transactions linked to this specific invoice ledger.">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-400">{invoiceRecords.length} transactional record{invoiceRecords.length === 1 ? '' : 's'} identified.</p>
              <Link href="/payments" className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10">Clear selection</Link>
            </div>
            <div className="mt-4 overflow-auto">
              <table className="min-w-[1050px] w-full border-separate border-spacing-0 text-left text-sm">
                <thead><tr className="text-xs uppercase tracking-[0.14em] text-slate-500"><th className="border-b border-white/10 px-3 py-3">Transaction ID</th><th className="border-b border-white/10 px-3 py-3">Invoice</th><th className="border-b border-white/10 px-3 py-3">Vendor</th><th className="border-b border-white/10 px-3 py-3 text-right">Settled Amount</th><th className="border-b border-white/10 px-3 py-3 text-center">Method</th><th className="border-b border-white/10 px-3 py-3 text-center">Status</th><th className="border-b border-white/10 px-3 py-3 text-center">ERP Sync</th><th className="border-b border-white/10 px-3 py-3">Date</th></tr></thead>
                <tbody>{invoiceRecords.map((record) => <tr key={record.id} className="hover:bg-white/[0.03]"><td className="border-b border-white/5 px-3 py-4 font-mono text-xs text-slate-400">{record.id}</td><td className="border-b border-white/5 px-3 py-4 font-semibold text-white">{record.invoiceNumber}</td><td className="border-b border-white/5 px-3 py-4 text-slate-300">{record.vendorName}</td><td className="border-b border-white/5 px-3 py-4 text-right tabular-nums text-slate-200">{money(record.amount)}</td><td className="border-b border-white/5 px-3 py-4 text-center"><Badge tone="violet">{record.paymentMode}</Badge></td><td className="border-b border-white/5 px-3 py-4 text-center"><Badge tone={paymentTone(record.status)}>{record.status}</Badge></td><td className="border-b border-white/5 px-3 py-4 text-center"><Badge tone={record.erpSyncStatus === 'Synced' ? 'emerald' : 'amber'}>{record.erpSyncStatus}</Badge></td><td className="border-b border-white/5 px-3 py-4 text-slate-400">{new Date(record.initiatedAt).toLocaleDateString('en-IN')}</td></tr>)}</tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      <Panel
        title={`Approved payment queue (${filteredRows.length})`}
        subtitle="Filter and paginate invoices approved by L1/L2/L3 before creating or executing payments."
        action={
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                value={query} 
                onChange={(event) => { setQuery(event.target.value); setPage(1); }} 
                placeholder="Search invoice, vendor, ref or UTR..." 
                className="w-80 rounded-xl border border-white/10 bg-slate-950/50 py-2 pl-10 pr-3 text-sm outline-none transition-all focus:border-cyan-400/40 focus:bg-slate-950/80" 
              />
            </div>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm outline-none">
              {['All', 'Ready', 'Paid', 'Failed', 'Hold', 'Queued for Payment', 'Payment Failed'].map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-white/5 pb-5">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All Payments' },
              { id: 'full', label: 'Full Payment' },
              { id: 'installment', label: 'Installment Payment' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => { setPaymentStructureFilter(opt.id); setPage(1); }}
                className={cn(
                  "rounded-xl px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all border",
                  paymentStructureFilter === opt.id
                    ? "bg-cyan-400/10 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.1)]"
                    : "bg-slate-900/40 border-white/5 text-slate-400 hover:bg-white/5 hover:border-white/10"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Showing <span className="text-slate-200">{filteredRows.length}</span> payments
          </div>
        </div>
        <div className="overflow-auto">
          <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead><tr className="text-xs uppercase tracking-[0.14em] text-slate-500"><th className="border-b border-white/10 px-3 py-3">Invoice</th><th className="border-b border-white/10 px-3 py-3">Vendor</th><th className="border-b border-white/10 px-3 py-3">Amount</th><th className="border-b border-white/10 px-3 py-3 text-center">Structure</th><th className="border-b border-white/10 px-3 py-3">Mode</th><th className="border-b border-white/10 px-3 py-3">Approval status</th><th className="border-b border-white/10 px-3 py-3">Payment status</th><th className="border-b border-white/10 px-3 py-3">ERP</th><th className="border-b border-white/10 px-3 py-3">Action</th></tr></thead>
            <tbody>
              {pageRows.map((item) => {
                const nextInst = item.paymentStructure === 'installment' 
                  ? item.installmentSchedule?.find(s => s.status !== 'Paid') 
                  : null;
                
                return (
                  <tr key={item.id} className="hover:bg-white/[0.03]">
                    <td className="border-b border-white/5 px-3 py-4 font-medium text-white">{item.invoiceNumber}<div className="text-xs text-slate-500">{item.approvalLevel} approved route</div></td>
                    <td className="border-b border-white/5 px-3 py-4 text-slate-300">{item.vendorName}</td>
                    <td className="border-b border-white/5 px-3 py-4 text-slate-200">{money(item.invoiceAmount)}<div className="text-xs text-slate-500">GST {money(item.gstAmount)}</div></td>
                    <td className="border-b border-white/5 px-3 py-4 text-center">
                      <Badge tone={item.paymentStructure === 'installment' ? 'violet' : 'cyan'}>
                        {item.paymentStructure === 'installment' ? 'Installment Payment' : 'Full Payment'}
                      </Badge>
                    </td>
                    <td className="border-b border-white/5 px-3 py-4"><Badge tone="violet">{item.paymentMode}</Badge></td>
                    <td className="border-b border-white/5 px-3 py-4"><Badge tone={item.status === 'Payment Failed' ? 'rose' : item.status === 'On Hold' ? 'amber' : 'emerald'}>{item.status}</Badge></td>
                    <td className="border-b border-white/5 px-3 py-4"><Badge tone={paymentTone(item.paymentStatus)}>{item.paymentStatus}</Badge></td>
                    <td className="border-b border-white/5 px-3 py-4"><Badge tone={item.erpSyncStatus === 'Synced' ? 'emerald' : 'amber'}>{item.erpSyncStatus}</Badge></td>
                    <td className="border-b border-white/5 px-3 py-4">
                      <div className="flex flex-wrap gap-2">
                        {item.paymentStatus === 'Ready' && <Link href={`/payments/create?invoiceId=${encodeURIComponent(item.id)}`} className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-200">Create</Link>}
                        <button onClick={() => execute(item, 'success')} className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-400/15">
                          {nextInst ? `Pay Inst. #${nextInst.installmentNo}` : 'Success'}
                        </button>
                      <button onClick={() => execute(item, 'failed')} className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-400/15">Fail</button>
                      <button onClick={() => execute(item, 'hold')} className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/15">Hold</button>
                    </div>
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-500">No payments found for selected filter</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-400">Page {currentPage} of {totalPages}</div>
          <div className="flex gap-2">
            <button disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 disabled:opacity-40">Previous</button>
            <button disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 disabled:opacity-40">Next</button>
          </div>
        </div>
      </Panel>

      <Panel title={`Payment ledger (${records.length})`} subtitle="Created payment instructions remain searchable from the payment records store.">
        <div className="overflow-auto">
          <table className="min-w-[1280px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-[10px] uppercase font-bold tracking-widest text-slate-500">
                <th className="border-b border-white/10 px-3 py-3">Payment ID</th>
                <th className="border-b border-white/10 px-3 py-3">Reference</th>
                <th className="border-b border-white/10 px-3 py-3 text-right">Total Liability</th>
                <th className="border-b border-white/10 px-3 py-3 text-center">Strategy</th>
                <th className="border-b border-white/10 px-3 py-3 text-center">Tenure</th>
                <th className="border-b border-white/10 px-3 py-3">Next Due</th>
                <th className="border-b border-white/10 px-3 py-3 text-right">Balance</th>
                <th className="border-b border-white/10 px-3 py-3 text-center">Status</th>
                <th className="border-b border-white/10 px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {records.slice(0, 12).map((record) => {
                const isInstallment = record.paymentStructure === 'installment';
                const schedule = record.installmentSchedule || [];
                const totalLiability = isInstallment ? (record as any).finalPayable || record.amount : record.amount;
                
                const paidCount = schedule.filter((i) => i.status === 'Paid').length;
                const nextDueItem = schedule.find((i) => i.status === 'Pending' || i.status === 'Overdue');
                const balance = schedule.filter((i) => i.status !== 'Paid').reduce((sum, i) => sum + i.amount, 0);

                return (
                  <tr key={record.id} className="hover:bg-white/[0.03] group">
                    <td className="border-b border-white/5 px-3 py-4 font-mono text-xs text-slate-400">{record.id}</td>
                    <td className="border-b border-white/5 px-3 py-4">
                      <div className="font-semibold text-white">{record.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-500 font-medium truncate max-w-[150px]">{record.vendorName}</div>
                    </td>
                    <td className="border-b border-white/5 px-3 py-4 text-right tabular-nums font-bold text-slate-200">{money(totalLiability)}</td>
                    <td className="border-b border-white/5 px-3 py-4 text-center">
                      <Badge tone={isInstallment ? 'cyan' : 'emerald'}>{isInstallment ? 'Installment' : 'Full'}</Badge>
                    </td>
                    <td className="border-b border-white/5 px-3 py-4 text-center text-xs text-slate-400 font-medium">
                      {isInstallment ? `${paidCount} / ${schedule.length}` : '1 / 1'}
                    </td>
                    <td className="border-b border-white/5 px-3 py-4 text-xs font-mono text-slate-300">
                      {nextDueItem?.dueDate ? new Date(nextDueItem.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : (isInstallment ? '-' : 'N/A')}
                    </td>
                    <td className="border-b border-white/5 px-3 py-4 text-right tabular-nums font-semibold text-slate-400">
                      {isInstallment ? money(balance) : money(0)}
                    </td>
                    <td className="border-b border-white/5 px-3 py-4 text-center"><Badge tone={paymentTone(record.status)}>{record.status}</Badge></td>
                    <td className="border-b border-white/5 px-3 py-4 text-right">
                      <Link href={`/payments/create?invoiceId=${encodeURIComponent(record.invoiceId)}`} className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs font-bold text-cyan-200 opacity-80 group-hover:opacity-100 transition">View</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
