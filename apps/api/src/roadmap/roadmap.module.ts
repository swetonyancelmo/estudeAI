import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';
import { RoadmapAdjustService } from './roadmap-adjust.service';
import { RoadmapAiService } from './roadmap-ai.service';
import { RoadmapCacheService } from './roadmap-cache.service';
import { ResourceDiscoveryService } from './resource-discovery.service';
import { UserRoadmapService } from './user-roadmap.service';
import { RoadmapTemplate } from './entities/roadmap-template.entity';
import { Roadmap } from './entities/roadmap.entity';
// A entidade se chama Module (ARCHITETURE.md §4) e colide com o decorator
// @Module do Nest — só aqui, então o alias fica local a este arquivo.
import { Module as ModuleEntity } from './entities/module.entity';
import { Resource } from './entities/resource.entity';
import { Topic } from './entities/topic.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoadmapTemplate,
      Roadmap,
      ModuleEntity,
      Topic,
      Resource,
    ]),
  ],
  controllers: [RoadmapController],
  providers: [
    RoadmapService,
    RoadmapAdjustService,
    RoadmapAiService,
    RoadmapCacheService,
    ResourceDiscoveryService,
    UserRoadmapService,
  ],
})
export class RoadmapModule {}
