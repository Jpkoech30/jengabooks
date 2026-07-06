import { Module } from '@nestjs/common';
import { WizardService } from './wizard.service';
import { WizardController } from './wizard.controller';

@Module({
  controllers: [WizardController],
  providers: [WizardService],
  exports: [WizardService],
})
export class WizardModule {}
