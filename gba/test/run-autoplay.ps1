# Runs the self-playing test ROM in mGBA (muted) and saves window captures every few seconds to gba\test\shots.
param([int[]]$At = @(2, 4, 6, 8, 11, 14, 18, 22), [string]$Rom = "$PSScriptRoot\sm-hellbound-autoplay.gba")
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class Win {
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
}
"@
$shots = New-Item -ItemType Directory -Force "$PSScriptRoot\shots"
Get-ChildItem $shots -Filter *.png | Remove-Item
$p = Start-Process "C:\Program Files\mGBA\mGBA.exe" -ArgumentList @('-3', '-C', 'mute=1', '-C', 'fullscreen=0', "`"$Rom`"") -PassThru
$t0 = Get-Date
try {
  foreach ($s in $At) {
    while (((Get-Date) - $t0).TotalSeconds -lt $s) { Start-Sleep -Milliseconds 100 }
    $p.Refresh(); $h = $p.MainWindowHandle
    if ($h -eq [IntPtr]::Zero) { "no window yet at ${s}s"; continue }
    $r = New-Object Win+RECT; [void][Win]::GetClientRect($h, [ref]$r)
    $bmp = New-Object System.Drawing.Bitmap -ArgumentList ([Math]::Max(1, $r.R)), ([Math]::Max(1, $r.B))
    $g = [System.Drawing.Graphics]::FromImage($bmp); $dc = $g.GetHdc()
    [void][Win]::PrintWindow($h, $dc, 3)   # client area, full content (GL)
    $g.ReleaseHdc($dc); $g.Dispose()
    $bmp.Save("$($shots.FullName)\t$('{0:D2}' -f $s).png"); $bmp.Dispose()
  }
} finally {
  if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force }
}
Get-ChildItem $shots | ForEach-Object { "{0} {1}" -f $_.Name, $_.Length }
