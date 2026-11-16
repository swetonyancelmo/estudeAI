import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Trilhas curadas (docs/TRILHAS.md §7) — catálogo de conteúdo, sem dono.
 *
 * Só tabelas novas: nada das tabelas de usuário muda aqui. O conteúdo NÃO entra
 * por migration; quem carrega é o TrackSyncService, no boot, a partir dos JSONs
 * versionados em `src/tracks/content` (editar uma trilha é editar o JSON).
 *
 * `track_topics.track_id` é redundante com o módulo, de propósito: é o que
 * permite o UNIQUE (track_id, slug) — slug de tópico é único na trilha, não só
 * no módulo, porque `prerequisites` referencia tópicos de outros módulos.
 *
 * `resources_fetched_at` nulo = recursos ainda não buscados (fila do worker).
 */
export class CreateTracks1790000000000 implements MigrationInterface {
  name = 'CreateTracks1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tracks" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "slug" character varying NOT NULL,
        "title" character varying NOT NULL,
        "description" text NOT NULL,
        "content_hash" character varying NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tracks_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tracks_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "track_modules" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "track_id" uuid NOT NULL,
        "slug" character varying NOT NULL,
        "title" character varying NOT NULL,
        "description" text NOT NULL,
        "order_index" integer NOT NULL,
        "project_title" character varying NOT NULL,
        "project_description" text NOT NULL,
        "project_hours" integer NOT NULL,
        CONSTRAINT "PK_track_modules_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_track_modules_track_slug" UNIQUE ("track_id", "slug"),
        CONSTRAINT "FK_track_modules_track" FOREIGN KEY ("track_id")
          REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "track_topics" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "track_id" uuid NOT NULL,
        "module_id" uuid NOT NULL,
        "slug" character varying NOT NULL,
        "title" character varying NOT NULL,
        "level" character varying NOT NULL,
        "required" boolean NOT NULL,
        "estimated_hours" integer NOT NULL,
        "known_skill" character varying,
        "prerequisites" text[] NOT NULL DEFAULT '{}',
        "search_query" character varying NOT NULL,
        "order_index" integer NOT NULL,
        "resources_fetched_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "PK_track_topics_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_track_topics_track_slug" UNIQUE ("track_id", "slug"),
        CONSTRAINT "FK_track_topics_track" FOREIGN KEY ("track_id")
          REFERENCES "tracks" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_track_topics_module" FOREIGN KEY ("module_id")
          REFERENCES "track_modules" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_track_topics_module_id" ON "track_topics" ("module_id")`,
    );

    // Índice parcial: a fila do worker é "o que ainda não foi buscado", e ela
    // encolhe até zero — não faz sentido indexar as linhas já resolvidas.
    await queryRunner.query(
      `CREATE INDEX "IDX_track_topics_pending_resources" ON "track_topics" ("id") WHERE "resources_fetched_at" IS NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE "track_topic_resources" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "track_topic_id" uuid NOT NULL,
        "title" character varying NOT NULL,
        "url" text NOT NULL,
        "type" character varying NOT NULL,
        "thumbnail_url" text,
        "source" character varying NOT NULL,
        "order_index" integer NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_track_topic_resources_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_track_topic_resources_topic_url" UNIQUE ("track_topic_id", "url"),
        CONSTRAINT "FK_track_topic_resources_topic" FOREIGN KEY ("track_topic_id")
          REFERENCES "track_topics" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "track_topic_resources"`);
    await queryRunner.query(`DROP INDEX "IDX_track_topics_pending_resources"`);
    await queryRunner.query(`DROP INDEX "IDX_track_topics_module_id"`);
    await queryRunner.query(`DROP TABLE "track_topics"`);
    await queryRunner.query(`DROP TABLE "track_modules"`);
    await queryRunner.query(`DROP TABLE "tracks"`);
  }
}
