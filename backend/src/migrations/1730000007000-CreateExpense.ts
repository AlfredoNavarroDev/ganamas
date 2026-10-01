import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateExpense1730000007000 implements MigrationInterface {
  name = 'CreateExpense1730000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE expense (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES business(id),
        amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
        description VARCHAR(255) NOT NULL,
        expensed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_expense_business_expensedat ON expense(business_id, expensed_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_expense_business_expensedat`);
    await queryRunner.query(`DROP TABLE expense`);
  }
}
