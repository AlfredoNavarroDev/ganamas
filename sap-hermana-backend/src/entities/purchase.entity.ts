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
import { Product } from './product.entity';

@Entity('purchase')
@Index(['business', 'purchasedAt'])
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business, (business) => business.purchases)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  @Index()
  product: Product;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  quantity: string;

  @Column({ name: 'unit_cost', type: 'numeric', precision: 10, scale: 2 })
  unitCost: string;

  // columna generada en la DB (quantity * unit_cost) — TypeORM solo la lee, nunca la escribe
  @Column({
    name: 'total_cost',
    type: 'numeric',
    precision: 10,
    scale: 2,
    generatedType: 'STORED',
    asExpression: 'quantity * unit_cost',
    insert: false,
    update: false,
  })
  totalCost: string;

  @Column({ name: 'purchased_at', type: 'timestamptz', default: () => 'now()' })
  purchasedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
