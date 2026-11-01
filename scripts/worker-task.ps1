param(
    [Parameter(Mandatory=$true)][ValidatePattern('^T-[A-Za-z0-9-]+$')][string]$Id,
    [ValidateSet('light','standard')][string]$Tier='standard',
    [switch]$Merge
)
$ErrorActionPreference='Stop'
$repoRoot=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$taskPath=Join-Path $repoRoot ".worktrees\$Id"
$taskBranch="worker/$Id"
if ($Merge) {
    git -C $repoRoot merge --no-edit $taskBranch
    if ($LASTEXITCODE -ne 0) { throw 'Merge failed; resolve before continuing.' }
    # Keep task worktrees for review. Cleanup is a separate explicit operation.
    exit 0
}
$briefPath=Join-Path $repoRoot "briefs\$Id.md"
if (-not (Test-Path -LiteralPath $briefPath -PathType Leaf)) { throw 'Task brief is missing.' }
New-Item -ItemType Directory -Path (Join-Path $repoRoot 'logs') -Force | Out-Null
if (-not (Test-Path -LiteralPath $taskPath)) {
    git -C $repoRoot worktree add -b $taskBranch $taskPath main
    if ($LASTEXITCODE -ne 0) { throw 'Could not create task worktree.' }
}
# Both tiers currently use the free model independently tested in this environment.
# Do not invent Hyde aliases or enable untested heavy variants.
$workerModel=if ($env:WORKER_MODEL) {$env:WORKER_MODEL} else {'opencode/beam-free'}
$permissionConfig=@{permission=@{edit='allow';bash=[ordered]@{'*'='deny';'node --test*'='allow';'node --check*'='allow';'git status*'='allow';'git diff*'='allow';'Get-Content *'='allow';'Get-ChildItem *'='allow';'Test-Path *'='allow'}}} | ConvertTo-Json -Depth 5 -Compress
$env:OPENCODE_CONFIG_CONTENT=$permissionConfig
$taskPrompt="Read AGENTS.md and PLAN.md, then carry out only briefs/$Id.md. You are in a worktree on branch $taskBranch. Do not commit; the manager reviews and commits. End with files changed, how verified, and unfinished items. Do not use live external APIs."
$logPath=Join-Path $repoRoot "logs\$Id.log"
& opencode --pure run --model $workerModel --dir $taskPath $taskPrompt *> $logPath
$workerExit=$LASTEXITCODE
Write-Output "Task $Id | tier $Tier | $workerModel | exit $workerExit"
Get-Content -LiteralPath $logPath -Tail 35
git -C $taskPath diff --stat
git -C $taskPath status --short
exit $workerExit
