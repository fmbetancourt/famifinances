import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FamiliesModule } from '../families/families.module';
import { Reminder, ReminderSchema } from './reminder.schema';
import { ReminderRepository } from './reminder.repository';
import { RemindersService } from './reminders.service';
import { RemindersController } from './reminders.controller';

/**
 * NTF-01 · personal, per-member reminder configuration. Delivery is on-device
 * (Expo local notifications) — the server persists config only, with no push,
 * scheduler, or queue. Imports ONLY FamiliesModule (FamilyScopeGuard); it touches
 * no financial module, so there is no cycle and no forwardRef.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Reminder.name, schema: ReminderSchema }]),
    FamiliesModule, // FamilyScopeGuard (Principle I)
  ],
  controllers: [RemindersController],
  providers: [ReminderRepository, RemindersService],
})
export class RemindersModule {}
