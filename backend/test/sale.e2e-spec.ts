import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Sale (e2e)', () => {
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
      .send({ name: `Sale test business ${Date.now()}` });
    businessId = business.body.id;

    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, name: 'Palta hass', price: '5.00', unit: 'kg' });
    productId = product.body.id;

    await request(app.getHttpServer())
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, productId, quantity: '10', unitCost: '2.00' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a sale larger than available stock', async () => {
    await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, productId, quantity: '999' })
      .expect(400);
  });

  it('creates a sale, discounts stock, and reverts it on delete', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, productId, quantity: '4', unitPrice: '4.50' })
      .expect(201);
    const saleId = createResponse.body.id;

    const afterSale = await request(app.getHttpServer())
      .get('/products')
      .query({ businessId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      afterSale.body.find((p: { id: string }) => p.id === productId).stock,
    ).toBe('6.00');

    await request(app.getHttpServer())
      .delete(`/sales/${saleId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const afterDelete = await request(app.getHttpServer())
      .get('/products')
      .query({ businessId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      afterDelete.body.find((p: { id: string }) => p.id === productId).stock,
    ).toBe('10.00');
  });
});
