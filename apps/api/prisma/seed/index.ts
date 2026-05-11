import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { ROLE_PERMISSIONS, PERMISSIONS } from '../../../packages/shared/src/constants/permissions'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting seed...')

  // ── 1. Permissions ──────────────────────────────────────
  console.log('  → Seeding permissions...')
  for (const code of Object.values(PERMISSIONS)) {
    const [resource, ...actionParts] = code.split(':')
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, resource, action: actionParts.join(':') },
    })
  }

  // ── 2. Roles ─────────────────────────────────────────────
  console.log('  → Seeding roles...')
  const roleDefinitions = [
    { code: 'SUPER_ADMIN', name: 'Super Administrator', isSystem: true },
    { code: 'TENANT_ADMIN', name: 'Administrator Client', isSystem: true },
    { code: 'CONTRACTS_OP', name: 'Operator Contracte', isSystem: true },
    { code: 'PAYMENTS_OP', name: 'Operator Plăți', isSystem: true },
    { code: 'ACCOUNTANT', name: 'Contabil', isSystem: true },
    { code: 'REPORTING_OP', name: 'Operator Raportare', isSystem: true },
    { code: 'VIEWER', name: 'Vizualizator', isSystem: true },
    { code: 'SUPPORT_ADMIN', name: 'Suport Tehnic', isSystem: true },
  ]

  for (const role of roleDefinitions) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: { name: role.name },
      create: role,
    })
  }

  // ── 3. Role Permissions ──────────────────────────────────
  console.log('  → Seeding role permissions...')
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.findUnique({ where: { code: roleCode } })
    if (!role) continue
    for (const permCode of permCodes) {
      const perm = await prisma.permission.findUnique({ where: { code: permCode } })
      if (!perm) continue
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
        update: {},
        create: { roleId: role.id, permissionId: perm.id },
      })
    }
  }

  // ── 4. Counties (sample Romanian counties) ──────────────
  console.log('  → Seeding nomenclature (counties)...')
  const counties = [
    { code: 'AB', name: 'Alba' }, { code: 'AR', name: 'Arad' },
    { code: 'AG', name: 'Argeș' }, { code: 'BC', name: 'Bacău' },
    { code: 'BH', name: 'Bihor' }, { code: 'BN', name: 'Bistrița-Năsăud' },
    { code: 'BT', name: 'Botoșani' }, { code: 'BV', name: 'Brașov' },
    { code: 'BR', name: 'Brăila' }, { code: 'B', name: 'București' },
    { code: 'BZ', name: 'Buzău' }, { code: 'CS', name: 'Caraș-Severin' },
    { code: 'CL', name: 'Călărași' }, { code: 'CJ', name: 'Cluj' },
    { code: 'CT', name: 'Constanța' }, { code: 'CV', name: 'Covasna' },
    { code: 'DB', name: 'Dâmbovița' }, { code: 'DJ', name: 'Dolj' },
    { code: 'GL', name: 'Galați' }, { code: 'GR', name: 'Giurgiu' },
    { code: 'GJ', name: 'Gorj' }, { code: 'HR', name: 'Harghita' },
    { code: 'HD', name: 'Hunedoara' }, { code: 'IL', name: 'Ialomița' },
    { code: 'IS', name: 'Iași' }, { code: 'IF', name: 'Ilfov' },
    { code: 'MM', name: 'Maramureș' }, { code: 'MH', name: 'Mehedinți' },
    { code: 'MS', name: 'Mureș' }, { code: 'NT', name: 'Neamț' },
    { code: 'OT', name: 'Olt' }, { code: 'PH', name: 'Prahova' },
    { code: 'SM', name: 'Satu Mare' }, { code: 'SJ', name: 'Sălaj' },
    { code: 'SB', name: 'Sibiu' }, { code: 'SV', name: 'Suceava' },
    { code: 'TR', name: 'Teleorman' }, { code: 'TM', name: 'Timiș' },
    { code: 'TL', name: 'Tulcea' }, { code: 'VS', name: 'Vaslui' },
    { code: 'VL', name: 'Vâlcea' }, { code: 'VN', name: 'Vrancea' },
  ]
  for (const county of counties) {
    await prisma.county.upsert({ where: { code: county.code }, update: {}, create: county })
  }

  // ── 5. Land Use Categories ───────────────────────────────
  const landUseCategories = [
    { code: 'A', name: 'Arabil' },
    { code: 'P', name: 'Pășune' },
    { code: 'F', name: 'Fânețe' },
    { code: 'V', name: 'Vie' },
    { code: 'L', name: 'Livezi' },
    { code: 'S', name: 'Stufăriș' },
    { code: 'PD', name: 'Pădure' },
    { code: 'N', name: 'Neproductiv' },
  ]
  for (const cat of landUseCategories) {
    await prisma.landUseCategory.upsert({ where: { code: cat.code }, update: {}, create: cat })
  }

  // ── 6. Payment Methods ───────────────────────────────────
  const paymentMethods = [
    { code: 'BANK', name: 'Transfer bancar' },
    { code: 'POSTAL', name: 'Mandat poștal' },
    { code: 'CASH', name: 'Numerar la sediu' },
    { code: 'PRODUCT', name: 'Produse agricole' },
  ]
  for (const pm of paymentMethods) {
    await prisma.paymentMethod.upsert({ where: { code: pm.code }, update: {}, create: pm })
  }

  // ── 7. Demo Tenant ───────────────────────────────────────
  console.log('  → Seeding demo tenant...')
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Arendă SRL',
      slug: 'demo',
      status: 'ACTIVE',
    },
  })

  // ── 8. Super Admin User ──────────────────────────────────
  console.log('  → Seeding super admin user...')
  const email = process.env.SUPER_ADMIN_EMAIL || 'admin@arenda.ro'
  const password = process.env.SUPER_ADMIN_PASSWORD || 'Admin1234!'
  const passwordHash = await bcrypt.hash(password, 12)

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: {},
    create: {
      tenantId: tenant.id,
      email,
      passwordHash,
      firstName: 'Admin',
      lastName: 'System',
      status: 'ACTIVE',
    },
  })

  const superAdminRole = await prisma.role.findUnique({ where: { code: 'SUPER_ADMIN' } })
  if (superAdminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId_tenantId: { userId: adminUser.id, roleId: superAdminRole.id, tenantId: tenant.id } },
      update: {},
      create: { userId: adminUser.id, roleId: superAdminRole.id, tenantId: tenant.id },
    })
  }

  // ── 9. Demo Zone ─────────────────────────────────────────
  await prisma.zone.upsert({
    where: { id: 'zone-demo-1' },
    update: {},
    create: {
      id: 'zone-demo-1',
      tenantId: tenant.id,
      name: 'Zona Nord',
      description: 'Parcelele din zona nordică',
    },
  })

  console.log(`✅ Seed complete. Admin: ${email} / ${password}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
