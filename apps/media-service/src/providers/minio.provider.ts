import { Provider } from '@nestjs/common';
import * as Minio from 'minio';

export const MINIO_TOKEN = 'MINIO';

function createMinioClient(): Minio.Client {
  const endpoint = process.env.MINIO_ENDPOINT;
  const port = Number(process.env.MINIO_PORT) || 9000;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  const useSSL = process.env.MINIO_USE_SSL === 'true' || process.env.MINIO_USE_SSL === '1';

  if (!endpoint || !accessKey || !secretKey) {
    throw new Error(
      'MINIO_ENDPOINT, MINIO_ACCESS_KEY, and MINIO_SECRET_KEY environment variables are required',
    );
  }

  return new Minio.Client({
    endPoint: endpoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  });
}

export const MinioProvider: Provider = {
  provide: MINIO_TOKEN,
  useFactory: () => createMinioClient(),
};
