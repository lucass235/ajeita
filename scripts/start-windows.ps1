$ErrorActionPreference = 'Stop'

$projectPath = Split-Path -Parent $PSScriptRoot
$nodePath = 'C:\Program Files\nodejs\node.exe'
Set-Location -LiteralPath $projectPath

# O Winget instala o FFmpeg em uma pasta versionada. Inclui essa pasta no PATH
# para que atualizacoes do pacote nao exijam alterar a tarefa agendada.
$wingetPackages = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
$ffmpeg = Get-ChildItem -LiteralPath $wingetPackages -Filter 'ffmpeg.exe' -Recurse -ErrorAction SilentlyContinue |
  Select-Object -First 1
if ($ffmpeg) {
  $env:PATH = $ffmpeg.DirectoryName + [IO.Path]::PathSeparator + $env:PATH
}

& $nodePath 'src\bot.js'
exit $LASTEXITCODE
