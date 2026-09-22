import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { Business } from '../entities/business.entity';
import { Product } from '../entities/product.entity';
import { Purchase } from '../entities/purchase.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ListPurchasesQueryDto } from './dto/list-purchases-query.dto';

@Injectable()
export class PurchaseService {
  constructor(
    @InjectRepository(Purchase)
    private readonly purchaseRepository: Repository<Purchase>,
    private readonly dataSource: DataSource,
  ) {}

  create(dto: CreatePurchaseDto) {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { id: dto.productId, business: { id: dto.businessId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Product not found');

      const quantity = new Decimal(dto.quantity);
      const unitCost = new Decimal(dto.unitCost);
      const currentStock = new Decimal(product.stock);
      const currentAvgCost = new Decimal(product.avgCost);
      const newStock = currentStock.plus(quantity);
      const newAvgCost = newStock.isZero()
        ? currentAvgCost
        : currentStock
            .times(currentAvgCost)
            .plus(quantity.times(unitCost))
            .dividedBy(newStock);

      product.stock = newStock.toFixed(2);
      product.avgCost = newAvgCost.toFixed(2);
      await manager.save(product);

      const purchase = manager.create(Purchase, {
        business: { id: dto.businessId } as Business,
        product,
        quantity: dto.quantity,
        unitCost: dto.unitCost,
        purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : undefined,
      });
      return manager.save(purchase);
    });
  }

  async findAll(query: ListPurchasesQueryDto) {
    const qb = this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.product', 'product')
      .where('purchase.business = :businessId', {
        businessId: query.businessId,
      });

    if (query.productId) {
      qb.andWhere('purchase.product = :productId', {
        productId: query.productId,
      });
    }
    if (query.from) {
      qb.andWhere('purchase.purchasedAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('purchase.purchasedAt <= :to', { to: query.to });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const [data, total] = await qb
      .orderBy('purchase.purchasedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }
}
