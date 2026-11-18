import { IsString, MaxLength } from 'class-validator';

/** Query de GET /docs/mdn. A URL é validada de verdade no serviço. */
export class MdnArticleQueryDto {
  @IsString({ message: 'Informe a URL da página da MDN.' })
  @MaxLength(500)
  url: string;
}
