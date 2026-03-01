param(
    [string]$OutputDir = "apps/mobile/assets/store"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

function New-HexColor {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Hex,
        [int]$Alpha = 255
    )

    $normalized = $Hex.Trim().TrimStart("#")
    if ($normalized.Length -eq 3) {
        $normalized = ($normalized.ToCharArray() | ForEach-Object { "$_$_" }) -join ""
    }

    $r = [Convert]::ToInt32($normalized.Substring(0, 2), 16)
    $g = [Convert]::ToInt32($normalized.Substring(2, 2), 16)
    $b = [Convert]::ToInt32($normalized.Substring(4, 2), 16)
    return [System.Drawing.Color]::FromArgb($Alpha, $r, $g, $b)
}

function New-RoundedRectPath {
    param(
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $Radius * 2

    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()

    return $path
}

function New-FontSafe {
    param(
        [string[]]$Names,
        [float]$Size,
        [System.Drawing.FontStyle]$Style = [System.Drawing.FontStyle]::Regular
    )

    foreach ($name in $Names) {
        try {
            return New-Object System.Drawing.Font($name, $Size, $Style, [System.Drawing.GraphicsUnit]::Pixel)
        }
        catch {
        }
    }

    return New-Object System.Drawing.Font("Segoe UI", $Size, $Style, [System.Drawing.GraphicsUnit]::Pixel)
}

function Draw-TrackedText {
    param(
        [System.Drawing.Graphics]$Graphics,
        [string]$Text,
        [System.Drawing.Font]$Font,
        [System.Drawing.Brush]$Brush,
        [float]$X,
        [float]$Y,
        [float]$Tracking
    )

    $format = New-Object System.Drawing.StringFormat([System.Drawing.StringFormat]::GenericTypographic)
    $format.FormatFlags = $format.FormatFlags -bor [System.Drawing.StringFormatFlags]::MeasureTrailingSpaces

    $cursor = $X
    foreach ($char in $Text.ToCharArray()) {
        $glyph = [string]$char
        $Graphics.DrawString($glyph, $Font, $Brush, $cursor, $Y, $format)
        $size = $Graphics.MeasureString($glyph, $Font, 1000, $format)
        $cursor += $size.Width + $Tracking
    }

    $format.Dispose()
}

function Draw-LabelPill {
    param(
        [System.Drawing.Graphics]$Graphics,
        [string]$Text,
        [float]$X,
        [float]$Y,
        [System.Drawing.Color]$FillColor,
        [System.Drawing.Color]$BorderColor,
        [System.Drawing.Color]$TextColor
    )

    $font = New-FontSafe -Names @("Segoe UI Semibold", "Segoe UI") -Size 13 -Style ([System.Drawing.FontStyle]::Bold)
    $format = New-Object System.Drawing.StringFormat([System.Drawing.StringFormat]::GenericTypographic)
    $size = $Graphics.MeasureString($Text, $font, 1000, $format)
    $width = [Math]::Ceiling($size.Width) + 28
    $height = 36

    $path = New-RoundedRectPath -X $X -Y $Y -Width $width -Height $height -Radius 18
    $fill = New-Object System.Drawing.SolidBrush($FillColor)
    $border = New-Object System.Drawing.Pen($BorderColor, 1)
    $textBrush = New-Object System.Drawing.SolidBrush($TextColor)

    $Graphics.FillPath($fill, $path)
    $Graphics.DrawPath($border, $path)
    $Graphics.DrawString($Text, $font, $textBrush, $X + 14, $Y + 9, $format)

    $textBrush.Dispose()
    $border.Dispose()
    $fill.Dispose()
    $path.Dispose()
    $font.Dispose()
    $format.Dispose()

    return $width
}

function Draw-FeatureSurface {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.Image]$Icon,
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height
    )

    $shadowPath = New-RoundedRectPath -X ($X + 8) -Y ($Y + 10) -Width $Width -Height $Height -Radius 34
    $shadowBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "000000" -Alpha 110))
    $Graphics.FillPath($shadowBrush, $shadowPath)

    $surfacePath = New-RoundedRectPath -X $X -Y $Y -Width $Width -Height $Height -Radius 34
    $surfaceBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "171717" -Alpha 248))
    $surfaceBorder = New-Object System.Drawing.Pen((New-HexColor -Hex "FFFFFF" -Alpha 22), 1)
    $Graphics.FillPath($surfaceBrush, $surfacePath)
    $Graphics.DrawPath($surfaceBorder, $surfacePath)

    $surfaceState = $Graphics.Save()
    $Graphics.SetClip($surfacePath)

    $accentBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "8A9A5B"))
    $Graphics.FillRectangle($accentBrush, $X + 24, $Y + 22, 70, 5)

    $iconX = $X + 26
    $iconY = $Y + 40
    $Graphics.DrawImage($Icon, $iconX, $iconY, 52, 52)

    $eyebrowFont = New-FontSafe -Names @("Segoe UI Semibold", "Segoe UI") -Size 13 -Style ([System.Drawing.FontStyle]::Bold)
    $titleFont = New-FontSafe -Names @("Segoe UI Semibold", "Segoe UI") -Size 17 -Style ([System.Drawing.FontStyle]::Bold)
    $bodyFont = New-FontSafe -Names @("Segoe UI", "Segoe UI Variable Text") -Size 12 -Style ([System.Drawing.FontStyle]::Regular)
    $mutedBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "A57164" -Alpha 220))
    $titleBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "E5E4E2"))
    $bodyBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "C9C6BF"))

    Draw-TrackedText -Graphics $Graphics -Text "TODAY" -Font $eyebrowFont -Brush $mutedBrush -X ($X + 92) -Y ($Y + 50) -Tracking 1.1
    $Graphics.DrawString("Pick one film.", $titleFont, $titleBrush, [System.Drawing.RectangleF]::new($X + 92, $Y + 76, 190, 24))
    $Graphics.DrawString("Write one clear thought.", $bodyFont, $bodyBrush, [System.Drawing.RectangleF]::new($X + 92, $Y + 104, 190, 22))

    $posterY = $Y + 158
    $posterWidth = 44
    $posterHeight = 78
    for ($i = 0; $i -lt 5; $i++) {
        $posterX = $X + 24 + ($i * 52)
        $posterPath = New-RoundedRectPath -X $posterX -Y $posterY -Width $posterWidth -Height $posterHeight -Radius 18
        $posterFillColor =
            switch ($i) {
                1 { New-HexColor -Hex "8A9A5B" -Alpha 62 }
                default { New-HexColor -Hex "1F1F1F" -Alpha 250 }
            }
        $posterBorderColor =
            switch ($i) {
                1 { New-HexColor -Hex "8A9A5B" -Alpha 180 }
                default { New-HexColor -Hex "FFFFFF" -Alpha 20 }
            }
        $posterFill = New-Object System.Drawing.SolidBrush($posterFillColor)
        $posterBorder = New-Object System.Drawing.Pen($posterBorderColor, 1)
        $Graphics.FillPath($posterFill, $posterPath)
        $Graphics.DrawPath($posterBorder, $posterPath)

        $posterLineBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "FFFFFF" -Alpha 30))
        $Graphics.FillRectangle($posterLineBrush, $posterX + 8, $posterY + 52, 26, 3)
        $Graphics.FillRectangle($posterLineBrush, $posterX + 8, $posterY + 60, 20, 2)

        $posterLineBrush.Dispose()
        $posterBorder.Dispose()
        $posterFill.Dispose()
        $posterPath.Dispose()
    }

    $composerPath = New-RoundedRectPath -X ($X + 24) -Y ($Y + 282) -Width ($Width - 48) -Height 68 -Radius 20
    $composerFill = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "1F1F1F" -Alpha 238))
    $composerBorder = New-Object System.Drawing.Pen((New-HexColor -Hex "FFFFFF" -Alpha 22), 1)
    $Graphics.FillPath($composerFill, $composerPath)
    $Graphics.DrawPath($composerBorder, $composerPath)

    $composerEyebrowFont = New-FontSafe -Names @("Segoe UI Semibold", "Segoe UI") -Size 12 -Style ([System.Drawing.FontStyle]::Bold)
    $composerTextFont = New-FontSafe -Names @("Segoe UI", "Segoe UI Variable Text") -Size 12 -Style ([System.Drawing.FontStyle]::Regular)
    $sageBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "8A9A5B"))
    $mutedTextBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "8E8B84"))
    $primaryTextBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "E5E4E2"))

    Draw-TrackedText -Graphics $Graphics -Text "180 CHARACTERS" -Font $composerEyebrowFont -Brush $sageBrush -X ($X + 38) -Y ($Y + 298) -Tracking 0.9
    $Graphics.DrawString("One focused comment.", $composerTextFont, $primaryTextBrush, $X + 38, $Y + 322)

    $buttonPath = New-RoundedRectPath -X ($X + $Width - 122) -Y ($Y + 296) -Width 74 -Height 30 -Radius 15
    $buttonFill = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "8A9A5B"))
    $buttonTextBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "121212"))
    $buttonFont = New-FontSafe -Names @("Segoe UI Semibold", "Segoe UI") -Size 12 -Style ([System.Drawing.FontStyle]::Bold)
    $Graphics.FillPath($buttonFill, $buttonPath)
    Draw-TrackedText -Graphics $Graphics -Text "WRITE" -Font $buttonFont -Brush $buttonTextBrush -X ($X + $Width - 102) -Y ($Y + 304) -Tracking 0.7

    $Graphics.Restore($surfaceState)

    $buttonFont.Dispose()
    $buttonTextBrush.Dispose()
    $buttonFill.Dispose()
    $buttonPath.Dispose()
    $primaryTextBrush.Dispose()
    $mutedTextBrush.Dispose()
    $sageBrush.Dispose()
    $composerTextFont.Dispose()
    $composerEyebrowFont.Dispose()
    $composerBorder.Dispose()
    $composerFill.Dispose()
    $composerPath.Dispose()
    $bodyBrush.Dispose()
    $titleBrush.Dispose()
    $mutedBrush.Dispose()
    $bodyFont.Dispose()
    $titleFont.Dispose()
    $eyebrowFont.Dispose()
    $accentBrush.Dispose()
    $surfaceBorder.Dispose()
    $surfaceBrush.Dispose()
    $surfacePath.Dispose()
    $shadowBrush.Dispose()
    $shadowPath.Dispose()
}

function New-FeatureBitmap {
    param(
        [string]$Headline,
        [string]$Subline,
        [bool]$ShowBadges
    )

    $width = 1024
    $height = 500
    $bitmap = New-Object System.Drawing.Bitmap($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $graphics.Clear((New-HexColor -Hex "121212"))

    $iconPath = Join-Path $PSScriptRoot "..\apps\mobile\assets\play-store-icon-512.png"
    $icon = [System.Drawing.Image]::FromFile((Resolve-Path $iconPath))
    Draw-FeatureSurface -Graphics $graphics -Icon $icon -X 628 -Y 56 -Width 286 -Height 364

    $accentBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "8A9A5B"))
    $graphics.FillRectangle($accentBrush, 88, 102, 84, 5)

    $brandFont = New-FontSafe -Names @("Segoe UI Black", "Segoe UI Semibold", "Segoe UI") -Size 88 -Style ([System.Drawing.FontStyle]::Bold)
    $subtitleFont = New-FontSafe -Names @("Segoe UI Semibold", "Segoe UI") -Size 17 -Style ([System.Drawing.FontStyle]::Bold)
    $headlineFont = New-FontSafe -Names @("Segoe UI Semibold", "Segoe UI") -Size 40 -Style ([System.Drawing.FontStyle]::Bold)
    $sublineFont = New-FontSafe -Names @("Segoe UI", "Segoe UI Variable Text") -Size 18 -Style ([System.Drawing.FontStyle]::Regular)
    $brandBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "8A9A5B"))
    $subtitleBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "A57164"))
    $headlineBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "E5E4E2"))
    $sublineBrush = New-Object System.Drawing.SolidBrush((New-HexColor -Hex "C9C6BF"))

    $graphics.DrawString("180", $brandFont, $brandBrush, 84, 116)
    Draw-TrackedText -Graphics $graphics -Text "ABSOLUTE CINEMA" -Font $subtitleFont -Brush $subtitleBrush -X 92 -Y 210 -Tracking 1.8

    if (-not [string]::IsNullOrWhiteSpace($Headline)) {
        $graphics.DrawString($Headline, $headlineFont, $headlineBrush, [System.Drawing.RectangleF]::new(88, 274, 454, 92))
    }

    if (-not [string]::IsNullOrWhiteSpace($Subline)) {
        $graphics.DrawString($Subline, $sublineFont, $sublineBrush, [System.Drawing.RectangleF]::new(88, 372, 454, 56))
    }

    $icon.Dispose()
    $accentBrush.Dispose()
    $sublineBrush.Dispose()
    $headlineBrush.Dispose()
    $subtitleBrush.Dispose()
    $brandBrush.Dispose()
    $sublineFont.Dispose()
    $headlineFont.Dispose()
    $subtitleFont.Dispose()
    $brandFont.Dispose()
    $graphics.Dispose()

    return $bitmap
}

$resolvedOutputDir = Join-Path $PSScriptRoot "..\$OutputDir"
New-Item -ItemType Directory -Path $resolvedOutputDir -Force | Out-Null

$variants = @(
    @{
        File = "feature-graphic-brand-clean.png"
        Headline = ""
        Subline = ""
        ShowBadges = $false
    },
    @{
        File = "feature-graphic-daily-ritual.png"
        Headline = "A daily film ritual"
        Subline = "5 curated films. 180 characters. Every day."
        ShowBadges = $false
    },
    @{
        File = "feature-graphic-safe-en.png"
        Headline = "5 curated films daily"
        Subline = "One focused 180-character comment."
        ShowBadges = $false
    }
)

foreach ($variant in $variants) {
    $bitmap = New-FeatureBitmap -Headline $variant.Headline -Subline $variant.Subline -ShowBadges $variant.ShowBadges
    $outPath = Join-Path $resolvedOutputDir $variant.File
    $bitmap.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    Write-Output "Generated $outPath"
}
