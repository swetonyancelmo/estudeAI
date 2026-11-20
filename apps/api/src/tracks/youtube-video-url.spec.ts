import {
  canonicalYoutubeUrl,
  isCanonicalYoutubeUrl,
  parseYoutubeVideoId,
  youtubeThumbnailUrl,
} from './youtube-video-url';

describe('parseYoutubeVideoId', () => {
  const id = 'dQw4w9WgXcQ';

  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtube.com/watch?v=${id}&t=42s&list=PLabc`,
    `https://m.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}?si=xyz`,
    `https://www.youtube.com/embed/${id}`,
    `https://www.youtube-nocookie.com/embed/${id}`,
    `https://www.youtube.com/shorts/${id}`,
    `  https://www.youtube.com/live/${id}  `,
  ])('extrai o id de %s', (url) => {
    expect(parseYoutubeVideoId(url)).toBe(id);
  });

  it.each([
    'https://www.youtube.com/playlist?list=PLabcdefghijklmnop',
    'https://www.youtube.com/@canal',
    'https://www.youtube.com/watch?v=curto',
    'https://www.youtube.com/watch',
    'https://vimeo.com/123456789',
    'https://evil.example/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'ftp://youtube.com/watch?v=dQw4w9WgXcQ',
    'não é url',
    '',
  ])('recusa %s', (url) => {
    expect(parseYoutubeVideoId(url)).toBeNull();
  });
});

describe('canonicalYoutubeUrl', () => {
  it('gera sempre a mesma forma e ela é reconhecida como canônica', () => {
    const url = canonicalYoutubeUrl('dQw4w9WgXcQ');
    expect(url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(isCanonicalYoutubeUrl(url)).toBe(true);
  });

  it('não considera canônicas as variantes do mesmo vídeo', () => {
    expect(isCanonicalYoutubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(false);
    expect(
      isCanonicalYoutubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=5'),
    ).toBe(false);
  });
});

describe('youtubeThumbnailUrl', () => {
  it('usa o host e o caminho que o next.config do web libera', () => {
    expect(youtubeThumbnailUrl('dQw4w9WgXcQ')).toBe(
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    );
  });
});
