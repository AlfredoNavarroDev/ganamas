import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { TEST_USERNAME, TEST_PASSWORD } from './e2e-test-user';

describe('Purchase (e2e)', () => {
  let app: INestApplication<Server>;
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
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
    });
    token = (login.body as { accessToken: string }).accessToken;

    const business = await request(app.getHttpServer())
      .post('/businesses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Purchase test business ${Date.now()}` });
    businessId = (business.body as { id: string }).id;

    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, name: 'Palta hass', price: '5.00', unit: 'kg' });
    productId = (product.body as { id: string }).id;
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
    const products = productResponse.body as {
      id: string;
      stock: string;
      avgCost: string;
    }[];
    const updatedProduct = products.find((p) => p.id === productId);
    expect(updatedProduct?.stock).toBe('10.00');
    expect(updatedProduct?.avgCost).toBe('4.00');

    const listResponse = await request(app.getHttpServer())
      .get('/purchases')
      .query({ businessId, page: 1, limit: 10 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const purchaseList = listResponse.body as {
      total: number;
      data: { productId?: string; product?: { id: string } }[];
    };
    expect(purchaseList.total).toBeGreaterThanOrEqual(1);
    expect(purchaseList.data.some((p) => p.product?.id === productId)).toBe(
      true,
    );
  });
});
