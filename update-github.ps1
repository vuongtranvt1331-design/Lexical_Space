$ErrorActionPreference = 'Stop'
$sourceRoot = $PSScriptRoot
$remoteUrl = 'https://github.com/vuongtranvt1331-design/Lexical_Space.git'
$cacheRoot = Join-Path $env:LOCALAPPDATA 'LexicalSpacePublisher'
$checkout = Join-Path $cacheRoot 'Lexical_Space'

function Run-Git {
    param([string[]]$GitArgs)
    & git -c credential.https://github.com.helper= -c credential.https://github.com.helper=manager @GitArgs
    if ($LASTEXITCODE -ne 0) { throw 'Git could not finish. Check your connection or GitHub access; no force push was attempted.' }
}

try {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Install Git for Windows first: https://git-scm.com/download/win' }
    New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null
    Write-Host 'Preparing GitHub update...'
    if (-not (Test-Path -LiteralPath (Join-Path $checkout '.git'))) {
        Run-Git -GitArgs @('clone', '--branch', 'main', '--single-branch', $remoteUrl, $checkout)
    }
    $actualRemote = & git -C $checkout remote get-url origin
    if ($LASTEXITCODE -ne 0 -or $actualRemote -ne $remoteUrl) { throw 'Unexpected repository in publisher cache. Update stopped.' }
    $branch = & git -C $checkout branch --show-current
    if ($branch -ne 'main') { throw 'Publisher cache must be on main.' }
    $pending = & git -C $checkout status --porcelain
    if ($pending) { throw "An unfinished update exists in $checkout. Keep these files and resolve it before retrying." }
    Run-Git -GitArgs @('-C', $checkout, 'pull', '--ff-only', 'origin', 'main')
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot 'index.html'))) { throw 'Keep both update files inside the app folder next to index.html.' }
    $excluded = '(^|/)(\.git|node_modules|\.codex|\.agents)(/|$)|(^|/)(\.env[^/]*|groq-local-config\.js|[^/]*\.(log|pem|key))$'
    $sourcePrefix = $sourceRoot.TrimEnd('\') + '\'
    Get-ChildItem -LiteralPath $sourceRoot -File -Recurse -Force | ForEach-Object {
        $relative = $_.FullName.Substring($sourcePrefix.Length).Replace('\', '/')
        if ($relative -notmatch $excluded) {
            $target = Join-Path $checkout $relative
            New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
            Copy-Item -LiteralPath $_.FullName -Destination $target -Force
        }
    }
    # Remove tracked files removed from the app; never traverse outside this checkout.
    $tracked = & git -C $checkout -c core.quotepath=false ls-files
    if ($LASTEXITCODE -ne 0) { throw 'Could not list published files.' }
    foreach ($relative in $tracked) {
        if ($relative -match $excluded) { continue }
        if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot $relative))) {
            $target = [IO.Path]::GetFullPath((Join-Path $checkout $relative))
            $allowedPrefix = [IO.Path]::GetFullPath($checkout).TrimEnd('\') + '\'
            if (-not $target.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid file path.' }
            Remove-Item -LiteralPath $target -Force
        }
    }
    Run-Git -GitArgs @('-C', $checkout, 'add', '--all')
    & git -C $checkout diff --cached --quiet
    if ($LASTEXITCODE -eq 0) { Run-Git -GitArgs @('-C', $checkout, 'push', 'origin', 'main'); Write-Host 'Already up to date.'; exit 0 }
    if ($LASTEXITCODE -ne 1) { throw 'Could not inspect changes.' }
    Write-Host 'Files being published:'
    Run-Git -GitArgs @('-C', $checkout, 'diff', '--cached', '--stat')
    $message = Read-Host 'Update description (Enter for automatic message)'
    if ([string]::IsNullOrWhiteSpace($message)) { $message = 'update: LexicalSpace ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') }
    # Repository-local identity avoids changing other projects on this computer.
    Run-Git -GitArgs @('-C', $checkout, 'config', 'user.name', 'vuongtranvt1331-design')
    Run-Git -GitArgs @('-C', $checkout, 'config', 'user.email', 'vuongtranvt1331-design@users.noreply.github.com')
    Run-Git -GitArgs @('-C', $checkout, 'commit', '-m', $message)
    Run-Git -GitArgs @('-C', $checkout, 'push', 'origin', 'main')
    Write-Host 'GitHub updated successfully.' -ForegroundColor Green
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
