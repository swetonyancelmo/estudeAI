import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Videoaulas curadas das trilhas.
 *
 * `track_topics.videos`: vídeos do YouTube escolhidos à mão no JSON da trilha
 * (`pnpm videos import`). jsonb pelo mesmo motivo de `docs`: o arquivo manda,
 * é regravado a cada sync e não tem id próprio nem cota a preservar. No roadmap
 * do usuário viram linhas de `topic_resources` (type 'video', source 'youtube').
 */
export class AddTrackVideos1799000000000 implements MigrationInterface {
  name = 'AddTrackVideos1799000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "track_topics" ADD "videos" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "track_topics" DROP COLUMN "videos"`);
  }
}
