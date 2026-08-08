const { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });


/**
 * Safely masks credential strings.
 * @param {string} val - The credential to mask
 * @returns {string} The masked credential
 */
function maskCredential(val) {
  if (!val) return 'undefined';
  if (val.length <= 8) return '********';
  return `${val.slice(0, 4)}****${val.slice(-4)}`;
}

// Initialize S3Client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || (process.env.R2_ACCOUNT_ID ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined),
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Uploads a file buffer to R2
 * @param {Buffer} fileBuffer - File content buffer
 * @param {string} key - File destination path key
 * @param {string} mimeType - The mime type of the file
 * @returns {Promise<string>} The uploaded file's URL or Key
 */
async function uploadFile(fileBuffer, key, mimeType) {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  });
  await s3Client.send(command);
  return key;
}

/**
 * Uploads a public file (listing image/video, logo, etc.)
 * @param {Buffer} fileBuffer - File content buffer
 * @param {string} fileName - Original file name
 * @param {string} mimeType - The mime type of the file
 * @returns {Promise<string>} The constructed public access URL via r2.dev
 */
async function uploadPublicFile(fileBuffer, fileName, mimeType) {
  const key = `public/${Date.now()}_${fileName}`;
  await uploadFile(fileBuffer, key, mimeType);
  // Use R2_PUBLIC_URL (r2.dev subdomain) — the R2_ENDPOINT is the private S3 API and is NOT browser-accessible
  const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  if (!publicBase) {
    throw new Error('R2_PUBLIC_URL is not set in .env — please enable r2.dev public access in Cloudflare dashboard');
  }
  return `${publicBase}/${key}`;
}

/**
 * Builds the public URL for a given R2 key (used for HLS segments uploaded by key).
 * @param {string} key - The R2 object key
 * @returns {string} The public URL
 */
function getPublicUrl(key) {
  const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  return `${publicBase}/${key}`;
}

/**
 * Uploads a private file (citizenship front/back, ID proof, etc.)
 * @param {Buffer} fileBuffer - File content buffer
 * @param {string} fileName - Original file name
 * @param {string} mimeType - The mime type of the file
 * @returns {Promise<string>} The key of the private file
 */
async function uploadPrivateFile(fileBuffer, fileName, mimeType) {
  const key = `private/${Date.now()}_${fileName}`;
  return await uploadFile(fileBuffer, key, mimeType);
}

/**
 * Generates a short-lived signed URL for a private file.
 * @param {string} key - The private file's key
 * @returns {Promise<string>} The signed URL (expires in 5 minutes)
 */
async function getPrivateFileUrl(key) {
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn: 300 });
}

/**
 * Computes the total storage size of all objects in the bucket.
 * @returns {Promise<{bytes: number, gb: number}>} The total size in bytes and GB
 */
async function getBucketUsage() {
  let totalSize = 0;
  let isTruncated = true;
  let continuationToken = undefined;

  while (isTruncated) {
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      ContinuationToken: continuationToken,
    });
    const response = await s3Client.send(command);
    if (response.Contents) {
      for (const obj of response.Contents) {
        totalSize += obj.Size || 0;
      }
    }
    isTruncated = response.IsTruncated;
    continuationToken = response.NextContinuationToken;
  }

  const sizeInGB = totalSize / (1024 * 1024 * 1024);
  return {
    bytes: totalSize,
    gb: parseFloat(sizeInGB.toFixed(3)),
  };
}

/**
 * Verifies connection to R2 by performing a minimal object list operation.
 * @returns {Promise<boolean>} True if connection check succeeds, false otherwise
 */
async function checkR2Connection() {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.R2_BUCKET_NAME,
      MaxKeys: 1,
    });
    await s3Client.send(command);
    return true;
  } catch (err) {
    const maskedAccessKey = maskCredential(process.env.R2_ACCESS_KEY_ID);
    console.error(`❌ Cloudflare R2 connection error (Access Key: ${maskedAccessKey}):`, err.message);
    return false;
  }
}

/**
 * Extracts the R2 object key from a public or private endpoint URL.
 * @param {string} url - The object URL
 * @returns {string|null} The object key or null
 */
function getKeyFromUrl(url) {
  if (!url) return null;
  const publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
  if (url.startsWith(publicBase)) {
    return url.replace(publicBase, '').replace(/^\//, '');
  }
  // Fallback in case endpoint was used
  const endpoint = (process.env.R2_ENDPOINT || '').split('.com')[0];
  if (url.includes(endpoint)) {
    const parts = url.split(process.env.R2_BUCKET_NAME);
    if (parts.length > 1) {
      return parts[1].replace(/^\//, '');
    }
  }
  return null;
}

/**
 * Deletes a single object from R2 by key.
 * @param {string} key - The R2 object key
 */
async function deleteR2Object(key) {
  if (!key) return;
  try {
    const command = new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });
    await s3Client.send(command);
    console.log(`[R2] Deleted object: ${key}`);
  } catch (err) {
    console.warn(`[R2] Failed to delete object ${key}:`, err.message);
  }
}

/**
 * Deletes all objects under a given prefix in R2.
 * @param {string} prefix - The prefix/folder key to delete
 */
async function deleteR2Folder(prefix) {
  if (!prefix) return;
  try {
    let isTruncated = true;
    let continuationToken = undefined;

    while (isTruncated) {
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });
      const response = await s3Client.send(listCommand);
      if (response.Contents && response.Contents.length > 0) {
        const deleteParams = {
          Bucket: process.env.R2_BUCKET_NAME,
          Delete: { Objects: response.Contents.map(obj => ({ Key: obj.Key })) }
        };
        const deleteCommand = new DeleteObjectsCommand(deleteParams);
        await s3Client.send(deleteCommand);
        console.log(`[R2] Deleted folder batch: ${response.Contents.length} files under ${prefix}/`);
      }
      isTruncated = response.IsTruncated;
      continuationToken = response.NextContinuationToken;
    }
  } catch (err) {
    console.warn(`[R2] Failed to delete folder prefix ${prefix}:`, err.message);
  }
}

module.exports = {
  s3Client,
  uploadFile,
  uploadPublicFile,
  uploadPrivateFile,
  getPrivateFileUrl,
  getPublicUrl,
  getBucketUsage,
  checkR2Connection,
  maskCredential,
  getKeyFromUrl,
  deleteR2Object,
  deleteR2Folder,
};
