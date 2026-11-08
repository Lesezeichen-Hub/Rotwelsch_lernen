$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$directory = Join-Path $PSScriptRoot '..\assets\icons'
$null = New-Item -ItemType Directory -Force -Path $directory
foreach ($size in @(192, 512)) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.Color]::FromArgb(20, 107, 99))
    $font = [System.Drawing.Font]::new('Georgia', [single]($size * 0.64), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rectangle = [System.Drawing.RectangleF]::new(0, -[single]($size * 0.03), $size, $size)
    $graphics.DrawString('R', $font, [System.Drawing.Brushes]::White, $rectangle, $format)
    $bitmap.Save((Join-Path $directory "app-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $format.Dispose()
    $font.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
Write-Output 'Local app icons generated (192 and 512 pixels).'