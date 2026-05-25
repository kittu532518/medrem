#!/usr/bin/env powershell
# MedRem: Google Cloud Build + Cloud Run Setup Script
# Run this in PowerShell to configure and deploy to Google Cloud

$ProjectID = "your-project-id"  # Replace with your Google Cloud Project ID
$Region = "us-central1"
$Repository = "medrem"
$GitHubRepo = "https://github.com/kittu532518/medrem"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "MedRem: Google Cloud Deployment Setup" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan

# Step 1: Set gcloud project
Write-Host "`n[1/7] Setting Google Cloud project..." -ForegroundColor Yellow
gcloud config set project $ProjectID
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to set project. Check your Project ID." -ForegroundColor Red
    exit 1
}

# Step 2: Enable required APIs
Write-Host "`n[2/7] Enabling Google Cloud APIs..." -ForegroundColor Yellow
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable iam.googleapis.com

# Step 3: Create Artifact Registry repository
Write-Host "`n[3/7] Creating Artifact Registry repository..." -ForegroundColor Yellow
gcloud artifacts repositories create $Repository `
    --repository-format=docker `
    --location=$Region `
    --description="Docker images for MedRem" `
    2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Repository created successfully!" -ForegroundColor Green
} else {
    Write-Host "Repository may already exist (continuing)..." -ForegroundColor Yellow
}

# Step 4: Create Cloud Build trigger
Write-Host "`n[4/7] Setting up Cloud Build trigger from GitHub..." -ForegroundColor Yellow
Write-Host "Visit: https://console.cloud.google.com/cloud-build/triggers" -ForegroundColor Cyan
Write-Host "Create a new trigger with these settings:" -ForegroundColor Cyan
Write-Host "  - Source: GitHub (connect your account if needed)"
Write-Host "  - Repository: kittu532518/medrem" -ForegroundColor Cyan
Write-Host "  - Branch: ^master$" -ForegroundColor Cyan
Write-Host "  - Configuration: cloudbuild.yaml" -ForegroundColor Cyan
Write-Host "  - Substitution variables:" -ForegroundColor Cyan
Write-Host "    - _ANTHROPIC_API_KEY = your-anthropic-api-key (from https://console.anthropic.com)" -ForegroundColor Yellow
Write-Host "    - _JWT_SECRET = your-long-random-jwt-secret" -ForegroundColor Yellow
Write-Host "`nPress Enter when done..."
Read-Host

# Step 5: Create Cloud Run services
Write-Host "`n[5/7] Setting up Cloud Run services..." -ForegroundColor Yellow

# Deploy placeholder for API (we'll use Cloud Build to deploy actual image)
Write-Host "Cloud Run services will be deployed automatically via Cloud Build." -ForegroundColor Green
Write-Host "Once the Cloud Build trigger runs, your services will be available at:" -ForegroundColor Green
Write-Host "  - API: https://medrem-api-<hash>.$Region.run.app" -ForegroundColor Cyan
Write-Host "  - Web: https://medrem-web-<hash>.$Region.run.app" -ForegroundColor Cyan

# Step 6: Configure IAM permissions
Write-Host "`n[6/7] Configuring IAM permissions..." -ForegroundColor Yellow
$CloudBuildSA = gcloud projects describe $ProjectID --format='value(projectNumber)' | % { "$_@cloudbuild.gserviceaccount.com" }
gcloud projects add-iam-policy-binding $ProjectID `
    --member="serviceAccount:$CloudBuildSA" `
    --role="roles/run.admin" `
    2>$null

# Step 7: Manual Cloud Build trigger
Write-Host "`n[7/7] Trigger a build..." -ForegroundColor Yellow
$Confirm = Read-Host "Run your first Cloud Build now? (y/n)"
if ($Confirm -eq 'y') {
    Write-Host "Triggering Cloud Build..." -ForegroundColor Yellow
    gcloud builds submit --config=cloudbuild.yaml `
        --substitutions=_ANTHROPIC_API_KEY="your-anthropic-api-key",_JWT_SECRET="your-jwt-secret"
}

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "Setup complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Green
Write-Host "1. Check Cloud Build progress: gcloud builds log -f" -ForegroundColor Yellow
Write-Host "2. View Cloud Run services: gcloud run services list --region=$Region" -ForegroundColor Yellow
Write-Host "3. Monitor logs: gcloud run services log read medrem-api --region=$Region" -ForegroundColor Yellow
