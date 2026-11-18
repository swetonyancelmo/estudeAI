import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Evolução do estudante (Fase 5 da plataforma de estudos).
 *
 * - `study_days`: minutos de estudo por pessoa, roadmap e dia local.
 * - `roadmap_topics.completed_at`: quando o tópico foi concluído. Tópicos já
 *   concluídos antes desta migration ficam sem data (não dá para saber), e os
 *   que nascem concluídos por habilidade declarada no wizard também.
 */
export class AddStudyTracking1797000000000 implements MigrationInterface {
  name = 'AddStudyTracking1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "study_days" (
        "user_id" uuid NOT NULL,
        "roadmap_id" uuid NOT NULL,
        "day" date NOT NULL,
        "minutes" integer NOT NULL DEFAULT 0,
        "last_beat_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        CONSTRAINT "PK_study_days" PRIMARY KEY ("user_id", "roadmap_id", "day"),
        CONSTRAINT "CHK_study_days_minutes" CHECK ("minutes" >= 0 AND "minutes" <= 1440),
        CONSTRAINT "FK_study_days_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_study_days_roadmap" FOREIGN KEY ("roadmap_id") REFERENCES "roadmaps"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_study_days_roadmap_day" ON "study_days" ("roadmap_id", "day")`,
    );
    await queryRunner.query(
      `ALTER TABLE "roadmap_topics" ADD "completed_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "roadmap_topics" DROP COLUMN "completed_at"`,
    );
    await queryRunner.query(`DROP TABLE "study_days"`);
  }
}
