import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Revisão espaçada (Fase 6 da plataforma de estudos): um cartão por pessoa e
 * pergunta de quiz, com a data da próxima revisão e o estado do FSRS.
 *
 * Quem já respondia quizzes ganha os cartões na primeira vez que abre a
 * revisão (o serviço reaplica o histórico de `quiz_attempts`), então esta
 * migration só cria a tabela.
 */
export class AddReviewCards1798000000000 implements MigrationInterface {
  name = 'AddReviewCards1798000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "review_cards" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "question_id" uuid NOT NULL,
        "roadmap_topic_id" uuid NOT NULL,
        "due" TIMESTAMP WITH TIME ZONE NOT NULL,
        "card" jsonb NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_review_cards" PRIMARY KEY ("id"),
        CONSTRAINT "FK_review_cards_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_review_cards_question" FOREIGN KEY ("question_id") REFERENCES "track_quiz_questions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_review_cards_topic" FOREIGN KEY ("roadmap_topic_id") REFERENCES "roadmap_topics"("id") ON DELETE CASCADE
      )`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_review_cards_user_question" ON "review_cards" ("user_id", "question_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_review_cards_user_due" ON "review_cards" ("user_id", "due")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_review_cards_question" ON "review_cards" ("question_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_review_cards_topic" ON "review_cards" ("roadmap_topic_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "review_cards"`);
  }
}
