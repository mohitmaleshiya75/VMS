import vendors from '@/data/vendors.json';
import invoices from '@/data/invoices.json';
import purchaseOrders from '@/data/purchase-orders.json';
import matching from '@/data/matching.json';
import approvals from '@/data/approvals.json';
import payments from '@/data/payments.json';
import audit from '@/data/audit.json';
import notifications from '@/data/notifications.json';
import type { Vendor, Invoice, PurchaseOrder, MatchRecord, ApprovalRecord, PaymentRecord, AuditRecord, NotificationRecord } from './types';

export const demoData = { vendors: vendors as Vendor[], invoices: invoices as Invoice[], purchaseOrders: purchaseOrders as PurchaseOrder[], matching: matching as MatchRecord[], approvals: approvals as ApprovalRecord[], payments: payments as PaymentRecord[], audit: audit as AuditRecord[], notifications: notifications as NotificationRecord[] };
export function totalAmount(items: Array<{ grossAmount?: number; amount?: number; netPaid?: number }>) { return items.reduce((sum, item) => sum + (item.grossAmount ?? item.amount ?? item.netPaid ?? 0), 0); }
export function approvalTier(amount: number) { if (amount <= 10000) return { level: 'L1', role: 'Team Lead' }; if (amount <= 100000) return { level: 'L2', role: 'Account Manager' }; return { level: 'L3', role: 'Finance Head' }; }
