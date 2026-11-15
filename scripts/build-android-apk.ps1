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

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$launcherSource = Join-Path $projectRoot "public\android-chrome-512x512.png"
$androidResources = Join-Path $projectRoot "android\app\src\main\res"
$nativeSyncScript = Join-Path $PSScriptRoot "sync-android-passkey-files.ps1"

& $nativeSyncScript -ProjectRoot $projectRoot
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

if (-not (Test-Path -LiteralPath $launcherSource)) {
  throw "Logo Android no encontrado: $launcherSource"
}

Add-Type -AssemblyName System.Drawing

function Write-LauncherIcon {
  param(
    [Parameter(Mandatory = $true)]
    [System.Drawing.Image]$Source,
    [Parameter(Mandatory = $true)]
    [int]$Size,
    [Parameter(Mandatory = $true)]
    [string]$Destination
  )

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $bitmap.SetResolution(96, 96)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage($Source, 0, 0, $Size, $Size)
    $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$launcherSizes = [ordered]@{
  "mdpi" = 48
  "hdpi" = 72
  "xhdpi" = 96
  "xxhdpi" = 144
  "xxxhdpi" = 192
}
$foregroundSizes = [ordered]@{
  "mdpi" = 108
  "hdpi" = 162
  "xhdpi" = 216
  "xxhdpi" = 324
  "xxxhdpi" = 432
}

$sourceImage = [System.Drawing.Image]::FromFile($launcherSource)
try {
  foreach ($density in $launcherSizes.Keys) {
    $mipmapDirectory = Join-Path $androidResources "mipmap-$density"
    Write-LauncherIcon -Source $sourceImage -Size $launcherSizes[$density] -Destination (Join-Path $mipmapDirectory "ic_launcher.png")
    Write-LauncherIcon -Source $sourceImage -Size $launcherSizes[$density] -Destination (Join-Path $mipmapDirectory "ic_launcher_round.png")
    Write-LauncherIcon -Source $sourceImage -Size $foregroundSizes[$density] -Destination (Join-Path $mipmapDirectory "ic_launcher_foreground.png")
  }
}
finally {
  $sourceImage.Dispose()
}

Write-Output "Iconos Android actualizados desde public\android-chrome-512x512.png"

Push-Location (Join-Path $projectRoot "android")
try {
  & .\gradlew.bat assembleDebug
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
