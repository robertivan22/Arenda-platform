// localStorage-based mock store — works without any backend

export interface Lessor {
  id: string
  code: string
  type: 'NATURAL' | 'LEGAL' | 'PFA'
  firstName: string
  lastName: string
  companyName: string
  displayName: string
  cnpCui: string
  gender: string
  county: string
  locality: string
  address: string
  phone: string
  mobile: string
  email: string
  iban: string
  bankName: string
  notes: string
  status: 'ACTIVE' | 'INACTIVE'
  contractsCount: number
  parcelsCount: number
  createdAt: string
}

export interface Contract {
  id: string
  contractNumber: string
  contractType: string
  lessorId: string
  lessorName: string
  zone: string
  signDate: string
  startDate: string
  endDate: string
  totalParcels: number
  annualRent: string
  status: 'ACTIVE' | 'EXPIRED' | 'DRAFT'
  createdAt: string
}

export interface Parcel {
  id: string
  parcelCode: string
  tarlaNr: string
  parcelNr: string
  county: string
  locality: string
  landUseCategory: string
  surface: string
  surfaceRented: string
  lessorId: string
  lessorName: string
  contractId: string
  status: string
  createdAt: string
}

export interface Payment {
  id: string
  lessorId: string
  lessorName: string
  contractId: string
  contractNumber: string
  amount: string
  dueDate: string
  paidDate: string
  status: 'OVERDUE' | 'PENDING' | 'PAID'
  notes: string
  createdAt: string
}

function get<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') } catch { return [] }
}

function save<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(key, JSON.stringify(data))
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }

// ── LESSORS ──────────────────────────────────────────────────────────────────
export const lessors = {
  list(): Lessor[] { return get<Lessor>('mock_lessors') },
  get(id: string): Lessor | undefined { return this.list().find(l => l.id === id) },
  create(data: Omit<Lessor, 'id' | 'code' | 'displayName' | 'status' | 'contractsCount' | 'parcelsCount' | 'createdAt'>): Lessor {
    const all = this.list()
    const code = `AR${String(all.length + 1).padStart(4, '0')}`
    const displayName = data.type === 'LEGAL' ? data.companyName : `${data.lastName} ${data.firstName}`.trim()
    const item: Lessor = { ...data, id: uid(), code, displayName, status: 'ACTIVE', contractsCount: 0, parcelsCount: 0, createdAt: new Date().toISOString() }
    save('mock_lessors', [...all, item])
    return item
  },
  update(id: string, data: Partial<Lessor>): void {
    save('mock_lessors', this.list().map(l => l.id === id ? { ...l, ...data } : l))
  },
}

// ── CONTRACTS ─────────────────────────────────────────────────────────────────
export const contracts = {
  list(): Contract[] { return get<Contract>('mock_contracts') },
  get(id: string): Contract | undefined { return this.list().find(c => c.id === id) },
  create(data: Omit<Contract, 'id' | 'createdAt'>): Contract {
    const item: Contract = { ...data, id: uid(), createdAt: new Date().toISOString() }
    save('mock_contracts', [...this.list(), item])
    // update lessor count
    const all = lessors.list()
    const lessor = all.find(l => l.id === data.lessorId)
    if (lessor) lessors.update(lessor.id, { contractsCount: lessor.contractsCount + 1 })
    return item
  },
}

// ── PARCELS ───────────────────────────────────────────────────────────────────
export const parcels = {
  list(): Parcel[] { return get<Parcel>('mock_parcels') },
  get(id: string): Parcel | undefined { return this.list().find(p => p.id === id) },
  create(data: Omit<Parcel, 'id' | 'createdAt'>): Parcel {
    const item: Parcel = { ...data, id: uid(), createdAt: new Date().toISOString() }
    save('mock_parcels', [...this.list(), item])
    return item
  },
}

// ── PAYMENTS ──────────────────────────────────────────────────────────────────
export const payments = {
  list(): Payment[] { return get<Payment>('mock_payments') },
  create(data: Omit<Payment, 'id' | 'createdAt'>): Payment {
    const item: Payment = { ...data, id: uid(), createdAt: new Date().toISOString() }
    save('mock_payments', [...this.list(), item])
    return item
  },
  markPaid(id: string): void {
    save('mock_payments', this.list().map(p => p.id === id ? { ...p, status: 'PAID' as const, paidDate: new Date().toISOString().split('T')[0] } : p))
  },
}

// ── DASHBOARD STATS ───────────────────────────────────────────────────────────
export function getDashboardStats() {
  const ls = lessors.list()
  const cs = contracts.list()
  const ps = parcels.list()
  const pms = payments.list()
  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const overdue = pms.filter(p => p.status === 'OVERDUE')
  return {
    lessorsTotal: ls.filter(l => l.status === 'ACTIVE').length,
    contractsActive: cs.filter(c => c.status === 'ACTIVE').length,
    contractsExpiring: cs.filter(c => c.status === 'ACTIVE' && new Date(c.endDate) <= in30).length,
    parcelsTotal: ps.length,
    surfaceTotal: ps.reduce((sum, p) => sum + parseFloat(p.surface || '0'), 0).toFixed(2),
    paymentsOverdue: overdue.length,
    paymentsOverdueAmount: overdue.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0).toFixed(2),
  }
}
