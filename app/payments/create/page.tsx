'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { clearDraft, readDraft, useFormDraftAutoSave } from '@/lib/form-draft-store';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge, Panel } from '@/components/ui';
import { useToast } from '@/components/toast';
import { useDemoUser } from '@/lib/auth';
import { usePaymentRecords } from '@/lib/payment-store';
import { useWorkflowItems, type WorkflowItem } from '@/lib/workflow-store';
import { money, cn } from '@/lib/utils';
import type { InstallmentSchedule } from '@/lib/types';
import { ArrowLeft, CalendarDays, FileText, RotateCcw, Save, WalletCards } from 'lucide-react';

const paymentMethods = ['RTGS', 'NEFT', 'UPI', 'Cheque', 'Manual Bank Transfer'] as const;

type PaymentMethod = (typeof paymentMethods)[number];

type InstallmentEntry = {
  installmentNo: number;
  dueDate: string;
  amount: number;
  status: 'Pending' | 'Paid' | 'Overdue';
  remainingBalance: number;
};

type PaymentForm = {
  invoiceId: string;
  invoiceNumber: string;
  vendorId: string;
  vendorName: string;
  beneficiaryName: string;
  amount: number;
  currency: string;
  paymentMode: PaymentMethod;
  bankName: string;
  bankAccountMasked: string;
  ifsc: string;
  utrNo: string;
  clearingChannel: string;
  failureReason: string;
  retryCount: number;
  initiatedBy: string;
  approvedBy: string;
  remittanceNote: string;
  taxDeduction: number;
  bankCharge: number;
  netPaid: number;
  ledgerStatus: string;
  erpSyncStatus: string;
  holdFlag: string;
  holdReason: string;
  priority: 'Low' | 'Medium' | 'High';
  paymentGateway: string;
  remarks: string;
  paymentType: 'Full' | 'Installment';
  totalInstallmentAmount: number;
  installmentDuration: number;
  installmentStartDate: string;
  installmentFrequency: 'Monthly' | 'Quarterly';
  status: 'Pending' | 'Ready' | 'Processing' | 'Success' | 'Failed' | 'Hold' | 'Cancelled';
  installments: InstallmentEntry[];
};

const emptyForm: PaymentForm = {
  invoiceId: '',
  invoiceNumber: '',
  vendorId: '',
  vendorName: '',
  beneficiaryName: '',
  amount: 0,
  currency: 'INR',
  paymentMode: 'NEFT',
  bankName: '',
  bankAccountMasked: '',
  ifsc: '',
  utrNo: '',
  clearingChannel: 'NPCI',
  failureReason: '',
  retryCount: 0,
  initiatedBy: 'Treasury Desk',
  approvedBy: '',
  remittanceNote: 'Invoice settlement',
  taxDeduction: 0,
  bankCharge: 0,
  netPaid: 0,
  ledgerStatus: 'Pending',
  erpSyncStatus: 'Pending',
  holdFlag: 'No',
  holdReason: '',
  priority: 'Medium',
  paymentGateway: 'Core Banking',
  remarks: '',
  paymentType: 'Full',
  totalInstallmentAmount: 0,
  installmentDuration: 3,
  installmentStartDate: new Date().toISOString().slice(0, 10),
  installmentFrequency: 'Monthly',
  status: 'Pending',
  installments: [],
};

function InputField({ label, value, onChange, type = 'text', required = true, help }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; required?: boolean; help?: string }) {
  return (
    <label className="text-sm text-slate-300">
      {label}
      <input
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none transition focus:border-cyan-400/30"
      />
      {help && <div className="mt-2 text-xs text-slate-500">{help}</div>}
    </label>
  );
}

export default function CreatePaymentPage() {
  const user = useDemoUser();
  const params = useSearchParams();
  const invoiceId = params?.get('invoiceId') ?? '';
  const router = useRouter();
  const toast = useToast();
  const { items, update } = useWorkflowItems();
  const { create } = usePaymentRecords();
  const [form, setForm] = useState<PaymentForm>(emptyForm);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(invoiceId);
  const paymentDraftKey = useMemo(() => 'payment:auto-save:create', []);

  const readyItems = useMemo(() => items.filter((item) => item.paymentStatus === 'Ready' || item.status === 'Queued for Payment'), [items]);
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedInvoiceId), [items, selectedInvoiceId]);
  const existingPending = items.filter((item) => item.paymentStatus === 'Ready' || item.status === 'Queued for Payment').length;

  const installmentBreakdown = useMemo(() => {
    const total = Number(form.totalInstallmentAmount || 0);
    const months = Number(form.installmentDuration || 1);

    if (form.paymentType !== 'Installment' || months <= 0 || !form.installmentStartDate) return null;

    const perInstallment = Number((total / months).toFixed(2));

    const schedule: InstallmentEntry[] = [];
    const start = new Date(form.installmentStartDate);
    let currentBalance = total;

    for (let i = 0; i < months; i++) {
      const dueDate = new Date(start);
      const monthsToAdd = form.installmentFrequency === 'Monthly' ? i : i * 3;
      dueDate.setMonth(start.getMonth() + monthsToAdd);

      const isLast = i === months - 1;
      // Last installment adjusts for rounding discrepancies to ensure ledger balance
      const amount = isLast 
        ? Number(currentBalance.toFixed(2))
        : perInstallment;

      currentBalance -= amount;

      schedule.push({ 
        installmentNo: i + 1, 
        dueDate: dueDate.toISOString().slice(0, 10), 
        amount, 
        status: 'Pending',
        remainingBalance: Number(Math.max(0, currentBalance).toFixed(2))
      });
    }

    return { perInstallment, schedule };
  }, [form.paymentType, form.totalInstallmentAmount, form.installmentDuration, form.installmentStartDate, form.installmentFrequency]);

  const installmentStats = useMemo(() => {
    if (!installmentBreakdown) return null;
    const { schedule } = installmentBreakdown;
    const totalPaid = schedule.filter(i => i.status === 'Paid').reduce((sum, i) => sum + i.amount, 0);
    const pendingAmount = schedule.filter(i => i.status === 'Pending').reduce((sum, i) => sum + i.amount, 0);
    const remainingBalance = schedule.filter(i => i.status !== 'Paid').reduce((sum, i) => sum + i.amount, 0);
    const nextDue = schedule.find(i => i.status === 'Pending' || i.status === 'Overdue')?.dueDate;

    return { totalPaid, pendingAmount, remainingBalance, nextDue };
  }, [installmentBreakdown]);

  useEffect(() => {
    // Restore auto-saved payment draft.
    const saved = readDraft<{ form: PaymentForm; selectedInvoiceId: string }>(paymentDraftKey);
    if (!saved) return;
    setForm(saved.form);
    setSelectedInvoiceId(saved.selectedInvoiceId ?? invoiceId);
  }, [paymentDraftKey]);

  useEffect(() => {
    setSelectedInvoiceId(invoiceId);
  }, [invoiceId]);

  useFormDraftAutoSave({
    draftKey: paymentDraftKey,
    enabled: true,
    debounceMs: 450,
    draft: { form, selectedInvoiceId },
  });


  useEffect(() => {
    if (selectedItem) {
      // Determine payment structure and installment details
      const isInstallment = selectedItem.paymentStructure === 'installment';
      const paymentType = isInstallment ? 'Installment' : 'Full';
      const firstInstallmentAmount = isInstallment && selectedItem.installmentSchedule && selectedItem.installmentSchedule.length > 0
        ? selectedItem.installmentSchedule[0].amount
        : selectedItem.invoiceAmount;

      // Transform InstallmentSchedule[] to InstallmentEntry[] (add remainingBalance)
      const installmentEntries: InstallmentEntry[] = (selectedItem.installmentSchedule ?? []).map((inst, idx, arr) => ({
        installmentNo: inst.installmentNo,
        dueDate: inst.dueDate,
        amount: inst.amount,
        status: inst.status,
        remainingBalance: arr.slice(idx + 1).reduce((sum, i) => sum + i.amount, 0),
      }));

      setForm((current) => ({
        ...current,
        invoiceId: selectedItem.id,
        invoiceNumber: selectedItem.invoiceNumber,
        vendorId: `VND-${selectedItem.id}`,
        vendorName: selectedItem.vendorName,
        beneficiaryName: selectedItem.vendorName,
        amount: firstInstallmentAmount,
        totalInstallmentAmount: selectedItem.invoiceAmount,
        paymentMode: selectedItem.paymentMode,
        remittanceNote: `Settlement for ${selectedItem.invoiceNumber}${isInstallment ? ' - Installment 1' : ''}`,
        priority: selectedItem.invoiceAmount > 100000 ? 'High' : selectedItem.invoiceAmount > 10000 ? 'Medium' : 'Low',
        paymentGateway: selectedItem.paymentMode === 'UPI' ? 'NPCI UPI' : selectedItem.paymentMode === 'Manual Bank Transfer' ? 'Bank Transfer' : selectedItem.paymentMode,
        netPaid: firstInstallmentAmount - current.taxDeduction - current.bankCharge,
        paymentType,
        installmentDuration: selectedItem.installmentMonths ?? 1,
        installmentStartDate: selectedItem.installmentStartDate ?? new Date().toISOString().slice(0, 10),
        installments: installmentEntries,
      }));
    } else {
      setForm(emptyForm);
    }
  }, [selectedItem]);

  useEffect(() => {
    // Sync primary amount field with installment engine, or restore to total if Full.
    if (form.paymentType === 'Installment') {
      setForm(current => ({
        ...current,
        amount: installmentBreakdown?.perInstallment || 0
      }));
    } else {
      setForm(current => ({
        ...current,
        amount: current.totalInstallmentAmount
      }));
    }
  }, [form.paymentType, installmentBreakdown?.perInstallment, form.totalInstallmentAmount]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      netPaid: current.amount - current.taxDeduction - current.bankCharge,
    }));
  }, [form.amount, form.taxDeduction, form.bankCharge]);

  function patchForm(patch: Partial<PaymentForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function handleClearForm() {
    setForm(emptyForm);
    setSelectedInvoiceId(invoiceId);
    clearDraft(paymentDraftKey);
    toast({ type: 'success', title: 'Form Cleared', description: 'All entered data has been removed successfully.' });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!selectedItem || (selectedItem.paymentStatus !== 'Ready' && selectedItem.status !== 'Queued for Payment')) {
      toast({ type: 'error', title: 'Approved invoice required', description: 'Select an invoice approved by L1, L2, or L3 before creating payment.' });
      return;
    }
    if (!form.invoiceNumber || !form.vendorName || form.amount <= 0 || !form.paymentMode || !form.bankName || !form.ifsc) {
      toast({ type: 'error', title: 'Missing details', description: 'Complete invoice, vendor, bank, and payment fields before creating the payment.' });
      return;
    }

    // STEP 8: Installment Validation Rules
    if (form.paymentType === 'Installment') {
      if (form.totalInstallmentAmount <= 0) {
        toast({ type: 'error', title: 'Invalid total amount', description: 'Total payable amount is required and must be greater than zero.' });
        return;
      }
      if (form.installmentDuration <= 0) {
        toast({ type: 'error', title: 'Invalid duration', description: 'Installment duration must be at least 1 month.' });
        return;
      }
      if (form.installmentDuration > 60) {
        toast({ type: 'error', title: 'Tenure limit exceeded', description: 'Installment duration cannot exceed 60 months (5 years).' });
        return;
      }
      if (!form.installmentStartDate) {
        toast({ type: 'error', title: 'Missing start date', description: 'The first installment due date is required.' });
        return;
      }
      if (!installmentBreakdown || installmentBreakdown.perInstallment <= 0) {
        toast({ type: 'error', title: 'Calculation error', description: 'Calculated installment amount must be greater than zero. Please check amount and duration.' });
        return;
      }
    }

    create({
      invoiceId: form.invoiceId || `INV-${String(Date.now()).slice(-6)}`,
      invoiceNumber: form.invoiceNumber,
      vendorId: form.vendorId || `VND-${String(Date.now()).slice(-6)}`,
      vendorName: form.vendorName,
      beneficiaryName: form.beneficiaryName || form.vendorName,
      amount: form.amount,
      currency: form.currency,
      paymentMode: form.paymentMode,
      bankName: form.bankName,
      bankAccountMasked: form.bankAccountMasked || 'XXXXXX0000',
      ifsc: form.ifsc,
      utrNo: form.utrNo,
      clearingChannel: form.clearingChannel,
      status: 'Pending',
      failureReason: form.failureReason,
      retryCount: form.retryCount,
      initiatedAt: new Date().toISOString(),
      initiatedBy: form.initiatedBy || user.role,
      approvedBy: form.approvedBy || user.role,
      remittanceNote: form.remittanceNote,
      taxDeduction: form.taxDeduction,
      bankCharge: form.bankCharge,
      netPaid: form.netPaid,
      ledgerStatus: form.ledgerStatus,
      erpSyncStatus: form.erpSyncStatus,
      holdFlag: form.holdFlag,
      holdReason: form.holdReason,
      priority: form.priority,
      paymentGateway: form.paymentGateway,
      paymentType: form.paymentType,
      totalInstallmentAmount: form.totalInstallmentAmount,
      installments: form.paymentType === 'Installment' ? installmentBreakdown?.schedule || [] : [],
      remarks: form.remarks,
    } as any);

    if (selectedItem) {
      update(selectedItem.id, { status: 'Queued for Payment', paymentStatus: 'Ready' }, user.role);
    }

    toast({ type: 'success', title: 'Payment Created', description: `A payment instruction for ${form.invoiceNumber} is now recorded.` });
    clearDraft(paymentDraftKey);
    setForm(emptyForm);
    router.push('/payments');
  }


  return (
    <div className="space-y-5">
      <Panel title="Create payment instruction" subtitle="Payments can be created only after an invoice is approved by L1, L2, or L3 and is ready for Finance Head payment processing.">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-400">{selectedItem ? `Preparing payment for ${selectedItem.invoiceNumber}` : 'Select an approved invoice to begin.'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="emerald">{selectedItem ? selectedItem.approvalLevel : 'Payment'}</Badge>
              <Badge tone={selectedItem?.status === 'Queued for Payment' ? 'emerald' : selectedItem?.status === 'Approved' ? 'cyan' : 'slate'}>{selectedItem?.status ?? 'Draft'}</Badge>
            </div>
          </div>
          <Link href="/payments" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10"><ArrowLeft size={16} /> Back to payments</Link>
        </div>
      </Panel>

      <form onSubmit={submit} className="space-y-5">
        <Panel title="Approved invoice selector" subtitle="Choose from invoices already routed through L1, L2, or L3 approval.">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
            <label className="text-sm text-slate-300">
              Ready invoice
              <select value={selectedInvoiceId} onChange={(event) => setSelectedInvoiceId(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none focus:border-cyan-400/30">
                <option value="">Select approved invoice</option>
                {readyItems.map((item) => <option key={item.id} value={item.id}>{item.invoiceNumber} - {item.vendorName} - {money(item.invoiceAmount)}</option>)}
              </select>
            </label>
            <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Ready invoices</div>
              <div className="mt-2 text-2xl font-semibold text-white">{readyItems.length}</div>
            </div>
          </div>
        </Panel>

        {form.paymentType === 'Installment' && form.installments && form.installments.length > 0 && (
          <Panel title="Installment Payment Schedule" subtitle={`Total ${form.installments.length} installments, Current: #1 of ${form.installments.length}`}>
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-widest text-slate-500">Total amount</div>
                <div className="mt-2 text-2xl font-semibold text-white">{money(form.totalInstallmentAmount)}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-widest text-slate-500">Current installment</div>
                <div className="mt-2 text-2xl font-semibold text-cyan-200">#{form.installments[0]?.installmentNo} - {money(form.installments[0]?.amount ?? 0)}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-widest text-slate-500">Due date</div>
                <div className="mt-2 text-2xl font-semibold text-white">{form.installments[0]?.dueDate || '-'}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-widest text-slate-500">Remaining balance</div>
                <div className="mt-2 text-2xl font-semibold text-amber-200">{money(form.installments.slice(1).reduce((sum, i) => sum + i.amount, 0))}</div>
              </div>
            </div>

            <div className="mt-4 overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Installment</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-slate-400">Due Date</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-widest text-slate-400">Amount</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {form.installments.map((inst, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-slate-300">#{inst.installmentNo}</td>
                      <td className="px-4 py-3 text-slate-300">{inst.dueDate}</td>
                      <td className="px-4 py-3 text-right font-semibold text-cyan-200">{money(inst.amount)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block rounded px-3 py-1 text-xs font-semibold ${
                          inst.status === 'Paid' ? 'bg-emerald-500/20 text-emerald-200' :
                          inst.status === 'Overdue' ? 'bg-red-500/20 text-red-200' :
                          'bg-slate-600/50 text-slate-200'
                        }`}>
                          {inst.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4 space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <InputField 
                label="Invoice number" 
                value={form.invoiceNumber} 
                onChange={(value) => {
                  patchForm({ invoiceNumber: value });
                  // Auto-fetch details if a matching approved invoice is found
                  const match = readyItems.find(item => item.invoiceNumber.trim().toLowerCase() === value.trim().toLowerCase());
                  if (match) {
                    setSelectedInvoiceId(match.id);
                    toast({ type: 'success', title: 'Invoice detected', description: `Details for ${match.invoiceNumber} have been auto-populated.` });
                  }
                }} 
                required 
                type="text" 
              />
              <InputField label="Vendor name" value={form.vendorName} onChange={(value) => patchForm({ vendorName: value })} required type="text" />
              <InputField label="Payment mode" value={form.paymentMode} onChange={(value) => patchForm({ paymentMode: value as PaymentMethod })} type="text" required />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm text-slate-300">
                Payment method
                <select value={form.paymentMode} onChange={(event) => patchForm({ paymentMode: event.target.value as PaymentMethod })} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none focus:border-cyan-400/30">
                  {paymentMethods.map((method) => <option key={method}>{method}</option>)}
                </select>
              </label>
              <InputField label="Invoice amount" value={form.amount} onChange={(value) => patchForm({ amount: Number(value) })} type="number" required />
              <InputField label="Priority" value={form.priority} onChange={(value) => patchForm({ priority: value as PaymentForm['priority'] })} type="text" required />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <InputField label="Beneficiary" value={form.beneficiaryName} onChange={(value) => patchForm({ beneficiaryName: value })} required type="text" />
              <InputField label="Bank name" value={form.bankName} onChange={(value) => patchForm({ bankName: value })} required type="text" />
              <InputField label="Account number" value={form.bankAccountMasked} onChange={(value) => patchForm({ bankAccountMasked: value })} required type="text" help="Mask the account number for security." />
              <InputField label="IFSC" value={form.ifsc} onChange={(value) => patchForm({ ifsc: value.toUpperCase() })} required type="text" />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <InputField label="Tax deduction" value={form.taxDeduction} onChange={(value) => patchForm({ taxDeduction: Number(value) })} type="number" required />
              <InputField label="Bank charge" value={form.bankCharge} onChange={(value) => patchForm({ bankCharge: Number(value) })} type="number" required />
              <InputField label="UTR / Reference" value={form.utrNo} onChange={(value) => patchForm({ utrNo: value })} required={false} type="text" />
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/45 p-4 space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div><div className="text-xs uppercase tracking-[0.18em] text-slate-500">Net payment</div><div className="mt-2 text-2xl font-semibold text-white">{money(form.netPaid)}</div></div>
                <Badge tone={form.status === 'Pending' ? 'amber' : 'emerald'}>{form.status}</Badge>
              </div>
              <div className="mt-3 text-sm text-slate-400">Net payment is calculated as invoice amount less tax deduction and bank charges.</div>
            </div>
            <InputField label="Clearing channel" value={form.clearingChannel} onChange={(value) => patchForm({ clearingChannel: value })} required type="text" />
            <InputField label="Payment gateway" value={form.paymentGateway} onChange={(value) => patchForm({ paymentGateway: value })} required type="text" />
            <label className="text-sm text-slate-300">
              Remittance note
              <textarea
                value={form.remittanceNote}
                onChange={(event) => patchForm({ remittanceNote: event.target.value })}
                className="mt-2 h-28 w-full rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none focus:border-cyan-400/30"
              />
            </label>
            <label className="text-sm text-slate-300">
              Remarks
              <textarea
                value={form.remarks}
                onChange={(event) => patchForm({ remarks: event.target.value })}
                className="mt-2 h-28 w-full rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none focus:border-cyan-400/30"
              />
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={handleClearForm} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/10">
            <RotateCcw size={16} /> Reset form
          </button>
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-6 py-3 text-sm font-medium text-white transition hover:bg-cyan-600">
            <Save size={16} /> Create payment
          </button>
        </div>
      </form>
    </div>
  );
}