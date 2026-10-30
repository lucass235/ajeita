$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
New-Item -ItemType Directory -Force logs | Out-Null
while ($true) {
  "[$(Get-Date -Format s)] iniciando AJEITA" | Add-Content logs\ajeita.log
  & node src/bot.js *>> logs\ajeita.log
  "[$(Get-Date -Format s)] encerrado (codigo $LASTEXITCODE), reiniciando em 10s" | Add-Content logs\ajeita.log
  Start-Sleep -Seconds 10
}
