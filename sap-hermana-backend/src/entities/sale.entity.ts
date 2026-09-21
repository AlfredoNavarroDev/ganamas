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

@Entity('sale')
@Index(['business', 'soldAt'])
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Business, (business) => business.sales)
  @JoinColumn({ name: 'business_id' })
  business: Business;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  @Index()
  product: Product;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  quantity: string;

  // snapshot del precio de catálogo al momento de vender (para calcular descuento/regateo)
  @Column({ name: 'list_price', type: 'numeric', precision: 10, scale: 2, default: 0 })
  listPrice: string;

  // precio realmente cobrado (puede ser menor a list_price si hubo regateo)
  @Column({ name: 'unit_price', type: 'numeric', precision: 10, scale: 2 })
  unitPrice: string;

  // snapshot del avg_cost del producto al momento de vender
  @Column({ name: 'unit_cost', type: 'numeric', precision: 10, scale: 2, default: 0 })
  unitCost: string;

  // columnas generadas en la DB — TypeORM solo las lee
  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    generatedType: 'STORED',
    asExpression: 'quantity * unit_price',
    insert: false,
    update: false,
  })
  total: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    generatedType: 'STORED',
    asExpression: '(quantity * unit_price) - (quantity * unit_cost)',
    insert: false,
    update: false,
  })
  profit: string;

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    generatedType: 'STORED',
    asExpression: '(list_price - unit_price) * quantity',
    insert: false,
    update: false,
  })
  discount: string;

  @Column({ name: 'payment_method', length: 20, default: 'efectivo' })
  paymentMethod: 'efectivo' | 'yape' | 'plin';

  @Column({ name: 'sold_at', type: 'timestamptz', default: () => 'now()' })
  soldAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
