import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../entities/business.entity';
import { Product } from '../entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
  ) {}

  create(dto: CreateProductDto) {
    const product = this.productRepository.create({
      business: { id: dto.businessId } as Business,
      name: dto.name,
      price: dto.price,
      unit: dto.unit,
      category: dto.category ?? null,
    });
    return this.productRepository.save(product);
  }

  findAll(query: ListProductsQueryDto) {
    const active = query.active === undefined ? true : query.active === 'true';
    return this.productRepository.find({
      where: { business: { id: query.businessId }, active },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    Object.assign(product, dto);
    return this.productRepository.save(product);
  }

  async remove(id: string) {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    product.active = false;
    return this.productRepository.save(product);
  }
}
