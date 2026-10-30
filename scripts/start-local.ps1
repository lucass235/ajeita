$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
New-Item -ItemType Directory -Force logs | Out-Null
$launcherLog = Join-Path $root 'logs\launcher.log'
function Write-Launcher($text) {
  if ((Test-Path $launcherLog) -and (Get-Item $launcherLog).Length -gt 1MB) { Move-Item $launcherLog "$launcherLog.old" -Force }
  Add-Content -Path $launcherLog -Value "[$(Get-Date -Format s)] $text" -Encoding utf8
}

function Update-YtDlp {
  $marker = Join-Path $root 'logs\yt-dlp-updated.txt'
  if ((Test-Path $marker) -and ((Get-Date) - (Get-Item $marker).LastWriteTime).TotalHours -lt 24) { return }
  $py = Join-Path $root '.venv\Scripts\python.exe'
  Write-Launcher 'verificando atualizacao do yt-dlp'
  $out = & $py -m pip install --quiet --upgrade 'yt-dlp[default]' curl_cffi 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0) {
    Set-Content -Path $marker -Value (Get-Date -Format s)
    Write-Launcher ('yt-dlp ' + (& $py -m yt_dlp --version))
  } else {
    Write-Launcher ('falha ao atualizar yt-dlp: ' + $out.Trim())
  }
}

while ($true) {
  Update-YtDlp
  Write-Launcher 'iniciando AJEITA'
  $p = Start-Process -FilePath node -ArgumentList 'src/bot.js' -WorkingDirectory $root -NoNewWindow -Wait -PassThru -RedirectStandardError (Join-Path $root 'logs\stderr.log')
  Write-Launcher "encerrado (codigo $($p.ExitCode)), reiniciando em 10s"
  Start-Sleep -Seconds 10
}
