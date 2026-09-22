import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Product (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let businessId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
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
      .send({ name: `Product test business ${Date.now()}` });
    businessId = business.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates, lists, updates, and soft-deletes a product', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, name: 'Palta hass madura', price: '5.00', unit: 'kg', category: 'palta' })
      .expect(201);

    const productId = createResponse.body.id;

    const listResponse = await request(app.getHttpServer())
      .get('/products')
      .query({ businessId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listResponse.body.some((p: { id: string }) => p.id === productId)).toBe(true);

    await request(app.getHttpServer())
      .patch(`/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ price: '5.50' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const listAfterDelete = await request(app.getHttpServer())
      .get('/products')
      .query({ businessId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listAfterDelete.body.some((p: { id: string }) => p.id === productId)).toBe(false);
  });
});
