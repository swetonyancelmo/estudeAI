import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';
import { RoadmapAdjustService } from './roadmap-adjust.service';
import { RoadmapAiService } from './roadmap-ai.service';
import { RoadmapCacheService } from './roadmap-cache.service';
import { TrackJustificationService } from './track-justification.service';
import { Track } from '../tracks/entities/track.entity';
import { ResourceDiscoveryService } from './resource-discovery.service';
import { UserRoadmapService } from './user-roadmap.service';
import { RoadmapTemplate } from './entities/roadmap-template.entity';
import { Roadmap } from './entities/roadmap.entity';
// A entidade se chama Module (ARCHITETURE.md §4) e colide com o decorator
// @Module do Nest — só aqui, então o alias fica local a este arquivo.
import { Module as ModuleEntity } from './entities/module.entity';
import { Resource } from './entities/resource.entity';
import { Topic } from './entities/topic.entity';
import { QuizAttempt } from './entities/quiz-attempt.entity';
import { TrackQuizQuestion } from '../tracks/entities/track-quiz-question.entity';
import { QuizService } from './quiz.service';
import { ChallengeService } from './challenge.service';
import { StudyService } from './study.service';
import { ReviewService } from './review.service';
import { ReviewController } from './review.controller';
import { ReviewCard } from './entities/review-card.entity';
import { StudyDay } from './entities/study-day.entity';
import { ChallengeProgress } from './entities/challenge-progress.entity';
import { TrackChallenge } from '../tracks/entities/track-challenge.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoadmapTemplate,
      Roadmap,
      ModuleEntity,
      Topic,
      Resource,
      QuizAttempt,
      // Só leitura: as perguntas são gravadas pelo sync das trilhas.
      TrackQuizQuestion,
      ChallengeProgress,
      StudyDay,
      ReviewCard,
      // Só leitura: os desafios são gravados pelo sync das trilhas.
      TrackChallenge,
      // Só leitura: quem escreve nas trilhas é o TracksModule (que depende
      // deste, e por isso a geração lê o catálogo direto pelo repositório).
      Track,
    ]),
  ],
  controllers: [RoadmapController, ReviewController],
  providers: [
    RoadmapService,
    RoadmapAdjustService,
    TrackJustificationService,
    // Geração completa pelo Gemini + cache por critério: fora do fluxo desde
    // as trilhas curadas (docs/TRILHAS.md §7). Ficam registrados até a remoção
    // num PR próprio.
    RoadmapAiService,
    RoadmapCacheService,
    ResourceDiscoveryService,
    UserRoadmapService,
    QuizService,
    ChallengeService,
    StudyService,
    ReviewService,
  ],
  // O catálogo de trilhas reusa a descoberta de recursos (TracksModule).
  exports: [ResourceDiscoveryService],
})
export class RoadmapModule {}
