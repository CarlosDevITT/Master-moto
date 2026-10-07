param([string]$ExportPath = '')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$inputPath = Join-Path $projectRoot 'Data\MASTER_MOTOS_v6.xlsx'
$outputPath = if ($ExportPath) { $ExportPath } else { Join-Path $projectRoot 'js\data.js' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($inputPath)
try {
function Read-XmlEntry($name) {
  $entry = $zip.GetEntry($name)
  if (!$entry) { throw "Entrada ausente: $name" }
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
if (!$sheet) { throw 'A aba MASTER COMPLETO não foi encontrada.' }
$rid = $sheet.GetAttribute('id','http://schemas.openxmlformats.org/officeDocument/2006/relationships')
$rel = $rels.SelectNodes("//*[local-name()='Relationship']") | Where-Object { $_.Id -eq $rid }
$target = ($rel.Target -replace '^/','')
if ($target -notlike 'xl/*') { $target = 'xl/' + $target }
$sheetXml = Read-XmlEntry $target
$rows = @()
foreach ($row in $sheetXml.SelectNodes("//*[local-name()='sheetData']/*[local-name()='row']")) {
  if ([int]$row.GetAttribute('r') -lt 3) { continue }
  # Missing Excel cells must not shift the remaining columns.
  $values = @('', '', '', '', '', '', '', '', '')
  foreach ($cell in $row.SelectNodes("./*[local-name()='c']")) {
    $column = $cell.GetAttribute('r') -replace '\d',''
    if ($column -notmatch '^[A-I]$') { continue }
    $columnIndex = [int][char]$column - [int][char]'A'
    $valueNode = $cell.SelectSingleNode("./*[local-name()='v']")
    $value = if ($valueNode) { $valueNode.InnerText } else { '' }
    if ($cell.GetAttribute('t') -eq 's' -and $value -ne '') { $value = $shared[[int]$value] }
    if ($cell.GetAttribute('t') -eq 'inlineStr') { $value = $cell.InnerText }
    $values[$columnIndex] = [string]$value
  }
  if ($values[0] -and $values[1] -and $values[8] -and $values[0] -ne 'MARCA') {
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
if (!$rows.Count) { throw 'Nenhum registro válido encontrado; o catálogo não foi sobrescrito.' }
$json = ConvertTo-Json -InputObject @($rows) -Depth 4 -Compress
Set-Content -LiteralPath $outputPath -Value ("window.MOTO_DATA = $json;") -Encoding UTF8
Write-Output "Exportados $($rows.Count) registros para $outputPath"
} finally { $zip.Dispose() }
