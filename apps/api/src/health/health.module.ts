import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

/** Exposes the public `/health` liveness endpoint (FAM-25). No providers needed. */
@Module({ controllers: [HealthController] })
export class HealthModule {}
