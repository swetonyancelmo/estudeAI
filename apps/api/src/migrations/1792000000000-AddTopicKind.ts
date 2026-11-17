import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Projetos de fim de módulo como itens do roadmap (docs/TRILHAS.md §5).
 *
 * Um projeto é uma linha de `roadmap_topics` com `kind = 'project'`, e não uma
 * tabela à parte: assim ele ganha de graça tudo o que tópico já tem — ordem,
 * conclusão, progresso, reajuste e as proteções de "concluído é intocável".
 *
 * O DEFAULT 'topic' cobre as linhas existentes e os tópicos criados pelo
 * reajuste, que não informa o tipo. `description` só é usado pelos projetos.
 */
export class AddTopicKind1792000000000 implements MigrationInterface {
  name = 'AddTopicKind1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "roadmap_topics" ADD "kind" character varying NOT NULL DEFAULT 'topic'`,
    );
    await queryRunner.query(
      `ALTER TABLE "roadmap_topics" ADD "description" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "roadmap_topics" DROP COLUMN "description"`,
    );
    await queryRunner.query(`ALTER TABLE "roadmap_topics" DROP COLUMN "kind"`);
  }
}
