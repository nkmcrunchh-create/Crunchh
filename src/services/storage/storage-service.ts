import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl as getS3SignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";

export interface StorageProvider {
  putPrivateObject(path: string, body: Buffer, contentType: string): Promise<{ storagePath: string }>;
  getSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
}

export class LocalStorageProvider implements StorageProvider {
  async putPrivateObject(storagePath: string, body: Buffer) {
    const fullPath = path.join(process.cwd(), env.LOCAL_STORAGE_DIR, storagePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, body);
    return { storagePath };
  }

  async getSignedUrl(storagePath: string) {
    return `${env.PUBLIC_BASE_URL}/private/${encodeURIComponent(storagePath)}`;
  }
}

export class SupabaseStorageProvider implements StorageProvider {
  private client = createClient(env.SUPABASE_URL || "", env.SUPABASE_SERVICE_ROLE_KEY || "");

  private assertConfigured() {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new AppError("Supabase storage is not configured.", 503, "STORAGE_NOT_CONFIGURED");
    }
  }

  async putPrivateObject(storagePath: string, body: Buffer, contentType: string) {
    this.assertConfigured();
    const { error } = await this.client.storage.from(env.SUPABASE_INVOICE_BUCKET).upload(storagePath, body, {
      contentType,
      upsert: true
    });
    if (error) throw new AppError(error.message, 503, "STORAGE_UPLOAD_FAILED");
    return { storagePath };
  }

  async getSignedUrl(storagePath: string, expiresInSeconds: number) {
    this.assertConfigured();
    const { data, error } = await this.client.storage.from(env.SUPABASE_INVOICE_BUCKET).createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) throw new AppError(error?.message || "Could not create signed URL.", 503, "SIGNED_URL_FAILED");
    return data.signedUrl;
  }
}

export class R2StorageProvider implements StorageProvider {
  private client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID || "",
      secretAccessKey: env.R2_SECRET_ACCESS_KEY || ""
    }
  });

  private assertConfigured() {
    if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_INVOICE_BUCKET) {
      throw new AppError("Cloudflare R2 storage is not configured.", 503, "R2_NOT_CONFIGURED");
    }
  }

  async putPrivateObject(storagePath: string, body: Buffer, contentType: string) {
    this.assertConfigured();
    await this.client.send(new PutObjectCommand({
      Bucket: env.R2_INVOICE_BUCKET,
      Key: storagePath,
      Body: body,
      ContentType: contentType
    }));
    return { storagePath };
  }

  async getSignedUrl(storagePath: string, expiresInSeconds: number) {
    this.assertConfigured();
    if (env.R2_PUBLIC_CUSTOM_DOMAIN) {
      return getS3SignedUrl(this.client, new GetObjectCommand({
        Bucket: env.R2_INVOICE_BUCKET,
        Key: storagePath,
        ResponseContentDisposition: `attachment; filename="${path.basename(storagePath)}"`
      }), { expiresIn: expiresInSeconds });
    }
    return getS3SignedUrl(this.client, new GetObjectCommand({
      Bucket: env.R2_INVOICE_BUCKET,
      Key: storagePath,
      ResponseContentDisposition: `attachment; filename="${path.basename(storagePath)}"`
    }), { expiresIn: expiresInSeconds });
  }
}

export function getStorageProvider(): StorageProvider {
  if (env.STORAGE_PROVIDER === "supabase") return new SupabaseStorageProvider();
  if (env.STORAGE_PROVIDER === "r2") return new R2StorageProvider();
  return new LocalStorageProvider();
}
