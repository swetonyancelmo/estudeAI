import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { MdnArticleDto } from '@estudeai/shared-types';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MdnArticleQueryDto } from './dto/mdn-article-query.dto';
import { MdnReaderService } from './mdn-reader.service';

/**
 * Documentação oficial (Fase 2). Exige login: o leitor faz a API buscar
 * conteúdo de fora, e isso não fica aberto para qualquer um.
 */
@Controller('docs')
@UseGuards(JwtAuthGuard)
export class DocsController {
  constructor(private readonly mdn: MdnReaderService) {}

  /** Artigo da MDN pronto para o leitor (HTML sanitizado, links absolutos). */
  @Get('mdn')
  mdnArticle(@Query() query: MdnArticleQueryDto): Promise<MdnArticleDto> {
    return this.mdn.getArticle(query.url);
  }
}
