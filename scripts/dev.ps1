#!/usr/bin/env pwsh
<#
.SYNOPSIS
    JengaBooks Dev Environment Launcher
.DESCRIPTION
    Automated dev environment startup for Windows + WSL.

    What it does:
      1. Ensures WSL is running
      2. Starts PostgreSQL and Redis inside WSL (if not already running)
      3. Auto-detects WSL IP and injects DATABASE_URL with correct host
      4. Waits for PostgreSQL and Redis to be reachable
      5. Checks optional 3rd party API connectivity (non-blocking)
      6. Starts the JengaBooks dev server with correct env vars

    On Linux or macOS, WSL-specific steps are skipped and localhost is used.

.PARAMETER WslDistro
    The WSL distribution name. Defaults to 'Ubuntu'.

.PARAMETER SkipServiceCheck
    If set, skips service health checks and starts the app immediately.

.PARAMETER SkipWsl
    If set, skips WSL-related steps (for Docker or Linux-native setups).

.EXAMPLE
    .\scripts\dev.ps1
    .\scripts\dev.ps1 -WslDistro Ubuntu-22.04
    .\scripts\dev.ps1 -SkipServiceCheck
    .\scripts\dev.ps1 -SkipWsl
#>

param(
    [string]$WslDistro = "Ubuntu-26.04",
    [switch]$SkipServiceCheck,
    [switch]$SkipWsl
)

$ErrorActionPreference = "Stop"
$JengaRoot = Split-Path -Parent $PSScriptRoot

# Detect platform
$isWindows = [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
$isWsl = $isWindows -and (-not $SkipWsl)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   JengaBooks - Dev Environment" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# ==============================================================================
# STEP 1: Start WSL (skip if not Windows or SkipWsl)
# ==============================================================================
if ($isWsl) {
    Write-Host "[1/5] Checking WSL status..." -ForegroundColor Cyan
    $wslInfo = wsl -l -v 2>&1 | Out-String
    if ($wslInfo -match "No installed distributions") {
        Write-Warning "No WSL distributions found. Use -SkipWsl if running with Docker."
        exit 1
    }

    $wslRunning = $wslInfo -match "$WslDistro\s+Running"
    if (-not $wslRunning) {
        Write-Host "  Starting WSL distribution '$WslDistro'..." -ForegroundColor Yellow
        wsl -d $WslDistro -- echo "WSL started" 2>&1 | Out-Null
        Start-Sleep -Seconds 2
    }
    Write-Host "  [OK] WSL is ready" -ForegroundColor Green

    # ==========================================================================
    # STEP 2: Start infrastructure in WSL
    # ==========================================================================
    Write-Host "[2/5] Starting PostgreSQL..." -ForegroundColor Cyan
    $pgStatus = wsl -d $WslDistro -u root -- service postgresql status 2>&1 | Out-String
    if ($pgStatus -match "is running") {
        Write-Host "  [OK] PostgreSQL already running" -ForegroundColor Green
    } else {
        wsl -d $WslDistro -u root -- service postgresql start 2>&1 | Out-Null
        Start-Sleep -Seconds 1
        Write-Host "  [OK] PostgreSQL started" -ForegroundColor Green
    }

    Write-Host "[3/5] Starting Redis..." -ForegroundColor Cyan
    $redisStatus = wsl -d $WslDistro -u root -- service redis-server status 2>&1 | Out-String
    if ($redisStatus -match "is running") {
        Write-Host "  [OK] Redis already running" -ForegroundColor Green
    } else {
        wsl -d $WslDistro -u root -- service redis-server start 2>&1 | Out-Null
        Start-Sleep -Seconds 1
        Write-Host "  [OK] Redis started" -ForegroundColor Green
    }

    # ==========================================================================
    # STEP 3: Auto-detect WSL IP and inject DATABASE_URL
    # ==========================================================================
    Write-Host "[4/5] Detecting WSL IP and configuring connection..." -ForegroundColor Cyan

    # Run the IP detection script and capture the export command
    $wslIpExport = & node "$JengaRoot\scripts\wsl-ip.js" --export 2>&1
    # The --export flag outputs: $env:DATABASE_URL="..."
    # on stdout (for PowerShell) and stderr (for bash)
    $exportLine = $wslIpExport | Select-String -Pattern '^\$env:DATABASE_URL=' | Select-Object -First 1

    if ($exportLine) {
        # Execute the export command to set the env var for this process
        Invoke-Expression $exportLine
        Write-Host "  [OK] DATABASE_URL configured with WSL IP" -ForegroundColor Green
        Write-Host "    -> $env:DATABASE_URL" -ForegroundColor Gray
    } else {
        Write-Warning "  [!!] Could not detect WSL IP. Using .env as-is."
        Write-Host "    -> Falling back to configured DATABASE_URL" -ForegroundColor Yellow
    }
} else {
    # Non-WSL or SkipWsl: use localhost (Docker or Linux native)
    Write-Host "[1/4] Platform: $([System.Environment]::OSVersion.Platform)" -ForegroundColor Cyan
    Write-Host "  -> Using localhost (Linux native or Docker)" -ForegroundColor Yellow
}

# ==============================================================================
# STEP 4: Verify service connectivity
# ==============================================================================
if (-not $SkipServiceCheck) {
    $stepLabel = if ($isWsl) { "[5/5]" } else { "[2/4]" }
    Write-Host "${stepLabel} Verifying service connectivity..." -ForegroundColor Cyan
    Push-Location $JengaRoot
    try {
        & node scripts/wait-for-services.js
        if ($LASTEXITCODE -ne 0) {
            throw "Service health check failed"
        }
    } finally {
        Pop-Location
    }
} else {
    $stepLabel = if ($isWsl) { "[5/5]" } else { "[2/4]" }
    Write-Host "${stepLabel} Service check skipped (-SkipServiceCheck)" -ForegroundColor Yellow
}

# ==============================================================================
# STEP 5: Start the app
# ==============================================================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Starting JengaBooks..." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Push-Location $JengaRoot
npm run dev
Pop-Location
