import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Product } from './product.entity';
import { Sale } from './sale.entity';
import { Purchase } from './purchase.entity';

@Entity('business')
@Unique(['owner', 'name'])
export class Business {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (user) => user.businesses)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ length: 100 })
  name: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Product, (product) => product.business)
  products: Product[];

  @OneToMany(() => Sale, (sale) => sale.business)
  sales: Sale[];

  @OneToMany(() => Purchase, (purchase) => purchase.business)
  purchases: Purchase[];
}
