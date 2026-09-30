import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { User } from './entities/user.entity';
import { Business } from './entities/business.entity';
import { Product } from './entities/product.entity';
import { Purchase } from './entities/purchase.entity';
import { Sale } from './entities/sale.entity';
import { DayClosing } from './entities/day-closing.entity';
import { Expense } from './entities/expense.entity';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './business/business.module';
import { ProductModule } from './product/product.module';
import { PurchaseModule } from './purchase/purchase.module';
import { SaleModule } from './sale/sale.module';
import { ReportsModule } from './reports/reports.module';
import { ClosingModule } from './closing/closing.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [User, Business, Product, Purchase, Sale, DayClosing, Expense],
        synchronize: false,
        ssl:
          config.get('DATABASE_SSL') === 'true'
            ? { rejectUnauthorized: false }
            : false,
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    AuthModule,
    BusinessModule,
    ProductModule,
    PurchaseModule,
    SaleModule,
    ReportsModule,
    ClosingModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
