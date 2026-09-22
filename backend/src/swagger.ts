import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  if (process.env.NODE_ENV === 'production') return;

  const config = new DocumentBuilder()
    .setTitle('SAP hermana API')
    .setDescription('API para registro de ventas, compras y reportes de negocios')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Auth')
    .addTag('Businesses')
    .addTag('Products')
    .addTag('Purchases')
    .addTag('Sales')
    .addTag('Reports')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
