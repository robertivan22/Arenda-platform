import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { DatabaseModule } from './database/database.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { TenantsModule } from './tenants/tenants.module'
import { RolesModule } from './roles/roles.module'
import { LessorsModule } from './lessors/lessors.module'
import { ContractsModule } from './contracts/contracts.module'
import { ParcelsModule } from './parcels/parcels.module'
import { NomenclatureModule } from './nomenclature/nomenclature.module'
import { AuditModule } from './audit/audit.module'
import { DocumentsModule } from './documents/documents.module'
import { StorageModule } from './storage/storage.module'
import { DeclarationsModule } from './declarations/declarations.module'
import { InvoicesImportModule } from './invoices-import/invoices-import.module'
import { configValidation } from './config/config.validation'

@Module({
  imports: [
    // Config (global — available everywhere without import)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: configValidation,
    }),

    // Rate limiting — 100 requests per minute per IP by default
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // Core infrastructure
    DatabaseModule,
    AuditModule,
    StorageModule,

    // Domain modules
    AuthModule,
    UsersModule,
    TenantsModule,
    RolesModule,
    NomenclatureModule,
    LessorsModule,
    ContractsModule,
    ParcelsModule,
    DocumentsModule,
    DeclarationsModule,
    InvoicesImportModule,
  ],
})
export class AppModule {}
