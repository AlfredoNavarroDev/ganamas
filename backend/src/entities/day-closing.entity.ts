import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Business } from './business.entity';
import { User } from './user.entity';

export type DayClosingSnapshot = {
  revenue: string;
  profit: string;
  count: number;
  avgTicket: string;
  topProduct: { productId: string; productName: string; profit: string } | null;
  byPaymentMethod: { paymentMethod: string; revenue: string }[];
};

@Entity('day_closing')
@Unique(['business', 'closedDate'])
export class DayClosing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ name: 'closed_date', type: 'date' })
  closedDate: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'closed_by' })
  closedBy: User;

  @Column({ type: 'jsonb' })
  snapshot: DayClosingSnapshot;

  @CreateDateColumn({ name: 'closed_at' })
  closedAt: Date;
}
