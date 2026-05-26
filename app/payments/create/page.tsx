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
  installments: InstallmentSchedule[];
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

function SummaryMetric({ label, value, tone = 'slate', bold = false }: { label: string; value: string | number; tone?: 'slate' | 'emerald' | 'amber' | 'rose' | 'violet' | 'cyan'; bold?: boolean }) {
  return (
    <div className="rounded-lg border border-white/5 bg-slate-900/50 p-3 shadow-sm transition hover:bg-slate-900/80">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className={cn("text-sm tabular-nums truncate", bold ? "font-bold text-white" : "text-slate-200")}>{value}</div>
    </div>
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
  const todayDate = new Date().toISOString().slice(0, 10);
  const [paymentStructure, setPaymentStructure] = useState<'full' | 'installment'>('full');
  const [installmentMonths, setInstallmentMonths] = useState(12);
  const [installmentStartDate, setInstallmentStartDate] = useState(todayDate);
  const paymentDraftKey = useMemo(() => 'payment:auto-save:create', []);

  const readyItems = useMemo(() => items.filter((item) => item.paymentStatus === 'Ready' || item.status === 'Queued for Payment'), [items]);
  const selectedItem = useMemo(() => items.find((item) => item.id === selectedInvoiceId), [items, selectedInvoiceId]);
  const existingPending = items.filter((item) => item.paymentStatus === 'Ready' || item.status === 'Queued for Payment').length;

  const installmentBreakdown = useMemo(() => {
    const total = Number(form.totalInstallmentAmount || 0);
    const months = Number(form.installmentDuration || 1);

    if (form.paymentType !== 'Installment' || months <= 0 || !form.installmentStartDate) return null;

    const perInstallment = Number((total / months).toFixed(2));

    const schedule: InstallmentSchedule[] = [];
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
        id: `INST-${i+1}-${Date.now()}`,
        installmentNo: i + 1,
        dueDate: dueDate.toISOString().slice(0, 10),
        amount,
        paidAmount: 0,
        remainingAmount: amount,
        status: 'Pending',
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

      // Use the approved schedule from the workflow item
      const installmentEntries: InstallmentSchedule[] = (selectedItem.installmentSchedule ?? []).map((inst) => ({
        ...inst,
      }));

      setPaymentStructure(selectedItem.paymentStructure ?? 'full');
      setInstallmentMonths(selectedItem.installmentMonths ?? 1);
      setInstallmentStartDate(selectedItem.installmentStartDate ?? new Date().toISOString().slice(0, 10));

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

  const calculations = useMemo(() => {
    const invoiceAmount = selectedItem?.invoiceAmount || 0;
    const gstAmount = selectedItem?.gstAmount || 0;
    const tdsAmount = form.taxDeduction || 0;
    const bankCharges = form.bankCharge || 0;
    const finalPayable = invoiceAmount + gstAmount + bankCharges - tdsAmount;
    const monthlyInstallment = paymentStructure === 'installment' ? (finalPayable / (installmentMonths || 1)) : finalPayable;
    
    return { 
      finalPayable, 
      monthlyInstallment, 
      tdsAmount, 
      bankCharges, 
      invoiceAmount 
    };
  }, [selectedItem, form.taxDeduction, form.bankCharge, paymentStructure, installmentMonths]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const { finalPayable, monthlyInstallment, tdsAmount, bankCharges } = calculations;

    // Enterprise Validation Rules
    if (!selectedItem) {
      toast({ type: 'error', title: 'Selection Required', description: 'Select an approved invoice to process payment.' });
      return;
    }

    if (isNaN(finalPayable) || finalPayable < 0) {
      toast({ type: 'error', title: 'Invalid Total', description: 'Final payable amount cannot be negative or NaN.' });
      return;
    }

    if (paymentStructure === 'installment') {
      if (installmentMonths <= 0) {
        toast({ type: 'error', title: 'Invalid Tenure', description: 'Installment duration must be at least 1 month.' });
        return;
      }
      if (!installmentStartDate) {
        toast({ type: 'error', title: 'Date Required', description: 'Installment start date is mandatory for schedule generation.' });
        return;
      }
      if (form.installments.length === 0) {
        toast({ type: 'error', title: 'Schedule Empty', description: 'Amortization schedule must be generated before saving.' });
        return;
      }
    }

    if (!form.bankName || !form.ifsc || !form.bankAccountMasked) {
      toast({ type: 'error', title: 'Banking Error', description: 'Beneficiary bank details are required for clearing.' });
      return;
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
      netPaid: paymentStructure === 'installment' ? monthlyInstallment : finalPayable,
      ledgerStatus: form.ledgerStatus,
      erpSyncStatus: form.erpSyncStatus,
      holdFlag: form.holdFlag,
      holdReason: form.holdReason,
      priority: form.priority,
      paymentGateway: form.paymentGateway,
      paymentStructure: paymentStructure,
      installmentMonths: installmentMonths,
      installmentSchedule: form.installments,
      monthlyInstallmentAmount: monthlyInstallment,
      remainingBalance: finalPayable,
      gstAmount: selectedItem?.gstAmount || 0,
      tdsAmount: tdsAmount,
      bankCharges: bankCharges,
      finalPayable: finalPayable,
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
      <form onSubmit={submit} className="space-y-5">
        {/* 1. Approved Invoice Selector */}
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

        {paymentStructure === 'installment' && form.installments && form.installments.length > 0 && (
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
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryMetric label="Taxable Amount" value={money(calculations.invoiceAmount)} />
              <SummaryMetric label="GST Component" value={money(selectedItem?.gstAmount || 0)} tone="violet" />
              <SummaryMetric label="Bank Processing" value={money(calculations.bankCharges)} />
              <SummaryMetric label="TDS (Deduction)" value={`- ${money(calculations.tdsAmount)}`} tone="rose" />
            </div>
            
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    {paymentStructure === 'installment' ? 'Current Installment' : 'Total Net Payable'}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {money(paymentStructure === 'installment' ? calculations.monthlyInstallment : calculations.finalPayable)}
                  </div>
                </div>
                <Badge tone={form.status === 'Pending' ? 'amber' : 'emerald'}>{form.status}</Badge>
              </div>
              <div className="mt-3 text-sm text-slate-400">Net payment accounts for Gross Invoice value (Subtotal + GST) plus processing fees, less statutory deductions.</div>
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
            <Save size={16} /> Create Payment
          </button>
        </div>
      </form>
    </div>
  );
}