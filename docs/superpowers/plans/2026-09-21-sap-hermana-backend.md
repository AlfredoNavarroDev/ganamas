# SAP hermana Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the delivered `sap-hermana-backend` package (entities, DTOs, migrations, seed script) into the real `/backend` NestJS v11 scaffold and build the modules/controllers/services that implement the sales-tracking API described in the closed domain spec.

**Architecture:** One NestJS module per entity (Auth, Business, Product, Purchase, Sale) plus a cross-cutting Reports module, all registered on a shared `TypeOrmModule` connection. Money/quantity math goes through `decimal.js` against `numeric` columns stored as strings; stock-affecting writes (Purchase create, Sale create/delete) run inside a DB transaction with a pessimistic write lock on the affected `Product` row.

**Tech Stack:** NestJS v11, TypeORM + PostgreSQL (`pg`), `@nestjs/config`, `@nestjs/jwt` + `@nestjs/passport` + `passport-jwt`, `class-validator`/`class-transformer`, `bcrypt`, `decimal.js`, `@nestjs/swagger`, Jest + Supertest (already scaffolded).

**Spec:** `docs/superpowers/specs/2026-09-21-sap-hermana-backend-design.md`

## Global Constraints

- Package manager for `/backend` is **npm** (matches existing `package-lock.json`) — never pnpm/yarn here.
- `synchronize: false` always. Every schema change goes through a TypeORM migration — never edit an entity expecting auto-sync.
- Every `numeric` column (`price`, `stock`, `avg_cost`, `quantity`, `unit_cost`, `unit_price`, `list_price`, `total*`, `profit`, `discount`) is typed as TypeScript `string`. All arithmetic on these values goes through `decimal.js` (`new Decimal(x)`), never native `number`/floats.
- Generated columns — `Purchase.totalCost`; `Sale.total`, `Sale.profit`, `Sale.discount` — are already mapped `insert: false, update: false` in the entities. Application code must never assign them.
- Every report/aggregation query that groups by day or hour must convert with `AT TIME ZONE 'America/Lima'` (Peru is UTC-5, no DST). This is the single most important correctness rule per the closed spec — a bug here is silent (KPIs are just wrong, no error).
- Global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })` is wired in Task 1's `main.ts`, not deferred to the end — pagination and other query-param transforms depend on it from the start.
- `JwtAuthGuard` is registered as a global `APP_GUARD` in `AuthModule`. Only `POST /auth/login` carries `@Public()`.
- Env vars: `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN` (default `30d`, no refresh token — single-user app), `SEED_USERNAME`, `SEED_PASSWORD`, `LOW_STOCK_THRESHOLD` (default `5`), `PORT` (default `3000`), `NODE_ENV`.
- Swagger is served at `/api/docs` with bearer-auth registered, and is skipped entirely when `NODE_ENV=production`.
- Backend implementation follows the `nestjs-stack` skill's conventions (module structure, DTO/testing patterns) over ad-hoc choices.
- Commit messages are plain, conventional-commit style. **Never add a `Co-Authored-By` trailer** — unbreakable project rule.
- Every e2e suite assumes the developer has already run `npm run migration:run` and the seed script (Task 1) against a real local Postgres, and that `SEED_USERNAME`/`SEED_PASSWORD` are set in `backend/.env`. E2e tests log in with those credentials rather than creating throwaway users, matching the app's real (seed-only, no public registration) auth flow.

---

## File Structure

```
backend/
  .env.example                          # Task 1
  data-source.ts                        # Task 1 (moved)
  src/
    main.ts                             # Task 1 (ValidationPipe), Task 9 (Swagger)
    app.module.ts                       # grows across Tasks 1, 3-8
    entities/                           # Task 1 (moved, unchanged)
      user.entity.ts
      business.entity.ts
      product.entity.ts
      purchase.entity.ts
      sale.entity.ts
    migrations/                         # Task 1 (moved, unchanged)
    scripts/
      seed-user.ts                      # Task 1 (moved, unchanged)
    common/
      dto/
        pagination-query.dto.ts         # Task 2
        pagination-query.dto.spec.ts    # Task 2
    auth/                               # Task 3
      auth.module.ts
      auth.controller.ts
      auth.service.ts
      auth.service.spec.ts
      jwt.strategy.ts
      guards/jwt-auth.guard.ts
      decorators/public.decorator.ts
      decorators/current-user.decorator.ts
      dto/login.dto.ts                  # moved from sap-hermana-backend/src/dto
    business/                           # Task 4
      business.module.ts
      business.controller.ts
      business.service.ts
      business.service.spec.ts
      dto/create-business.dto.ts
      dto/update-business.dto.ts
    product/                            # Task 5
      product.module.ts
      product.controller.ts
      product.service.ts
      product.service.spec.ts
      dto/create-product.dto.ts         # moved
      dto/update-product.dto.ts
      dto/list-products-query.dto.ts
    purchase/                           # Task 6
      purchase.module.ts
      purchase.controller.ts
      purchase.service.ts
      purchase.service.spec.ts
      dto/create-purchase.dto.ts        # moved
      dto/list-purchases-query.dto.ts
    sale/                               # Task 7
      sale.module.ts
      sale.controller.ts
      sale.service.ts
      sale.service.spec.ts
      dto/create-sale.dto.ts            # moved
      dto/list-sales-query.dto.ts
    reports/                            # Task 8
      reports.module.ts
      reports.controller.ts
      reports.service.ts
      reports.service.spec.ts
      dto/reports-query.dto.ts
  test/
    business.e2e-spec.ts                # Task 4
    product.e2e-spec.ts                 # Task 5
    purchase.e2e-spec.ts                # Task 6
    sale.e2e-spec.ts                    # Task 7
    reports.e2e-spec.ts                 # Task 8
    swagger.e2e-spec.ts                 # Task 9
    (app.e2e-spec.ts deleted in Task 1 — tested the removed default AppController)
README.md                               # Task 9 (replaces default Nest CLI README)
```

---

### Task 1: Scaffolding — move files, install deps, wire config, verify DB bootstrap

**Files:**
- Create: `backend/data-source.ts` (moved), `backend/src/entities/*.entity.ts` (moved), `backend/src/migrations/*.ts` (moved), `backend/src/scripts/seed-user.ts` (moved), `backend/.env.example`
- Modify: `backend/package.json`, `backend/src/app.module.ts`, `backend/src/main.ts`
- Delete: `backend/src/app.controller.ts`, `backend/src/app.controller.spec.ts`, `backend/src/app.service.ts`, `backend/test/app.e2e-spec.ts`

**Interfaces:**
- Produces: a running `AppModule` with `ConfigModule` (global) and `TypeOrmModule` connected to Postgres; a global `ValidationPipe`; `User`, `Business`, `Product`, `Purchase`, `Sale` entity classes importable from `../entities/<name>.entity`; `npm run migration:run` and a working seed script. Every later task's module imports these entities and relies on the global pipe already being active.

- [ ] **Step 1: Move the delivered files into `/backend`**

Run from the repo root (`ganamas/`):

```bash
git mv sap-hermana-backend/data-source.ts backend/data-source.ts
git mv sap-hermana-backend/src/entities backend/src/entities
git mv sap-hermana-backend/src/migrations backend/src/migrations
git mv sap-hermana-backend/src/scripts backend/src/scripts
```

`sap-hermana-backend/src/dto/*.ts` are **not** moved here — each later task moves its own DTO file directly into its module's `dto/` folder. `sap-hermana-backend/CLAUDE.md` and `README.md` stay in place as the closed domain-rules reference.

- [ ] **Step 2: Install dependencies**

Run from `backend/`:

```bash
npm install @nestjs/typeorm typeorm pg @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt decimal.js @nestjs/swagger
npm install -D @types/passport-jwt @types/bcrypt
```

- [ ] **Step 3: Add `.env.example` and TypeORM CLI scripts**

Create `backend/.env.example`:

```
DATABASE_URL=postgresql://usuario:password@localhost:5432/sap_hermana
JWT_SECRET=change-me
JWT_EXPIRES_IN=30d
SEED_USERNAME=admin
SEED_PASSWORD=change-me
LOW_STOCK_THRESHOLD=5
PORT=3000
NODE_ENV=development
```

In `backend/package.json`, add to `"scripts"`:

```json
"typeorm": "typeorm-ts-node-commonjs",
"migration:run": "npm run typeorm -- migration:run -d data-source.ts",
"migration:revert": "npm run typeorm -- migration:revert -d data-source.ts",
"migration:generate": "npm run typeorm -- migration:generate -d data-source.ts",
"seed:user": "ts-node src/scripts/seed-user.ts"
```

- [ ] **Step 4: Remove default Nest CLI boilerplate**

```bash
rm backend/src/app.controller.ts backend/src/app.controller.spec.ts backend/src/app.service.ts backend/test/app.e2e-spec.ts
```

- [ ] **Step 5: Wire `ConfigModule` + `TypeOrmModule` in `app.module.ts`**

Replace `backend/src/app.module.ts` with:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Business } from './entities/business.entity';
import { Product } from './entities/product.entity';
import { Purchase } from './entities/purchase.entity';
import { Sale } from './entities/sale.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.getOrThrow<string>('DATABASE_URL'),
        entities: [User, Business, Product, Purchase, Sale],
        synchronize: false,
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
  ],
})
export class AppModule {}
```

- [ ] **Step 6: Set the global `ValidationPipe` in `main.ts`**

Replace `backend/src/main.ts` with:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 7: Verify migrations and seed run against a real Postgres**

Create `backend/.env` (copy from `.env.example`, point `DATABASE_URL` at a local Postgres instance you control), then run from `backend/`:

```bash
npm run migration:run
```

Expected: output lists the 5 migrations applied (`CreateExtensionAndUser`, `CreateBusiness`, `CreateProduct`, `CreatePurchase`, `CreateSale`), exit code 0.

```bash
npm run seed:user
```

Expected: `Usuario "<SEED_USERNAME>" creado/actualizado correctamente.`, exit code 0.

```bash
npm run start:dev
```

Expected: Nest logs `Nest application successfully started` with no errors, confirming `TypeOrmModule` connected. Stop it (Ctrl+C) once confirmed.

- [ ] **Step 8: Commit**

```bash
git add backend/data-source.ts backend/src/entities backend/src/migrations backend/src/scripts backend/.env.example backend/package.json backend/package-lock.json backend/src/app.module.ts backend/src/main.ts
git rm backend/src/app.controller.ts backend/src/app.controller.spec.ts backend/src/app.service.ts backend/test/app.e2e-spec.ts
git commit -m "chore: scaffold backend with TypeORM, config, and moved entities/migrations"
```

---

### Task 2: Shared pagination query DTO

**Files:**
- Create: `backend/src/common/dto/pagination-query.dto.ts`
- Test: `backend/src/common/dto/pagination-query.dto.spec.ts`

**Interfaces:**
- Consumes: nothing (no prior task dependency beyond `class-validator`/`class-transformer`, installed in Task 1).
- Produces: `PaginationQueryDto` with optional `page?: number` and `limit?: number`, transformed from query-string values. `ListPurchasesQueryDto` (Task 6) and `ListSalesQueryDto` (Task 7) extend this.

- [ ] **Step 1: Write the failing test**

```typescript
// backend/src/common/dto/pagination-query.dto.spec.ts
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

describe('PaginationQueryDto', () => {
  it('transforms numeric query strings into numbers', async () => {
    const dto = plainToInstance(PaginationQueryDto, { page: '2', limit: '10' });
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(10);
  });

  it('allows page and limit to be omitted', async () => {
    const dto = plainToInstance(PaginationQueryDto, {});
    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.page).toBeUndefined();
    expect(dto.limit).toBeUndefined();
  });

  it('rejects a non-integer page', async () => {
    const dto = plainToInstance(PaginationQueryDto, { page: 'abc' });
    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- pagination-query.dto.spec.ts`
Expected: FAIL — `Cannot find module './pagination-query.dto'`

- [ ] **Step 3: Write the implementation**

```typescript
// backend/src/common/dto/pagination-query.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- pagination-query.dto.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/common
git commit -m "feat: add shared pagination query dto"
```

---

### Task 3: Auth module (JWT login, global guard)

**Files:**
- Create: `backend/src/auth/dto/login.dto.ts` (moved), `backend/src/auth/auth.module.ts`, `backend/src/auth/auth.controller.ts`, `backend/src/auth/auth.service.ts`, `backend/src/auth/jwt.strategy.ts`, `backend/src/auth/guards/jwt-auth.guard.ts`, `backend/src/auth/decorators/public.decorator.ts`, `backend/src/auth/decorators/current-user.decorator.ts`
- Test: `backend/src/auth/auth.service.spec.ts`, `backend/test/auth.e2e-spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `User` entity (Task 1).
- Produces: `AuthService.login(dto: LoginDto): Promise<{ accessToken: string }>`; `JwtAuthGuard` (global, via `APP_GUARD`); `@Public()` decorator (exempts a route from the guard); `@CurrentUser()` decorator returning `AuthenticatedUser = { userId: string; username: string }`, both importable from `../auth/decorators/*`. Every later controller relies on the guard already being global and on `@CurrentUser()`/`@Public()` existing.

- [ ] **Step 1: Move the login DTO**

```bash
mkdir -p backend/src/auth/dto
git mv sap-hermana-backend/src/dto/login.dto.ts backend/src/auth/dto/login.dto.ts
```

- [ ] **Step 2: Write the failing unit test for `AuthService`**

```typescript
// backend/src/auth/auth.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { User } from '../entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: { findOne: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    userRepository = { findOne: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed-jwt') };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('returns an access token when credentials are valid', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      username: 'hermana',
      passwordHash,
    });

    const result = await service.login({ username: 'hermana', password: 'correct-password' });

    expect(result).toEqual({ accessToken: 'signed-jwt' });
    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-1', username: 'hermana' });
  });

  it('throws UnauthorizedException when the user does not exist', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      service.login({ username: 'missing', password: 'whatever' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the password does not match', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      username: 'hermana',
      passwordHash,
    });

    await expect(
      service.login({ username: 'hermana', password: 'wrong-password' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- auth.service.spec.ts`
Expected: FAIL — `Cannot find module './auth.service'`

- [ ] **Step 4: Implement the auth building blocks**

```typescript
// backend/src/auth/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// backend/src/auth/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthenticatedUser {
  userId: string;
  username: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

```typescript
// backend/src/auth/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtPayload) {
    return { userId: payload.sub, username: payload.username };
  }
}
```

```typescript
// backend/src/auth/guards/jwt-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

```typescript
// backend/src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({ where: { username: dto.username } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) throw new UnauthorizedException('Invalid credentials');

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
    });

    return { accessToken };
  }
}
```

```typescript
// backend/src/auth/auth.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }
}
```

```typescript
// backend/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '30d') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AuthModule {}
```

Add `AuthModule` to `backend/src/app.module.ts`'s `imports` array (alongside `ConfigModule.forRoot` and `TypeOrmModule.forRootAsync`):

```typescript
import { AuthModule } from './auth/auth.module';
// ...
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  TypeOrmModule.forRootAsync({ /* unchanged from Task 1 */ }),
  AuthModule,
],
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- auth.service.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Write and run the e2e test**

```typescript
// backend/test/auth.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in with the seeded credentials and returns a JWT', async () => {
    const response = await request(app.getHttpServer()).post('/auth/login').send({
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
```

Run: `npm run test:e2e -- auth.e2e-spec.ts`
Expected: PASS (3 tests) — requires the seeded DB from Task 1, Step 7.

- [ ] **Step 7: Commit**

```bash
git add backend/src/auth backend/src/app.module.ts backend/test/auth.e2e-spec.ts
git commit -m "feat: add auth module with JWT login and global guard"
```

---

### Task 4: Business module

**Files:**
- Create: `backend/src/business/dto/create-business.dto.ts`, `backend/src/business/dto/update-business.dto.ts`, `backend/src/business/business.module.ts`, `backend/src/business/business.controller.ts`, `backend/src/business/business.service.ts`
- Test: `backend/src/business/business.service.spec.ts`, `backend/test/business.e2e-spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `Business`, `User` entities (Task 1); `@CurrentUser()`, `AuthenticatedUser`, `JwtAuthGuard` (Task 3, applied globally — no explicit `@UseGuards` needed).
- Produces: `BusinessService.create/findAll/update`, scoped by `ownerId`. No later task depends on Business's internals (Product/Purchase/Sale reference `businessId` directly, not through this service).

- [ ] **Step 1: Write the failing unit test**

```typescript
// backend/src/business/business.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { BusinessService } from './business.service';
import { Business } from '../entities/business.entity';

describe('BusinessService', () => {
  let service: BusinessService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve({ id: 'business-1', ...value })),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [BusinessService, { provide: getRepositoryToken(Business), useValue: repository }],
    }).compile();

    service = module.get(BusinessService);
  });

  it('creates a business scoped to the owner', async () => {
    const result = await service.create('owner-1', { name: 'Frutas' });

    expect(repository.create).toHaveBeenCalledWith({
      owner: { id: 'owner-1' },
      name: 'Frutas',
    });
    expect(result).toMatchObject({ id: 'business-1', name: 'Frutas' });
  });

  it('lists only the owner\'s active businesses by default', async () => {
    repository.find.mockResolvedValue([]);

    await service.findAll('owner-1', true);

    expect(repository.find).toHaveBeenCalledWith({
      where: { owner: { id: 'owner-1' }, active: true },
    });
  });

  it('throws NotFoundException when updating a business the owner does not have', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.update('owner-1', 'missing', { active: false })).rejects.toThrow(
      NotFoundException,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- business.service.spec.ts`
Expected: FAIL — `Cannot find module './business.service'`

- [ ] **Step 3: Implement the Business module**

```typescript
// backend/src/business/dto/create-business.dto.ts
import { IsString, Length } from 'class-validator';

export class CreateBusinessDto {
  @IsString()
  @Length(1, 100)
  name: string;
}
```

```typescript
// backend/src/business/dto/update-business.dto.ts
import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateBusinessDto } from './create-business.dto';

export class UpdateBusinessDto extends PartialType(CreateBusinessDto) {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
```

```typescript
// backend/src/business/business.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../entities/business.entity';
import { User } from '../entities/user.entity';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business) private readonly businessRepository: Repository<Business>,
  ) {}

  create(ownerId: string, dto: CreateBusinessDto) {
    const business = this.businessRepository.create({
      owner: { id: ownerId } as User,
      name: dto.name,
    });
    return this.businessRepository.save(business);
  }

  findAll(ownerId: string, active: boolean) {
    return this.businessRepository.find({ where: { owner: { id: ownerId }, active } });
  }

  async update(ownerId: string, id: string, dto: UpdateBusinessDto) {
    const business = await this.businessRepository.findOne({
      where: { id, owner: { id: ownerId } },
    });
    if (!business) throw new NotFoundException('Business not found');
    Object.assign(business, dto);
    return this.businessRepository.save(business);
  }
}
```

```typescript
// backend/src/business/business.controller.ts
import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { BusinessService } from './business.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('businesses')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBusinessDto) {
    return this.businessService.create(user.userId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('active') active?: string) {
    const activeFilter = active === undefined ? true : active === 'true';
    return this.businessService.findAll(user.userId, activeFilter);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBusinessDto,
  ) {
    return this.businessService.update(user.userId, id, dto);
  }
}
```

```typescript
// backend/src/business/business.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Business } from '../entities/business.entity';
import { BusinessController } from './business.controller';
import { BusinessService } from './business.service';

@Module({
  imports: [TypeOrmModule.forFeature([Business])],
  controllers: [BusinessController],
  providers: [BusinessService],
})
export class BusinessModule {}
```

Add `BusinessModule` to `backend/src/app.module.ts`'s `imports` array.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- business.service.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write and run the e2e test**

```typescript
// backend/test/business.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
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
```

Run: `npm run test:e2e -- business.e2e-spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/business backend/src/app.module.ts backend/test/business.e2e-spec.ts
git commit -m "feat: add business module with owner-scoped CRUD"
```

---

### Task 5: Product module

**Files:**
- Create: `backend/src/product/dto/create-product.dto.ts` (moved), `backend/src/product/dto/update-product.dto.ts`, `backend/src/product/dto/list-products-query.dto.ts`, `backend/src/product/product.module.ts`, `backend/src/product/product.controller.ts`, `backend/src/product/product.service.ts`
- Test: `backend/src/product/product.service.spec.ts`, `backend/test/product.e2e-spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `Product`, `Business` entities (Task 1).
- Produces: `ProductService.create/findAll/update/remove`. Task 6 (Purchase) and Task 7 (Sale) read/write `Product` rows directly via `EntityManager` inside their own transactions — they do not call `ProductService`.

- [ ] **Step 1: Move the create-product DTO**

```bash
mkdir -p backend/src/product/dto
git mv sap-hermana-backend/src/dto/create-product.dto.ts backend/src/product/dto/create-product.dto.ts
```

- [ ] **Step 2: Write the failing unit test**

```typescript
// backend/src/product/product.service.spec.ts
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductService } from './product.service';
import { Product } from '../entities/product.entity';

describe('ProductService', () => {
  let service: ProductService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn((value) => value),
      save: jest.fn((value) => Promise.resolve({ id: 'product-1', ...value })),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [ProductService, { provide: getRepositoryToken(Product), useValue: repository }],
    }).compile();

    service = module.get(ProductService);
  });

  it('creates a product scoped to its business', async () => {
    await service.create({
      businessId: 'business-1',
      name: 'Palta hass madura',
      price: '5.00',
      unit: 'kg',
      category: 'palta',
    });

    expect(repository.create).toHaveBeenCalledWith({
      business: { id: 'business-1' },
      name: 'Palta hass madura',
      price: '5.00',
      unit: 'kg',
      category: 'palta',
    });
  });

  it('defaults the active filter to true when listing', async () => {
    repository.find.mockResolvedValue([]);

    await service.findAll({ businessId: 'business-1', active: undefined });

    expect(repository.find).toHaveBeenCalledWith({
      where: { business: { id: 'business-1' }, active: true },
    });
  });

  it('soft-deletes by setting active to false', async () => {
    repository.findOne.mockResolvedValue({ id: 'product-1', active: true });

    await service.remove('product-1');

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'product-1', active: false }),
    );
  });

  it('throws NotFoundException when removing a missing product', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- product.service.spec.ts`
Expected: FAIL — `Cannot find module './product.service'`

- [ ] **Step 4: Implement the Product module**

```typescript
// backend/src/product/dto/update-product.dto.ts
import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['businessId'] as const),
) {}
```

```typescript
// backend/src/product/dto/list-products-query.dto.ts
import { IsBooleanString, IsOptional, IsUUID } from 'class-validator';

export class ListProductsQueryDto {
  @IsUUID()
  businessId: string;

  @IsOptional()
  @IsBooleanString()
  active?: string;
}
```

```typescript
// backend/src/product/product.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Business } from '../entities/business.entity';
import { Product } from '../entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product) private readonly productRepository: Repository<Product>,
  ) {}

  create(dto: CreateProductDto) {
    const product = this.productRepository.create({
      business: { id: dto.businessId } as Business,
      name: dto.name,
      price: dto.price,
      unit: dto.unit,
      category: dto.category ?? null,
    });
    return this.productRepository.save(product);
  }

  findAll(query: ListProductsQueryDto) {
    const active = query.active === undefined ? true : query.active === 'true';
    return this.productRepository.find({
      where: { business: { id: query.businessId }, active },
    });
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    Object.assign(product, dto);
    return this.productRepository.save(product);
  }

  async remove(id: string) {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    product.active = false;
    return this.productRepository.save(product);
  }
}
```

```typescript
// backend/src/product/product.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListProductsQueryDto) {
    return this.productService.findAll(query);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
```

```typescript
// backend/src/product/product.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../entities/product.entity';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product])],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
```

Add `ProductModule` to `backend/src/app.module.ts`'s `imports` array.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- product.service.spec.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Write and run the e2e test**

```typescript
// backend/test/product.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
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
```

Run: `npm run test:e2e -- product.e2e-spec.ts`
Expected: PASS (1 test)

- [ ] **Step 7: Commit**

```bash
git add backend/src/product backend/src/app.module.ts backend/test/product.e2e-spec.ts
git commit -m "feat: add product module with soft-delete"
```

---

### Task 6: Purchase module (avg_cost recalculation, pessimistic lock)

**Files:**
- Create: `backend/src/purchase/dto/create-purchase.dto.ts` (moved), `backend/src/purchase/dto/list-purchases-query.dto.ts`, `backend/src/purchase/purchase.module.ts`, `backend/src/purchase/purchase.controller.ts`, `backend/src/purchase/purchase.service.ts`
- Test: `backend/src/purchase/purchase.service.spec.ts`, `backend/test/purchase.e2e-spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `Business`, `Product`, `Purchase` entities (Task 1); `PaginationQueryDto` (Task 2).
- Produces: `PurchaseService.create/findAll`. Establishes the transaction + pessimistic-lock + `decimal.js` pattern that Task 7 (Sale) repeats for stock control.

- [ ] **Step 1: Move the create-purchase DTO**

```bash
mkdir -p backend/src/purchase/dto
git mv sap-hermana-backend/src/dto/create-purchase.dto.ts backend/src/purchase/dto/create-purchase.dto.ts
```

- [ ] **Step 2: Write the failing unit test**

```typescript
// backend/src/purchase/purchase.service.spec.ts
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PurchaseService } from './purchase.service';
import { Purchase } from '../entities/purchase.entity';

describe('PurchaseService', () => {
  let service: PurchaseService;
  let manager: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    manager = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      create: jest.fn((_entityClass, plain) => plain),
    };
    dataSource = { transaction: jest.fn((callback) => callback(manager)) };

    const module = await Test.createTestingModule({
      providers: [
        PurchaseService,
        { provide: DataSource, useValue: dataSource },
        // findAll() uses this repository via createQueryBuilder — not exercised
        // by the tests below, so an empty stub is enough to satisfy Nest's DI.
        { provide: getRepositoryToken(Purchase), useValue: {} },
      ],
    }).compile();

    service = module.get(PurchaseService);
  });

  it('recalculates avg_cost as a stock-weighted average and increases stock', async () => {
    manager.findOne.mockResolvedValue({ id: 'product-1', stock: '10.00', avgCost: '2.00' });

    await service.create({
      businessId: 'business-1',
      productId: 'product-1',
      quantity: '10',
      unitCost: '4.00',
    });

    const savedProduct = manager.save.mock.calls[0][0];
    expect(savedProduct.stock).toBe('20.00');
    expect(savedProduct.avgCost).toBe('3.00');

    const savedPurchase = manager.save.mock.calls[1][0];
    expect(savedPurchase.quantity).toBe('10');
    expect(savedPurchase.unitCost).toBe('4.00');
  });

  it('keeps the existing avg_cost when the product had zero stock and this purchase is also zero', async () => {
    manager.findOne.mockResolvedValue({ id: 'product-1', stock: '0.00', avgCost: '0.00' });

    await service.create({
      businessId: 'business-1',
      productId: 'product-1',
      quantity: '0',
      unitCost: '5.00',
    });

    const savedProduct = manager.save.mock.calls[0][0];
    expect(savedProduct.avgCost).toBe('0.00');
  });

  it('throws NotFoundException when the product does not exist in that business', async () => {
    manager.findOne.mockResolvedValue(null);

    await expect(
      service.create({
        businessId: 'business-1',
        productId: 'missing',
        quantity: '1',
        unitCost: '1',
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- purchase.service.spec.ts`
Expected: FAIL — `Cannot find module './purchase.service'`

- [ ] **Step 4: Implement the Purchase module**

```typescript
// backend/src/purchase/dto/list-purchases-query.dto.ts
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListPurchasesQueryDto extends PaginationQueryDto {
  @IsUUID()
  businessId: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
```

```typescript
// backend/src/purchase/purchase.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { Business } from '../entities/business.entity';
import { Product } from '../entities/product.entity';
import { Purchase } from '../entities/purchase.entity';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ListPurchasesQueryDto } from './dto/list-purchases-query.dto';

@Injectable()
export class PurchaseService {
  constructor(
    @InjectRepository(Purchase) private readonly purchaseRepository: Repository<Purchase>,
    private readonly dataSource: DataSource,
  ) {}

  create(dto: CreatePurchaseDto) {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { id: dto.productId, business: { id: dto.businessId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Product not found');

      const quantity = new Decimal(dto.quantity);
      const unitCost = new Decimal(dto.unitCost);
      const currentStock = new Decimal(product.stock);
      const currentAvgCost = new Decimal(product.avgCost);
      const newStock = currentStock.plus(quantity);
      const newAvgCost = newStock.isZero()
        ? currentAvgCost
        : currentStock.times(currentAvgCost).plus(quantity.times(unitCost)).dividedBy(newStock);

      product.stock = newStock.toFixed(2);
      product.avgCost = newAvgCost.toFixed(2);
      await manager.save(product);

      const purchase = manager.create(Purchase, {
        business: { id: dto.businessId } as Business,
        product,
        quantity: dto.quantity,
        unitCost: dto.unitCost,
        purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : undefined,
      });
      return manager.save(purchase);
    });
  }

  async findAll(query: ListPurchasesQueryDto) {
    const qb = this.purchaseRepository
      .createQueryBuilder('purchase')
      .leftJoinAndSelect('purchase.product', 'product')
      .where('purchase.business = :businessId', { businessId: query.businessId });

    if (query.productId) {
      qb.andWhere('purchase.product = :productId', { productId: query.productId });
    }
    if (query.from) {
      qb.andWhere('purchase.purchasedAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('purchase.purchasedAt <= :to', { to: query.to });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const [data, total] = await qb
      .orderBy('purchase.purchasedAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }
}
```

```typescript
// backend/src/purchase/purchase.controller.ts
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { ListPurchasesQueryDto } from './dto/list-purchases-query.dto';

@Controller('purchases')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Post()
  create(@Body() dto: CreatePurchaseDto) {
    return this.purchaseService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListPurchasesQueryDto) {
    return this.purchaseService.findAll(query);
  }
}
```

```typescript
// backend/src/purchase/purchase.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Purchase } from '../entities/purchase.entity';
import { PurchaseController } from './purchase.controller';
import { PurchaseService } from './purchase.service';

@Module({
  imports: [TypeOrmModule.forFeature([Purchase])],
  controllers: [PurchaseController],
  providers: [PurchaseService],
})
export class PurchaseModule {}
```

Add `PurchaseModule` to `backend/src/app.module.ts`'s `imports` array.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- purchase.service.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Write and run the e2e test**

```typescript
// backend/test/purchase.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Purchase (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let businessId: string;
  let productId: string;

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
      .send({ name: `Purchase test business ${Date.now()}` });
    businessId = business.body.id;

    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, name: 'Palta hass', price: '5.00', unit: 'kg' });
    productId = product.body.id;
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
    const updatedProduct = productResponse.body.find((p: { id: string }) => p.id === productId);
    expect(updatedProduct.stock).toBe('10.00');
    expect(updatedProduct.avgCost).toBe('4.00');

    const listResponse = await request(app.getHttpServer())
      .get('/purchases')
      .query({ businessId, page: 1, limit: 10 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listResponse.body.total).toBeGreaterThanOrEqual(1);
    expect(listResponse.body.data.some((p: { productId?: string; product?: { id: string } }) => p.product?.id === productId)).toBe(true);
  });
});
```

Run: `npm run test:e2e -- purchase.e2e-spec.ts`
Expected: PASS (1 test)

- [ ] **Step 7: Commit**

```bash
git add backend/src/purchase backend/src/app.module.ts backend/test/purchase.e2e-spec.ts
git commit -m "feat: add purchase module with weighted avg_cost recalculation"
```

---

### Task 7: Sale module (stock control, pessimistic lock, delete-reverts-stock)

**Files:**
- Create: `backend/src/sale/dto/create-sale.dto.ts` (moved), `backend/src/sale/dto/list-sales-query.dto.ts`, `backend/src/sale/sale.module.ts`, `backend/src/sale/sale.controller.ts`, `backend/src/sale/sale.service.ts`
- Test: `backend/src/sale/sale.service.spec.ts`, `backend/test/sale.e2e-spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: `Business`, `Product`, `Sale` entities (Task 1); `PaginationQueryDto` (Task 2); repeats the transaction + pessimistic-lock pattern from Task 6.
- Produces: `SaleService.create/findAll/remove`. Task 8 (Reports) reads `sale` rows directly via raw SQL — it does not call `SaleService`.

- [ ] **Step 1: Move the create-sale DTO**

```bash
mkdir -p backend/src/sale/dto
git mv sap-hermana-backend/src/dto/create-sale.dto.ts backend/src/sale/dto/create-sale.dto.ts
```

- [ ] **Step 2: Write the failing unit test**

```typescript
// backend/src/sale/sale.service.spec.ts
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SaleService } from './sale.service';
import { Product } from '../entities/product.entity';
import { Sale } from '../entities/sale.entity';

describe('SaleService', () => {
  let service: SaleService;
  let manager: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; remove: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    manager = {
      findOne: jest.fn(),
      save: jest.fn((entity) => Promise.resolve(entity)),
      create: jest.fn((_entityClass, plain) => plain),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = { transaction: jest.fn((callback) => callback(manager)) };

    const module = await Test.createTestingModule({
      providers: [
        SaleService,
        { provide: DataSource, useValue: dataSource },
        // findAll() uses this repository via createQueryBuilder — not exercised
        // by the tests below, so an empty stub is enough to satisfy Nest's DI.
        { provide: getRepositoryToken(Sale), useValue: {} },
      ],
    }).compile();

    service = module.get(SaleService);
  });

  describe('create', () => {
    it('uses the catalog price and snapshots avg_cost when unitPrice is not given', async () => {
      manager.findOne.mockResolvedValue({
        id: 'product-1',
        stock: '10.00',
        price: '5.00',
        avgCost: '3.00',
      });

      await service.create({ businessId: 'business-1', productId: 'product-1', quantity: '2' });

      const savedProduct = manager.save.mock.calls[0][0];
      expect(savedProduct.stock).toBe('8.00');

      const savedSale = manager.save.mock.calls[1][0];
      expect(savedSale.listPrice).toBe('5.00');
      expect(savedSale.unitPrice).toBe('5.00');
      expect(savedSale.unitCost).toBe('3.00');
    });

    it('records a discount when unitPrice is lower than the catalog price', async () => {
      manager.findOne.mockResolvedValue({
        id: 'product-1',
        stock: '10.00',
        price: '5.00',
        avgCost: '3.00',
      });

      await service.create({
        businessId: 'business-1',
        productId: 'product-1',
        quantity: '2',
        unitPrice: '4.00',
      });

      const savedSale = manager.save.mock.calls[1][0];
      expect(savedSale.listPrice).toBe('5.00');
      expect(savedSale.unitPrice).toBe('4.00');
    });

    it('rejects a sale when stock is insufficient', async () => {
      manager.findOne.mockResolvedValue({ id: 'product-1', stock: '1.00', price: '5.00', avgCost: '3.00' });

      await expect(
        service.create({ businessId: 'business-1', productId: 'product-1', quantity: '2' }),
      ).rejects.toThrow(BadRequestException);
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the product does not exist in that business', async () => {
      manager.findOne.mockResolvedValue(null);

      await expect(
        service.create({ businessId: 'business-1', productId: 'missing', quantity: '1' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('reverts stock before deleting the sale', async () => {
      manager.findOne
        .mockResolvedValueOnce({ id: 'sale-1', quantity: '3', product: { id: 'product-1' } } as Sale)
        .mockResolvedValueOnce({ id: 'product-1', stock: '5.00' } as Product);

      await service.remove('sale-1');

      const savedProduct = manager.save.mock.calls[0][0];
      expect(savedProduct.stock).toBe('8.00');
      expect(manager.remove).toHaveBeenCalled();
    });

    it('throws NotFoundException when the sale does not exist', async () => {
      manager.findOne.mockResolvedValueOnce(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- sale.service.spec.ts`
Expected: FAIL — `Cannot find module './sale.service'`

- [ ] **Step 4: Implement the Sale module**

```typescript
// backend/src/sale/dto/list-sales-query.dto.ts
import { IsDateString, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListSalesQueryDto extends PaginationQueryDto {
  @IsUUID()
  businessId: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
```

```typescript
// backend/src/sale/sale.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { Business } from '../entities/business.entity';
import { Product } from '../entities/product.entity';
import { Sale } from '../entities/sale.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';

@Injectable()
export class SaleService {
  constructor(
    @InjectRepository(Sale) private readonly saleRepository: Repository<Sale>,
    private readonly dataSource: DataSource,
  ) {}

  create(dto: CreateSaleDto) {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { id: dto.productId, business: { id: dto.businessId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Product not found');

      const quantity = new Decimal(dto.quantity);
      const stock = new Decimal(product.stock);
      if (stock.lessThan(quantity)) {
        throw new BadRequestException('Insufficient stock');
      }

      const listPrice = new Decimal(product.price);
      const unitPrice = dto.unitPrice !== undefined ? new Decimal(dto.unitPrice) : listPrice;

      product.stock = stock.minus(quantity).toFixed(2);
      await manager.save(product);

      const sale = manager.create(Sale, {
        business: { id: dto.businessId } as Business,
        product,
        quantity: dto.quantity,
        listPrice: listPrice.toFixed(2),
        unitPrice: unitPrice.toFixed(2),
        unitCost: product.avgCost,
        paymentMethod: dto.paymentMethod ?? 'efectivo',
        soldAt: dto.soldAt ? new Date(dto.soldAt) : undefined,
      });
      return manager.save(sale);
    });
  }

  async remove(id: string) {
    return this.dataSource.transaction(async (manager) => {
      const sale = await manager.findOne(Sale, { where: { id }, relations: { product: true } });
      if (!sale) throw new NotFoundException('Sale not found');

      const product = await manager.findOne(Product, {
        where: { id: sale.product.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!product) throw new NotFoundException('Product not found');

      product.stock = new Decimal(product.stock).plus(sale.quantity).toFixed(2);
      await manager.save(product);
      await manager.remove(sale);
    });
  }

  async findAll(query: ListSalesQueryDto) {
    const qb = this.saleRepository
      .createQueryBuilder('sale')
      .leftJoinAndSelect('sale.product', 'product')
      .where('sale.business = :businessId', { businessId: query.businessId });

    if (query.productId) {
      qb.andWhere('sale.product = :productId', { productId: query.productId });
    }
    if (query.from) {
      qb.andWhere('sale.soldAt >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('sale.soldAt <= :to', { to: query.to });
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const [data, total] = await qb
      .orderBy('sale.soldAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }
}
```

```typescript
// backend/src/sale/sale.controller.ts
import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { SaleService } from './sale.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';

@Controller('sales')
export class SaleController {
  constructor(private readonly saleService: SaleService) {}

  @Post()
  create(@Body() dto: CreateSaleDto) {
    return this.saleService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListSalesQueryDto) {
    return this.saleService.findAll(query);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.saleService.remove(id);
  }
}
```

```typescript
// backend/src/sale/sale.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sale } from '../entities/sale.entity';
import { SaleController } from './sale.controller';
import { SaleService } from './sale.service';

@Module({
  imports: [TypeOrmModule.forFeature([Sale])],
  controllers: [SaleController],
  providers: [SaleService],
})
export class SaleModule {}
```

Add `SaleModule` to `backend/src/app.module.ts`'s `imports` array.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- sale.service.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Write and run the e2e test**

```typescript
// backend/test/sale.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Sale (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let businessId: string;
  let productId: string;

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
      .send({ name: `Sale test business ${Date.now()}` });
    businessId = business.body.id;

    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, name: 'Palta hass', price: '5.00', unit: 'kg' });
    productId = product.body.id;

    await request(app.getHttpServer())
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, productId, quantity: '10', unitCost: '2.00' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a sale larger than available stock', async () => {
    await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, productId, quantity: '999' })
      .expect(400);
  });

  it('creates a sale, discounts stock, and reverts it on delete', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, productId, quantity: '4', unitPrice: '4.50' })
      .expect(201);
    const saleId = createResponse.body.id;

    const afterSale = await request(app.getHttpServer())
      .get('/products')
      .query({ businessId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(afterSale.body.find((p: { id: string }) => p.id === productId).stock).toBe('6.00');

    await request(app.getHttpServer())
      .delete(`/sales/${saleId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const afterDelete = await request(app.getHttpServer())
      .get('/products')
      .query({ businessId })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(afterDelete.body.find((p: { id: string }) => p.id === productId).stock).toBe('10.00');
  });
});
```

Run: `npm run test:e2e -- sale.e2e-spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add backend/src/sale backend/src/app.module.ts backend/test/sale.e2e-spec.ts
git commit -m "feat: add sale module with stock control and delete-reverts-stock"
```

---

### Task 8: Reports module (weekly-summary, kpis)

**Files:**
- Create: `backend/src/reports/dto/reports-query.dto.ts`, `backend/src/reports/reports.module.ts`, `backend/src/reports/reports.controller.ts`, `backend/src/reports/reports.service.ts`
- Test: `backend/src/reports/reports.service.spec.ts`, `backend/test/reports.e2e-spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Consumes: raw SQL against the `sale` and `product` tables via `DataSource.query` (chosen over `QueryBuilder` here because these are Postgres-specific aggregations — `date_trunc`, `AT TIME ZONE`, `EXTRACT(HOUR ...)` — and raw SQL avoids any ambiguity in how TypeORM's `QueryBuilder` maps relation properties to columns); `ConfigService` for `LOW_STOCK_THRESHOLD`.
- Produces: `GET /reports/weekly-summary`, `GET /reports/kpis`. Terminal task — nothing later depends on this module.

- [ ] **Step 1: Write the failing unit test**

This test does not hit a real DB — it mocks `DataSource.query` and asserts (a) the returned shape and (b) that the SQL sent for day/hour grouping contains the Lima timezone conversion, since that conversion is the single most safety-critical piece of this module.

```typescript
// backend/src/reports/reports.service.spec.ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  let service: ReportsService;
  let dataSource: { query: jest.Mock };

  beforeEach(async () => {
    dataSource = { query: jest.fn().mockResolvedValue([]) };

    const module = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: DataSource, useValue: dataSource },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('5') } },
      ],
    }).compile();

    service = module.get(ReportsService);
  });

  it('groups the weekly summary by day converted to America/Lima', async () => {
    await service.weeklySummary('business-1', '2026-01-01', '2026-01-08');

    const dailySql = dataSource.query.mock.calls[0][0];
    expect(dailySql).toContain("AT TIME ZONE 'America/Lima'");
    expect(dailySql).toContain('date_trunc');
  });

  it('returns daily rows and a payment-method breakdown', async () => {
    dataSource.query.mockResolvedValueOnce([{ day: '2026-01-01', revenue: '10.00' }]);
    dataSource.query.mockResolvedValueOnce([{ paymentMethod: 'efectivo', revenue: '10.00' }]);

    const result = await service.weeklySummary('business-1', '2026-01-01', '2026-01-08');

    expect(result.daily).toEqual([{ day: '2026-01-01', revenue: '10.00' }]);
    expect(result.byPaymentMethod).toEqual([{ paymentMethod: 'efectivo', revenue: '10.00' }]);
  });

  it('ranks best day and best hour by profit, and applies the low-stock threshold', async () => {
    await service.kpis('business-1', '2026-01-01', '2026-01-08');

    const bestDaySql = dataSource.query.mock.calls[0][0];
    const bestHourSql = dataSource.query.mock.calls[1][0];
    const lowStockSql = dataSource.query.mock.calls[3][0];
    const lowStockParams = dataSource.query.mock.calls[3][1];

    expect(bestDaySql).toContain("AT TIME ZONE 'America/Lima'");
    expect(bestDaySql).toContain('ORDER BY profit DESC');
    expect(bestHourSql).toContain('EXTRACT(HOUR FROM');
    expect(lowStockSql).toContain('stock <');
    expect(lowStockParams).toContain(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- reports.service.spec.ts`
Expected: FAIL — `Cannot find module './reports.service'`

- [ ] **Step 3: Implement the Reports module**

```typescript
// backend/src/reports/dto/reports-query.dto.ts
import { IsDateString, IsUUID } from 'class-validator';

export class ReportsQueryDto {
  @IsUUID()
  businessId: string;

  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}
```

```typescript
// backend/src/reports/reports.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  async weeklySummary(businessId: string, from: string, to: string) {
    const daily = await this.dataSource.query(
      `SELECT date_trunc('day', sold_at AT TIME ZONE 'America/Lima') AS day,
              COALESCE(SUM(total), 0) AS revenue,
              COALESCE(SUM(quantity * unit_cost), 0) AS cost,
              COALESCE(SUM(profit), 0) AS profit,
              COALESCE(SUM(discount), 0) AS discount
         FROM sale
        WHERE business_id = $1 AND sold_at BETWEEN $2 AND $3
        GROUP BY day
        ORDER BY day ASC`,
      [businessId, from, to],
    );

    const byPaymentMethod = await this.dataSource.query(
      `SELECT payment_method AS "paymentMethod",
              COALESCE(SUM(total), 0) AS revenue
         FROM sale
        WHERE business_id = $1 AND sold_at BETWEEN $2 AND $3
        GROUP BY payment_method`,
      [businessId, from, to],
    );

    return { daily, byPaymentMethod };
  }

  async kpis(businessId: string, from: string, to: string) {
    const bestDayRows = await this.dataSource.query(
      `SELECT date_trunc('day', sold_at AT TIME ZONE 'America/Lima') AS day,
              COALESCE(SUM(profit), 0) AS profit
         FROM sale
        WHERE business_id = $1 AND sold_at BETWEEN $2 AND $3
        GROUP BY day
        ORDER BY profit DESC
        LIMIT 1`,
      [businessId, from, to],
    );

    const bestHourRows = await this.dataSource.query(
      `SELECT EXTRACT(HOUR FROM sold_at AT TIME ZONE 'America/Lima') AS hour,
              COALESCE(SUM(profit), 0) AS profit
         FROM sale
        WHERE business_id = $1 AND sold_at BETWEEN $2 AND $3
        GROUP BY hour
        ORDER BY profit DESC
        LIMIT 1`,
      [businessId, from, to],
    );

    const topProducts = await this.dataSource.query(
      `SELECT p.id AS "productId", p.name AS "productName",
              COALESCE(SUM(s.profit), 0) AS profit
         FROM sale s
         JOIN product p ON p.id = s.product_id
        WHERE s.business_id = $1 AND s.sold_at BETWEEN $2 AND $3
        GROUP BY p.id, p.name
        ORDER BY profit DESC
        LIMIT 5`,
      [businessId, from, to],
    );

    const lowStockThreshold = Number(this.configService.get('LOW_STOCK_THRESHOLD', '5'));
    const lowStock = await this.dataSource.query(
      `SELECT id, name, stock
         FROM product
        WHERE business_id = $1 AND active = true AND stock < $2
        ORDER BY stock ASC`,
      [businessId, lowStockThreshold],
    );

    return {
      bestDay: bestDayRows[0] ?? null,
      bestHour: bestHourRows[0] ?? null,
      topProducts,
      lowStock,
    };
  }
}
```

```typescript
// backend/src/reports/reports.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsQueryDto } from './dto/reports-query.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('weekly-summary')
  weeklySummary(@Query() query: ReportsQueryDto) {
    return this.reportsService.weeklySummary(query.businessId, query.from, query.to);
  }

  @Get('kpis')
  kpis(@Query() query: ReportsQueryDto) {
    return this.reportsService.kpis(query.businessId, query.from, query.to);
  }
}
```

```typescript
// backend/src/reports/reports.module.ts
import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
```

Add `ReportsModule` to `backend/src/app.module.ts`'s `imports` array.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- reports.service.spec.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Write and run the e2e test — including the Lima day-boundary edge case**

This is the scenario the closed spec calls out explicitly: a sale at 7pm Sunday in Lima must be grouped as Sunday, not Monday, even though in UTC it has already crossed midnight.

```typescript
// backend/test/reports.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Reports (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let businessId: string;
  let productId: string;

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
      .send({ name: `Reports test business ${Date.now()}` });
    businessId = business.body.id;

    const product = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, name: 'Palta hass', price: '5.00', unit: 'kg' });
    productId = product.body.id;

    await request(app.getHttpServer())
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ businessId, productId, quantity: '100', unitCost: '2.00' });

    // 2026-01-04 is a Sunday. 19:00 Lima (UTC-5) time is 2026-01-05T00:00:00Z —
    // already Monday in UTC, but must still be reported as Sunday in Lima time.
    await request(app.getHttpServer())
      .post('/sales')
      .set('Authorization', `Bearer ${token}`)
      .send({
        businessId,
        productId,
        quantity: '1',
        unitPrice: '5.00',
        soldAt: '2026-01-05T00:00:00.000Z',
      })
      .expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('groups the Sunday-7pm-Lima sale as Sunday, not Monday', async () => {
    const response = await request(app.getHttpServer())
      .get('/reports/weekly-summary')
      .query({ businessId, from: '2026-01-04T00:00:00.000Z', to: '2026-01-11T00:00:00.000Z' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const sundayRow = response.body.daily.find((row: { day: string }) =>
      row.day.startsWith('2026-01-04'),
    );
    const mondayRow = response.body.daily.find((row: { day: string }) =>
      row.day.startsWith('2026-01-05'),
    );

    expect(sundayRow).toBeDefined();
    expect(Number(sundayRow.revenue)).toBeCloseTo(5.0, 2);
    expect(mondayRow).toBeUndefined();
  });

  it('flags the product under the low-stock threshold in kpis', async () => {
    const response = await request(app.getHttpServer())
      .get('/reports/kpis')
      .query({ businessId, from: '2026-01-01T00:00:00.000Z', to: '2026-01-11T00:00:00.000Z' })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.lowStock).toEqual([]);
    expect(response.body.topProducts[0].productId).toBe(productId);
  });
});
```

Run: `npm run test:e2e -- reports.e2e-spec.ts`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/reports backend/src/app.module.ts backend/test/reports.e2e-spec.ts
git commit -m "feat: add reports module with Lima-timezone weekly summary and kpis"
```

---

### Task 9: Swagger, README, final full-suite verification

**Files:**
- Create: `backend/README.md` (replaces default)
- Test: `backend/test/swagger.e2e-spec.ts`
- Modify: `backend/src/main.ts`, every `Create*Dto` (`LoginDto`, `CreateBusinessDto`, `CreateProductDto`, `CreatePurchaseDto`, `CreateSaleDto`) — add `@ApiProperty`

**Interfaces:**
- Consumes: every module from Tasks 3-8 (Swagger introspects their controllers/DTOs).
- Produces: `/api/docs` (skipped when `NODE_ENV=production`); `backend/README.md`. Terminal task.

- [ ] **Step 1: Write the failing e2e test for Swagger**

```typescript
// backend/test/swagger.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { setupSwagger } from '../src/swagger';

describe('Swagger (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the Swagger UI at /api/docs', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:e2e -- swagger.e2e-spec.ts`
Expected: FAIL — `Cannot find module '../src/swagger'`

- [ ] **Step 3: Implement Swagger setup**

```typescript
// backend/src/swagger.ts
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
```

Update `backend/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
bootstrap();
```

Tag each controller so its routes group correctly under Swagger — add to the top of each:

```typescript
// backend/src/auth/auth.controller.ts
import { ApiTags } from '@nestjs/swagger';
// ...
@ApiTags('Auth')
@Controller('auth')
export class AuthController { /* unchanged body */ }
```

```typescript
// backend/src/business/business.controller.ts
import { ApiTags } from '@nestjs/swagger';
// ...
@ApiTags('Businesses')
@Controller('businesses')
export class BusinessController { /* unchanged body */ }
```

```typescript
// backend/src/product/product.controller.ts
import { ApiTags } from '@nestjs/swagger';
// ...
@ApiTags('Products')
@Controller('products')
export class ProductController { /* unchanged body */ }
```

```typescript
// backend/src/purchase/purchase.controller.ts
import { ApiTags } from '@nestjs/swagger';
// ...
@ApiTags('Purchases')
@Controller('purchases')
export class PurchaseController { /* unchanged body */ }
```

```typescript
// backend/src/sale/sale.controller.ts
import { ApiTags } from '@nestjs/swagger';
// ...
@ApiTags('Sales')
@Controller('sales')
export class SaleController { /* unchanged body */ }
```

```typescript
// backend/src/reports/reports.controller.ts
import { ApiTags } from '@nestjs/swagger';
// ...
@ApiTags('Reports')
@Controller('reports')
export class ReportsController { /* unchanged body */ }
```

Add `@ApiProperty` to every `Create*Dto` so Swagger renders real field docs instead of empty schemas:

```typescript
// backend/src/auth/dto/login.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'hermana' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'super-secret' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
```

```typescript
// backend/src/business/dto/create-business.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateBusinessDto {
  @ApiProperty({ example: 'Frutas' })
  @IsString()
  @Length(1, 100)
  name: string;
}
```

```typescript
// backend/src/product/dto/create-product.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsString, Length, IsNumberString, IsIn, IsOptional } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ example: 'Palta hass madura' })
  @IsString()
  @Length(1, 150)
  name: string;

  @ApiProperty({ example: '5.00' })
  @IsNumberString()
  price: string;

  @ApiProperty({ enum: ['unidad', 'kg'], example: 'kg' })
  @IsIn(['unidad', 'kg'])
  unit: 'unidad' | 'kg';

  @ApiProperty({ example: 'palta', required: false })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  category?: string;
}
```

```typescript
// backend/src/purchase/dto/create-purchase.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumberString, IsOptional, IsDateString } from 'class-validator';

export class CreatePurchaseDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa7' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: '10' })
  @IsNumberString()
  quantity: string;

  @ApiProperty({ example: '4.00' })
  @IsNumberString()
  unitCost: string;

  @ApiProperty({ example: '2026-01-15T14:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  purchasedAt?: string;
}
```

```typescript
// backend/src/sale/dto/create-sale.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumberString, IsOptional, IsDateString, IsIn } from 'class-validator';

export class CreateSaleDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsUUID()
  businessId: string;

  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa7' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: '2' })
  @IsNumberString()
  quantity: string;

  @ApiProperty({ example: '4.50', required: false, description: 'Omit to use the catalog price' })
  @IsOptional()
  @IsNumberString()
  unitPrice?: string;

  @ApiProperty({ enum: ['efectivo', 'yape', 'plin'], example: 'efectivo', required: false })
  @IsOptional()
  @IsIn(['efectivo', 'yape', 'plin'])
  paymentMethod?: 'efectivo' | 'yape' | 'plin';

  @ApiProperty({ example: '2026-01-15T19:00:00.000Z', required: false })
  @IsOptional()
  @IsDateString()
  soldAt?: string;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:e2e -- swagger.e2e-spec.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Write the README**

```markdown
<!-- backend/README.md -->
# SAP hermana — Backend

API NestJS para el registro de ventas y compras de dos negocios (frutas y ropa),
con corte semanal y KPIs de rentabilidad. Ver
`../sap-hermana-backend/CLAUDE.md` para las decisiones de dominio y reglas de
negocio ya cerradas, y `../docs/superpowers/specs/2026-09-21-sap-hermana-backend-design.md`
para el diseño de implementación.

## Stack

NestJS 11 · TypeORM · PostgreSQL · JWT (`passport-jwt`) · `class-validator` ·
`decimal.js` para aritmética monetaria · Swagger (`@nestjs/swagger`).

## Requisitos

- Node.js 20+
- PostgreSQL 14+ corriendo localmente (o accesible vía `DATABASE_URL`)

## Variables de entorno

Copiar `.env.example` a `.env` y completar:

| Variable | Descripción | Default |
|---|---|---|
| `DATABASE_URL` | Cadena de conexión Postgres | — |
| `JWT_SECRET` | Secreto para firmar JWT | — |
| `JWT_EXPIRES_IN` | Duración del token (sin refresh, app de un solo usuario) | `30d` |
| `SEED_USERNAME` | Usuario único de la app | — |
| `SEED_PASSWORD` | Password del usuario único | — |
| `LOW_STOCK_THRESHOLD` | Umbral global de alerta de stock bajo en `/reports/kpis` | `5` |
| `PORT` | Puerto HTTP | `3000` |
| `NODE_ENV` | `development` habilita logging SQL y Swagger | — |

## Setup

```bash
npm install
npm run migration:run
npm run seed:user
```

El seed de los 2 negocios iniciales ("Frutas", "Ropa") se hace manualmente vía
`POST /businesses` una vez logueado — no es una migración ni parte de este
script, es dato inicial de negocio.

## Correr

```bash
npm run start:dev   # desarrollo con recarga en caliente
npm run start:prod  # producción (requiere npm run build antes)
```

Documentación interactiva de la API (deshabilitada en `NODE_ENV=production`):
`http://localhost:3000/api/docs`

## Tests

```bash
npm test           # unitarios
npm run test:e2e   # e2e — requiere Postgres migrado y sembrado (ver Setup)
npm run test:cov   # cobertura
```

## Login

Único endpoint público: `POST /auth/login`. No hay registro público — el
usuario se crea/actualiza solo vía `npm run seed:user`. Todas las demás rutas
requieren `Authorization: Bearer <token>`.
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: all unit test suites PASS.

Run: `npm run test:e2e`
Expected: all e2e test suites PASS (requires the seeded local Postgres from Task 1).

- [ ] **Step 7: Commit**

```bash
git add backend/src/swagger.ts backend/src/main.ts backend/README.md backend/test/swagger.e2e-spec.ts backend/src/auth/auth.controller.ts backend/src/auth/dto/login.dto.ts backend/src/business/business.controller.ts backend/src/business/dto/create-business.dto.ts backend/src/product/product.controller.ts backend/src/product/dto/create-product.dto.ts backend/src/purchase/purchase.controller.ts backend/src/purchase/dto/create-purchase.dto.ts backend/src/sale/sale.controller.ts backend/src/sale/dto/create-sale.dto.ts backend/src/reports/reports.controller.ts
git commit -m "docs: add Swagger UI and README"
```

---

## Post-plan cleanup (not a task — do only after all 9 tasks are verified working)

Once `sap-hermana-backend/src/dto/` is empty (all four DTOs moved) and the full
suite is green, `sap-hermana-backend/` contains only `CLAUDE.md`, `README.md`,
and an empty `src/dto/` directory. Per the design spec, leave it in place as
the domain-rules reference — do not delete it as part of this plan.
