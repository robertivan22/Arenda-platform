# scripts/import-siruta.ps1
# Downloads SIRUTA 2025 CSV from data.gov.ro and bulk-upserts into Supabase
# No Node.js required — uses pure PowerShell + Supabase REST API
#
# Usage (from repo root):
#   .\scripts\import-siruta.ps1

$ErrorActionPreference = 'Stop'

# ─── Read .env.local ────────────────────────────────────────────────────────
$envFile = Join-Path $PSScriptRoot "..\apps\web\.env.local"
if (-not (Test-Path $envFile)) {
    Write-Error "apps/web/.env.local not found"
    exit 1
}

$env = @{}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^#=]+)=(.+)$') {
        $env[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$SUPABASE_URL      = $env['NEXT_PUBLIC_SUPABASE_URL']
$SERVICE_ROLE_KEY  = $env['SUPABASE_SERVICE_ROLE_KEY']

if (-not $SUPABASE_URL -or -not $SERVICE_ROLE_KEY) {
    Write-Error "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    exit 1
}

$apiHeaders = @{
    'apikey'        = $SERVICE_ROLE_KEY
    'Authorization' = "Bearer $SERVICE_ROLE_KEY"
    'Content-Type'  = 'application/json'
    'Prefer'        = 'resolution=merge-duplicates'
}

# ─── Download XLSX (data.gov.ro serves Excel despite .csv URL) ───────────────
$xlsxUrl  = 'https://data.gov.ro/dataset/fcba1a54-cffd-422c-b3ac-920f63564085/resource/0ab29d86-302c-4cfa-b9b9-fd5c7ff90710/download/siruta_s1_2025.csv'
$tmpFile  = Join-Path $env:TEMP "siruta_2025.xlsx"
Write-Host "Downloading SIRUTA file..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $xlsxUrl -OutFile $tmpFile -UseBasicParsing

# ─── Parse via Excel COM ─────────────────────────────────────────────────────
Write-Host "Opening with Excel COM..." -ForegroundColor Cyan
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false

try {
    $wb = $xl.Workbooks.Open($tmpFile, 0, $true)
    $ws = $wb.Sheets.Item(1)

    $lastRow = $ws.UsedRange.Rows.Count
    $lastCol = $ws.UsedRange.Columns.Count
    Write-Host "  Rows: $lastRow  Cols: $lastCol" -ForegroundColor Gray

    # Read header row (row 1)
    $colHeaders = @{}
    for ($c = 1; $c -le $lastCol; $c++) {
        $h = $ws.Cells.Item(1, $c).Text.ToString().Trim()
        $colHeaders[$h] = $c
    }
    Write-Host ("  Headers: " + ($colHeaders.Keys -join ' | ')) -ForegroundColor Gray

    # Confirmed column positions for siruta_s1_2025.xlsx:
    # TIP(1) SIRSUP(2) DENLOC(3) NIV(4) MED(5) JUD(6) REGIUNE(7) NUTS(8) FSL(9) CODP(10) SIRUTA(11) FSJ(12)
    $cCode   = $colHeaders['SIRUTA']   # e.g. 1234567
    $cName   = $colHeaders['DENLOC']   # locality name
    $cType   = $colHeaders['TIP']      # 1=Municipiu 2=Oras 3=Comuna etc.
    $cCounty = $colHeaders['JUD']      # county abbreviation e.g. PH, IF
    $cParent = $colHeaders['SIRSUP']   # parent SIRUTA code
    $cPostal = $colHeaders['CODP']     # postal code

    # Fallback to known positions if hashtable lookup fails
    if (-not $cCode)   { $cCode   = 11 }
    if (-not $cName)   { $cName   = 3  }
    if (-not $cType)   { $cType   = 1  }
    if (-not $cCounty) { $cCounty = 6  }
    if (-not $cParent) { $cParent = 2  }
    if (-not $cPostal) { $cPostal = 10 }

    Write-Host "  Mapped cols: code=$cCode name=$cName type=$cType county=$cCounty" -ForegroundColor Gray

    $records = [System.Collections.Generic.List[object]]::new()

    # Read entire used range as a 2D array — much faster than cell-by-cell
    $data = $ws.UsedRange.Value2

    for ($r = 2; $r -le $lastRow; $r++) {
        $code = if ($cCode)   { "$($data[$r, $cCode])".Trim()   } else { '' }
        if (-not $code -or $code -eq '') { continue }

        $records.Add([ordered]@{
            code        = $code
            name        = if ($cName)   { "$($data[$r, $cName])".Trim() }   else { $null }
            type        = if ($cType)   { "$($data[$r, $cType])".Trim() }   else { $null }
            county      = if ($cCounty) { "$($data[$r, $cCounty])".Trim() } else { $null }
            parent_code = if ($cParent) { "$($data[$r, $cParent])".Trim() } else { $null }
            postal_code = if ($cPostal) { "$($data[$r, $cPostal])".Trim() } else { $null }
        })

        if ($r % 2000 -eq 0) { Write-Host "`r  Processing row $r/$lastRow..." -NoNewline }
    }

    $wb.Close($false)
}
finally {
    $xl.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($xl) | Out-Null
    Remove-Item $tmpFile -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Parsed $($records.Count) records" -ForegroundColor Green

# ─── Upsert in chunks of 500 ─────────────────────────────────────────────────
$chunkSize = 500
$uploaded  = 0
$endpoint  = "$SUPABASE_URL/rest/v1/siruta"

# Convert Generic.List to a plain array for proper slicing
$arr = $records.ToArray()

for ($i = 0; $i -lt $arr.Count; $i += $chunkSize) {
    $end   = [Math]::Min($i + $chunkSize, $arr.Count)
    $chunk = $arr[$i..($end - 1)]

    # Build JSON manually - ConvertTo-Json on [ordered] hashtable arrays is unreliable in PS5.1
    $jsonItems = foreach ($rec in $chunk) {
        $c = $rec.code        -replace '\\','\\' -replace '"','\"'
        $n = if ($rec.name)        { '"' + ($rec.name        -replace '\\','\\' -replace '"','\"') + '"' } else { 'null' }
        $t = if ($rec.type)        { '"' + ($rec.type        -replace '\\','\\' -replace '"','\"') + '"' } else { 'null' }
        $j = if ($rec.county)      { '"' + ($rec.county      -replace '\\','\\' -replace '"','\"') + '"' } else { 'null' }
        $p = if ($rec.parent_code) { '"' + ($rec.parent_code -replace '\\','\\' -replace '"','\"') + '"' } else { 'null' }
        $z = if ($rec.postal_code) { '"' + ($rec.postal_code -replace '\\','\\' -replace '"','\"') + '"' } else { 'null' }
        '{"code":"' + $c + '","name":' + $n + ',"type":' + $t + ',"county":' + $j + ',"parent_code":' + $p + ',"postal_code":' + $z + '}'
    }
    $body = '[' + ($jsonItems -join ',') + ']'

    try {
        Invoke-RestMethod -Uri $endpoint -Method Post -Headers $apiHeaders -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType 'application/json' | Out-Null
        $uploaded += $chunk.Count
        Write-Host "`r  Uploaded $uploaded/$($arr.Count)..." -NoNewline
    }
    catch {
        Write-Host ""
        Write-Error "Failed at chunk $i : $_"
        exit 1
    }
}

Write-Host ""
Write-Host "Done! $uploaded SIRUTA records uploaded to Supabase." -ForegroundColor Green
