# ============================================================
# 下载星露谷真实物品贴图（来自官方 Wiki）到本地 img/ 文件夹
# 需要网络；已下载过的文件会自动跳过，可重复运行
# ============================================================
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ErrorActionPreference = "Continue"
Set-Location -LiteralPath $PSScriptRoot

# 物品 id -> Wiki 文件名
$items = @{
  # ---------- 农作物 ----------
  "parsnip"     = "Parsnip.png"
  "potato"      = "Potato.png"
  "greenbean"   = "Green_Bean.png"
  "cauliflower" = "Cauliflower.png"
  "strawberry"  = "Strawberry.png"
  "kale"        = "Kale.png"
  "blueberry"   = "Blueberry.png"
  "melon"       = "Melon.png"
  "tomato"      = "Tomato.png"
  "hotpepper"   = "Hot_Pepper.png"
  "wheat"       = "Wheat.png"
  "corn"        = "Corn.png"
  "sunflower"   = "Sunflower.png"
  "pumpkin"     = "Pumpkin.png"
  "cranberry"   = "Cranberries.png"
  "eggplant"    = "Eggplant.png"
  "yam"         = "Yam.png"
  "amaranth"    = "Amaranth.png"
  "artichoke"   = "Artichoke.png"
  # ---------- 收集物 ----------
  "wild-horseradish" = "Wild_Horseradish.png"
  "daffodil"         = "Daffodil.png"
  "leek"             = "Leek.png"
  "dandelion"        = "Dandelion.png"
  "spring-onion"     = "Spring_Onion.png"
  "spice-berry"      = "Spice_Berry.png"
  "grape"            = "Grape.png"
  "sweet-pea"        = "Sweet_Pea.png"
  "fiddlehead-fern"  = "Fiddlehead_Fern.png"
  "common-mushroom"  = "Common_Mushroom.png"
  "wild-plum"        = "Wild_Plum.png"
  "hazelnut"         = "Hazelnut.png"
  "blackberry"       = "Blackberry.png"
  "chanterelle"      = "Chanterelle.png"
  "winter-root"      = "Winter_Root.png"
  "crystal-fruit"    = "Crystal_Fruit.png"
  "snow-yam"         = "Snow_Yam.png"
  "crocus"           = "Crocus.png"
  "holly"            = "Holly.png"
}

$imgDir = Join-Path $PSScriptRoot "img"
New-Item -ItemType Directory -Force -Path $imgDir | Out-Null

$titles = ($items.GetEnumerator() | ForEach-Object { "File:" + $_.Value }) -join "|"
$api = "https://stardewvalleywiki.com/mediawiki/api.php?action=query&titles=$titles&prop=imageinfo&iiprop=url&format=json&formatversion=2"

Write-Host "正在从星露谷 Wiki 获取图片地址..." -ForegroundColor Cyan
$byTitle = @{}
try {
    $json = Invoke-RestMethod -Uri $api -TimeoutSec 60 -Headers @{ "User-Agent" = "StardewGuideFanSite/1.0" }
    foreach ($page in $json.query.pages) {
        if ($page.imageinfo -and $page.imageinfo.Count -gt 0) { $byTitle[$page.title] = $page.imageinfo[0].url }
    }
} catch {
    Write-Host "✗ Wiki 请求失败：$($_.Exception.Message)" -ForegroundColor Red
    Write-Host "（站点会使用备用图标，不影响上线）" -ForegroundColor Yellow
    exit 1
}

$ok = 0; $skip = 0; $fail = @()
foreach ($e in $items.GetEnumerator()) {
    $out = Join-Path $imgDir ($e.Key + ".png")
    if ((Test-Path $out) -and ((Get-Item $out).Length -gt 0)) { $skip++; continue }
    $url = $byTitle["File:" + $e.Value]
    if (-not $url) { $fail += $e.Key; continue }
    try {
        Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing -TimeoutSec 30
        $ok++
    } catch { $fail += $e.Key }
}

Write-Host ""
Write-Host ("完成：新下载 {0} 个，已存在跳过 {1} 个，失败 {2} 个" -f $ok, $skip, $fail.Count) -ForegroundColor Green
if ($fail.Count) {
    Write-Host ("失败项：" + ($fail -join ", ")) -ForegroundColor Yellow
    Write-Host "失败项可稍后重跑本脚本补下；页面会先用备用图标显示" -ForegroundColor Yellow
}
Write-Host ""
