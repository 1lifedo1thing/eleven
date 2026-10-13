# Installs Eleven for the current Windows user.
#
#   irm https://eleven.chizi.app/install.ps1 | iex
#
# Set ELEVEN_RELEASE_URL to install a specific zip (local path or URL) instead.
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Repo = if ($env:ELEVEN_REPO) { $env:ELEVEN_REPO } else { "Zfinix/eleven" }
$Mirror = if ($env:ELEVEN_MIRROR) { $env:ELEVEN_MIRROR } else { "https://dl.chizi.app" }
$Dest = if ($env:ELEVEN_DEST) { $env:ELEVEN_DEST } else { Join-Path $env:LOCALAPPDATA "Programs\Eleven" }

function Find-Release {
  try {
    $version = (Invoke-RestMethod "$Mirror/latest.json").version
    $url = "$Mirror/v$version/Eleven-$version-windows-x64.zip"
    Invoke-WebRequest $url -Method Head -UseBasicParsing | Out-Null
    return $url
  } catch {}
  $release = Invoke-RestMethod "https://api.github.com/repos/$Repo/releases/latest"
  return ($release.assets | Where-Object { $_.name -like "Eleven-*-windows-x64.zip" } | Select-Object -First 1).browser_download_url
}

$url = $env:ELEVEN_RELEASE_URL
if (-not $url) {
  Write-Host "Finding the latest Eleven release..."
  $url = Find-Release
}
if (-not $url) {
  Write-Error "No Windows release found. Set ELEVEN_RELEASE_URL to a zip."
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("eleven-" + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
  $zip = Join-Path $tmp "eleven.zip"
  Write-Host "Downloading $url"
  if ($url -match "^https?://") { Invoke-WebRequest $url -OutFile $zip -UseBasicParsing } else { Copy-Item $url $zip }
  Expand-Archive $zip -DestinationPath $tmp -Force

  Write-Host "Installing to $Dest"
  Get-Process Eleven -ErrorAction SilentlyContinue | Stop-Process -Force
  if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
  New-Item -ItemType Directory -Path (Split-Path $Dest) -Force | Out-Null
  Move-Item (Join-Path $tmp "Eleven") $Dest
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

$exe = Join-Path $Dest "bin\Eleven.exe"
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path ([Environment]::GetFolderPath("Programs")) "Eleven.lnk"))
$shortcut.TargetPath = $exe
$shortcut.WorkingDirectory = Split-Path $exe
$shortcut.Save()

Write-Host "Installed. Eleven is in the Start menu."
if (-not $env:ELEVEN_NO_LAUNCH) { Start-Process $exe }
