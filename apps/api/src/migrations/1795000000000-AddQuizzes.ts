import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quizzes por tópico (Fase 3 da plataforma de estudos).
 *
 * - `track_quiz_questions`: perguntas da trilha, vindas do JSON. Conteúdo
 *   compartilhado entre usuários, por isso NÃO são copiadas para o roadmap.
 * - `quiz_attempts`: cada resposta de um usuário, só acrescentada. Some junto
 *   com o usuário, com o tópico do roadmap ou com a pergunta (CASCADE).
 */
export class AddQuizzes1795000000000 implements MigrationInterface {
  name = 'AddQuizzes1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "track_quiz_questions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "track_topic_id" uuid NOT NULL,
        "slug" character varying NOT NULL,
        "question" text NOT NULL,
        "options" jsonb NOT NULL,
        "answer_index" integer NOT NULL,
        "explanation" text NOT NULL,
        "order_index" integer NOT NULL,
        CONSTRAINT "PK_track_quiz_questions" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_track_quiz_questions_answer" CHECK ("answer_index" >= 0 AND "answer_index" < jsonb_array_length("options")),
        CONSTRAINT "FK_track_quiz_questions_topic" FOREIGN KEY ("track_topic_id") REFERENCES "track_topics"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_track_quiz_questions_topic_slug" ON "track_quiz_questions" ("track_topic_id", "slug")`,
    );
    await queryRunner.query(
      `CREATE TABLE "quiz_attempts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "roadmap_topic_id" uuid NOT NULL,
        "question_id" uuid NOT NULL,
        "chosen_index" integer NOT NULL,
        "is_correct" boolean NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_quiz_attempts" PRIMARY KEY ("id"),
        CONSTRAINT "FK_quiz_attempts_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quiz_attempts_topic" FOREIGN KEY ("roadmap_topic_id") REFERENCES "roadmap_topics"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_quiz_attempts_question" FOREIGN KEY ("question_id") REFERENCES "track_quiz_questions"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quiz_attempts_topic_question" ON "quiz_attempts" ("roadmap_topic_id", "question_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quiz_attempts_user_created" ON "quiz_attempts" ("user_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_quiz_attempts_question" ON "quiz_attempts" ("question_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "quiz_attempts"`);
    await queryRunner.query(`DROP TABLE "track_quiz_questions"`);
  }
}
