import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePurchase1730000004000 implements MigrationInterface {
  name = 'CreatePurchase1730000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE purchase (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES business(id),
        product_id UUID NOT NULL REFERENCES product(id),
        quantity NUMERIC(10,2) NOT NULL CHECK (quantity > 0),
        unit_cost NUMERIC(10,2) NOT NULL CHECK (unit_cost >= 0),
        total_cost NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
        purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_purchase_business_purchasedat ON purchase(business_id, purchased_at)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_purchase_product ON purchase(product_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_purchase_product`);
    await queryRunner.query(`DROP INDEX idx_purchase_business_purchasedat`);
    await queryRunner.query(`DROP TABLE purchase`);
  }
}
