param([string[]]$Pages = @('53', '54', '55', '56'))
$ErrorActionPreference = 'Stop'
$target = Join-Path $PSScriptRoot '..\assets\sources'
$null = New-Item -ItemType Directory -Force -Path $target
$identifier = 'bub_gb_cc0PAAAAMAAJ'
$metaUrl = "https://archive.org/metadata/$identifier"

function Get-SourceFile([string]$url, [string]$filename) {
    $destination = Join-Path $target $filename
    if (-not (Test-Path $destination)) { Invoke-WebRequest -UseBasicParsing -Uri $url -OutFile $destination }
    return [ordered]@{ filename = $filename; url = $url; size = (Get-Item $destination).Length; sha256 = (Get-FileHash $destination -Algorithm SHA256).Hash.ToLowerInvariant() }
}

$files = @()
$provenancePath = Join-Path $target 'provenance.json'
if (Test-Path $provenancePath) { $files = @((Get-Content -Raw -Encoding UTF8 $provenancePath | ConvertFrom-Json).files) }
$files = @($files | Where-Object { $_.filename -notin @('kluge-metadata.json', 'kluge-1901-ocr.txt') })
$files += Get-SourceFile $metaUrl 'kluge-metadata.json'
$metadata = Get-Content -Raw -Encoding UTF8 (Join-Path $target 'kluge-metadata.json') | ConvertFrom-Json
if ($metadata.metadata.licenseurl -ne 'http://creativecommons.org/publicdomain/mark/1.0/' -or $metadata.metadata.date -ne '1901') { throw 'Source identity or public-domain label changed.' }
$files += Get-SourceFile "https://archive.org/download/$identifier/$($identifier)_djvu.txt" 'kluge-1901-ocr.txt'
foreach ($pageNumber in $Pages) {
    $mapping = $metadata.page_numbers.pages | Where-Object { $_.pageNumber -eq $pageNumber } | Select-Object -First 1
    if (-not $mapping) { throw "Missing printed page: $pageNumber" }
    $imageFile = "$($identifier)_jp2/$($identifier)_$('{0:D4}' -f [int]$mapping.leafNum).jp2"
    $imageUrl = "https://$($metadata.server)/BookReader/BookReaderImages.php?zip=$($metadata.dir)/$($identifier)_jp2.zip&file=$imageFile&id=$identifier&scale=2&rotate=0"
    $image = Get-SourceFile $imageUrl "kluge-p$pageNumber.jpg"
    $image.printedPage = $pageNumber
    $image.leafNum = $mapping.leafNum
    $files = @($files | Where-Object { $_.filename -ne $image.filename })
    $files += $image
    Write-Output "Kluge p. $pageNumber, leaf $($mapping.leafNum): $($image.size) bytes"
}
$provenance = [ordered]@{ retrievedAt = [DateTime]::UtcNow.ToString('o'); title = $metadata.metadata.title; author = $metadata.metadata.creator; date = $metadata.metadata.date; rights = $metadata.metadata.licenseurl; files = $files }
$json = $provenance | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText((Join-Path $target 'provenance.json'), $json, [System.Text.UTF8Encoding]::new($false))
Write-Output 'Sources archived. OCR is not a reviewed dictionary.'