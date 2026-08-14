import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * FR-03.2 / FR-03.3 — roadmap vinculado ao usuário + progresso.
 *
 * Três tabelas encadeadas por ON DELETE CASCADE: apagar o usuário leva os
 * roadmaps, apagar o roadmap leva módulos e tópicos. Nada aqui se liga a
 * `roadmap_templates` (cache genérico da Etapa 5): o conteúdo é COPIADO na
 * geração, então o progresso de um usuário não alcança o molde compartilhado.
 *
 * A coluna de ordenação é `order_index` porque `order` é palavra reservada.
 */
export class CreateUserRoadmaps1788000000000 implements MigrationInterface {
  name = 'CreateUserRoadmaps1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "roadmaps" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "target_area" character varying NOT NULL,
        "justification" text NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_roadmaps_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_roadmaps_user" FOREIGN KEY ("user_id")
          REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_roadmaps_user_id" ON "roadmaps" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "roadmap_modules" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "roadmap_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "description" text NOT NULL,
        "order_index" integer NOT NULL,
        CONSTRAINT "PK_roadmap_modules_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_roadmap_modules_roadmap" FOREIGN KEY ("roadmap_id")
          REFERENCES "roadmaps" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_roadmap_modules_roadmap_id" ON "roadmap_modules" ("roadmap_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "roadmap_topics" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "module_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "is_completed" boolean NOT NULL DEFAULT false,
        "order_index" integer NOT NULL,
        "estimated_hours" integer,
        CONSTRAINT "PK_roadmap_topics_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_roadmap_topics_module" FOREIGN KEY ("module_id")
          REFERENCES "roadmap_modules" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_roadmap_topics_module_id" ON "roadmap_topics" ("module_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_roadmap_topics_module_id"`);
    await queryRunner.query(`DROP TABLE "roadmap_topics"`);
    await queryRunner.query(`DROP INDEX "IDX_roadmap_modules_roadmap_id"`);
    await queryRunner.query(`DROP TABLE "roadmap_modules"`);
    await queryRunner.query(`DROP INDEX "IDX_roadmaps_user_id"`);
    await queryRunner.query(`DROP TABLE "roadmaps"`);
  }
}
