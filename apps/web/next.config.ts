import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Thumbnails dos vídeos/playlists do YouTube (Etapa 8). É o ÚNICO host
    // remoto liberado, e vem sempre do campo `thumbnails` da YouTube Data API —
    // nunca de uma URL escolhida por usuário ou pela IA.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
        pathname: "/vi/**",
      },
    ],
  },
};

export default nextConfig;
