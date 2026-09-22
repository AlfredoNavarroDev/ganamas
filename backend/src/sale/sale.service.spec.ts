import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SaleService } from './sale.service';
import { Sale } from '../entities/sale.entity';

describe('SaleService', () => {
  let service: SaleService;
  let manager: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    remove: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    manager = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      create: jest.fn((_entityClass, plain) => plain),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = { transaction: jest.fn((callback) => callback(manager)) };

    const module = await Test.createTestingModule({
      providers: [
        SaleService,
        { provide: DataSource, useValue: dataSource },
        // findAll() uses this repository via createQueryBuilder — not exercised
        // by the tests below, so an empty stub is enough to satisfy Nest's DI.
        { provide: getRepositoryToken(Sale), useValue: {} },
      ],
    }).compile();

    service = module.get(SaleService);
  });

  describe('create', () => {
    it('uses the catalog price and snapshots avg_cost when unitPrice is not given', async () => {
      manager.findOne.mockResolvedValue({
        id: 'product-1',
        stock: '10.00',
        price: '5.00',
        avgCost: '3.00',
      });

      await service.create({
        businessId: 'business-1',
        productId: 'product-1',
        quantity: '2',
      });

      const savedProduct = manager.save.mock.calls[0][0];
      expect(savedProduct.stock).toBe('8.00');

      const savedSale = manager.save.mock.calls[1][0];
      expect(savedSale.listPrice).toBe('5.00');
      expect(savedSale.unitPrice).toBe('5.00');
      expect(savedSale.unitCost).toBe('3.00');
    });

    it('records a discount when unitPrice is lower than the catalog price', async () => {
      manager.findOne.mockResolvedValue({
        id: 'product-1',
        stock: '10.00',
        price: '5.00',
        avgCost: '3.00',
      });

      await service.create({
        businessId: 'business-1',
        productId: 'product-1',
        quantity: '2',
        unitPrice: '4.00',
      });

      const savedSale = manager.save.mock.calls[1][0];
      expect(savedSale.listPrice).toBe('5.00');
      expect(savedSale.unitPrice).toBe('4.00');
    });

    it('rejects a sale when stock is insufficient', async () => {
      manager.findOne.mockResolvedValue({
        id: 'product-1',
        stock: '1.00',
        price: '5.00',
        avgCost: '3.00',
      });

      await expect(
        service.create({
          businessId: 'business-1',
          productId: 'product-1',
          quantity: '2',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the product does not exist in that business', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          businessId: 'business-1',
          productId: 'missing',
          quantity: '1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('reverts stock before deleting the sale', async () => {
      manager.findOne
        .mockResolvedValueOnce({
          id: 'sale-1',
          quantity: '3',
          product: { id: 'product-1' },
        })
        .mockResolvedValueOnce({ id: 'product-1', stock: '5.00' });

      await service.remove('sale-1');

      const savedProduct = manager.save.mock.calls[0][0];
      expect(savedProduct.stock).toBe('8.00');
      expect(manager.remove).toHaveBeenCalled();
    });

    it('throws NotFoundException when the sale does not exist', async () => {
      manager.findOne.mockResolvedValueOnce(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
