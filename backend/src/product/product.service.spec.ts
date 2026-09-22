import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductService } from './product.service';
import { Product } from '../entities/product.entity';

describe('ProductService', () => {
  let service: ProductService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve({ id: 'product-1', ...value })),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [ProductService, { provide: getRepositoryToken(Product), useValue: repository }],
    }).compile();

    service = module.get(ProductService);
  });

  it('creates a product scoped to its business', async () => {
    await service.create({
      businessId: 'business-1',
      name: 'Palta hass madura',
      price: '5.00',
      unit: 'kg',
      category: 'palta',
    });

    expect(repository.create).toHaveBeenCalledWith({
      business: { id: 'business-1' },
      name: 'Palta hass madura',
      price: '5.00',
      unit: 'kg',
      category: 'palta',
    });
  });

  it('defaults the active filter to true when listing', async () => {
    repository.find.mockResolvedValue([]);

    await service.findAll({ businessId: 'business-1', active: undefined });

    expect(repository.find).toHaveBeenCalledWith({
      where: { business: { id: 'business-1' }, active: true },
    });
  });

  it('soft-deletes by setting active to false', async () => {
    repository.findOne.mockResolvedValue({ id: 'product-1', active: true });

    await service.remove('product-1');

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'product-1', active: false }),
    );
  });

  it('throws NotFoundException when removing a missing product', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
  });
});
