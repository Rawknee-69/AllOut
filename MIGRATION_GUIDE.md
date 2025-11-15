# Migration from Replit Object Storage to Cloudflare R2

This project has been migrated from Replit Object Storage to Cloudflare R2 (S3-compatible object storage).

## What Changed

1. **Storage Backend**: Replaced Google Cloud Storage (via Replit sidecar) with Cloudflare R2
2. **Dependencies**: 
   - Removed: `@google-cloud/storage`
   - Added: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
3. **Authentication**: Replit Auth is still used (no changes)

## Setup Instructions

### 1. Create a Cloudflare R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **R2** > **Create bucket**
3. Choose a bucket name (e.g., `academindhub-storage`)

### 2. Create R2 API Tokens

1. In Cloudflare Dashboard, go to **R2** > **Manage R2 API Tokens**
2. Click **Create API token**
3. Give it a name and select **Admin Read & Write** permissions
4. Copy the following values:
   - **Account ID** (found in the R2 dashboard URL or API token page)
   - **Access Key ID**
   - **Secret Access Key** (only shown once - save it!)

### 3. Update Environment Variables

Add these to your `.env` file:

```env
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_account_id_here
R2_ACCESS_KEY_ID=your_access_key_id_here
R2_SECRET_ACCESS_KEY=your_secret_access_key_here
R2_BUCKET_NAME=your_bucket_name_here
R2_PUBLIC_URL=  # Optional: Public URL if you set up a custom domain

# Object Storage Paths
PRIVATE_OBJECT_DIR=/your_bucket_name/private
PUBLIC_OBJECT_SEARCH_PATHS=  # Optional: Comma-separated paths for public objects
```

**Important**: 
- Replace `your_bucket_name` in `PRIVATE_OBJECT_DIR` with your actual bucket name
- The format should be `/bucket-name/private` (leading slash, then bucket name, then subdirectory)

### 4. Install Dependencies

```bash
npm install
```

This will install the new AWS S3 SDK packages.

### 5. Test the Setup

Start your server and try uploading a file. The files should now be stored in Cloudflare R2 instead of Replit Object Storage.

## Cloudflare R2 Free Tier

- **10 GB** storage
- **1 million** Class A operations per month (reads, writes, lists)
- **10 million** Class B operations per month (free egress)

This should be sufficient for most development and small production deployments.

## Troubleshooting

### Error: "R2_BUCKET_NAME not set"
- Make sure you've set the `R2_BUCKET_NAME` environment variable

### Error: "PRIVATE_OBJECT_DIR not set"
- Set `PRIVATE_OBJECT_DIR` to `/your-bucket-name/private` (replace with your actual bucket name)

### Error: "Access Denied" or authentication errors
- Verify your `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` are correct
- Make sure your API token has the correct permissions

### Files not uploading
- Check that your bucket name matches in both `R2_BUCKET_NAME` and `PRIVATE_OBJECT_DIR`
- Verify your R2 API token has write permissions

## Notes

- All existing file paths and URLs will continue to work
- The ACL (Access Control List) system is preserved and works the same way
- Replit Auth is still used for authentication (no changes needed)

