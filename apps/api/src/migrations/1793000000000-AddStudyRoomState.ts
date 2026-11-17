import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sala de estudo (Fase 1 da plataforma de estudos): andamento por recurso e
 * anotação por tópico.
 *
 * São colunas, e não tabelas com `user_id`, porque `roadmap_topics` e
 * `topic_resources` já são a cópia do roadmap de UMA pessoa: o dono vem do
 * roadmap, e a checagem de ownership continua sendo a do `loadOwned`.
 *
 * Os DEFAULTs cobrem as linhas existentes e os recursos criados pela geração,
 * pelo reajuste e pela fila das trilhas, que não informam andamento.
 */
export class AddStudyRoomState1793000000000 implements MigrationInterface {
  name = 'AddStudyRoomState1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "topic_resources" ADD "status" character varying NOT NULL DEFAULT 'not_started'`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic_resources" ADD "watched_seconds" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`ALTER TABLE "roadmap_topics" ADD "note" text`);
    await queryRunner.query(
      `ALTER TABLE "roadmap_topics" ADD "note_updated_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "roadmap_topics" DROP COLUMN "note_updated_at"`,
    );
    await queryRunner.query(`ALTER TABLE "roadmap_topics" DROP COLUMN "note"`);
    await queryRunner.query(
      `ALTER TABLE "topic_resources" DROP COLUMN "watched_seconds"`,
    );
    await queryRunner.query(
      `ALTER TABLE "topic_resources" DROP COLUMN "status"`,
    );
  }
}
