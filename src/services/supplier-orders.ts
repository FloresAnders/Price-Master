import { FirestoreService } from './firestore';

export interface SupplierOrderProduct {
  id: string
  name: string
  quantity: number
  price?: number
  barcode?: string
}

export interface SupplierOrderEntry {
  id: string
  supplierName: string
  companyName?: string
  orderDate: string
  expectedDeliveryDate?: string
  notes?: string
  products: SupplierOrderProduct[]
  total?: number
  createdAt?: string
  updatedAt?: string
  createdBy?: string
  updatedBy?: string
}

export interface SupplierOrdersDocument {
  id: string
  companyName: string
  supplierName: string
  orders: SupplierOrderEntry[]
  createdAt?: string
  updatedAt?: string
  createdBy?: string
  updatedBy?: string
}

interface SaveOrderOptions {
  companyName: string
  supplierName: string
  order: SupplierOrderEntry
  userId?: string
  previousDocumentId?: string | null
}

interface RemoveOrderOptions {
  documentId: string
  orderId: string
}

export class SupplierOrdersService {
  private static readonly COLLECTION_NAME = 'ordenes'

  private static normalizeSegment(value: string): string {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()
    return normalized || 'registro'
  }

  static buildDocumentId(companyName: string, supplierName: string): string {
    const companySegment = this.normalizeSegment(companyName)
    const supplierSegment = this.normalizeSegment(supplierName)
    return `${companySegment}-${supplierSegment}`
  }

  static async fetchOrdersForCompany(companyName: string): Promise<SupplierOrdersDocument[]> {
    const documents = await FirestoreService.query(this.COLLECTION_NAME, [
      { field: 'companyName', operator: '==', value: companyName }
    ])

    return documents.map(doc => {
      const supplierName: string = doc.supplierName || ''
      const company: string = doc.companyName || companyName
      const rawOrders = Array.isArray(doc.orders) ? doc.orders : []
      const orders: SupplierOrderEntry[] = rawOrders.map((item: any) => this.mapOrder(item, supplierName, company))

      return {
        id: doc.id as string,
        companyName: company,
        supplierName: supplierName || orders[0]?.supplierName || '',
        orders,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        createdBy: doc.createdBy,
        updatedBy: doc.updatedBy
      }
    })
  }

  static async saveOrder(options: SaveOrderOptions): Promise<string> {
    const { companyName, supplierName, order, userId, previousDocumentId } = options
    const targetDocId = this.buildDocumentId(companyName, supplierName)
    const now = new Date().toISOString()

    if (previousDocumentId && previousDocumentId !== targetDocId) {
      await this.removeOrder({ documentId: previousDocumentId, orderId: order.id })
    }

    const orderToPersist = this.prepareOrderForStorage(order, supplierName, companyName, userId, now)
    const existingDoc = await FirestoreService.getById(this.COLLECTION_NAME, targetDocId)

    if (!existingDoc) {
      await FirestoreService.addWithId(this.COLLECTION_NAME, targetDocId, {
        companyName,
        supplierName,
        orders: [orderToPersist],
        createdAt: orderToPersist.createdAt || now,
        updatedAt: now,
        createdBy: orderToPersist.createdBy || userId || null,
        updatedBy: userId || orderToPersist.updatedBy || null
      })
    } else {
      const rawOrders = Array.isArray(existingDoc.orders) ? existingDoc.orders : []
      const orderIndex = rawOrders.findIndex((item: any) => item.id === orderToPersist.id)

      if (orderIndex >= 0) {
        const currentOrder = rawOrders[orderIndex]
        rawOrders[orderIndex] = {
          ...currentOrder,
          ...orderToPersist,
          createdAt: currentOrder?.createdAt || orderToPersist.createdAt || now
        }
      } else {
        rawOrders.unshift(orderToPersist)
      }

      await FirestoreService.update(this.COLLECTION_NAME, targetDocId, {
        companyName,
        supplierName,
        orders: rawOrders,
        updatedAt: now,
        updatedBy: userId || orderToPersist.updatedBy || null
      })
    }

    return targetDocId
  }

  static async removeOrder(options: RemoveOrderOptions): Promise<void> {
    const { documentId, orderId } = options
    const existingDoc = await FirestoreService.getById(this.COLLECTION_NAME, documentId)
    if (!existingDoc) {
      return
    }

    const rawOrders = Array.isArray(existingDoc.orders) ? existingDoc.orders : []
    const remaining = rawOrders.filter((item: any) => item.id !== orderId)

    if (remaining.length === 0) {
      await FirestoreService.delete(this.COLLECTION_NAME, documentId)
      return
    }

    await FirestoreService.update(this.COLLECTION_NAME, documentId, {
      orders: remaining,
      updatedAt: new Date().toISOString()
    })
  }

  private static mapOrder(data: any, fallbackSupplier: string, fallbackCompany: string): SupplierOrderEntry {
    const productsRaw = Array.isArray(data?.products) ? data.products : []
    const products: SupplierOrderProduct[] = productsRaw.map((product: any) => ({
      id: product?.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: String(product?.name || ''),
      quantity: Number(product?.quantity) || 0,
      price: product?.price !== undefined && product?.price !== null ? Number(product.price) : undefined,
      barcode: product?.barcode || undefined
    }))

    const computedTotal = products.reduce((sum, product) => {
      if (typeof product.price === 'number') {
        return sum + product.price * product.quantity
      }
      return sum
    }, 0)

    const storedTotal = data?.total !== undefined && data?.total !== null
      ? Number(data.total)
      : (computedTotal > 0 ? Number(computedTotal.toFixed(2)) : undefined)

    return {
      id: String(data?.id || `${Date.now()}`),
      supplierName: String(data?.supplierName || fallbackSupplier || ''),
      companyName: String(data?.companyName || fallbackCompany || ''),
      orderDate: String(data?.orderDate || ''),
      expectedDeliveryDate: data?.expectedDeliveryDate ? String(data.expectedDeliveryDate) : undefined,
      notes: data?.notes ? String(data.notes) : undefined,
      products,
      total: storedTotal,
      createdAt: data?.createdAt ? String(data.createdAt) : undefined,
      updatedAt: data?.updatedAt ? String(data.updatedAt) : undefined,
      createdBy: data?.createdBy ? String(data.createdBy) : undefined,
      updatedBy: data?.updatedBy ? String(data.updatedBy) : undefined
    }
  }

  private static prepareOrderForStorage(
    order: SupplierOrderEntry,
    supplierName: string,
    companyName: string,
    userId: string | undefined,
    timestamp: string
  ): SupplierOrderEntry {
  const sourceProducts = Array.isArray(order.products) ? order.products : []
  const products = sourceProducts.map(product => ({
      id: product.id,
      name: product.name,
      quantity: product.quantity,
      price: product.price !== undefined ? Number(product.price) : undefined,
      barcode: product.barcode || undefined
    }))

    const totalFromProducts = products.reduce((sum, product) => {
      if (typeof product.price === 'number') {
        return sum + product.price * product.quantity
      }
      return sum
    }, 0)

    const total = order.total !== undefined && order.total !== null
      ? Number(order.total)
      : (totalFromProducts > 0 ? Number(totalFromProducts.toFixed(2)) : undefined)

    return {
      ...order,
      supplierName: order.supplierName || supplierName,
      companyName: order.companyName || companyName,
      products,
      total,
      createdAt: order.createdAt || timestamp,
      updatedAt: timestamp,
      createdBy: order.createdBy || userId,
      updatedBy: userId || order.updatedBy
    }
  }
}
