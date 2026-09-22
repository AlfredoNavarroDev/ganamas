import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSale1730000005000 implements MigrationInterface {
  name = 'CreateSale1730000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sale (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES business(id),
        product_id UUID NOT NULL REFERENCES product(id),
        quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
        list_price NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (list_price >= 0),
        unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
        unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
        total NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
        profit NUMERIC(10,2) GENERATED ALWAYS AS ((quantity * unit_price) - (quantity * unit_cost)) STORED,
        discount NUMERIC(10,2) GENERATED ALWAYS AS ((list_price - unit_price) * quantity) STORED,
        payment_method VARCHAR(20) NOT NULL DEFAULT 'efectivo'
          CHECK (payment_method IN ('efectivo', 'yape', 'plin')),
        sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_sale_business_soldat ON sale(business_id, sold_at)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_sale_product ON sale(product_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_sale_product`);
    await queryRunner.query(`DROP INDEX idx_sale_business_soldat`);
    await queryRunner.query(`DROP TABLE sale`);
  }
}
