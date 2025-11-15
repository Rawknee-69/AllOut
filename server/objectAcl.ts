import { S3Object } from "./objectStorage";
import { S3Client, HeadObjectCommand, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { objectStorageClient } from "./objectStorage";

const ACL_POLICY_METADATA_KEY = "custom-acl-policy";

export enum ObjectAccessGroupType {}

export interface ObjectAccessGroup {
  type: ObjectAccessGroupType;
  id: string;
}

export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclRule {
  group: ObjectAccessGroup;
  permission: ObjectPermission;
}

export interface ObjectAclPolicy {
  owner: string;
  visibility: "public" | "private";
  aclRules?: Array<ObjectAclRule>;
}

function isPermissionAllowed(
  requested: ObjectPermission,
  granted: ObjectPermission,
): boolean {
  if (requested === ObjectPermission.READ) {
    return [ObjectPermission.READ, ObjectPermission.WRITE].includes(granted);
  }
  return granted === ObjectPermission.WRITE;
}

abstract class BaseObjectAccessGroup implements ObjectAccessGroup {
  constructor(
    public readonly type: ObjectAccessGroupType,
    public readonly id: string,
  ) {}

  public abstract hasMember(userId: string): Promise<boolean>;
}

function createObjectAccessGroup(
  group: ObjectAccessGroup,
): BaseObjectAccessGroup {
  switch (group.type) {
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}

export async function setObjectAclPolicy(
  objectFile: S3Object,
  aclPolicy: ObjectAclPolicy,
): Promise<void> {
  // Get current metadata
  let currentMetadata: Record<string, string> = {};
  try {
    const metadata = await objectFile.getMetadata();
    currentMetadata = metadata.metadata || {};
  } catch (error) {
    // Object might not exist, but we'll try to set metadata anyway
  }

  // Update metadata with ACL policy
  currentMetadata[ACL_POLICY_METADATA_KEY] = JSON.stringify(aclPolicy);

  // Get object metadata to preserve other properties
  const headCommand = new HeadObjectCommand({
    Bucket: objectFile.bucket,
    Key: objectFile.key,
  });

  let contentType: string | undefined;
  let contentLength: number | undefined;
  let existingMetadata: Record<string, string> = {};
  let cacheControl: string | undefined;
  let contentEncoding: string | undefined;
  let contentDisposition: string | undefined;
  let etag: string | undefined;

  try {
    const headResponse = await objectStorageClient.send(headCommand);
    contentType = headResponse.ContentType;
    contentLength = headResponse.ContentLength;
    existingMetadata = headResponse.Metadata || {};
    cacheControl = headResponse.CacheControl;
    contentEncoding = headResponse.ContentEncoding;
    contentDisposition = headResponse.ContentDisposition;
    etag = headResponse.ETag;
  } catch (error: any) {
    if (error.name !== "NotFound" && error.$metadata?.httpStatusCode !== 404) {
      throw error;
    }
    // Object doesn't exist, we can't set metadata
    throw new Error(`Object not found: ${objectFile.bucket}/${objectFile.key}`);
  }

  // Merge existing metadata with new ACL policy
  const updatedMetadata = {
    ...existingMetadata,
    ...currentMetadata,
  };

  // Copy object to itself with updated metadata (S3 doesn't support direct metadata updates)
  const copyCommand = new CopyObjectCommand({
    Bucket: objectFile.bucket,
    Key: objectFile.key,
    CopySource: `${objectFile.bucket}/${objectFile.key}`,
    Metadata: updatedMetadata,
    MetadataDirective: "REPLACE",
    ContentType: contentType,
    CacheControl: cacheControl,
    ContentEncoding: contentEncoding,
    ContentDisposition: contentDisposition,
  });

  await objectStorageClient.send(copyCommand);
}

export async function getObjectAclPolicy(
  objectFile: S3Object,
): Promise<ObjectAclPolicy | null> {
  try {
    const metadata = await objectFile.getMetadata();
    const aclPolicy = metadata.metadata?.[ACL_POLICY_METADATA_KEY];
    if (!aclPolicy) {
      return null;
    }
    return JSON.parse(aclPolicy as string);
  } catch (error) {
    return null;
  }
}

export async function canAccessObject({
  userId,
  objectFile,
  requestedPermission,
}: {
  userId?: string;
  objectFile: S3Object;
  requestedPermission: ObjectPermission;
}): Promise<boolean> {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }

  if (
    aclPolicy.visibility === "public" &&
    requestedPermission === ObjectPermission.READ
  ) {
    return true;
  }

  if (!userId) {
    return false;
  }

  if (aclPolicy.owner === userId) {
    return true;
  }

  for (const rule of aclPolicy.aclRules || []) {
    const accessGroup = createObjectAccessGroup(rule.group);
    if (
      (await accessGroup.hasMember(userId)) &&
      isPermissionAllowed(requestedPermission, rule.permission)
    ) {
      return true;
    }
  }

  return false;
}
