param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectRoot
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$files = @(
  @{
    Source = Join-Path $ProjectRoot "capacitor-android\MainActivity.java"
    Destination = Join-Path $ProjectRoot "android\app\src\main\java\com\timemaster\app\MainActivity.java"
  },
  @{
    Source = Join-Path $ProjectRoot "capacitor-android\build.gradle"
    Destination = Join-Path $ProjectRoot "android\app\build.gradle"
  }
)

foreach ($file in $files) {
  if (-not (Test-Path -LiteralPath $file.Source)) {
    throw "Plantilla Android no encontrada: $($file.Source)"
  }

  $destinationDirectory = Split-Path -Parent $file.Destination
  if (-not (Test-Path -LiteralPath $destinationDirectory)) {
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
  }

  Copy-Item -LiteralPath $file.Source -Destination $file.Destination -Force
}

Write-Output "WebAuthn Android sincronizado desde capacitor-android"
