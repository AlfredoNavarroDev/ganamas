import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { TEST_USERNAME, TEST_PASSWORD } from './e2e-test-user';

describe('Expense (e2e)', () => {
  let app: INestApplication<Server>;
  let token: string;
  let businessId: string;

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
      .send({ name: `Expense test business ${Date.now()}` });
    businessId = (business.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates an expense and lists it with pagination', async () => {
    await request(app.getHttpServer())
      .post('/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, amount: '25.00', description: 'Bolsas para empacar' })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/expenses')
      .query({ businessId, page: 1, limit: 10 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const expenseList = listResponse.body as {
      total: number;
      data: { description: string; amount: string }[];
    };
    expect(expenseList.total).toBeGreaterThanOrEqual(1);
    expect(
      expenseList.data.some((e) => e.description === 'Bolsas para empacar'),
    ).toBe(true);
  });
});
