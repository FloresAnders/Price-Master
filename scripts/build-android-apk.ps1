$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$jdkCandidates = @(
  (Join-Path $env:ProgramFiles "Java\jdk-21"),
  (Join-Path $env:ProgramFiles "Android\Android Studio\jbr"),
  $env:JAVA_HOME
) | Where-Object { $_ -and (Test-Path -LiteralPath (Join-Path $_ "bin\java.exe")) }

$jdk21 = $jdkCandidates | Where-Object {
  $releaseFile = Join-Path $_ "release"
  (Test-Path -LiteralPath $releaseFile) -and
    ((Get-Content -Raw -LiteralPath $releaseFile) -match 'JAVA_VERSION="21\.')
} | Select-Object -First 1

if (-not $jdk21) {
  throw "JDK 21 no encontrado. Instale JDK 21 o Android Studio 2025.2.1+."
}

$env:JAVA_HOME = $jdk21
$env:Path = "$(Join-Path $jdk21 'bin');$env:Path"

Write-Output "Usando JAVA_HOME=$env:JAVA_HOME"

& npm.cmd run sync:android
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Push-Location (Join-Path $PSScriptRoot "..\android")
try {
  & .\gradlew.bat assembleDebug
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
