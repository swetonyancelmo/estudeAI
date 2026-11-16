import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Liga o roadmap do usuário à trilha curada de onde ele nasceu
 * (docs/TRILHAS.md §7).
 *
 * Tudo aceita nulo: os roadmaps anteriores às trilhas (gerados pelo Gemini)
 * continuam válidos e simplesmente não têm origem.
 *
 * `roadmap_topics.track_topic_id` existe para um fim só: quando a fila de
 * recursos preenche um tópico da trilha, os tópicos de usuários que nasceram
 * dele antes disso recebem os mesmos links. ON DELETE SET NULL porque o tópico
 * do usuário é uma cópia — remover o original da trilha não o apaga.
 */
export class LinkRoadmapsToTracks1791000000000 implements MigrationInterface {
  name = 'LinkRoadmapsToTracks1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "roadmaps" ADD "track_slug" character varying`,
    );
    await queryRunner.query(`ALTER TABLE "roadmaps" ADD "answers" jsonb`);

    await queryRunner.query(
      `ALTER TABLE "roadmap_topics" ADD "track_topic_id" uuid`,
    );
    await queryRunner.query(`
      ALTER TABLE "roadmap_topics"
        ADD CONSTRAINT "FK_roadmap_topics_track_topic" FOREIGN KEY ("track_topic_id")
        REFERENCES "track_topics" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
    `);
    // Parcial: só os tópicos vindos de trilha entram, e é por essa coluna que a
    // fila de recursos os encontra.
    await queryRunner.query(
      `CREATE INDEX "IDX_roadmap_topics_track_topic_id" ON "roadmap_topics" ("track_topic_id") WHERE "track_topic_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_roadmap_topics_track_topic_id"`);
    await queryRunner.query(
      `ALTER TABLE "roadmap_topics" DROP CONSTRAINT "FK_roadmap_topics_track_topic"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roadmap_topics" DROP COLUMN "track_topic_id"`,
    );
    await queryRunner.query(`ALTER TABLE "roadmaps" DROP COLUMN "answers"`);
    await queryRunner.query(`ALTER TABLE "roadmaps" DROP COLUMN "track_slug"`);
  }
}
