import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PurchaseService } from './purchase.service';
import { Purchase } from '../entities/purchase.entity';

describe('PurchaseService', () => {
  let service: PurchaseService;
  let manager: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    manager = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      create: jest.fn((_entityClass, plain) => plain),
    };
    dataSource = { transaction: jest.fn((callback) => callback(manager)) };

    const module = await Test.createTestingModule({
      providers: [
        PurchaseService,
        { provide: DataSource, useValue: dataSource },
        // findAll() uses this repository via createQueryBuilder — not exercised
        // by the tests below, so an empty stub is enough to satisfy Nest's DI.
        { provide: getRepositoryToken(Purchase), useValue: {} },
      ],
    }).compile();

    service = module.get(PurchaseService);
  });

  it('recalculates avg_cost as a stock-weighted average and increases stock', async () => {
    manager.findOne.mockResolvedValue({
      id: 'product-1',
      stock: '10.00',
      avgCost: '2.00',
    });

    await service.create({
      businessId: 'business-1',
      productId: 'product-1',
      quantity: '10',
      unitCost: '4.00',
    });

    const savedProduct = manager.save.mock.calls[0][0];
    expect(savedProduct.stock).toBe('20.00');
    expect(savedProduct.avgCost).toBe('3.00');

    const savedPurchase = manager.save.mock.calls[1][0];
    expect(savedPurchase.quantity).toBe('10');
    expect(savedPurchase.unitCost).toBe('4.00');
  });

  it('throws NotFoundException when the product does not exist in that business', async () => {
    manager.findOne.mockResolvedValue(null);

    await expect(
      service.create({
        businessId: 'business-1',
        productId: 'missing',
        quantity: '1',
        unitCost: '1',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
