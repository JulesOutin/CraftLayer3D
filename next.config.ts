import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Les images produits sont servies en <img> classique (URLs Supabase Storage ou autres),
  // donc aucune configuration next/image n'est nécessaire pour le MVP.
  experimental: {
    serverActions: {
      // Au-delà de la limite par défaut (1 Mo) : la Server Action rejette la requête
      // avant même d'atteindre la vérification applicative (5 Mo) dans actions.ts.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
