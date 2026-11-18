import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocsController } from './docs.controller';
import { MdnArticle } from './entities/mdn-article.entity';
import { MdnReaderService } from './mdn-reader.service';

@Module({
  imports: [TypeOrmModule.forFeature([MdnArticle])],
  controllers: [DocsController],
  providers: [MdnReaderService],
})
export class DocsModule {}
