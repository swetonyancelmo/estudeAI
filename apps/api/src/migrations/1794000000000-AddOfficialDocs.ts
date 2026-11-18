import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Documentação oficial (Fase 2 da plataforma de estudos).
 *
 * - `track_topics.docs`: links oficiais curados no JSON da trilha. jsonb porque
 *   são regravados a cada sync, sem id próprio nem cota a preservar.
 * - `mdn_articles`: cache dos artigos da MDN já sanitizados para o leitor,
 *   compartilhado entre todos os usuários (o conteúdo é o mesmo para todos).
 *
 * As docs entram no roadmap do usuário como linhas de `topic_resources` com
 * source 'docs' — varchar, sem ALTER TYPE (ver resource.entity.ts).
 */
export class AddOfficialDocs1794000000000 implements MigrationInterface {
  name = 'AddOfficialDocs1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "track_topics" ADD "docs" jsonb NOT NULL DEFAULT '[]'`,
    );
    // Ordem de leitura das docs curadas no roadmap do usuário (o básico
    // primeiro). Os recursos que já existem ficam com 0 e seguem ordenados
    // por título, como antes.
    await queryRunner.query(
      `ALTER TABLE "topic_resources" ADD "order_index" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `CREATE TABLE "mdn_articles" (
        "slug" character varying NOT NULL,
        "payload" jsonb NOT NULL,
        "format_version" integer NOT NULL,
        "fetched_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_mdn_articles_slug" PRIMARY KEY ("slug")
      )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "mdn_articles"`);
    await queryRunner.query(
      `ALTER TABLE "topic_resources" DROP COLUMN "order_index"`,
    );
    await queryRunner.query(`ALTER TABLE "track_topics" DROP COLUMN "docs"`);
  }
}
