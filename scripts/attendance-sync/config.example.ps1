# Copy this file to config.ps1 in this same folder and fill in your real values.
# config.ps1 is gitignored - it holds real credentials and must never be committed
# or shared. This example file has no secrets in it and is safe to keep in git.

# --- SQL Server: the local eSSL / biometric attendance database ---
# Server name as you connect to it in SQL Server Management Studio, e.g.
# 'DESKTOP-ABC123\SQLEXPRESS' (named instance) or just 'DESKTOP-ABC123'.
$SqlServer = 'YOURSERVER\SQLEXPRESS'
$SqlDatabase = 'YourDatabaseName'

# Windows Authentication (recommended if this script runs on the same machine
# you use SSMS on, under the same Windows login that can already open the DB).
$SqlUseWindowsAuth = $true

# Only used if $SqlUseWindowsAuth is $false - a SQL Server login instead.
$SqlUser = ''
$SqlPassword = ''

# --- Supabase ---
$SupabaseUrl = 'https://ktdxklzblhgxgeuwpczj.supabase.co'

# Project Settings -> API -> "service_role" secret key (NOT the anon/publishable
# key you used in the app's .env). This key bypasses row-level security, which
# is required here so the script can write attendance for every staff member,
# not just one. Keep config.ps1 off of any shared drive or git repo.
$SupabaseServiceRoleKey = 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE'
