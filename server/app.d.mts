import type http from 'node:http';

export function createNafisCheckServer(options: {
  dataDir: string;
  distDir?: string;
  appOrigin?: string;
  basePath?: string;
  maxMutationsPerMinute?: number;
  maxJsonBodyBytes?: number;
}): {
  handler: http.RequestListener;
  close: () => void;
};
