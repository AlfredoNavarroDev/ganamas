import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async weeklySummary(businessId: string, from: string, to: string) {
    const daily = await this.dataSource.query(
      `SELECT to_char(date_trunc('day', sold_at AT TIME ZONE 'America/Lima'), 'YYYY-MM-DD') AS day,
              COALESCE(SUM(total), 0) AS revenue,
              COALESCE(SUM(quantity * unit_cost), 0) AS cost,
              COALESCE(SUM(profit), 0) AS profit,
              COALESCE(SUM(discount), 0) AS discount
         FROM sale
        WHERE business_id = $1 AND sold_at BETWEEN $2 AND $3
        GROUP BY day
        ORDER BY day ASC`,
      [businessId, from, to],
    );

    const byPaymentMethod = await this.dataSource.query(
      `SELECT payment_method AS "paymentMethod",
              COALESCE(SUM(total), 0) AS revenue
         FROM sale
        WHERE business_id = $1 AND sold_at BETWEEN $2 AND $3
        GROUP BY payment_method`,
      [businessId, from, to],
    );

    return { daily, byPaymentMethod };
  }

  async kpis(businessId: string, from: string, to: string) {
    const bestDayRows = await this.dataSource.query(
      `SELECT to_char(date_trunc('day', sold_at AT TIME ZONE 'America/Lima'), 'YYYY-MM-DD') AS day,
              COALESCE(SUM(profit), 0) AS profit
         FROM sale
        WHERE business_id = $1 AND sold_at BETWEEN $2 AND $3
        GROUP BY day
        ORDER BY profit DESC
        LIMIT 1`,
      [businessId, from, to],
    );

    const bestHourRows = await this.dataSource.query(
      `SELECT EXTRACT(HOUR FROM sold_at AT TIME ZONE 'America/Lima') AS hour,
              COALESCE(SUM(profit), 0) AS profit
         FROM sale
        WHERE business_id = $1 AND sold_at BETWEEN $2 AND $3
        GROUP BY hour
        ORDER BY profit DESC
        LIMIT 1`,
      [businessId, from, to],
    );

    const topProducts = await this.dataSource.query(
      `SELECT p.id AS "productId", p.name AS "productName",
              COALESCE(SUM(s.profit), 0) AS profit
         FROM sale s
         JOIN product p ON p.id = s.product_id
        WHERE s.business_id = $1 AND s.sold_at BETWEEN $2 AND $3
        GROUP BY p.id, p.name
        ORDER BY profit DESC
        LIMIT 5`,
      [businessId, from, to],
    );

    const lowStockThreshold = Number(this.configService.get('LOW_STOCK_THRESHOLD', '5'));
    const lowStock = await this.dataSource.query(
      `SELECT id, name, stock
         FROM product
        WHERE business_id = $1 AND active = true AND stock < $2
        ORDER BY stock ASC`,
      [businessId, lowStockThreshold],
    );

    return {
      bestDay: bestDayRows[0] ?? null,
      bestHour: bestHourRows[0] ?? null,
      topProducts,
      lowStock,
    };
  }
}
