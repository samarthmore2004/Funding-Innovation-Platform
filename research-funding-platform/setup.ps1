<#
.SYNOPSIS
  One-time local setup on Windows: Python virtual environment, backend dependencies, database migration + seed,
  and frontend dependencies.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\setup.ps1
  powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Reset          # re-seed the database from scratch
  powershell -ExecutionPolicy Bypass -File .\setup.ps1 -SkipFrontend
#>
param(
    [switch]$Reset,
    [switch]$SkipFrontend
)
$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

if ($root.Length -gt 120) {
    Write-Warning "The project path is long ($($root.Length) chars). If installs fail with path errors, move the project to e.g. C:\Projects\research-funding-platform or enable Windows long paths."
}

function Find-Python {
    foreach ($candidate in @(@("py", "-3.13"), @("py", "-3.12"), @("python"))) {
        try {
            $exe = $candidate[0]
            $probeArgs = @($candidate | Select-Object -Skip 1) + @("--version")
            $out = & $exe @probeArgs 2>$null
            if ($LASTEXITCODE -eq 0 -and $out -match "Python 3\.(1[2-9])") { return ,$candidate }
        } catch { }
    }
    throw "Python 3.12+ was not found. Install it from https://www.python.org/downloads/ and re-run."
}

Write-Host "== Backend ==" -ForegroundColor Cyan
Push-Location (Join-Path $root "backend")
try {
    if (-not (Test-Path ".venv\Scripts\python.exe")) {
        $py = Find-Python
        $pyArgs = @($py | Select-Object -Skip 1) + @("-m", "venv", ".venv")
        & $py[0] @pyArgs
    }
    $venvPython = ".\.venv\Scripts\python.exe"
    & $venvPython -m pip install --upgrade pip
    & $venvPython -m pip install -r requirements-dev.txt
    if ($LASTEXITCODE -ne 0) { throw "pip install failed" }
    & $venvPython -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw "alembic upgrade failed" }
    if ($Reset) { & $venvPython -m app.seed.seed --reset } else { & $venvPython -m app.seed.seed }
    if ($LASTEXITCODE -ne 0) { throw "database seeding failed" }
} finally {
    Pop-Location
}

if (-not $SkipFrontend) {
    Write-Host "== Frontend ==" -ForegroundColor Cyan
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm was not found. Install Node.js LTS from https://nodejs.org/ and re-run."
    }
    Push-Location (Join-Path $root "frontend")
    try {
        npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed" }
    } finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Setup complete. Start both servers with:  powershell -ExecutionPolicy Bypass -File .\start-dev.ps1" -ForegroundColor Green
