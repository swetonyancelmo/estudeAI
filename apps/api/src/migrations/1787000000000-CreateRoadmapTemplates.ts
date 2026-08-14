import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-02.2 — tabela de cache de roadmaps pré-gerados. Chave de match exato =
 * (goal, weekly_time, affinity, learning_style), garantida única pelo índice
 * composto. O roadmap gerado fica em `payload` (jsonb).
 */
export class CreateRoadmapTemplates1787000000000 implements MigrationInterface {
  name = 'CreateRoadmapTemplates1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "roadmap_templates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "goal" character varying NOT NULL,
        "weekly_time" character varying NOT NULL,
        "affinity" character varying NOT NULL,
        "learning_style" character varying NOT NULL,
        "payload" jsonb NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roadmap_templates_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_roadmap_templates_criteria"
        ON "roadmap_templates" ("goal", "weekly_time", "affinity", "learning_style")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_roadmap_templates_criteria"`);
    await queryRunner.query(`DROP TABLE "roadmap_templates"`);
  }
}
