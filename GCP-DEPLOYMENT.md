# MedRem: Google Cloud Deployment Guide

This guide walks you through deploying MedRem to Google Cloud Run using Cloud Build.

## Prerequisites

✅ Google Cloud Account (you have this)
✅ gcloud CLI installed (you have this)
✅ GitHub repo connected (just pushed)
✅ Docker configured in Cloud Build (Cloud Build is free)

## Deployment Steps

### Step 1: Get Your Project ID

```powershell
gcloud config list --format='value(core.project)'
```

Or visit: https://console.cloud.google.com/home/dashboard → note the "Project ID"

### Step 2: Run the Setup Script

```powershell
.\setup-gcloud-deploy.ps1
```

This script will:
- Enable required Cloud APIs (Artifact Registry, Cloud Build, Cloud Run)
- Create an Artifact Registry repository for Docker images
- Guide you to create a Cloud Build trigger in the Cloud Console

### Step 3: Create Cloud Build Trigger (Manual)

1. Go to: https://console.cloud.google.com/cloud-build/triggers
2. Click **Create Trigger**
3. Fill in these details:

| Field | Value |
|-------|-------|
| **Name** | medrem-deploy |
| **Event** | Push to a branch |
| **Repository** | GitHub - kittu532518/medrem |
| **Branch** | ^master$ |
| **Configuration** | Cloud Build configuration file |
| **Cloud Build config file location** | cloudbuild.yaml |

4. Under **Substitutions**, add these values:
   ```
   _REGION = us-central1
   _REPOSITORY = medrem
   _ANTHROPIC_API_KEY = <your Anthropic API key from https://console.anthropic.com>
   _JWT_SECRET = <your long random JWT secret>
   ```

5. Click **Create**

### Step 4: Trigger a Build

Push a change to GitHub to trigger the build:

```powershell
git commit --allow-empty -m "Trigger Cloud Build"
git push origin master
```

Or manually trigger from the console:
- Go to **Cloud Build** → **Triggers** → Click your trigger → **Run**

### Step 5: Monitor the Build

Watch the build progress:

```powershell
gcloud builds log -f
```

The build will:
1. Build the API Docker image
2. Build the web frontend image
3. Push both to Artifact Registry
4. Deploy API to Cloud Run
5. Deploy web frontend to Cloud Run

### Step 6: Get Your Public URLs

Once the build completes (5-10 minutes):

```powershell
gcloud run services list --region=us-central1
```

You'll see two services:
- **medrem-api** → `https://medrem-api-XXXXX.run.app`
- **medrem-web** → `https://medrem-web-XXXXX.run.app`

The **web frontend** is your main public URL. Share that with users!

## Updating Your App

After any code changes, just push to GitHub:

```powershell
git add .
git commit -m "Your changes"
git push origin master
```

Cloud Build automatically rebuilds and redeploys! 🚀

## Important Environment Variables

Make sure these are set in your Cloud Build trigger substitutions:

- `ANTHROPIC_API_KEY` → Your Claude API key (from https://console.anthropic.com, add via Cloud Build substitutions)
- `JWT_SECRET` → Use a secure random string (generate one: `[guid]::NewGuid().ToString()` in PowerShell)
- `NODE_ENV` → Set to `production` in cloudbuild.yaml

## Costs

- **Cloud Build**: Free tier covers ~120 builds/month (plenty for dev)
- **Cloud Run**: Free tier: 2M requests/month, 360K GB-seconds compute/month
- **Artifact Registry**: Free tier: 500MB storage

Pricing: https://cloud.google.com/pricing/list

## Troubleshooting

### Build fails with "authentication failed"
- Check your `_ANTHROPIC_API_KEY` and `_JWT_SECRET` substitutions
- Ensure GitHub is connected to Cloud Build

### Services not getting external IP
- Cloud Run assigns public URLs automatically
- Check: `gcloud run services describe medrem-web --region=us-central1`

### Out of free quota
- Monitor at: https://console.cloud.google.com/billing/quotas
- Upgrade to paid plan or delete old builds/services

## Support

- Cloud Build docs: https://cloud.google.com/build/docs
- Cloud Run docs: https://cloud.google.com/run/docs
- Troubleshooting: `gcloud builds log BUILD_ID` for detailed error logs
