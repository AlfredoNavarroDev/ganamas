import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Business } from './business.entity';

@Entity('expense')
@Index(['business', 'expensedAt'])
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: string;

  @Column({ length: 255 })
  description: string;

  @Column({ name: 'expensed_at', type: 'timestamptz', default: () => 'now()' })
  expensedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
