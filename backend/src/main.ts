import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim());
  app.enableCors({
    origin: allowedOrigins,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  setupSwagger(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
