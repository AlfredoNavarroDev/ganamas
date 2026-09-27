import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';

describe('Closings (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let businessId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = app.get(DataSource);

    const login = await request(app.getHttpServer()).post('/auth/login').send({
      username: process.env.SEED_USERNAME,
      password: process.env.SEED_PASSWORD,
    });
    token = login.body.accessToken;

    const business = await request(app.getHttpServer())
      .post('/businesses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Closing test business ${Date.now()}` });
    businessId = business.body.id;
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM day_closing WHERE business_id = $1', [businessId]);
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

    expect(first.body.snapshot).toBeDefined();
    expect(first.body.closedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

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
    expect(today.body.id).toBe(first.body.id);

    const history = await request(app.getHttpServer())
      .get('/closings')
      .query({ businessId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(history.body).toHaveLength(1);
    expect(history.body[0].id).toBe(first.body.id);
  });
});
