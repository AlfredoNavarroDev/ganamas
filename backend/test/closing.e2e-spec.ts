import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Server } from 'http';
import { AppModule } from '../src/app.module';
import { TEST_USERNAME, TEST_PASSWORD } from './e2e-test-user';

describe('Closings (e2e)', () => {
  let app: INestApplication<Server>;
  let dataSource: DataSource;
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
    dataSource = app.get(DataSource);

    const login = await request(app.getHttpServer()).post('/auth/login').send({
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
    });
    token = (login.body as { accessToken: string }).accessToken;

    const business = await request(app.getHttpServer())
      .post('/businesses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Closing test business ${Date.now()}` });
    businessId = (business.body as { id: string }).id;
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM day_closing WHERE business_id = $1', [
      businessId,
    ]);
    await dataSource.query('DELETE FROM business WHERE id = $1', [businessId]);
    await app.close();
  });

  it('reports no closing for today before any close', async () => {
    await request(app.getHttpServer())
      .get('/closings/today')
      .query({ businessId })
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('closes today, then rejects a second close the same day', async () => {
    const first = await request(app.getHttpServer())
      .post('/closings')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId })
      .expect(201);

    const firstBody = first.body as {
      id: string;
      closedDate: string;
      snapshot: unknown;
    };
    expect(firstBody.snapshot).toBeDefined();
    expect(firstBody.closedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await request(app.getHttpServer())
      .post('/closings')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId })
      .expect(409);

    const today = await request(app.getHttpServer())
      .get('/closings/today')
      .query({ businessId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect((today.body as { id: string }).id).toBe(firstBody.id);

    const history = await request(app.getHttpServer())
      .get('/closings')
      .query({ businessId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const historyBody = history.body as { id: string }[];
    expect(historyBody).toHaveLength(1);
    expect(historyBody[0].id).toBe(firstBody.id);
  });
});
