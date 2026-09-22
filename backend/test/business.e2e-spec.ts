import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Business (e2e)', () => {
  let app: INestApplication;
  let token: string;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/businesses').expect(401);
  });

  it('creates, lists, and toggles active on a business', async () => {
    const uniqueName = `Test business ${Date.now()}`;

    const createResponse = await request(app.getHttpServer())
      .post('/businesses')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: uniqueName })
      .expect(201);

    const businessId = createResponse.body.id;

    const listResponse = await request(app.getHttpServer())
      .get('/businesses')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listResponse.body.some((b: { id: string }) => b.id === businessId)).toBe(true);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/businesses/${businessId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ active: false })
      .expect(200);
    expect(updateResponse.body.active).toBe(false);
  });
});
