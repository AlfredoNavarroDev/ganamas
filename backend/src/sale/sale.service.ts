import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { Business } from '../entities/business.entity';
import { Product } from '../entities/product.entity';
import { Sale } from '../entities/sale.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';

@Injectable()
export class SaleService {
  constructor(
    @InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
    private readonly dataSource: DataSource,
  ) {}

  create(dto: CreateSaleDto) {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { id: dto.productId, business: { id: dto.businessId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Product not found');

      const quantity = new Decimal(dto.quantity);
      const stock = new Decimal(product.stock);
      if (stock.lessThan(quantity)) {
        throw new BadRequestException('Insufficient stock');
      }

      const listPrice = new Decimal(product.price);
      const unitPrice =
        dto.unitPrice !== undefined ? new Decimal(dto.unitPrice) : listPrice;

      product.stock = stock.minus(quantity).toFixed(2);
      await manager.save(product);

      const sale = manager.create(Sale, {
        business: { id: dto.businessId } as Business,
        product,
        quantity: dto.quantity,
        listPrice: listPrice.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
        unitCost: product.avgCost,
        paymentMethod: dto.paymentMethod ?? 'efectivo',
        soldAt: dto.soldAt ? new Date(dto.soldAt) : undefined,
      });
      return manager.save(sale);
    });
  }

  async remove(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const sale = await manager.findOne(Sale, {
        where: { id },
        relations: { product: true },
      });
      if (!sale) throw new NotFoundException('Sale not found');

      const product = await manager.findOne(Product, {
        where: { id: sale.product.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Product not found');

      product.stock = new Decimal(product.stock).plus(sale.quantity).toFixed(2);
      await manager.save(product);
      await manager.remove(sale);
    });
  }

  async findAll(query: ListSalesQueryDto) {
    const qb = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.product', 'product')
      .where('sale.business = :businessId', { businessId: query.businessId });

    if (query.productId) {
      qb.andWhere('sale.product = :productId', { productId: query.productId });
    }
    if (query.from) {
      qb.andWhere('sale.soldAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('sale.soldAt <= :to', { to: query.to });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const [data, total] = await qb
      .orderBy('sale.soldAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }
}
