import { EntityState } from '@ngrx/entity';
import { OutboxRecord } from 'src/shared/models';

export interface OutboxState extends EntityState<OutboxRecord> {
  draining: boolean;
}
