import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDayClosing1730000006000 implements MigrationInterface {
  name = 'CreateDayClosing1730000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE day_closing (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        business_id UUID NOT NULL REFERENCES business(id),
        closed_date DATE NOT NULL,
        closed_by UUID NOT NULL REFERENCES "user"(id),
        snapshot JSONB NOT NULL,
        closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (business_id, closed_date)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_day_closing_business_date ON day_closing(business_id, closed_date)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX idx_day_closing_business_date`);
    await queryRunner.query(`DROP TABLE day_closing`);
  }
}
