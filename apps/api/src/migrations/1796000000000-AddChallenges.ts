import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Desafios de código (Fase 4 da plataforma de estudos).
 *
 * - `track_challenges`: desafios da trilha, vindos do JSON. Conteúdo
 *   compartilhado entre usuários.
 * - `challenge_progress`: código e resultado de cada usuário em cada desafio,
 *   uma linha por tópico do roadmap e desafio.
 */
export class AddChallenges1796000000000 implements MigrationInterface {
  name = 'AddChallenges1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "track_challenges" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "track_topic_id" uuid NOT NULL,
        "slug" character varying NOT NULL,
        "title" character varying NOT NULL,
        "prompt" text NOT NULL,
        "template" character varying NOT NULL,
        "files" jsonb NOT NULL,
        "tests" text NOT NULL,
        "solution" jsonb NOT NULL,
        "order_index" integer NOT NULL,
        CONSTRAINT "PK_track_challenges" PRIMARY KEY ("id"),
        CONSTRAINT "FK_track_challenges_topic" FOREIGN KEY ("track_topic_id") REFERENCES "track_topics"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_track_challenges_topic_slug" ON "track_challenges" ("track_topic_id", "slug")`,
    );
    await queryRunner.query(
      `CREATE TABLE "challenge_progress" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "roadmap_topic_id" uuid NOT NULL,
        "challenge_id" uuid NOT NULL,
        "files" jsonb NOT NULL,
        "passed" boolean NOT NULL DEFAULT false,
        "passed_at" TIMESTAMP WITH TIME ZONE,
        "runs" integer NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_challenge_progress" PRIMARY KEY ("id"),
        CONSTRAINT "FK_challenge_progress_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_challenge_progress_topic" FOREIGN KEY ("roadmap_topic_id") REFERENCES "roadmap_topics"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_challenge_progress_challenge" FOREIGN KEY ("challenge_id") REFERENCES "track_challenges"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_challenge_progress_topic_challenge" ON "challenge_progress" ("roadmap_topic_id", "challenge_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_challenge_progress_user" ON "challenge_progress" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_challenge_progress_challenge" ON "challenge_progress" ("challenge_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "challenge_progress"`);
    await queryRunner.query(`DROP TABLE "track_challenges"`);
  }
}
