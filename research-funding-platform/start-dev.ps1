<#
.SYNOPSIS
  Start the FastAPI backend (port 8000) and the Vite frontend (port 5173) in two new PowerShell windows and open
  the app in the default browser. Run .\setup.ps1 once before using this script.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\start-dev.ps1
#>
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

if (-not (Test-Path (Join-Path $backend ".venv\Scripts\python.exe"))) {
    throw "Backend virtual environment not found. Run .\setup.ps1 first."
}

Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$backend'; `$host.UI.RawUI.WindowTitle = 'RFIP API :8000'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
)
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$frontend'; `$host.UI.RawUI.WindowTitle = 'RFIP frontend :5173'; npm run dev"
)

Write-Host "Waiting for the API to become healthy..."
$deadline = (Get-Date).AddSeconds(60)
do {
    try {
        $ok = (Invoke-WebRequest -UseBasicParsing "http://localhost:8000/api/health" -TimeoutSec 3).StatusCode -eq 200
    } catch { $ok = $false; Start-Sleep -Seconds 1 }
} until ($ok -or (Get-Date) -gt $deadline)

Start-Process "http://localhost:5173"
Write-Host "Frontend: http://localhost:5173   API docs: http://localhost:8000/docs" -ForegroundColor Green
