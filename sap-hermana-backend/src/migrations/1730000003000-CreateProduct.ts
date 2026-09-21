import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProduct1730000003000 implements MigrationInterface {
  name = 'CreateProduct1730000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE product (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES business(id),
        name VARCHAR(150) NOT NULL,
        price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
        unit VARCHAR(20) NOT NULL DEFAULT 'unidad' CHECK (unit IN ('unidad', 'kg')),
        category VARCHAR(100),
        stock NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (stock >= 0),
        avg_cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (avg_cost >= 0),
        active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_product_business_active ON product(business_id, active)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_product_business_category ON product(business_id, category)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_product_business_category`);
    await queryRunner.query(`DROP INDEX idx_product_business_active`);
    await queryRunner.query(`DROP TABLE product`);
  }
}
