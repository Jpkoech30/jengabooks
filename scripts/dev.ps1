#!/usr/bin/env pwsh
<#
.SYNOPSIS
    JengaBooks Dev Environment Launcher
.DESCRIPTION
    Ensures WSL services (PostgreSQL, Redis) are running before starting
    the JengaBooks dev server. Handles WSL auto-start and service gating
    so developers don't need to manually manage infrastructure.
.PARAMETER WslDistro
    The WSL distribution name. Defaults to 'Ubuntu'.
.PARAMETER SkipServiceCheck
    If set, skips the service health check and starts the app immediately.
.EXAMPLE
    .\scripts\dev.ps1
    .\scripts\dev.ps1 -WslDistro Ubuntu-22.04
    .\scripts\dev.ps1 -SkipServiceCheck
#>

param(
    [string]$WslDistro = "Ubuntu",
    [switch]$SkipServiceCheck
)

$ErrorActionPreference = "Stop"
$JengaRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   JengaBooks — Dev Environment" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# ---- Step 1: Check WSL ----
Write-Host "[1/4] Checking WSL status..." -ForegroundColor Cyan
$wslInfo = wsl -l -v 2>&1 | Out-String
if ($wslInfo -match "No installed distributions") {
    Write-Warning "No WSL distributions found. Please install WSL first."
    exit 1
}

$wslRunning = $wslInfo -match "$WslDistro\s+Running"
if (-not $wslRunning) {
    Write-Host "  → Starting WSL distribution '$WslDistro'..." -ForegroundColor Yellow
    wsl -d $WslDistro -- echo "WSL started" 2>&1 | Out-Null
    Start-Sleep -Seconds 2
}
Write-Host "  ✓ WSL is ready" -ForegroundColor Green

# ---- Step 2: Start PostgreSQL in WSL ----
Write-Host "[2/4] Starting PostgreSQL..." -ForegroundColor Cyan
$pgStatus = wsl -d $WslDistro -u root -- service postgresql status 2>&1 | Out-String
if ($pgStatus -match "is running") {
    Write-Host "  ✓ PostgreSQL already running" -ForegroundColor Green
} else {
    wsl -d $WslDistro -u root -- service postgresql start 2>&1 | Out-Null
    Start-Sleep -Seconds 1
    Write-Host "  ✓ PostgreSQL started" -ForegroundColor Green
}

# ---- Step 3: Start Redis in WSL ----
Write-Host "[3/4] Starting Redis..." -ForegroundColor Cyan
$redisStatus = wsl -d $WslDistro -u root -- service redis-server status 2>&1 | Out-String
if ($redisStatus -match "is running") {
    Write-Host "  ✓ Redis already running" -ForegroundColor Green
} else {
    wsl -d $WslDistro -u root -- service redis-server start 2>&1 | Out-Null
    Start-Sleep -Seconds 1
    Write-Host "  ✓ Redis started" -ForegroundColor Green
}

# ---- Step 4: Check service health ----
if (-not $SkipServiceCheck) {
    Write-Host "[4/4] Verifying service connectivity..." -ForegroundColor Cyan
    Push-Location $JengaRoot
    try {
        node scripts/wait-for-services.js
        if ($LASTEXITCODE -ne 0) {
            throw "Service health check failed"
        }
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[4/4] Service check skipped (-SkipServiceCheck)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Starting JengaBooks..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# ---- Start dev server ----
Push-Location $JengaRoot
npm run dev
Pop-Location
