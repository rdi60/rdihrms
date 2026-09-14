<#
.SYNOPSIS
  Creates a login (Supabase auth user + profile) for every active employee in
  the local eSSL database whose EmployeeCode matches one of -CodePrefixes,
  and who doesn't already have a profile. Writes a CSV of the emails/
  passwords it created so you can hand them out.

.PARAMETER CodePrefixes
  Only employees whose EmployeeCode starts with one of these are considered.
  Defaults to CDRF and R (Rajan Dental's staff, per the two groups used in
  the local database - excludes generic/test codes and shift templates).

.PARAMETER DryRun
  Read and compute everything, print what would be created, but don't
  actually create any accounts or write the credentials CSV.

.EXAMPLE
  .\Provision-Staff.ps1 -DryRun
  .\Provision-Staff.ps1
#>
param(
  [string[]]$CodePrefixes = @('CDRF', 'R'),
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

$configPath = Join-Path $PSScriptRoot 'config.ps1'
if (-not (Test-Path $configPath)) {
  Write-Error "config.ps1 not found next to this script. Copy config.example.ps1 to config.ps1 and fill in your values."
  exit 1
}
. $configPath

foreach ($required in 'SqlServer', 'SqlDatabase', 'SupabaseUrl', 'SupabaseServiceRoleKey') {
  if (-not (Get-Variable -Name $required -ErrorAction SilentlyContinue) -or [string]::IsNullOrWhiteSpace((Get-Variable -Name $required).Value)) {
    Write-Error "config.ps1 is missing a value for `$$required."
    exit 1
  }
}

# -- SQL Server: find matching active employees ------------------------------

if ($SqlUseWindowsAuth) {
  $connString = "Server=$SqlServer;Database=$SqlDatabase;Integrated Security=True;TrustServerCertificate=True;"
} else {
  $connString = "Server=$SqlServer;Database=$SqlDatabase;User Id=$SqlUser;Password=$SqlPassword;TrustServerCertificate=True;"
}

$likeClauses = for ($i = 0; $i -lt $CodePrefixes.Count; $i++) { "EmployeeCode LIKE @prefix$i" }
$query = "SELECT EmployeeCode, EmployeeName FROM Employees WHERE Status = 'Working' AND ($($likeClauses -join ' OR '))"

Write-Host "Connecting to SQL Server ($SqlServer / $SqlDatabase)..."
$connection = New-Object System.Data.SqlClient.SqlConnection $connString
$connection.Open()
$command = $connection.CreateCommand()
$command.CommandText = $query
for ($i = 0; $i -lt $CodePrefixes.Count; $i++) {
  $null = $command.Parameters.AddWithValue("@prefix$i", "$($CodePrefixes[$i])%")
}
$reader = $command.ExecuteReader()

$employees = New-Object System.Collections.Generic.List[object]
while ($reader.Read()) {
  $employees.Add([pscustomobject]@{
    EmployeeCode = ([string]$reader['EmployeeCode']).Trim()
    EmployeeName = ([string]$reader['EmployeeName']).Trim()
  })
}
$reader.Close()
$connection.Close()
Write-Host "Found $($employees.Count) active employees matching prefixes: $($CodePrefixes -join ', ')"

# -- Supabase: find who already has a profile ---------------------------------

$headers = @{
  apikey        = $SupabaseServiceRoleKey
  Authorization = "Bearer $SupabaseServiceRoleKey"
  'Content-Type' = 'application/json'
}

Write-Host "Checking existing profiles in Supabase..."
$existingProfiles = Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/profiles?select=employee_code" -Headers $headers -Method Get
$existingCodes = @{}
foreach ($p in $existingProfiles) {
  $existingCodes[$p.employee_code.Trim().ToUpperInvariant()] = $true
}
Write-Host "$($existingCodes.Count) profiles already exist."

$toCreate = $employees | Where-Object { -not $existingCodes.ContainsKey($_.EmployeeCode.ToUpperInvariant()) }
Write-Host "$($toCreate.Count) employees need a new login."

if ($toCreate.Count -eq 0) {
  Write-Host "Nothing to do."
  exit 0
}

# -- Build email + password for each new account -----------------------------

function ConvertTo-EmailLocalPart {
  param([string]$Code)
  return ($Code.ToLowerInvariant() -replace '[^a-z0-9]', '')
}

$results = New-Object System.Collections.Generic.List[object]
foreach ($e in $toCreate) {
  $localPart = ConvertTo-EmailLocalPart -Code $e.EmployeeCode
  $results.Add([pscustomobject]@{
    EmployeeCode = $e.EmployeeCode
    EmployeeName = $e.EmployeeName
    Email        = "$localPart@rajandental.app"
    Password     = "Rajan@$($e.EmployeeCode)"
    Status       = 'pending'
  })
}

if ($DryRun) {
  Write-Host "`n--dry run-- would create $($results.Count) accounts. First 10:"
  $results | Select-Object -First 10 EmployeeCode, EmployeeName, Email | Format-Table | Out-String | Write-Host
  exit 0
}

# -- Create each account via Supabase's admin API -----------------------------
# This triggers the database's handle_new_user trigger, which creates the
# matching profiles row from the metadata below.

$created = 0
$failed = 0
foreach ($r in $results) {
  $body = @{
    email         = $r.Email
    password      = $r.Password
    email_confirm = $true
    user_metadata = @{
      full_name     = $r.EmployeeName
      role          = 'staff'
      employee_code = $r.EmployeeCode
    }
  } | ConvertTo-Json -Depth 5

  try {
    Invoke-RestMethod -Uri "$SupabaseUrl/auth/v1/admin/users" -Headers $headers -Method Post -Body $body | Out-Null
    $r.Status = 'created'
    $created++
    Write-Host "Created: $($r.EmployeeCode) - $($r.EmployeeName)"
  } catch {
    $r.Status = "error: $($_.Exception.Message)"
    $failed++
    Write-Warning "Failed: $($r.EmployeeCode) - $($r.EmployeeName): $($_.Exception.Message)"
  }
}

Write-Host "`nCreated $created accounts, $failed failed."

$csvPath = Join-Path $PSScriptRoot "provisioned-staff-credentials.csv"
$results | Export-Csv -Path $csvPath -NoTypeInformation
Write-Host "Credentials written to $csvPath"
Write-Host "This file has plaintext passwords in it - hand out logins from it, then delete it. Do not commit it or leave it on a shared drive."
