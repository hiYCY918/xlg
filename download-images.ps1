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
  # ---------- 钓鱼（山湖/河流） ----------
  "carp"             = "Carp.png"
  "largemouth"       = "Largemouth_Bass.png"
  "rainbow"          = "Rainbow_Trout.png"
  "sturgeon"         = "Sturgeon.png"
  "bullhead"         = "Bullhead.png"
  "chub"             = "Chub.png"
  "lingcod"          = "Lingcod.png"
  "legend"           = "Legend.png"
  "sunfish"          = "Sunfish.png"
  "smallmouth"       = "Smallmouth_Bass.png"
  "walleye"          = "Walleye.png"
  "perch"            = "Perch.png"
  "bream"            = "Bream.png"
  "shad"             = "Shad.png"
  "salmon"           = "Salmon.png"
  "tiger"            = "Tiger_Trout.png"
  "catfish"          = "Catfish.png"
  "pike"             = "Pike.png"
  "dorado"           = "Dorado.png"
  "angler"           = "Angler.png"
  "glacierfish"      = "Glacierfish.png"
  # ---------- 钓鱼（海洋/夜市） ----------
  "anchovy"          = "Anchovy.png"
  "sardine"          = "Sardine.png"
  "tuna"             = "Tuna.png"
  "red-snapper"      = "Red_Snapper.png"
  "squid"            = "Squid.png"
  "sea-cucumber"     = "Sea_Cucumber.png"
  "herring"          = "Herring.png"
  "eel"              = "Eel.png"
  "octopus"          = "Octopus.png"
  "pufferfish"       = "Pufferfish.png"
  "halibut"          = "Halibut.png"
  "red-mullet"       = "Red_Mullet.png"
  "tilapia"          = "Tilapia.png"
  "albacore"         = "Albacore.png"
  "flounder"         = "Flounder.png"
  "super-cucumber"   = "Super_Cucumber.png"
  "crimsonfish"      = "Crimsonfish.png"
  "midnight-squid"   = "Midnight_Squid.png"
  "spook-fish"       = "Spook_Fish.png"
  "blobfish"         = "Blobfish.png"
  # ---------- 钓鱼（蟹笼） ----------
  "lobster"          = "Lobster.png"
  "crab"             = "Crab.png"
  "clam"             = "Clam.png"
  "oyster"           = "Oyster.png"
  "mussel"           = "Mussel.png"
  "cockle"           = "Cockle.png"
  "shrimp"           = "Shrimp.png"
  "crayfish"         = "Crayfish.png"
  "snail"            = "Snail.png"
  "periwinkle"       = "Periwinkle.png"
  # ---------- 钓鱼（矿井/沙漠/其他/姜岛） ----------
  "stonefish"        = "Stonefish.png"
  "ghostfish"        = "Ghostfish.png"
  "ice-pip"          = "Ice_Pip.png"
  "lava-eel"         = "Lava_Eel.png"
  "sandfish"         = "Sandfish.png"
  "scorpion-carp"    = "Scorpion_Carp.png"
  "woodskip"         = "Woodskip.png"
  "mutant-carp"      = "Mutant_Carp.png"
  "void-salmon"      = "Void_Salmon.png"
  "stingray"         = "Stingray.png"
  "lionfish"         = "Lionfish.png"
  "blue-discus"      = "Blue_Discus.png"
  "midnight-carp"    = "Midnight_Carp.png"
  "son-of-crimsonfish" = "Son_of_Crimsonfish.png"
  "legend-2"         = "Legend_II.png"
  "glacierfish-jr"   = "Glacierfish_Jr..png"
  "ms-angler"        = "Ms._Angler.png"
}

$imgDir = Join-Path $PSScriptRoot "img"
New-Item -ItemType Directory -Force -Path $imgDir | Out-Null

# 分批查询（MediaWiki 的 titles 参数单次最多 50 个）
Write-Host "正在从星露谷 Wiki 获取图片地址（分批查询）..." -ForegroundColor Cyan
$byTitle = @{}
$entries = @($items.GetEnumerator())
for ($i = 0; $i -lt $entries.Count; $i += 50) {
    $end = [Math]::Min($i + 49, $entries.Count - 1)
    $batch = $entries[$i..$end]
    $titles = ($batch | ForEach-Object { "File:" + $_.Value }) -join "|"
    $api = "https://stardewvalleywiki.com/mediawiki/api.php?action=query&titles=$titles&prop=imageinfo&iiprop=url&format=json&formatversion=2"
    try {
        $json = Invoke-RestMethod -Uri $api -TimeoutSec 60 -Headers @{ "User-Agent" = "StardewGuideFanSite/1.0" }
        if ($json.query.pages) {
            foreach ($page in $json.query.pages) {
                # MediaWiki 会把标题中的下划线规范化为空格，统一转为下划线再匹配
                if ($page.imageinfo -and $page.imageinfo.Count -gt 0) { $byTitle[($page.title -replace " ", "_")] = $page.imageinfo[0].url }
            }
        }
    } catch {
        Write-Host "✗ 第 $($i / 50 + 1) 批查询失败：$($_.Exception.Message)" -ForegroundColor Red
    }
}
if ($byTitle.Count -eq 0) {
    Write-Host "✗ 未能获取任何图片地址（Wiki 请求全部失败）" -ForegroundColor Red
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
