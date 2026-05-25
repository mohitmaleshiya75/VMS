'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PurchaseOrderDetail } from '@/components/purchase-order-detail';
import { Panel } from '@/components/ui';
import { usePurchaseOrders } from '@/lib/purchase-order-store';
import { ArrowLeft } from 'lucide-react';

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const { items } = usePurchaseOrders();
  const id = decodeURIComponent(params.id);
  const po = items.find((item) => item.id === id || item.poNumber === id);

  if (!po) {
    return (
      <div className="space-y-5">
        <Link href="/purchase-orders" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"><ArrowLeft size={16} /> Back to PO list</Link>
        <Panel title="Purchase order not found" subtitle="The requested PO may have been deleted or reset.">
          <div className="text-sm text-slate-400">Open the PO list to search current purchase order records.</div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link href="/purchase-orders" className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-white/10"><ArrowLeft size={16} /> Back to PO list</Link>
      <PurchaseOrderDetail po={po} />
    </div>
  );
}
