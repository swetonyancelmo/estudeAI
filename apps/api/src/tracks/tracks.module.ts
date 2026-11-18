import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoadmapModule } from '../roadmap/roadmap.module';
import { Track } from './entities/track.entity';
import { TrackModule } from './entities/track-module.entity';
import { TrackTopic } from './entities/track-topic.entity';
import { TrackTopicResource } from './entities/track-topic-resource.entity';
import { TrackQuizQuestion } from './entities/track-quiz-question.entity';
import { TrackChallenge } from './entities/track-challenge.entity';
import { TrackResourceSyncService } from './track-resource-sync.service';
import { TrackSyncService } from './track-sync.service';

/**
 * Catálogo de trilhas curadas (docs/TRILHAS.md). Nesta etapa só carrega o
 * conteúdo e preenche os recursos em segundo plano — nenhuma rota e nenhuma
 * mudança no fluxo de geração, que continua no RoadmapModule.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Track,
      TrackModule,
      TrackTopic,
      TrackTopicResource,
      TrackQuizQuestion,
      TrackChallenge,
    ]),
    RoadmapModule,
  ],
  providers: [TrackSyncService, TrackResourceSyncService],
})
export class TracksModule {}
