import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { ClosingService } from './closing.service';
import { DayClosing } from '../entities/day-closing.entity';
import { ReportsService } from '../reports/reports.service';

describe('ClosingService', () => {
  let service: ClosingService;
  let repo: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let reportsService: { summary: jest.Mock };

  const summarySnapshot = {
    revenue: '10.00',
    profit: '4.00',
    count: 2,
    avgTicket: '5.00',
    topProduct: null,
    byPaymentMethod: [],
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn((data) => data),
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    reportsService = { summary: jest.fn().mockResolvedValue(summarySnapshot) };

    const module = await Test.createTestingModule({
      providers: [
        ClosingService,
        { provide: getRepositoryToken(DayClosing), useValue: repo },
        { provide: ReportsService, useValue: reportsService },
      ],
    }).compile();

    service = module.get(ClosingService);
  });

  it('closes today using the reports summary as the snapshot', async () => {
    repo.save.mockImplementation((entity) => Promise.resolve(entity));

    const result = await service.closeToday('business-1', 'user-1');

    expect(reportsService.summary).toHaveBeenCalledWith(
      'business-1',
      expect.any(String),
      expect.any(String),
    );
    expect(result.snapshot).toEqual(summarySnapshot);
    expect(result.closedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('throws ConflictException when the day is already closed', async () => {
    const driverError = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    });
    repo.save.mockRejectedValue(new QueryFailedError('INSERT INTO day_closing', [], driverError));

    await expect(service.closeToday('business-1', 'user-1')).rejects.toThrow(ConflictException);
  });

  it('rethrows unrelated database errors', async () => {
    const driverError = Object.assign(new Error('connection lost'), { code: '08006' });
    repo.save.mockRejectedValue(new QueryFailedError('INSERT INTO day_closing', [], driverError));

    await expect(service.closeToday('business-1', 'user-1')).rejects.toThrow('connection lost');
  });

  it('throws NotFoundException when there is no closing for today', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.findToday('business-1')).rejects.toThrow(NotFoundException);
  });

  it('returns the closing for today when one exists', async () => {
    const closing = { id: 'closing-1', closedDate: '2026-01-07', snapshot: summarySnapshot };
    repo.findOne.mockResolvedValue(closing);

    await expect(service.findToday('business-1')).resolves.toEqual(closing);
  });
});
