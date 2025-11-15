import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Response } from "express";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import {
  ObjectAclPolicy,
  ObjectPermission,
  canAccessObject,
  getObjectAclPolicy,
  setObjectAclPolicy,
} from "./objectAcl";

// Cloudflare R2 configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "";
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ""; // Optional: public URL if bucket is public

// Create S3 client configured for Cloudflare R2
export const objectStorageClient = new S3Client({
  region: "auto", // R2 uses "auto" as the region
  endpoint: R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined,
  credentials: R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY
    ? {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      }
    : undefined,
});

// S3 Object wrapper to maintain compatibility with existing code
export interface S3Object {
  bucket: string;
  key: string;
  getMetadata(): Promise<{ contentType?: string; size?: number; metadata?: Record<string, string> }>;
  createReadStream(): Promise<Readable>;
}

class S3ObjectWrapper implements S3Object {
  constructor(public bucket: string, public key: string) {}

  async getMetadata(): Promise<{ contentType?: string; size?: number; metadata?: Record<string, string> }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: this.key,
      });
      const response = await objectStorageClient.send(command);
      return {
        contentType: response.ContentType,
        size: response.ContentLength,
        metadata: response.Metadata,
      };
    } catch (error: any) {
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        throw new ObjectNotFoundError();
      }
      throw error;
    }
  }

  async createReadStream(): Promise<Readable> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: this.key,
    });
    
    try {
      const response = await objectStorageClient.send(command);
      
      if (!response.Body) {
        throw new ObjectNotFoundError();
      }
      
      // AWS SDK v3 returns a Readable stream or a stream-like object
      // Convert to Node.js Readable stream if needed
      if (response.Body instanceof Readable) {
        return response.Body;
      }
      
      // Handle other stream types (ReadableStream, etc.)
      const bodyStream = response.Body as any;
      
      // If it's an async iterable, convert it
      if (bodyStream && typeof bodyStream[Symbol.asyncIterator] === 'function') {
        const stream = new Readable({
          objectMode: false,
        });
        
        // Start reading asynchronously
        (async () => {
          try {
            for await (const chunk of bodyStream) {
              stream.push(Buffer.from(chunk));
            }
            stream.push(null);
          } catch (error) {
            stream.destroy(error as Error);
          }
        })();
        
        return stream;
      }
      
      // If it's a web ReadableStream, convert it
      if (bodyStream && typeof bodyStream.getReader === 'function') {
        const reader = bodyStream.getReader();
        const stream = new Readable({
          async read() {
            try {
              const { done, value } = await reader.read();
              if (done) {
                this.push(null);
              } else {
                this.push(Buffer.from(value));
              }
            } catch (error) {
              this.destroy(error as Error);
            }
          },
        });
        return stream;
      }
      
      // Fallback: try to pipe it
      const stream = new Readable();
      if (bodyStream && typeof bodyStream.pipe === 'function') {
        bodyStream.pipe(stream);
      } else {
        // Last resort: read all and push
        const chunks: Buffer[] = [];
        for await (const chunk of bodyStream) {
          chunks.push(Buffer.from(chunk));
        }
        const buffer = Buffer.concat(chunks);
        stream.push(buffer);
        stream.push(null);
      }
      return stream;
    } catch (error: any) {
      if (error.name === "NoSuchKey" || error.$metadata?.httpStatusCode === 404) {
        throw new ObjectNotFoundError();
      }
      throw error;
    }
  }
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  getBucketName(): string {
    if (!R2_BUCKET_NAME) {
      throw new Error("R2_BUCKET_NAME not set. Set R2_BUCKET_NAME env var.");
    }
    return R2_BUCKET_NAME;
  }

  async searchPublicObject(filePath: string): Promise<S3Object | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const object = new S3ObjectWrapper(bucketName, objectName);
      try {
        await object.getMetadata();
        return object;
      } catch (error) {
        if (error instanceof ObjectNotFoundError) {
          continue;
        }
        throw error;
      }
    }
    return null;
  }

  async downloadObject(object: S3Object, res: Response, cacheTtlSec: number = 3600) {
    try {
      const metadata = await object.getMetadata();
      const aclPolicy = await getObjectAclPolicy(object);
      const isPublic = aclPolicy?.visibility === "public";
      
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size?.toString() || "0",
        "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
      });

      const stream = await object.createReadStream();
      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });
      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<S3Object> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split("/");
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join("/");
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith("/")) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const object = new S3ObjectWrapper(bucketName, objectName);
    
    // Check if object exists
    try {
      await object.getMetadata();
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        throw error;
      }
      throw new ObjectNotFoundError();
    }
    
    return object;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    // Handle R2 public URLs
    if (rawPath.startsWith("https://") && rawPath.includes(".r2.cloudflarestorage.com")) {
      const url = new URL(rawPath);
      const rawObjectPath = url.pathname;
      
      let objectEntityDir = this.getPrivateObjectDir();
      if (!objectEntityDir.endsWith("/")) {
        objectEntityDir = `${objectEntityDir}/`;
      }
      
      if (!rawObjectPath.startsWith(objectEntityDir)) {
        return rawObjectPath;
      }
      
      const entityId = rawObjectPath.slice(objectEntityDir.length);
      return `/objects/${entityId}`;
    }
    
    if (!rawPath.startsWith("https://")) {
      return rawPath;
    }
  
    return rawPath;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith("/")) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: S3Object;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }

  async uploadFile(
    filePath: string,
    fileBuffer: Buffer,
    contentType: string = "application/octet-stream"
  ): Promise<void> {
    const privateObjectDir = this.getPrivateObjectDir();
    const fullPath = `${privateObjectDir}/${filePath}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: objectName,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await objectStorageClient.send(command);
  }
}

export const objectStorage = new ObjectStorageService();

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  // If path doesn't start with /, assume it's just the object name and use default bucket
  if (!path.startsWith("/")) {
    return {
      bucketName: objectStorage.getBucketName(),
      objectName: path,
    };
  }
  
  const pathParts = path.split("/").filter(p => p.length > 0);
  if (pathParts.length < 1) {
    throw new Error("Invalid path: must contain at least a bucket name or object name");
  }

  // If only one part, it's just the object name (use default bucket)
  if (pathParts.length === 1) {
    return {
      bucketName: objectStorage.getBucketName(),
      objectName: pathParts[0],
    };
  }

  // First part is bucket, rest is object name
  const bucketName = pathParts[0];
  const objectName = pathParts.slice(1).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  let command;
  
  switch (method) {
    case "GET":
      command = new GetObjectCommand({
        Bucket: bucketName,
        Key: objectName,
      });
      break;
    case "PUT":
      command = new PutObjectCommand({
        Bucket: bucketName,
        Key: objectName,
      });
      break;
    case "DELETE":
      command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: objectName,
      });
      break;
    case "HEAD":
      command = new HeadObjectCommand({
        Bucket: bucketName,
        Key: objectName,
      });
      break;
    default:
      throw new Error(`Unsupported method: ${method}`);
  }

  const signedUrl = await getSignedUrl(objectStorageClient, command, {
    expiresIn: ttlSec,
  });

  return signedUrl;
}
