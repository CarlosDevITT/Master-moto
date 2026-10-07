$projectRoot = Split-Path -Parent $PSScriptRoot
$inputPath = Join-Path (Split-Path -Parent $projectRoot) 'MASTER_MOTOS_v6.xlsx'
$outputPath = Join-Path $projectRoot 'js\data.js'
$publishPath = Join-Path $projectRoot 'dist\js\data.js'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($inputPath)
function Read-XmlEntry($name) {
  $entry = $zip.GetEntry($name)
  $reader = New-Object IO.StreamReader($entry.Open())
  $text = $reader.ReadToEnd(); $reader.Close()
  return [xml]$text
}
$workbook = Read-XmlEntry 'xl/workbook.xml'
$rels = Read-XmlEntry 'xl/_rels/workbook.xml.rels'
$shared = @()
$sharedEntry = $zip.GetEntry('xl/sharedStrings.xml')
if ($sharedEntry) {
  $reader = New-Object IO.StreamReader($sharedEntry.Open())
  $sharedXml = [xml]$reader.ReadToEnd(); $reader.Close()
  foreach ($si in $sharedXml.SelectNodes("//*[local-name()='si']")) { $shared += $si.InnerText }
}
$sheet = $workbook.SelectNodes("//*[local-name()='sheet']") | Where-Object { $_.name -like '*MASTER COMPLETO*' }
$rid = $sheet.GetAttribute('id','http://schemas.openxmlformats.org/officeDocument/2006/relationships')
$rel = $rels.SelectNodes("//*[local-name()='Relationship']") | Where-Object { $_.Id -eq $rid }
$target = ($rel.Target -replace '^/','')
if ($target -notlike 'xl/*') { $target = 'xl/' + $target }
$sheetXml = Read-XmlEntry $target
$rows = @()
foreach ($row in $sheetXml.SelectNodes("//*[local-name()='sheetData']/*[local-name()='row']")) {
  if ([int]$row.GetAttribute('r') -lt 3) { continue }
  $values = @()
  foreach ($cell in $row.SelectNodes("./*[local-name()='c']")) {
    $valueNode = $cell.SelectSingleNode("./*[local-name()='v']")
    $value = if ($valueNode) { $valueNode.InnerText } else { '' }
    if ($cell.GetAttribute('t') -eq 's' -and $value -ne '') { $value = $shared[[int]$value] }
    if ($cell.GetAttribute('t') -eq 'inlineStr') { $value = $cell.InnerText }
    $values += [string]$value
  }
  if ($values.Count -ge 9 -and $values[0] -ne 'MARCA') {
    $rows += [ordered]@{
      id = $rows.Count + 1
      marca = $values[0]
      modelo = $values[1]
      cilindrada = if ($values[2]) { [int]$values[2] } else { $null }
      quatroTempos = $values[3]
      doisTempos = $values[4]
      anoInicial = if ($values[5]) { [int]$values[5] } else { $null }
      anoFinal = if ($values[6]) { [int]$values[6] } else { $null }
      nomeTitulo = $values[7]
      categoria = $values[8]
    }
  }
}
$json = $rows | ConvertTo-Json -Depth 4 -Compress
Set-Content -LiteralPath $outputPath -Value ("window.MOTO_DATA = $json;") -Encoding UTF8
Copy-Item -LiteralPath $outputPath -Destination $publishPath -Force
$zip.Dispose()
Write-Output "Exportados $($rows.Count) registros para $outputPath e $publishPath"
