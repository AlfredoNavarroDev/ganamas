import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDailyProfitGoalToBusiness1730000008000
  implements MigrationInterface
{
  name = 'AddDailyProfitGoalToBusiness1730000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE business
      ADD COLUMN daily_profit_goal NUMERIC(10,2) NULL
        CHECK (daily_profit_goal IS NULL OR daily_profit_goal > 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE business DROP COLUMN daily_profit_goal
    `);
  }
}
