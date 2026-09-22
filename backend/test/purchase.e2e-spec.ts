import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Purchase (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let businessId: string;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    const login = await request(app.getHttpServer()).post('/auth/login').send({
      username: process.env.SEED_USERNAME,
      password: process.env.SEED_PASSWORD,
    });
    token = login.body.accessToken;

    const business = await request(app.getHttpServer())
      .post('/businesses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Purchase test business ${Date.now()}` });
    businessId = business.body.id;

    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, name: 'Palta hass', price: '5.00', unit: 'kg' });
    productId = product.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('recalculates stock and avg_cost, and lists the purchase with pagination', async () => {
    await request(app.getHttpServer())
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, productId, quantity: '10', unitCost: '4.00' })
      .expect(201);

    const productResponse = await request(app.getHttpServer())
      .get('/products')
      .query({ businessId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const updatedProduct = productResponse.body.find(
      (p: { id: string }) => p.id === productId,
    );
    expect(updatedProduct.stock).toBe('10.00');
    expect(updatedProduct.avgCost).toBe('4.00');

    const listResponse = await request(app.getHttpServer())
      .get('/purchases')
      .query({ businessId, page: 1, limit: 10 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listResponse.body.total).toBeGreaterThanOrEqual(1);
    expect(
      listResponse.body.data.some(
        (p: { productId?: string; product?: { id: string } }) =>
          p.product?.id === productId,
      ),
    ).toBe(true);
  });
});
