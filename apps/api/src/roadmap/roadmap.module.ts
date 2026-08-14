import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';
import { RoadmapAiService } from './roadmap-ai.service';
import { RoadmapCacheService } from './roadmap-cache.service';
import { RoadmapTemplate } from './entities/roadmap-template.entity';

@Module({
  imports: [TypeOrmModule.forFeature([RoadmapTemplate])],
  controllers: [RoadmapController],
  providers: [RoadmapService, RoadmapAiService, RoadmapCacheService],
})
export class RoadmapModule {}
