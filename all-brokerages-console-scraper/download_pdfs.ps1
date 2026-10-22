# Mass-download brochures from the CSV produced by extract_pdfs.js's
# downloadCsv() -- uses only Invoke-WebRequest, built into Windows
# PowerShell. No Python, no extra installs.
#
# Usage:
#   .\download_pdfs.ps1 -CsvPath cw_pdf_links.csv -OutDir brochures

param(
    [Parameter(Mandatory = $true)]
    [string]$CsvPath,

    [string]$OutDir = "brochures"
)

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$rows = Import-Csv -Path $CsvPath
$urls = $rows | ForEach-Object { $_.pdfUrl } | Where-Object { $_ } | Select-Object -Unique

$total = $urls.Count
Write-Host "Found $total PDF URL(s) in $CsvPath"

$i = 0
foreach ($url in $urls) {
    $i++
    $name = [System.IO.Path]::GetFileName(($url -split '\?')[0])
    $dest = Join-Path $OutDir $name

    if (Test-Path $dest) {
        Write-Host "[$i/$total] already downloaded: $name"
        continue
    }

    Write-Host "[$i/$total] downloading: $name"
    $attempt = 0
    $success = $false
    while (-not $success -and $attempt -lt 3) {
        $attempt++
        try {
            Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing
            $success = $true
        } catch {
            Write-Warning "  attempt $attempt/3 failed: $($_.Exception.Message)"
            Start-Sleep -Seconds 2
        }
    }
    if ($success) {
        Write-Host "  saved -> $dest"
    } else {
        Write-Warning "  FAILED after 3 attempts: $url"
    }
    Start-Sleep -Seconds 1
}

Write-Host "Done. Files saved in $OutDir"
