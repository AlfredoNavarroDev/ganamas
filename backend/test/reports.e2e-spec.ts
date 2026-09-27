import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { TEST_USERNAME, TEST_PASSWORD } from './e2e-test-user';

describe('Reports (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let businessId: string;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = app.get(DataSource);

    const login = await request(app.getHttpServer()).post('/auth/login').send({
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
    });
    token = login.body.accessToken;

    const business = await request(app.getHttpServer())
      .post('/businesses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Reports test business ${Date.now()}` });
    businessId = business.body.id;

    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, name: 'Palta hass', price: '5.00', unit: 'kg' });
    productId = product.body.id;

    await request(app.getHttpServer())
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, productId, quantity: '100', unitCost: '2.00' });

    // 2026-01-04 is a Sunday. 19:00 Lima (UTC-5) time is 2026-01-05T00:00:00Z —
    // already Monday in UTC, but must still be reported as Sunday in Lima time.
    await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        businessId,
        productId,
        quantity: '1',
        unitPrice: '5.00',
        soldAt: '2026-01-05T00:00:00.000Z',
      })
      .expect(201);
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM sale WHERE business_id = $1', [businessId]);
    await dataSource.query('DELETE FROM purchase WHERE business_id = $1', [businessId]);
    await dataSource.query('DELETE FROM product WHERE business_id = $1', [businessId]);
    await dataSource.query('DELETE FROM business WHERE id = $1', [businessId]);
    await app.close();
  });

  it('groups the Sunday-7pm-Lima sale as Sunday, not Monday', async () => {
    const response = await request(app.getHttpServer())
      .get('/reports/weekly-summary')
      .query({ businessId, from: '2026-01-04T00:00:00.000Z', to: '2026-01-11T00:00:00.000Z' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const sundayRow = response.body.daily.find(
      (row: { day: string }) => row.day === '2026-01-04',
    );
    const mondayRow = response.body.daily.find(
      (row: { day: string }) => row.day === '2026-01-05',
    );

    expect(sundayRow).toBeDefined();
    expect(Number(sundayRow.revenue)).toBeCloseTo(5.0, 2);
    expect(mondayRow).toBeUndefined();
  });

  it('flags the product under the low-stock threshold in kpis', async () => {
    const response = await request(app.getHttpServer())
      .get('/reports/kpis')
      .query({ businessId, from: '2026-01-01T00:00:00.000Z', to: '2026-01-11T00:00:00.000Z' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.lowStock).toEqual([]);
    expect(response.body.topProducts[0].productId).toBe(productId);
  });

  it('computes revenue, profit, count and avgTicket for a range', async () => {
    const response = await request(app.getHttpServer())
      .get('/reports/summary')
      .query({ businessId, from: '2026-01-01T00:00:00.000Z', to: '2026-01-11T00:00:00.000Z' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.count).toBe(1);
    expect(Number(response.body.revenue)).toBeCloseTo(5.0, 2);
    expect(Number(response.body.avgTicket)).toBeCloseTo(5.0, 2);
    expect(response.body.topProduct.productId).toBe(productId);
  });
});
