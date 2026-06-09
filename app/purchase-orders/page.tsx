'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Badge, Panel, SegmentedControl } from '@/components/ui';
import { useToast } from '@/components/toast';
import { useDemoUser } from '@/lib/auth';
import { demoData } from '@/lib/data';
import { createEmptyLineItem, normalizePurchaseOrder, statusTone, validatePurchaseOrder } from '@/lib/purchase-orders';
import { newPurchaseOrderDraft, usePurchaseOrders } from '@/lib/purchase-order-store';
import { money } from '@/lib/utils';
import type { PurchaseOrder, PurchaseOrderLineItem, Vendor } from '@/lib/types';
import { AlertTriangle, CheckCircle2, ChevronDown, Eye, FileText, ListChecks, Pencil, Plus, RefreshCw, RotateCcw, Save, Search, Trash2, Upload, XCircle } from 'lucide-react';
import { clearDraft, readDraft, useFormDraftAutoSave, writeDraft } from '@/lib/form-draft-store';


type FieldErrors = Partial<Record<keyof PurchaseOrder | 'items', string>>;
type PurchaseOrderView = 'create' | 'list';

const statusOptions: PurchaseOrder['status'][] = ['Draft', 'Issued', 'Approved', 'Partially Received', 'Closed', 'Cancelled'];
const paymentTermOptions = ['Net 30', 'Net 45', 'Advance Payment', 'Partial Payment'];

function cloneDraft(po: PurchaseOrder): PurchaseOrder {
  return {
    ...po,
    items: po.items.map((item) => ({ ...item })),
  };
}

function emptyDraft() {
  return cloneDraft(newPurchaseOrderDraft());
}

function Field({
  label,
  value,
  type = 'text',
  error,
  required = true,
  placeholder,
  onChange,
}: {
  label: string;
  value: string | number;
  type?: string;
  error?: string;
  required?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm text-slate-300">
      {label}
      <input
        required={required}
        value={value}
        type={type}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none transition placeholder:text-slate-600 focus:border-cyan-400/30"
      />
      {error && <span className="mt-1 block text-xs text-rose-300">{error}</span>}
    </label>
  );
}

function TextArea({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm text-slate-300">
      {label}
      <textarea
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-[88px] w-full rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none transition focus:border-cyan-400/30"
      />
      {error && <span className="mt-1 block text-xs text-rose-300">{error}</span>}
    </label>
  );
}

function InfoMetric({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: 'slate' | 'emerald' | 'cyan' | 'amber' }) {
  const classes = {
    slate: 'border-white/10 bg-slate-950/45 text-slate-500',
    emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    cyan: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300',
    amber: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  }[tone];

  return (
    <div className={`rounded-lg border p-4 ${classes}`}>
      <div className="text-xs uppercase tracking-[0.18em]">{label}</div>
      <div className="mt-2 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function matchingTone(status: PurchaseOrder['matchingStatus']) {
  if (status === 'Matched' || status === 'Ready for 3-Way Match') return 'emerald' as const;
  if (status === 'Variance Review') return 'amber' as const;
  return 'cyan' as const;
}

function vendorAddress(vendor: Vendor) {
  return [vendor.city, vendor.state].filter(Boolean).join(', ');
}

export default function PurchaseOrdersPage() {
  const user = useDemoUser();
  const toast = useToast();
  const { items, save, remove, reset } = usePurchaseOrders();
  const [activeView, setActiveView] = useState<PurchaseOrderView>('create');
  const [draft, setDraft] = useState<PurchaseOrder>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('procureflow-po-draft');
      if (saved) return JSON.parse(saved);
    }
    return emptyDraft();
  });

  useEffect(() => {
    localStorage.setItem('procureflow-po-draft', JSON.stringify(draft));
  }, [draft]);

  const [poUploadFile, setPoUploadFile] = useState('');
  const [editingId, setEditingId] = useState<string | undefined>();
  const draftAutoSaveKey = useMemo(() => {
    const modePart = editingId ? `edit:${editingId}` : 'create';
    return `po:auto-save:${modePart}`;
  }, [editingId]);

  const [errors, setErrors] = useState<string[]>([]);

  // Date and Search Filter States
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [singleDate, setSingleDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isQuickFilterDropdownOpen, setIsQuickFilterDropdownOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState('');

  // Filter Helper Functions
  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setSingleDate('');
    setSearchTerm('');
    setActiveFilter('');
    setStatusFilter('All');
    setSortOrder('newest');
  };

  const applyTodayFilter = () => {
    const date = new Date().toISOString().split('T')[0];
    setFromDate(date);
    setToDate(date);
    setSingleDate('');
    setActiveFilter('today');
  };

  const applyThisWeekFilter = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Adjust to Monday
    startOfWeek.setDate(now.getDate() + diff);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    setFromDate(startOfWeek.toISOString().split('T')[0]);
    setToDate(endOfWeek.toISOString().split('T')[0]);
    setSingleDate('');
    setActiveFilter('this_week');
  };

  const applyThisMonthFilter = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    setFromDate(startOfMonth.toISOString().split('T')[0]);
    setToDate(endOfMonth.toISOString().split('T')[0]);
    setSingleDate('');
    setActiveFilter('this_month');
  };

  const applyLastMonthFilter = () => {
    const now = new Date();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    setFromDate(startOfLastMonth.toISOString().split('T')[0]);
    setToDate(endOfLastMonth.toISOString().split('T')[0]);
    setSingleDate('');
    setActiveFilter('last_month');
  };

  const applyFinancialYearFilter = () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    // Indian FY: April to March
    const startYear = month < 3 ? year - 1 : year;

    setFromDate(`${startYear}-04-01`);
    setToDate(`${startYear + 1}-03-31`);
    setSingleDate('');
    setActiveFilter('fy');
  };

  const quickFilterOptions = useMemo(() => [
    { id: 'today', label: 'Today', fn: applyTodayFilter },
    { id: 'this_week', label: 'This Week', fn: applyThisWeekFilter },
    { id: 'this_month', label: 'This Month', fn: applyThisMonthFilter },
    { id: 'last_month', label: 'Last Month', fn: applyLastMonthFilter },
    { id: 'fy', label: 'Indian FY', fn: applyFinancialYearFilter },
  ], [applyTodayFilter, applyThisWeekFilter, applyThisMonthFilter, applyLastMonthFilter, applyFinancialYearFilter]);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(1);

  const isAdmin = user.key === 'admin';
  const normalizedDraft = useMemo(() => normalizePurchaseOrder(draft), [draft]);
  const totalValue = useMemo(() => items.reduce((sum, po) => sum + po.finalTotalAmount, 0), [items]);

  useEffect(() => {
    // Restore auto-saved PO form state when returning to this page.
    // We restore the 'create' bucket by default (edits have their own key).
    const createSaved = readDraft<{
      draft: PurchaseOrder;
      poUploadFile: string;
      editingId?: string;
    }>('po:auto-save:create');


    if (!createSaved) return;

    if (createSaved.editingId) setEditingId(createSaved.editingId);
    setDraft(createSaved.draft);
    setPoUploadFile(createSaved.poUploadFile || '');
    setActiveView('create');
  }, []);

  const filteredData = useMemo(() => {
    const data = items.filter((item) => {
      const itemDate = new Date(item.poDate || (item as any).invoiceDate || new Date());
      
      // Calendar & Quick Filter Logic
      const matchesDate = singleDate
        ? itemDate.toISOString().slice(0, 10) === singleDate
        : (!fromDate || itemDate >= new Date(fromDate)) &&
          (!toDate || itemDate <= new Date(toDate + 'T23:59:59'));

      // Search Logic
      const search = searchTerm.trim().toLowerCase();
      const matchesSearch =
        (item.vendorName || '').toLowerCase().includes(search) ||
        (item.poNumber || '').toLowerCase().includes(search) ||
        ((item as any).invoiceNumber || '').toLowerCase().includes(search);

      // Business Logic (Status)
      const matchesStatus = statusFilter === 'All' || item.status === statusFilter;

      return matchesDate && matchesSearch && matchesStatus;
    });

    return [...data].sort((a, b) => {
      const dateA = new Date(a.poDate || (a as any).invoiceDate || 0).getTime() || 0;
      const dateB = new Date(b.poDate || (b as any).invoiceDate || 0).getTime() || 0;
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [items, fromDate, toDate, singleDate, searchTerm, statusFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / 8));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredData.slice((currentPage - 1) * 8, currentPage * 8);

  function patchDraft(patch: Partial<PurchaseOrder>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  useEffect(() => {
    // Persist PO draft in the background so navigation doesn't wipe entered values.
    // Only saves in the create view (including edit mode when editingId is set).
    writeDraft(draftAutoSaveKey, {

      draft,
      poUploadFile,
      editingId,
    });
  }, [draftAutoSaveKey, draft, poUploadFile, editingId]);


  function updateLine(id: string, patch: Partial<PurchaseOrderLineItem>) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        const quantityOrdered = Number(next.quantityOrdered || 0);
        const unitPrice = Number(next.unitPrice || 0);
        return { ...next, quantityOrdered, unitPrice, totalPrice: quantityOrdered * unitPrice };
      }),
    }));
  }

  function addLine() {
    setDraft((current) => ({ ...current, items: [...current.items, createEmptyLineItem(current.items.length + 1)] }));
  }

  function removeLine(id: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((item) => item.id !== id),
    }));
  }

  function selectVendor(vendorId: string) {
    const vendor = demoData.vendors.find((entry) => entry.id === vendorId);
    if (!vendor) {
      patchDraft({ vendorId: '', vendorName: '' });
      return;
    }

    patchDraft({
      vendorId: vendor.id,
      vendorName: vendor.displayName || vendor.legalName,
      vendorAddress: vendorAddress(vendor),
      vendorContactNumber: vendor.primaryContactPhone,
      vendorEmail: vendor.primaryContactEmail,
      vendorGstDetails: vendor.gstin,
      paymentTerms: vendor.paymentTermsDays ? `Net ${vendor.paymentTermsDays}` : draft.paymentTerms,
      vendorReferenceId: vendor.id,
    });
  }

  function handlePoUpload(fileName?: string) {
    if (!fileName) return;
    setPoUploadFile(fileName);
    patchDraft({
      remarks: [draft.remarks, `Source PO uploaded: ${fileName}`].filter(Boolean).join(' | '),
      status: draft.status === 'Draft' ? 'Issued' : draft.status,
    });
    toast({ type: 'info', title: 'PO attached', description: `${fileName} is linked to this purchase order draft.` });
  }

  function validateDraft() {
    const result = validatePurchaseOrder(draft, items, editingId);
    setErrors(result.errors);
    setFieldErrors(result.fieldErrors);
    toast({
      type: result.valid ? 'success' : 'error',
      title: result.valid ? 'PO Validated' : 'PO Validation Failed',
      description: result.errors[0] ?? 'Purchase order is ready for invoice and GRN matching.',
    });
    return result;
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const result = validateDraft();
    if (!result.valid) return;

    const response = save(normalizedDraft, editingId);
    if (!response.result.valid) {
      setErrors(response.result.errors);
      setFieldErrors(response.result.fieldErrors);
      toast({ type: 'error', title: 'PO Save Failed', description: response.result.errors[0] ?? 'Please correct the PO data.' });
      return;
    }

    toast({
      type: 'success',
      title: editingId ? 'PO Updated' : 'PO Created',
      description: `${response.item.poNumber} is stored with matching-ready quantity, price, GST, and terms fields.`,
    });
    clearDraft(draftAutoSaveKey);
    // Also clear generic create bucket to avoid stale restores.
    clearDraft('po:auto-save:create');

    setDraft(emptyDraft());
    setEditingId(undefined);
    setPoUploadFile('');
    setActiveView('list');
    setErrors([]);
    setPage(1);
    setFieldErrors({});
  }

  function handleClearForm() {
    setDraft(emptyDraft());
    setEditingId(undefined);
    setPoUploadFile('');
    setErrors([]);
    setFieldErrors({});
    clearDraft(draftAutoSaveKey);
    clearDraft('po:auto-save:create');
    toast({ type: 'success', title: 'Form Cleared', description: 'All entered data has been removed successfully.' });
  }

  function edit(po: PurchaseOrder) {
    // Start edit mode with fresh state from selected PO.
    clearDraft(draftAutoSaveKey);
    clearDraft('po:auto-save:create');

    setEditingId(po.id);
    setDraft(cloneDraft(po));
    setActiveView('create');

    setErrors([]);
    setFieldErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function loadDemoPO() {
    const demoItems: PurchaseOrderLineItem[] = [
      {
        id: `demo-line-1-${Date.now()}`,
        itemNumber: '1',
        skuCode: 'LAP-001',
        itemDescription: 'Dell Latitude 5450 Laptop',
        quantityOrdered: 10,
        unitPrice: 65000,
        totalPrice: 650000,
      },
      {
        id: `demo-line-2-${Date.now()}`,
        itemNumber: '2',
        skuCode: 'MON-002',
        itemDescription: 'Dell 24 Inch Monitor',
        quantityOrdered: 15,
        unitPrice: 12000,
        totalPrice: 180000,
      },
      {
        id: `demo-line-3-${Date.now()}`,
        itemNumber: '3',
        skuCode: 'KEY-003',
        itemDescription: 'Wireless Keyboard and Mouse Combo',
        quantityOrdered: 20,
        unitPrice: 2500,
        totalPrice: 50000,
      },
    ];

    // Find a specific vendor from the Vendor Master (searching for '006' pattern)
    const vendor = demoData.vendors.find((v) => v.id.includes('006')) || demoData.vendors[0];

    setDraft((current) => ({
      ...current,
      poNumber: 'PO-2001',
      poDate: '2026-05-18',
      intendedDeliveryDate: '2026-05-18',
      expectedDeliveryDate: '2026-05-18',
      // Populate vendor fields from the master data list instead of hardcoded values
      vendorId: vendor?.id || '',
      vendorName: vendor ? (vendor.displayName || vendor.legalName) : '',
      vendorContactNumber: vendor?.primaryContactPhone || '',
      vendorEmail: vendor?.primaryContactEmail || '',
      vendorGstDetails: vendor?.gstin || '',
      vendorReferenceId: vendor?.id || '',
      vendorAddress: vendor ? vendorAddress(vendor) : '',
      paymentTerms: vendor?.paymentTermsDays ? `Net ${vendor.paymentTermsDays}` : 'Net 30',
      gstRate: 18,

      companyName: 'ProcureFlow X Pvt Ltd',
      departmentName: 'Procurement Department',
      billingAddress: 'Finance Tower, Mumbai, Maharashtra 400001',
      shippingAddress: 'Central Warehouse, Bhiwandi, Maharashtra 421302',
      deliveryChallanNumber: 'DC-5001',
      deliveryChallanDate: '2026-05-18',
      grnReference: 'GRN-3001',
      grnDate: '2026-05-20',
      costCenter: 'PROCUREMENT-001',
      items: demoItems,
      subtotal: 880000,
      taxAmount: 158400,
      gstDetails: 'GST 18%',
      discount: 10000,
      finalTotalAmount: 1028400,
      status: 'Draft',
    }));

    setPoUploadFile('');
    setErrors([]);
    setFieldErrors({});
    toast({
      type: 'success',
      title: 'Demo PO Loaded',
      description: `Realistic procurement data populated for ${vendor?.displayName || 'Demo Vendor'}.`,
    });
  }

  function deletePo(po: PurchaseOrder) {
    remove(po.id);
    toast({ type: 'warning', title: 'PO Deleted', description: `${po.poNumber} was removed from PO management.` });
  }

  function resetData() {
    reset();
    setDraft(emptyDraft());
    setEditingId(undefined);
    setPoUploadFile('');
    setErrors([]);
    setFieldErrors({});
    toast({ type: 'info', title: 'PO Data Reset', description: 'Purchase orders were restored to seeded records.' });
  }

  return (
    <div className="space-y-5">
      <Panel
        title="Purchase Order Management"
        subtitle="Create a fresh PO or upload an existing PO document, then manage saved records from a separate register."
        action={
          <SegmentedControl
            value={activeView}
            onChange={setActiveView}
            options={[
              { value: 'create', label: editingId ? 'Edit PO' : 'Create PO', icon: <FileText size={14} /> },
              { value: 'list', label: 'Registered PO', icon: <ListChecks size={14} /> },
            ]}
          />
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoMetric label="PO records" value={items.length} />
          <InfoMetric label="Ready for match" value={items.filter((po) => po.matchingStatus === 'Ready for 3-Way Match').length} tone="emerald" />
          <InfoMetric label="Issued or approved" value={items.filter((po) => po.status === 'Issued' || po.status === 'Approved').length} tone="cyan" />
          <InfoMetric label="Total PO value" value={money(totalValue)} tone="amber" />
        </div>
      </Panel>

      {activeView === 'create' && <Panel id="create-po" title={editingId ? 'Edit PO' : 'Create PO'} subtitle="Required PO, vendor, buyer, item, pricing, and payment fields are validated before saving.">
        <form onSubmit={submit} className="space-y-5">
          <div className="rounded-lg border border-dashed border-cyan-400/25 bg-cyan-400/10 p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="text-sm font-semibold text-white">Upload existing PO document</div>
                <div className="mt-1 text-xs leading-5 text-slate-400">Attach a PDF/image PO from your side, then complete or correct the structured PO fields below for matching.</div>
                {poUploadFile && <div className="mt-2 text-xs font-semibold text-cyan-200">{poUploadFile}</div>}
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
                <Upload size={16} /> Upload PO
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(event) => handlePoUpload(event.target.files?.[0]?.name)} />
              </label>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <Field label="PO Number" value={draft.poNumber} error={fieldErrors.poNumber} onChange={(value) => patchDraft({ poNumber: value })} placeholder="PO-2001" />
            <Field label="PO Date" type="date" value={draft.poDate} error={fieldErrors.poDate} onChange={(value) => patchDraft({ poDate: value })} />
            <Field label="Intended Delivery Date" type="date" value={draft.intendedDeliveryDate} error={fieldErrors.intendedDeliveryDate} onChange={(value) => patchDraft({ intendedDeliveryDate: value })} />
            <Field label="Expected Delivery Date" type="date" value={draft.expectedDeliveryDate || ''} error={fieldErrors.expectedDeliveryDate} onChange={(value) => patchDraft({ expectedDeliveryDate: value })} />
            <label className="text-sm text-slate-300">
              Vendor Master
              <select value={draft.vendorId} onChange={(event) => selectVendor(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none focus:border-cyan-400/30">
                <option value="">Select vendor</option>
                {demoData.vendors.slice(0, 30).map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.displayName}</option>)}
              </select>
            </label>
            <Field label="Vendor Name" value={draft.vendorName} error={fieldErrors.vendorName} onChange={(value) => patchDraft({ vendorName: value })} />
            <Field label="Vendor Contact Number" value={draft.vendorContactNumber} error={fieldErrors.vendorContactNumber} onChange={(value) => patchDraft({ vendorContactNumber: value })} />
            <Field label="Vendor Email" type="email" value={draft.vendorEmail} error={fieldErrors.vendorEmail} onChange={(value) => patchDraft({ vendorEmail: value })} />
            <Field label="Vendor GST Details" required={false} value={draft.vendorGstDetails} error={fieldErrors.vendorGstDetails} onChange={(value) => patchDraft({ vendorGstDetails: value.toUpperCase() })} />
            <Field label="GST Rate %" type="number" value={draft.gstRate ?? ''} error={fieldErrors.gstRate} onChange={(value) => patchDraft({ gstRate: Number(value) })} />
            <Field label="Cost Center" value={draft.costCenter || ''} error={fieldErrors.costCenter} onChange={(value) => patchDraft({ costCenter: value })} />
            <Field label="Vendor Reference ID" value={draft.vendorReferenceId || ''} onChange={(value) => patchDraft({ vendorReferenceId: value })} />
            <Field label="Delivery Challan Number" value={draft.deliveryChallanNumber || ''} error={fieldErrors.deliveryChallanNumber} onChange={(value) => patchDraft({ deliveryChallanNumber: value })} />
            <Field label="Delivery Challan Date" type="date" value={draft.deliveryChallanDate || ''} error={fieldErrors.deliveryChallanDate} onChange={(value) => patchDraft({ deliveryChallanDate: value })} />
            <Field label="GRN Reference" value={draft.grnReference || ''} error={fieldErrors.grnReference} onChange={(value) => patchDraft({ grnReference: value })} />
            <Field label="GRN Date" type="date" value={draft.grnDate || ''} error={fieldErrors.grnDate} onChange={(value) => patchDraft({ grnDate: value })} />
            <div className="md:col-span-2"><TextArea label="Vendor Address" value={draft.vendorAddress} error={fieldErrors.vendorAddress} onChange={(value) => patchDraft({ vendorAddress: value })} /></div>
            <Field label="Company Name" value={draft.companyName} error={fieldErrors.companyName} onChange={(value) => patchDraft({ companyName: value })} />
            <Field label="Department Name" value={draft.departmentName} error={fieldErrors.departmentName} onChange={(value) => patchDraft({ departmentName: value })} />
            <div className="md:col-span-2"><TextArea label="Billing Address" value={draft.billingAddress} error={fieldErrors.billingAddress} onChange={(value) => patchDraft({ billingAddress: value })} /></div>
            <div className="md:col-span-2"><TextArea label="Shipping Address" value={draft.shippingAddress} error={fieldErrors.shippingAddress} onChange={(value) => patchDraft({ shippingAddress: value })} /></div>
          </div>

          <div className="rounded-lg border border-white/10 bg-slate-950/35 p-4">
            <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="text-sm font-semibold text-white">Itemized Details</div>
                <div className="mt-1 text-xs text-slate-500">Line quantities and prices are retained for future PO, GRN, and invoice comparison.</div>
              </div>
              <button type="button" onClick={addLine} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-white/10"><Plus size={14} /> Add item</button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    <th className="border-b border-white/10 px-3 py-2">Item No.</th>
                    <th className="border-b border-white/10 px-3 py-2">SKU</th>
                    <th className="border-b border-white/10 px-3 py-2">Description</th>
                    <th className="border-b border-white/10 px-3 py-2">Qty</th>
                    <th className="border-b border-white/10 px-3 py-2">Unit Price</th>
                    <th className="border-b border-white/10 px-3 py-2">Total</th>
                    <th className="border-b border-white/10 px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="border-b border-white/5 px-3 py-3"><input value={item.itemNumber} onChange={(event) => updateLine(item.id, { itemNumber: event.target.value })} className="w-24 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 outline-none focus:border-cyan-400/30" /></td>
                      <td className="border-b border-white/5 px-3 py-3"><input value={item.skuCode} onChange={(event) => updateLine(item.id, { skuCode: event.target.value })} className="w-36 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 outline-none focus:border-cyan-400/30" /></td>
                      <td className="border-b border-white/5 px-3 py-3"><input value={item.itemDescription} onChange={(event) => updateLine(item.id, { itemDescription: event.target.value })} className="w-72 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 outline-none focus:border-cyan-400/30" /></td>
                      <td className="border-b border-white/5 px-3 py-3"><input type="number" min={1} value={item.quantityOrdered} onChange={(event) => updateLine(item.id, { quantityOrdered: Number(event.target.value) })} className="w-24 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 outline-none focus:border-cyan-400/30" /></td>
                      <td className="border-b border-white/5 px-3 py-3"><input type="number" min={0} value={item.unitPrice} onChange={(event) => updateLine(item.id, { unitPrice: Number(event.target.value) })} className="w-32 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 outline-none focus:border-cyan-400/30" /></td>
                      <td className="border-b border-white/5 px-3 py-3 text-slate-200">{money(Number(item.quantityOrdered || 0) * Number(item.unitPrice || 0), draft.currency)}</td>
                      <td className="border-b border-white/5 px-3 py-3"><button type="button" onClick={() => removeLine(item.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-rose-400/30 bg-rose-400/10 text-rose-200 transition hover:bg-rose-400/15" aria-label={`Remove PO item ${index + 1}`}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {fieldErrors.items && <div className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{fieldErrors.items}</div>}
          </div>

          <div className="grid gap-3 md:grid-cols-5">
            <Field label="Tax Amount" type="number" value={draft.taxAmount} onChange={(value) => patchDraft({ taxAmount: Number(value) })} />
            <Field label="GST Details" value={draft.gstDetails} onChange={(value) => patchDraft({ gstDetails: value })} />
            <Field label="Discount" type="number" value={draft.discount} onChange={(value) => patchDraft({ discount: Number(value) })} />
            <label className="text-sm text-slate-300">
              Payment Terms
              <select value={paymentTermOptions.includes(draft.paymentTerms) ? draft.paymentTerms : 'Manual'} onChange={(event) => event.target.value !== 'Manual' && patchDraft({ paymentTerms: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none focus:border-cyan-400/30">
                {paymentTermOptions.map((term) => <option key={term}>{term}</option>)}
                <option>Manual</option>
              </select>
            </label>
            <Field label="Payment Terms Text" value={draft.paymentTerms} error={fieldErrors.paymentTerms} onChange={(value) => patchDraft({ paymentTerms: value })} />
            <label className="text-sm text-slate-300">
              Status
              <select value={draft.status} onChange={(event) => patchDraft({ status: event.target.value as PurchaseOrder['status'] })} className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/50 px-4 py-3 text-sm outline-none focus:border-cyan-400/30">
                {statusOptions.map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoMetric label="Subtotal" value={money(normalizedDraft.subtotal, draft.currency)} />
            <InfoMetric label="Tax less discount" value={money(normalizedDraft.taxAmount - normalizedDraft.discount, draft.currency)} />
            <InfoMetric label="Final total" value={money(normalizedDraft.finalTotalAmount, draft.currency)} tone="emerald" />
          </div>

          {errors.length > 0 && <div className="grid gap-2 sm:grid-cols-2">{errors.map((error) => <div key={error} className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</div>)}</div>}

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={loadDemoPO} className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/15">
              <RefreshCw size={16} /> Load Demo PO
            </button>
            <button type="button" onClick={validateDraft} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"><CheckCircle2 size={16} /> Validate PO</button>
            <button type="button" onClick={handleClearForm} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10"><RotateCcw size={16} /> Clear All</button>
            <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"><Save size={16} /> {editingId ? 'Update PO' : 'Save PO'}</button>
            {editingId && <button type="button" onClick={() => { setEditingId(undefined); setDraft(emptyDraft()); setErrors([]); setFieldErrors({}); }} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10"><XCircle size={16} /> Cancel edit</button>}
          </div>
        </form>
      </Panel>}

      {activeView === 'list' && <>
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/5 bg-slate-900/50 p-4 shadow-sm mb-5">
          {/* Search Section */}
          <div className="flex-1 min-w-[240px] space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Search POs</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                value={searchTerm} 
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} 
                placeholder="PO #, Vendor, Dept..." 
                className="w-full rounded-lg border border-white/10 bg-slate-950/50 py-2 pl-10 pr-3 text-sm outline-none focus:border-cyan-400/30 text-slate-200 transition-all placeholder:text-slate-600"
              />
            </div>
          </div>

          {/* Calendar Filter Section */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Date Range</label>
            <div className="flex items-center gap-2">
              <input 
                type="date" 
                value={singleDate} 
                onChange={(e) => { setSingleDate(e.target.value); setFromDate(''); setToDate(''); setActiveFilter(''); setPage(1); }}
                className="w-36 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm outline-none focus:border-cyan-400/30 text-slate-200 [color-scheme:dark] transition-all"
                title="Specific Date"
              />
              <div className="h-4 w-px bg-white/10 mx-1" />
              <input 
                type="date" 
                value={fromDate} 
                onChange={(e) => { setFromDate(e.target.value); setSingleDate(''); setActiveFilter(''); setPage(1); }}
                className="w-36 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm outline-none focus:border-cyan-400/30 text-slate-200 [color-scheme:dark] transition-all"
                placeholder="From"
              />
              <input 
                type="date" 
                value={toDate} 
                onChange={(e) => { setToDate(e.target.value); setSingleDate(''); setActiveFilter(''); setPage(1); }}
                className="w-36 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm outline-none focus:border-cyan-400/30 text-slate-200 [color-scheme:dark] transition-all"
                placeholder="To"
              />
            </div>
          </div>

          {/* Quick Filter List */}
          <div className="space-y-1.5 relative">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quick Range</label>
            <button
              type="button"
              onClick={() => setIsQuickFilterDropdownOpen(!isQuickFilterDropdownOpen)}
              className="flex items-center justify-between w-full min-w-[120px] rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-200 transition-all hover:bg-white/5 focus:border-cyan-400/30"
            >
              {activeFilter ? quickFilterOptions.find(opt => opt.id === activeFilter)?.label : 'Select Filter'}
              <ChevronDown size={16} className={`transition-transform ${isQuickFilterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isQuickFilterDropdownOpen && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-white/10 bg-slate-900/95 shadow-lg overflow-hidden">
                {quickFilterOptions.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      f.fn();
                      setIsQuickFilterDropdownOpen(false); // Close dropdown after selection
                    }}
                    className={`block w-full text-left px-3 py-2 text-sm font-medium transition-all ${activeFilter === f.id ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        
        {/* Sort Section */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sort By</label>
          <select 
            value={sortOrder}
            onChange={(e) => { setSortOrder(e.target.value as 'newest' | 'oldest'); setPage(1); }}
            className="w-40 rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm outline-none focus:border-cyan-400/30 text-slate-200 [color-scheme:dark] transition-all"
          >
            <option value="newest">Newest Date First</option>
            <option value="oldest">Oldest Date First</option>
          </select>
        </div>

        {/* Reset Section */}
        <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reset</label>
            <button 
              type="button"
              onClick={resetFilters}
              className="flex items-center justify-center p-2.5 rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-all"
              title="Reset Filters"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        <Panel
          id="po-list"
          title={`Showing ${filteredData.length} Purchase Orders`}
          subtitle="Search, filter, sort, view details, edit, print, export, and delete purchase orders."
          action={
            <div className="flex flex-wrap gap-2">
              <select 
                value={statusFilter} 
                onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} 
                className="rounded-lg border border-white/10 bg-slate-950/50 px-3 py-2 text-sm outline-none focus:border-cyan-400/30"
              >
                <option>All</option>
                {statusOptions.map((status) => <option key={status}>{status}</option>)}
              </select>
              <button onClick={resetData} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10">
                <RefreshCw size={15} />Reset PO data
              </button>
            </div>
          }
        >

          <div className="grid gap-3 md:hidden">
            {filteredData.length === 0 ? (
              <div className="py-20 text-center rounded-2xl border border-white/5 bg-slate-950/20">
                <div className="mb-4 inline-flex rounded-full bg-white/5 p-4 text-slate-600"><FileText size={32} /></div>
                <h4 className="text-base font-semibold text-slate-300">No purchase orders found</h4>
                <p className="mt-1 text-sm text-slate-500 italic">Try adjusting your filters or search term.</p>
              </div>
            ) : filteredData.map((po) => (
              <article key={po.id} className="rounded-lg border border-white/10 bg-slate-950/45 p-4">
              </article>
            ))}
          </div>

          <div className="hidden overflow-auto md:block rounded-xl border border-white/10 max-h-[650px] custom-scrollbar">
            <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-left text-sm relative">
              <thead className="sticky top-0 z-20 bg-slate-900 shadow-sm">
                <tr className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 bg-slate-900/95 backdrop-blur-md">
                  <th className="border-b border-white/10 px-4 py-4">PO Details</th>
                  <th className="border-b border-white/10 bg-slate-900/95 px-4 py-3 backdrop-blur-md">Vendor Details</th>
                  <th className="border-b border-white/10 bg-slate-900/95 px-4 py-3 backdrop-blur-md">Department</th>
                  <th className="border-b border-white/10 bg-slate-900/95 px-4 py-3 text-right backdrop-blur-md">PO Amount</th>
                  <th className="border-b border-white/10 bg-slate-900/95 px-4 py-3 text-center backdrop-blur-md">Status</th>
                  <th className="border-b border-white/10 bg-slate-900/95 px-4 py-3 text-right backdrop-blur-md">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-slate-950/20">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-24 text-center">
                      <div className="inline-flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-slate-950/20 px-16 py-10">
                        <div className="mb-4 rounded-full bg-white/5 p-4 text-slate-600"><FileText size={32} strokeWidth={1.5} /></div>
                        <h4 className="text-base font-semibold text-slate-300">No purchase orders found</h4>
                        <p className="mt-1 text-sm text-slate-500 italic">Try adjusting filters or search term.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pageRows.map((po) => {
                    // Professional Status Badge Mapping
                    const tone = po.status === 'Approved' ? 'emerald' : 
                                 po.status === 'Draft' ? 'slate' : 
                                 po.status === 'Cancelled' ? 'rose' : 'amber';
                    
                    return (
                      <tr key={po.id} className="group transition-colors hover:bg-white/[0.04] even:bg-white/[0.02]">
                        <td className="px-4 py-4">
                          <div className="font-bold tracking-tight text-white">{po.poNumber}</div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                            <span className="tabular-nums font-bold text-slate-400">
                              {po.poDate ? new Date(po.poDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                            </span>
                            <span>•</span>
                            <span className="text-slate-600">{po.items.length} Items</span>
                          </div>
                        </td>
                        <td className="px-4 py-5">
                          <div className="text-sm font-semibold text-slate-200">{po.vendorName}</div>
                          <div className="text-[11px] text-slate-500 font-medium">{po.vendorReferenceId || 'NO-REF-ID'}</div>
                        </td>
                        <td className="px-4 py-5">
                          <div className="text-xs text-slate-300 font-medium">{po.departmentName || 'General'}</div>
                          <div className="text-[10px] text-slate-600 uppercase font-bold tracking-tighter">{po.costCenter || 'No Cost Center'}</div>
                        </td>
                        <td className="px-4 py-5 text-right">
                          <div className="font-bold text-slate-100 tabular-nums">{money(po.finalTotalAmount, po.currency)}</div>
                          <div className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{po.paymentTerms}</div>
                        </td>
                        <td className="px-4 py-5 text-center">
                          <Badge tone={tone}>{po.status}</Badge>
                        </td>
                        <td className="px-4 py-5 text-right">
                          <div className="flex flex-wrap justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                            <Link href={`/purchase-orders/${encodeURIComponent(po.id)}`} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-cyan-200 transition hover:bg-white/10" aria-label={`View ${po.poNumber}`}><Eye size={16} /></Link>
                            <button onClick={() => edit(po)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10" aria-label={`Edit ${po.poNumber}`}><Pencil size={16} /></button>
                            {isAdmin && <button onClick={() => deletePo(po)} className="grid h-9 w-9 place-items-center rounded-lg border border-rose-400/30 bg-rose-400/10 text-rose-200 transition hover:bg-rose-400/15" aria-label={`Delete ${po.poNumber}`}><Trash2 size={16} /></button>}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
            <div className="text-sm text-slate-400">Page {currentPage} of {totalPages}</div>
            <div className="flex gap-2">
              <button 
                disabled={currentPage <= 1} 
                onClick={() => setPage((value) => Math.max(1, value - 1))} 
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 disabled:opacity-40 transition-all hover:bg-white/10"
              >
                Previous
              </button>
              <button 
                disabled={currentPage >= totalPages} 
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))} 
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 disabled:opacity-40 transition-all hover:bg-white/10"
              >
                Next
              </button>
            </div>
          </div>
        </Panel>
      </>}
    </div>
  );
}
