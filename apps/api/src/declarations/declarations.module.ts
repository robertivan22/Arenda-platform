import { Module } from '@nestjs/common'
import { DatabaseModule } from '../database/database.module'
import { DeclarationsController } from './declarations.controller'
import { DeclarationsService } from './declarations.service'
import { D112Generator } from './generators/d112.generator'
import { ApiaGenerator } from './generators/apia.generator'
import { TaxRulesService } from './tax-rules/tax-rules.service'

@Module({
  imports: [DatabaseModule],
  controllers: [DeclarationsController],
  providers: [DeclarationsService, D112Generator, ApiaGenerator, TaxRulesService],
  exports: [DeclarationsService],
})
export class DeclarationsModule {}
