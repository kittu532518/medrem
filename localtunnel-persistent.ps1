#!/usr/bin/env powershell
# Auto-restart localtunnel on exit
# Usage: powershell -ExecutionPolicy Bypass -File localtunnel-persistent.ps1

$port = 5173
$maxRetries = 10
$retryCount = 0

while ($retryCount -lt $maxRetries) {
    Write-Host "Starting localtunnel on port $port..." -ForegroundColor Green
    Write-Host "Attempt $($retryCount + 1) of $maxRetries" -ForegroundColor Yellow
    
    try {
        & npx localtunnel --port $port
        $retryCount++
    }
    catch {
        Write-Host "Localtunnel crashed: $_" -ForegroundColor Red
        $retryCount++
    }
    
    if ($retryCount -lt $maxRetries) {
        Write-Host "Restarting in 3 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
}

Write-Host "Max retries reached. Exiting." -ForegroundColor Red
