# Deploying to Vercel

This guide will help you deploy your AcadeMindHub application to Vercel.

## Prerequisites

1. A Vercel account (sign up at [vercel.com](https://vercel.com))
2. All your environment variables ready (see `.env.example`)

## Quick Deploy

### Option 1: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Follow the prompts to link your project and set environment variables.

### Option 2: Deploy via GitHub

1. Push your code to a GitHub repository
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repository
4. Vercel will automatically detect the configuration
5. Add your environment variables in the Vercel dashboard

## Environment Variables

Add all the following environment variables in your Vercel project settings:

### Required Variables

- `SESSION_SECRET` - A secure random string for session encryption
- `REPL_ID` - Your Replit REPL ID (for authentication)
- `DATABASE_URL` - Your PostgreSQL connection string
- `R2_ACCOUNT_ID` - Cloudflare R2 Account ID
- `R2_ACCESS_KEY_ID` - Cloudflare R2 Access Key
- `R2_SECRET_ACCESS_KEY` - Cloudflare R2 Secret Key
- `R2_BUCKET_NAME` - Your R2 bucket name
- `PRIVATE_OBJECT_DIR` - Format: `/bucket-name/directory`
- `GEMINI_API_KEY` - Google Gemini API key
- `DEEPGRAM_API_KEY` - Deepgram API key

### Optional Variables

- `ISSUER_URL` - Replit OIDC issuer URL (defaults to `https://replit.com/oidc`)
- `R2_PUBLIC_URL` - Public URL for R2 if using custom domain
- `PUBLIC_OBJECT_SEARCH_PATHS` - Comma-separated paths for public objects
- `PORT` - Server port (Vercel sets this automatically)

## Important Notes

### WebSocket Limitations

⚠️ **WebSocket collaboration features will NOT work on Vercel** because Vercel's serverless functions don't support WebSocket connections. The app will run, but real-time collaboration features will be disabled.

If you need WebSocket support, consider:
- Using a different hosting platform (Railway, Render, Fly.io)
- Using a separate WebSocket service (Pusher, Ably, etc.)

### Build Process

The build process:
1. Builds the frontend with Vite → `dist/public/`
2. The API handler in `api/index.ts` serves both API routes and static files

### File Structure

```
.
├── api/
│   └── index.ts          # Vercel serverless function handler
├── server/                # Express server code
├── client/               # React frontend
├── dist/                 # Build output
│   └── public/           # Static files
├── vercel.json          # Vercel configuration
└── package.json
```

## Troubleshooting

### Build Fails

- Check that all environment variables are set in Vercel dashboard
- Ensure `npm run build` works locally
- Check Vercel build logs for specific errors

### API Routes Not Working

- Verify `api/index.ts` exists and exports a default handler
- Check that routes are properly registered
- Review Vercel function logs

### Static Files Not Loading

- Ensure `dist/public` contains built files
- Check `vercel.json` rewrites configuration
- Verify build output directory in Vercel settings

### Database Connection Issues

- Verify `DATABASE_URL` is correct
- Check if your database allows connections from Vercel's IPs
- Ensure SSL is enabled if required

## Custom Domain

1. Go to your project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

## Monitoring

- View logs in Vercel dashboard → Your Project → Functions
- Check function execution times and errors
- Monitor API usage and performance

## Support

For issues specific to:
- **Vercel**: Check [Vercel Documentation](https://vercel.com/docs)
- **This Project**: Check the main README or open an issue

