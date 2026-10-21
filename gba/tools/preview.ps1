# Composites converted GBA art into preview PNGs (backdrop + parallax layers + level tiles, and sprite sheets).
param([string]$Out = "$env:TEMP\gba_preview", [string]$Level = 'grave', [int]$X = 0, [int]$Width = 480)
Add-Type -AssemblyName System.Drawing
$g = Join-Path $PSScriptRoot '..\game\graphics'
New-Item -ItemType Directory -Force $Out | Out-Null
function Load($n) {
  $b = [System.Drawing.Bitmap]::FromFile((Resolve-Path "$g\$n.bmp"))
  $c = New-Object System.Drawing.Bitmap -ArgumentList $b.Width, $b.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $gr = [System.Drawing.Graphics]::FromImage($c); $gr.DrawImage($b, 0, 0, $b.Width, $b.Height); $gr.Dispose(); $b.Dispose()
  $c.MakeTransparent([System.Drawing.Color]::FromArgb(255, 255, 0, 255)); $c
}
$sky = @{ jungle = @(96,128,118); grave = @(40,45,70); hell = @(40,12,16) }[$Level]
$img = New-Object System.Drawing.Bitmap -ArgumentList $Width, 272
$o = [System.Drawing.Graphics]::FromImage($img); $o.Clear([System.Drawing.Color]::FromArgb(255, $sky[0], $sky[1], $sky[2]))
foreach ($n in "$($Level)_far", "$($Level)_mid", "$($Level)_near") { $b = Load $n; $o.DrawImage($b, (New-Object System.Drawing.Rectangle 0, 16, $Width, 256), (New-Object System.Drawing.Rectangle 0, 0, $Width, 256), 'Pixel'); $b.Dispose() }
$b = Load "$($Level)_level"; $o.DrawImage($b, (New-Object System.Drawing.Rectangle 0, 0, $Width, 272), (New-Object System.Drawing.Rectangle $X, 0, $Width, 272), 'Pixel'); $b.Dispose()
$o.Dispose(); $img.Save("$Out\$Level.png"); $img.Dispose()
