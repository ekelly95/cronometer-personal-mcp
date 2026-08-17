[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$entryPoint = Join-Path $projectRoot 'dist\mcp\main.js'
$dataDirectory = Join-Path $env:LOCALAPPDATA 'CronometerPersonalMcp'
$configurationPath = Join-Path $dataDirectory 'live-config.json'

if (-not (Test-Path -LiteralPath $entryPoint -PathType Leaf)) {
    throw 'Cronometer MCP is not built. Run scripts\setup-windows.ps1 first.'
}
if (-not (Test-Path -LiteralPath $configurationPath -PathType Leaf)) {
    throw 'Cronometer MCP is not configured. Run scripts\setup-windows.ps1 first.'
}

# The bridge can only check that CRONOMETER_DATA_DIR is set, not that the directory
# is actually protected — Python cannot read a Windows ACL without extra packages.
# This is the one component that can, and it runs on every start, so the check
# belongs here. The directory holds the DPAPI ciphertext and the session cookie;
# an inherited ACL would hand both to SYSTEM and every local administrator.
$acl = Get-Acl -LiteralPath $dataDirectory
$currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().User
if (-not $acl.AreAccessRulesProtected) {
    throw "The Cronometer data directory inherits permissions from its parent: $dataDirectory. Re-run scripts\setup-windows.ps1 to restrict it."
}
foreach ($rule in $acl.Access) {
    $identity = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier])
    if ($identity -ne $currentUser) {
        throw "The Cronometer data directory grants access to $($rule.IdentityReference): $dataDirectory. Re-run scripts\setup-windows.ps1 to restrict it."
    }
}

$configuration = Get-Content -LiteralPath $configurationPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($configuration.version -ne 1 -or $configuration.live_enabled -ne $true) {
    throw 'The saved Cronometer MCP configuration is invalid or live access is disabled.'
}
if (
    $configuration.username -isnot [string] -or
    [string]::IsNullOrWhiteSpace($configuration.username) -or
    $configuration.username.Length -gt 320 -or
    $configuration.username.IndexOfAny([char[]]"`r`n`0") -ge 0
) {
    throw 'The saved Cronometer username is invalid.'
}
if (
    $configuration.timezone -isnot [string] -or
    [string]::IsNullOrWhiteSpace($configuration.timezone) -or
    $configuration.timezone.Length -gt 100
) {
    throw 'The saved Cronometer diary timezone is invalid.'
}
# Absent means a configuration written before this field existed, and every one of
# those is a Windows one. Anything else was written on another platform, where the
# password is not in this file at all.
$credentialSource = if ($null -eq $configuration.PSObject.Properties['credential_source']) {
    'dpapi'
} else {
    $configuration.credential_source
}
if ($credentialSource -ne 'dpapi') {
    throw "This configuration stores its password with '$credentialSource', which this launcher cannot read. It was written on another platform; re-run scripts\setup-windows.ps1 on this machine."
}
if ($configuration.password_dpapi -isnot [string] -or $configuration.password_dpapi.Length -gt 65536) {
    throw 'The saved Cronometer password is invalid.'
}

# DPAPI ties the encrypted value to this Windows account, avoiding plaintext secrets in MCP configs.
$securePassword = ConvertTo-SecureString $configuration.password_dpapi
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
if ([string]::IsNullOrEmpty($plainPassword)) {
    throw 'The saved Cronometer password could not be decrypted for this Windows account.'
}

$exitCode = 1
try {
    $env:CRONOMETER_LIVE_ENABLED = '1'
    $env:CRONOMETER_USERNAME = $configuration.username
    $env:CRONOMETER_PASSWORD = $plainPassword
    $env:CRONOMETER_TIMEZONE = $configuration.timezone
    $env:CRONOMETER_DATA_DIR = $dataDirectory
    # Downloaded exports are the whole diary, per meal, so they live inside the same
    # ACL-protected directory as the credentials rather than wherever a browser put
    # them. The server refuses to read exports at all if this is unset — it will not
    # guess a location for files like these.
    $env:CRONOMETER_EXPORT_DIR = Join-Path $dataDirectory 'exports'
    $env:CRONOMETER_PYTHON = Join-Path $projectRoot '.venv-live\Scripts\python.exe'

    & node $entryPoint
    $exitCode = $LASTEXITCODE
} finally {
    $plainPassword = $null
    Remove-Item Env:CRONOMETER_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:CRONOMETER_USERNAME -ErrorAction SilentlyContinue
    Remove-Item Env:CRONOMETER_LIVE_ENABLED -ErrorAction SilentlyContinue
    Remove-Item Env:CRONOMETER_TIMEZONE -ErrorAction SilentlyContinue
    Remove-Item Env:CRONOMETER_DATA_DIR -ErrorAction SilentlyContinue
    Remove-Item Env:CRONOMETER_EXPORT_DIR -ErrorAction SilentlyContinue
    Remove-Item Env:CRONOMETER_PYTHON -ErrorAction SilentlyContinue
}

exit $exitCode
