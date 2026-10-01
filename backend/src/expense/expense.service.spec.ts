import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExpenseService } from './expense.service';
import { Expense } from '../entities/expense.entity';

describe('ExpenseService', () => {
  let service: ExpenseService;
  let repository: {
    create: jest.Mock<Partial<Expense>, [Partial<Expense>]>;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let qb: {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };

  beforeEach(async () => {
    qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };
    repository = {
      create: jest.fn((value: Partial<Expense>) => value),
      save: jest.fn((value) => Promise.resolve({ id: 'expense-1', ...value })),
      createQueryBuilder: jest.fn(() => qb),
    };

    const module = await Test.createTestingModule({
      providers: [
        ExpenseService,
        { provide: getRepositoryToken(Expense), useValue: repository },
      ],
    }).compile();

    service = module.get(ExpenseService);
  });

  it('creates an expense scoped to the given business', async () => {
    const result = await service.create({
      businessId: 'business-1',
      amount: '25.00',
      description: 'Bolsas para empacar',
    });

    expect(repository.create).toHaveBeenCalledWith({
      business: { id: 'business-1' },
      amount: '25.00',
      description: 'Bolsas para empacar',
      expensedAt: undefined,
    });
    expect(result).toMatchObject({ id: 'expense-1', amount: '25.00' });
  });

  it('passes an explicit expensedAt through as a Date', async () => {
    await service.create({
      businessId: 'business-1',
      amount: '25.00',
      description: 'Bolsas para empacar',
      expensedAt: '2026-09-29T14:00:00.000Z',
    });

    const created = repository.create.mock.calls[0][0];
    expect(created.expensedAt).toEqual(new Date('2026-09-29T14:00:00.000Z'));
  });

  it('filters by businessId, from and to, and paginates', async () => {
    qb.getManyAndCount.mockResolvedValue([[{ id: 'expense-1' }], 1]);

    const result = await service.findAll({
      businessId: 'business-1',
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-30T23:59:59.000Z',
      page: 2,
      limit: 10,
    });

    expect(qb.where).toHaveBeenCalledWith('expense.business = :businessId', {
      businessId: 'business-1',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('expense.expensedAt >= :from', {
      from: '2026-09-01T00:00:00.000Z',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('expense.expensedAt <= :to', {
      to: '2026-09-30T23:59:59.000Z',
    });
    expect(qb.skip).toHaveBeenCalledWith(10);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(result).toEqual({ data: [{ id: 'expense-1' }], total: 1, page: 2, limit: 10 });
  });

  it('defaults to page 1 and limit 50 when not provided', async () => {
    qb.getManyAndCount.mockResolvedValue([[], 0]);

    const result = await service.findAll({ businessId: 'business-1' });

    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(50);
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 50 });
  });
});
