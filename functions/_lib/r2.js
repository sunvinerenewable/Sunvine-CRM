import { AwsClient } from 'aws4fetch';

export function getR2Client(env) {
  const accountId = env?.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = env?.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = env?.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = env?.R2_BUCKET_NAME || process.env.R2_BUCKET_NAME || 'sunvine-documents';
  const publicDomain = env?.R2_PUBLIC_DOMAIN || process.env.R2_PUBLIC_DOMAIN;

  const isConfigured = Boolean(
    accountId &&
    accessKeyId &&
    secretAccessKey &&
    !accountId.includes('your_') &&
    !accessKeyId.includes('your_')
  );

  if (!isConfigured) return null;

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region: 'auto'
  });

  return {
    accountId,
    bucketName,
    publicDomain,
    endpoint,
    aws,
    /**
     * Generate a presigned PUT URL for upload
     */
    async presignPutUrl(key, contentType = 'application/pdf', expiresInSeconds = 900) {
      const url = `${endpoint}/${bucketName}/${key.replace(/^\/+/, '')}`;
      const signed = await aws.sign(url, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType
        },
        aws: {
          signQuery: true,
          expiresIn: expiresInSeconds
        }
      });
      return signed.url;
    },
    /**
     * Delete an object from R2
     */
    async deleteObject(key) {
      const url = `${endpoint}/${bucketName}/${key.replace(/^\/+/, '')}`;
      return await aws.fetch(url, { method: 'DELETE' });
    },
    /**
     * Get an object from R2 (returns Response)
     */
    async getObject(key) {
      const url = `${endpoint}/${bucketName}/${key.replace(/^\/+/, '')}`;
      return await aws.fetch(url, { method: 'GET' });
    },
    /**
     * Head an object in R2 (returns Response)
     */
    async headObject(key) {
      const url = `${endpoint}/${bucketName}/${key.replace(/^\/+/, '')}`;
      return await aws.fetch(url, { method: 'HEAD' });
    }
  };
}
