import { NextResponse } from 'next/server';
import { normalizePurchaseOrder, seedPurchaseOrders, validatePurchaseOrder } from '@/lib/purchase-orders';
import type { PurchaseOrder } from '@/lib/types';

type PurchaseOrderPayload = {
  purchaseOrder?: PurchaseOrder;
  existingPurchaseOrders?: PurchaseOrder[];
  editingId?: string;
  id?: string;
};

function sourceRecords(payload: PurchaseOrderPayload) {
  return Array.isArray(payload.existingPurchaseOrders) ? payload.existingPurchaseOrders : seedPurchaseOrders;
}

export async function GET() {
  return NextResponse.json({ purchaseOrders: seedPurchaseOrders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as PurchaseOrderPayload;
    if (!body.purchaseOrder) {
      return NextResponse.json({ valid: false, errors: ['Purchase order payload is required.'] }, { status: 400 });
    }

    const normalized = normalizePurchaseOrder(body.purchaseOrder);
    const result = validatePurchaseOrder(normalized, sourceRecords(body), body.editingId);

    if (!result.valid) {
      return NextResponse.json({ ...result, purchaseOrder: normalized }, { status: 422 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const purchaseOrder: PurchaseOrder = {
      ...normalized,
      id: body.editingId || normalized.id || `POREC-${String(Date.now()).slice(-6)}`,
      createdAt: body.editingId ? normalized.createdAt : today,
      updatedAt: today,
      matchingStatus: normalized.matchingStatus || 'Ready for 3-Way Match',
    };

    return NextResponse.json({ ...result, purchaseOrder }, { status: body.editingId ? 200 : 201 });
  } catch {
    return NextResponse.json({ valid: false, errors: ['Unable to process purchase order payload.'] }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json() as PurchaseOrderPayload;
    if (!body.id) {
      return NextResponse.json({ deleted: false, errors: ['Purchase order id is required.'] }, { status: 400 });
    }

    const exists = sourceRecords(body).some((purchaseOrder) => purchaseOrder.id === body.id || purchaseOrder.poNumber === body.id);
    if (!exists) {
      return NextResponse.json({ deleted: false, errors: ['Purchase order was not found.'] }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id: body.id });
  } catch {
    return NextResponse.json({ deleted: false, errors: ['Unable to process purchase order delete request.'] }, { status: 400 });
  }
}
