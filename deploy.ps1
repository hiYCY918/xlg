# ============================================================
# 星露谷物语攻略站 · 一键部署到 GitHub Pages
# 用法：双击 deploy.bat（推荐），或在本目录执行  powershell -File deploy.ps1
# ============================================================
$ErrorActionPreference = "Continue"

$Repo    = "xlg"       # 仓库名（可改）
$Owner   = "hiYCY918"  # GitHub 用户名（可改）
$SiteUrl = "https://$Owner.github.io/$Repo/"

Set-Location -LiteralPath $PSScriptRoot

function Fail([string]$msg) {
    Write-Host ""
    Write-Host "✗ $msg" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🌾 星露谷物语攻略站 · 一键部署" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# ---------- 1. 检查 GitHub CLI ----------
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Fail "未检测到 GitHub CLI。请先到 https://cli.github.com 下载安装后重试。"
}

# ---------- 2. 登录检查（gh 未登录返回非 0，不会中断脚本） ----------
gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "尚未登录 GitHub，即将打开浏览器授权（选择 SSH 方式）..." -ForegroundColor Yellow
    gh auth login --hostname github.com --git-protocol ssh --web
    if ($LASTEXITCODE -ne 0) { Fail "登录未完成或失败，请重试。" }
    Write-Host "✓ 登录成功" -ForegroundColor Green
} else {
    Write-Host "✓ 已登录 GitHub" -ForegroundColor Green
}
gh config set git_protocol ssh *> $null

# ---------- 3. 用真实账号修正 git 身份 ----------
$ghUser = gh api user --jq .login 2>$null
if ($ghUser) {
    git config user.name $ghUser
    git config user.email "$ghUser@users.noreply.github.com"
    $curEmail = git log -1 --pretty=%ae
    if ($curEmail -eq "game-guide@local") {
        git commit --amend --reset-author --no-edit *> $null
        Write-Host "✓ 已修正提交作者为 $ghUser" -ForegroundColor Green
    }
}

# ---------- 4. 下载真实物品贴图（已存在则跳过，失败不阻塞） ----------
if (Test-Path (Join-Path $PSScriptRoot "download-images.ps1")) {
    Write-Host "正在准备真实物品贴图（img/ 文件夹）..." -ForegroundColor Yellow
    & (Join-Path $PSScriptRoot "download-images.ps1")
}

# ---------- 5. 提交未保存的改动 ----------
git add -A
$dirty = git status --porcelain
if ($dirty) {
    git commit -m "deploy: 更新攻略站内容" *> $null
    Write-Host "✓ 已提交本地改动" -ForegroundColor Green
}

# ---------- 6. 创建并推送仓库 ----------
git branch -M main
git remote remove origin 2>$null
Write-Host "正在创建仓库 $Owner/$Repo 并推送..." -ForegroundColor Yellow
gh repo create $Repo --public --source . --push 2>&1 | Out-String | Write-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "仓库可能已存在，改为直接推送..." -ForegroundColor Yellow
    git remote remove origin 2>$null
    git remote add origin "git@github.com:$Owner/$Repo.git"
    git push -u origin main
    if ($LASTEXITCODE -ne 0) { Fail "推送失败，请查看上方错误信息。" }
}

# ---------- 完成提示 ----------
Write-Host ""
Write-Host "✅ 完成！代码已推送到 GitHub" -ForegroundColor Green
Write-Host ""
Write-Host "👉 最后一步（开启 Pages）：" -ForegroundColor Cyan
Write-Host "   打开 https://github.com/$Owner/$Repo/settings/pages" -ForegroundColor Cyan
Write-Host "   Build and deployment → Source 选 Deploy from a branch" -ForegroundColor Cyan
Write-Host "   Branch 选 main，目录选 / (root)，点 Save" -ForegroundColor Cyan
Write-Host ""
Write-Host "🌐 稍等 1 分钟后访问你的站点：" -ForegroundColor Green
Write-Host "   $SiteUrl" -ForegroundColor Yellow
Write-Host ""
