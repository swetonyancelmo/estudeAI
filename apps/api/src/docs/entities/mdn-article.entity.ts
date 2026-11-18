import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { MdnArticleDto } from '@estudeai/shared-types';

/**
 * Cache dos artigos da MDN já convertidos para o leitor (Fase 2). A chave é o
 * slug (`Web/HTTP/Guides/Overview`), independente do idioma: o serviço decide
 * o idioma ao buscar, e todos os usuários leem a mesma cópia.
 *
 * `payload` guarda o DTO pronto, com o HTML JÁ sanitizado — o que sai do banco
 * vai direto para o cliente.
 */
@Entity('mdn_articles')
export class MdnArticle {
  @PrimaryColumn({ type: 'varchar' })
  slug: string;

  @Column({ type: 'jsonb' })
  payload: MdnArticleDto;

  /**
   * Versão da conversão que gerou o `payload` (`MDN_ARTICLE_FORMAT`). Mudou o
   * sanitizador ou o mapeamento? Sobe a constante e o cache antigo vira
   * vencido na hora, em vez de esperar a semana do TTL.
   */
  @Column({ type: 'int', name: 'format_version' })
  formatVersion: number;

  @UpdateDateColumn({ type: 'timestamptz', name: 'fetched_at' })
  fetchedAt: Date;
}
