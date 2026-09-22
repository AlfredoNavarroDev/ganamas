import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Business } from './business.entity';

@Entity('product')
@Index(['business', 'active'])
@Index(['business', 'category'])
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business, (business) => business.products)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @Column({ length: 150 })
  name: string;

  // numeric llega/va como string por el driver pg — evita imprecisión de floats
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price: string;

  @Column({ length: 20, default: 'unidad' })
  unit: 'unidad' | 'kg';

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  stock: string;

  @Column({ name: 'avg_cost', type: 'numeric', precision: 10, scale: 2, default: 0 })
  avgCost: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
