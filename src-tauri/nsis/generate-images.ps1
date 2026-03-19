# Gera as imagens BMP para o instalador NSIS do MMO Sinal
# Execute: powershell -ExecutionPolicy Bypass -File generate-images.ps1

Add-Type -AssemblyName System.Drawing

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$iconPath   = Join-Path $scriptDir "..\icons\icon-128x128.png"

# ── Cores do app ──────────────────────────────────────────────────────────────
$colorBg      = [System.Drawing.ColorTranslator]::FromHtml("#1e3a5f")   # azul escuro
$colorAccent  = [System.Drawing.ColorTranslator]::FromHtml("#2563eb")   # azul principal
$colorText    = [System.Drawing.Color]::White
$colorSub     = [System.Drawing.ColorTranslator]::FromHtml("#93c5fd")   # azul claro

# ── Header: 150 x 57 ─────────────────────────────────────────────────────────
$headerW = 150; $headerH = 57
$header  = New-Object System.Drawing.Bitmap($headerW, $headerH)
$g       = [System.Drawing.Graphics]::FromImage($header)
$g.SmoothingMode   = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

# Fundo degradê
$gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new($headerW, 0),
    $colorBg, $colorAccent
)
$g.FillRectangle($gradBrush, 0, 0, $headerW, $headerH)
$gradBrush.Dispose()

# Ícone (redimensionado para 36x36, centralizado verticalmente, margem esquerda)
if (Test-Path $iconPath) {
    $icon = [System.Drawing.Image]::FromFile($iconPath)
    $iconSize = 36
    $iconX = 8
    $iconY = [int](($headerH - $iconSize) / 2)
    $g.DrawImage($icon, $iconX, $iconY, $iconSize, $iconSize)
    $icon.Dispose()
}

# Texto "MMO Sinal"
$fontMain = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$fontSub  = New-Object System.Drawing.Font("Segoe UI", 7, [System.Drawing.FontStyle]::Regular)
$brushW   = New-Object System.Drawing.SolidBrush($colorText)
$brushS   = New-Object System.Drawing.SolidBrush($colorSub)

$textX = 52
$g.DrawString("MMO Sinal", $fontMain, $brushW, $textX, 8)
$g.DrawString("Gerenciador de Sinal Escolar", $fontSub, $brushS, $textX, 28)

$fontMain.Dispose(); $fontSub.Dispose()
$brushW.Dispose(); $brushS.Dispose()
$g.Dispose()

$headerOut = Join-Path $scriptDir "header.bmp"
$header.Save($headerOut, [System.Drawing.Imaging.ImageFormat]::Bmp)
$header.Dispose()
Write-Host "Gerado: $headerOut"

# ── Sidebar: 164 x 314 ───────────────────────────────────────────────────────
$sideW = 164; $sideH = 314
$side  = New-Object System.Drawing.Bitmap($sideW, $sideH)
$g2    = [System.Drawing.Graphics]::FromImage($side)
$g2.SmoothingMode    = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g2.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

# Fundo degradê vertical
$gradBrush2 = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.Point]::new(0, 0),
    [System.Drawing.Point]::new(0, $sideH),
    $colorBg, $colorAccent
)
$g2.FillRectangle($gradBrush2, 0, 0, $sideW, $sideH)
$gradBrush2.Dispose()

# Linha decorativa lateral direita
$penLine = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#3b82f6"), 2)
$g2.DrawLine($penLine, $sideW - 1, 0, $sideW - 1, $sideH)
$penLine.Dispose()

# Ícone grande centralizado no topo
if (Test-Path $iconPath) {
    $icon2 = [System.Drawing.Image]::FromFile($iconPath)
    $iconSize2 = 80
    $iconX2 = [int](($sideW - $iconSize2) / 2)
    $g2.DrawImage($icon2, $iconX2, 40, $iconSize2, $iconSize2)
    $icon2.Dispose()
}

# Textos
$brushW2  = New-Object System.Drawing.SolidBrush($colorText)
$brushS2  = New-Object System.Drawing.SolidBrush($colorSub)
$fontT    = New-Object System.Drawing.Font("Segoe UI", 13, [System.Drawing.FontStyle]::Bold)
$fontD    = New-Object System.Drawing.Font("Segoe UI", 7.5, [System.Drawing.FontStyle]::Regular)
$fontP    = New-Object System.Drawing.Font("Segoe UI", 7, [System.Drawing.FontStyle]::Regular)

$fmtCenter = New-Object System.Drawing.StringFormat
$fmtCenter.Alignment = [System.Drawing.StringAlignment]::Center

$g2.DrawString("MMO Sinal", $fontT, $brushW2,
    [System.Drawing.RectangleF]::new(0, 135, $sideW, 30), $fmtCenter)
$g2.DrawString("Gerenciador de Sinal Escolar", $fontD, $brushS2,
    [System.Drawing.RectangleF]::new(0, 160, $sideW, 22), $fmtCenter)

# Versão na parte inferior
$g2.DrawString("Prestar Serviços e Soluções LTDA", $fontP, $brushS2,
    [System.Drawing.RectangleF]::new(0, 285, $sideW, 20), $fmtCenter)

$fontT.Dispose(); $fontD.Dispose(); $fontP.Dispose()
$brushW2.Dispose(); $brushS2.Dispose()
$g2.Dispose()

$sideOut = Join-Path $scriptDir "sidebar.bmp"
$side.Save($sideOut, [System.Drawing.Imaging.ImageFormat]::Bmp)
$side.Dispose()
Write-Host "Gerado: $sideOut"

Write-Host ""
Write-Host "Imagens geradas com sucesso!" -ForegroundColor Green
Write-Host "  header.bmp  (150x57)"
Write-Host "  sidebar.bmp (164x314)"
