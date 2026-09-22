import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in with the seeded credentials and returns a JWT', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: process.env.SEED_USERNAME,
        password: process.env.SEED_PASSWORD,
      });

    expect(response.status).toBe(200);
    expect(typeof response.body.accessToken).toBe('string');
  });

  it('rejects an unknown username', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'nobody', password: 'whatever' })
      .expect(401);
  });

  it('rejects a request missing the password field', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: process.env.SEED_USERNAME })
      .expect(400);
  });
});
