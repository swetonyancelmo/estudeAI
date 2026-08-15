import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Etapa 8 — recursos gratuitos de estudo por tópico.
 *
 * Último elo da cadeia de ON DELETE CASCADE que começa em `users`: apagar o
 * usuário leva os roadmaps, que levam os módulos, que levam os tópicos, que
 * agora levam os recursos. Nenhuma limpeza na aplicação.
 *
 * `url` é `text` (não varchar) porque URL de artigo não tem teto útil, e o
 * UNIQUE (topic_id, url) impede que um backfill de template antigo ou um
 * reajuste insiram o mesmo link duas vezes no mesmo tópico.
 */
export class CreateTopicResources1789000000000 implements MigrationInterface {
  name = 'CreateTopicResources1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "topic_resources" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "topic_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "url" text NOT NULL,
        "type" character varying NOT NULL,
        "thumbnail_url" text,
        "source" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_topic_resources_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_topic_resources_topic" FOREIGN KEY ("topic_id")
          REFERENCES "roadmap_topics" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_topic_resources_topic_id" ON "topic_resources" ("topic_id")`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_topic_resources_topic_url" ON "topic_resources" ("topic_id", "url")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "UQ_topic_resources_topic_url"`);
    await queryRunner.query(`DROP INDEX "IDX_topic_resources_topic_id"`);
    await queryRunner.query(`DROP TABLE "topic_resources"`);
  }
}
