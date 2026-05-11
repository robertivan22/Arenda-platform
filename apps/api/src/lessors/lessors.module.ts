import { Module } from '@nestjs/common'
import { LessorsController } from './lessors.controller'
import { LessorsService } from './lessors.service'

@Module({
  controllers: [LessorsController],
  providers: [LessorsService],
  exports: [LessorsService],
})
export class LessorsModule {}
