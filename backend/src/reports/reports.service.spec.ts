import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let dataSource: {
    query: jest.Mock<Promise<unknown[]>, [string, unknown[]?]>;
  };

  beforeEach(async () => {
    dataSource = {
      query: jest
        .fn<Promise<unknown[]>, [string, unknown[]?]>()
        .mockResolvedValue([]),
    };

    const module = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('5') },
        },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  it('groups the weekly summary by day converted to America/Lima', async () => {
    await service.weeklySummary('business-1', '2026-01-01', '2026-01-08');

    const dailySql = dataSource.query.mock.calls[0][0];
    expect(dailySql).toContain("AT TIME ZONE 'America/Lima'");
    expect(dailySql).toContain('date_trunc');
  });

  it('returns daily rows and a payment-method breakdown', async () => {
    dataSource.query.mockResolvedValueOnce([
      { day: '2026-01-01', revenue: '10.00' },
    ]);
    dataSource.query.mockResolvedValueOnce([
      { paymentMethod: 'efectivo', revenue: '10.00' },
    ]);

    const result = await service.weeklySummary(
      'business-1',
      '2026-01-01',
      '2026-01-08',
    );

    expect(result.daily).toEqual([{ day: '2026-01-01', revenue: '10.00' }]);
    expect(result.byPaymentMethod).toEqual([
      { paymentMethod: 'efectivo', revenue: '10.00' },
    ]);
  });

  it('ranks best day and best hour by profit, and applies the low-stock threshold', async () => {
    await service.kpis('business-1', '2026-01-01', '2026-01-08');

    const bestDaySql = dataSource.query.mock.calls[0][0];
    const bestHourSql = dataSource.query.mock.calls[1][0];
    const lowStockSql = dataSource.query.mock.calls[3][0];
    const lowStockParams = dataSource.query.mock.calls[3][1];

    expect(bestDaySql).toContain("AT TIME ZONE 'America/Lima'");
    expect(bestDaySql).toContain('ORDER BY profit DESC');
    expect(bestHourSql).toContain('EXTRACT(HOUR FROM');
    expect(lowStockSql).toContain('stock <');
    expect(lowStockParams).toContain(5);
  });

  it('computes totals, top product and payment-method breakdown for a range', async () => {
    dataSource.query.mockResolvedValueOnce([
      { revenue: '10.00', profit: '4.00', count: '2' },
    ]);
    dataSource.query.mockResolvedValueOnce([
      { productId: 'prod-1', productName: 'Palta hass', profit: '4.00' },
    ]);
    dataSource.query.mockResolvedValueOnce([
      { paymentMethod: 'efectivo', revenue: '10.00' },
    ]);

    const result = await service.summary(
      'business-1',
      '2026-01-01',
      '2026-01-08',
    );

    const totalsSql = dataSource.query.mock.calls[0][0];
    expect(totalsSql).toContain('COUNT(*)');
    expect(result).toEqual({
      revenue: '10.00',
      profit: '4.00',
      count: 2,
      avgTicket: '5.00',
      topProduct: {
        productId: 'prod-1',
        productName: 'Palta hass',
        profit: '4.00',
      },
      byPaymentMethod: [{ paymentMethod: 'efectivo', revenue: '10.00' }],
    });
  });

  it('returns zeroed totals and no top product when there are no sales in the range', async () => {
    dataSource.query.mockResolvedValueOnce([
      { revenue: '0', profit: '0', count: '0' },
    ]);
    dataSource.query.mockResolvedValueOnce([]);
    dataSource.query.mockResolvedValueOnce([]);

    const result = await service.summary(
      'business-1',
      '2026-01-01',
      '2026-01-08',
    );

    expect(result).toEqual({
      revenue: '0.00',
      profit: '0.00',
      count: 0,
      avgTicket: '0.00',
      topProduct: null,
      byPaymentMethod: [],
    });
  });
});
