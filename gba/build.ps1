# Builds the GBA ROM: gba\game -> gba\sm-hellbound.gba
#   -Clean     rebuild everything
#   -Autoplay  build the self-playing test ROM instead (gba\test\sm-hellbound-autoplay.gba), for automated checks
#   -StartLevel n  build a playable test ROM whose title screen starts the game at level n (gba\test\sm-hellbound-level<n>.gba)
# GNU make can't cope with the spaces and brackets in this folder's path, so the gba folder is mapped to a spare drive
# letter for the build and unmapped afterwards. Needs devkitPro's gba-dev (installed into MSYS2 at C:\msys64).
#   -Hard      with -Autoplay: the test ROM plays on Hard (-DSMHB_HARD, own build folder)
#   -Variant name  build a playable diagnostic ROM with -DSMHB_<NAME> (gba\test\sm-hellbound-<name>.gba), e.g. NO_DMG
#                  (no synth tones) or NO_SFX (music only)
param([switch]$Clean, [switch]$Autoplay, [switch]$Hard, [int]$Scene = 1, [int]$StartLevel = 0, [string]$Variant = '')
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$letter = 'BCDEFGHIJKLMNOPQRSTUVWXYZ'.ToCharArray() | Where-Object { -not (Test-Path "$($_):\") } | Select-Object -Last 1
if (-not $letter) { throw 'No free drive letter to map the build folder to.' }
subst "$($letter):" "$here"
try {
  $env:MSYSTEM = 'MSYS'; $env:CHERE_INVOKING = '1'; $env:MSYS2_PATH_TYPE = 'inherit'
  $jobs = [Environment]::ProcessorCount
  $test = $Autoplay -or $StartLevel -gt 0 -or $Variant
  $v = $Variant.ToLower().Replace('_', '-')
  $target = if ($Autoplay) { 'sm-hellbound-autoplay' } elseif ($StartLevel -gt 0) { "sm-hellbound-level$StartLevel" } elseif ($Variant) { "sm-hellbound-$v" } else { 'sm-hellbound' }
  # Each scene gets its own build folder, since make doesn't notice a changed -D flag
  $h = if ($Hard) { 'h' } else { '' }
  $hf = if ($Hard) { ' -DSMHB_HARD' } else { '' }
  $vars = if ($Autoplay) { "BUILD=build_autoplay$Scene$h TARGET=$target USERFLAGS='-DBN_CFG_AUDIO_MAX_SOUND_CHANNELS=10 -DBN_CFG_AUDIO_MIXING_RATE=BN_AUDIO_MIXING_RATE_21_KHZ -DSMHB_AUTOPLAY -DSMHB_SCENE=$Scene$hf'" }
    elseif ($StartLevel -gt 0) { "BUILD=build_level$StartLevel TARGET=$target USERFLAGS='-DBN_CFG_AUDIO_MAX_SOUND_CHANNELS=10 -DBN_CFG_AUDIO_MIXING_RATE=BN_AUDIO_MIXING_RATE_21_KHZ -DSMHB_START_LEVEL=$($StartLevel - 1)'" }
    elseif ($Variant) { "BUILD=build_$v TARGET=$target USERFLAGS='-DBN_CFG_AUDIO_MAX_SOUND_CHANNELS=10 -DBN_CFG_AUDIO_MIXING_RATE=BN_AUDIO_MIXING_RATE_21_KHZ -DSMHB_$($Variant.ToUpper())'" }
    else { '' }
  $cmd = "source /etc/profile.d/devkit-env.sh && cd /$($letter.ToString().ToLower())/game && " + $(if ($Clean) { "make $vars clean && " } else { '' }) + "make -j$jobs $vars"
  # make writes progress and warnings to stderr; don't let PowerShell treat those as fatal
  $ErrorActionPreference = 'Continue'
  & C:\msys64\usr\bin\bash.exe -lc "$cmd 2>&1"
  $code = $LASTEXITCODE
  $ErrorActionPreference = 'Stop'
  if ($code -ne 0) { throw "make failed ($code)" }
  $outDir = if ($test) { New-Item -ItemType Directory -Force "$here\test" } else { Get-Item $here }
  Copy-Item "$here\game\$target.gba" "$($outDir.FullName)\$target.gba" -Force
  Remove-Item "$here\game\$target.gba", "$here\game\$target.elf" -ErrorAction SilentlyContinue
  "Built $($outDir.FullName)\$target.gba ({0:N0} bytes)" -f (Get-Item "$($outDir.FullName)\$target.gba").Length
} finally {
  subst "$($letter):" /D
}
