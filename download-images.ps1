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
  "tulip"         = "Tulip.png"
  "blue-jazz"     = "Blue_Jazz.png"
  "coffee-bean"   = "Coffee_Bean.png"
  "rhubarb"       = "Rhubarb.png"
  "hops"          = "Hops.png"
  "starfruit"     = "Starfruit.png"
  "red-cabbage"   = "Red_Cabbage.png"
  "poppy"         = "Poppy.png"
  "summer-squash" = "Summer_Squash.png"
  "grape-crop"    = "Grape.png"
  "beet"          = "Beet.png"
  "bok-choy"      = "Bok_Choy.png"
  "ancient-fruit" = "Ancient_Fruit.png"
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
  "red-mushroom"     = "Red_Mushroom.png"
  "coral"            = "Coral.png"
  "sea-urchin"       = "Sea_Urchin.png"
  "rainbow-shell"    = "Rainbow_Shell.png"
  "nautilus-shell"   = "Nautilus_Shell.png"
  "coconut"          = "Coconut.png"
  "cactus-fruit"     = "Cactus_Fruit.png"
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
  # ---------- NPC 头像（保存为 npc-<id>.png） ----------
  "npc-abigail"    = "Abigail.png"
  "npc-leah"       = "Leah.png"
  "npc-penny"      = "Penny.png"
  "npc-maru"       = "Maru.png"
  "npc-emily"      = "Emily.png"
  "npc-haley"      = "Haley.png"
  "npc-sam"        = "Sam.png"
  "npc-sebastian"  = "Sebastian.png"
  "npc-alex"       = "Alex.png"
  "npc-harvey"     = "Harvey.png"
  "npc-elliott"    = "Elliott.png"
  "npc-shane"      = "Shane.png"
  "npc-robin"      = "Robin.png"
  "npc-clint"      = "Clint.png"
  "npc-marnie"     = "Marnie.png"
  "npc-pierre"     = "Pierre.png"
  "npc-willy"      = "Willy.png"
  "npc-lewis"      = "Lewis.png"
  "npc-jodi"       = "Jodi.png"
  "npc-pam"        = "Pam.png"
  "npc-gus"        = "Gus.png"
  "npc-caroline"   = "Caroline.png"
  "npc-demetrius"  = "Demetrius.png"
  "npc-george"     = "George.png"
  "npc-evelyn"     = "Evelyn.png"
  "npc-vincent"    = "Vincent.png"
  "npc-jas"        = "Jas.png"
  "npc-kent"       = "Kent.png"
  "npc-sandy"      = "Sandy.png"
  "npc-rasmodius"  = "Wizard.png"
  "npc-marlon"     = "Marlon.png"
  "npc-gunther"    = "Gunther.png"
  "npc-krobus"     = "Krobus.png"
  # ---------- 采矿（矿石/矿物/宝石） ----------
  "copper"        = "Copper_Ore.png"
  "iron"          = "Iron_Ore.png"
  "gold-ore"      = "Gold_Ore.png"
  "iridium"       = "Iridium_Ore.png"
  "coal"          = "Coal.png"
  "quartz"        = "Quartz.png"
  "amethyst"      = "Amethyst.png"
  "topaz"         = "Topaz.png"
  "emerald"       = "Emerald.png"
  "ruby"          = "Ruby.png"
  "diamond"       = "Diamond.png"
  "prismatic"     = "Prismatic_Shard.png"
  # ---------- 战斗（怪物） ----------
  "green-slime"   = "Green_Slime.png"
  "blue-slime"    = "Blue_Slime.png"
  "rock-crab"     = "Rock_Crab.png"
  "cave-fly"      = "Cave_Fly.png"
  "bat"           = "Bat.png"
  "duggy"         = "Duggy.png"
  "skeleton"      = "Skeleton.png"
  "ghost"         = "Ghost.png"
  "shadow-brute"  = "Shadow_Brute.png"
  "purple-slime"  = "Purple_Slime.png"
  "serpent"       = "Serpent.png"
  "mummy"         = "Mummy.png"
  # ---------- 采矿补全（宝石/矿物） ----------
  "aquamarine"    = "Aquamarine.png"
  "jade"          = "Jade.png"
  "opal"          = "Opal.png"
  "fire-opal"     = "Fire_Opal.png"
  "earth-crystal" = "Earth_Crystal.png"
  "frozen-tear"   = "Frozen_Tear.png"
  "fire-quartz"   = "Fire_Quartz.png"
  "obsidian"      = "Obsidian.png"
  "clay"          = "Clay.png"
  "marble"        = "Marble.png"
  "granite"       = "Granite.png"
  "slate"         = "Slate.png"
  "sandstone"     = "Sandstone.png"
  "limestone"     = "Limestone.png"
  "basalt"        = "Basalt.png"
  "dolomite"      = "Dolomite.png"
  "thunder-egg"   = "Thunder_Egg.png"
  "tigers-eye"    = "Tigerseye.png"
  "star-shard"    = "Star_Shards.png"
  "petrified-slime" = "Petrified_Slime.png"
  # ---------- 战斗补全（矿井/沙漠/姜岛） ----------
  "lava-crab"     = "Lava_Crab.png"
  "dust-sprite"   = "Dust_Sprite.png"
  "frost-bat"     = "Frost_Bat.png"
  "lava-bat"      = "Lava_Bat.png"
  "shadow-shaman" = "Shadow_Shaman.png"
  "red-slime"     = "Red_Slime.png"
  "copper-slime"  = "Copper_Slime.png"
  "iron-slime"    = "Iron_Slime.png"
  "metal-head"    = "Metal_Head.png"
  "magma-sprite"  = "Magma_Sprite.png"
  "wilderness-golem" = "Wilderness_Golem.png"
  "mutant-grub"   = "Mutant_Grub.png"
  "mutant-fly"    = "Mutant_Fly.png"
  "tiger-slime"   = "Tiger_Slime.png"
  "iridium-bat"   = "Iridium_Bat.png"
  "iridium-crab"  = "Iridium_Crab.png"
  "magma-sparker" = "Magma_Sparker.png"
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

# 英文名页面兜底（直接查条目页配图，最可靠）+ 文件搜索兜底
$pageNames = @{
  "zombie"         = "Zombie"
  "star-shard"     = "Star Shard"
  "tigers-eye"     = "Tiger's Eye"
  "gypsum"         = "Gypsum"
  "salt"           = "Salt"
  "gold-slime"     = "Gold Slime"
  "cave-grub"      = "Cave Grub"
  "stone-bat"      = "Stone Bat"
  "iridium-slime"  = "Iridium Slime"
}

function Get-FileUrl([string]$file) {
    # 兜底1：单文件查询 + 跟随重定向
    $api = "https://stardewvalleywiki.com/mediawiki/api.php?action=query&titles=File:" + [uri]::EscapeDataString($file) + "&prop=imageinfo&iiprop=url&format=json&formatversion=2&redirects=1"
    try {
        $j = Invoke-RestMethod -Uri $api -TimeoutSec 30 -Headers @{ "User-Agent" = "StardewGuideFanSite/1.0" }
        if ($j.query.pages -and $j.query.pages.Count -gt 0 -and $j.query.pages[0].imageinfo) {
            return $j.query.pages[0].imageinfo[0].url
        }
    } catch { }
    return $null
}

function Get-PageImage([string]$page) {
    # 兜底2：查询条目页的主图（pageimages），对物品/怪物最可靠
    $api = "https://stardewvalleywiki.com/mediawiki/api.php?action=query&titles=" + [uri]::EscapeDataString($page) + "&prop=pageimages&piprop=original&format=json&formatversion=2"
    try {
        $j = Invoke-RestMethod -Uri $api -TimeoutSec 30 -Headers @{ "User-Agent" = "StardewGuideFanSite/1.0" }
        if ($j.query.pages -and $j.query.pages.Count -gt 0 -and $j.query.pages[0].original) {
            return $j.query.pages[0].original.source
        }
    } catch { }
    return $null
}

function Find-WikiFile([string]$id) {
    # 兜底3：按英文名在文件命名空间搜索（修复 File: 前缀匹配）
    $term = $pageNames[$id]
    if (-not $term) { return $null }
    $searchApi = "https://stardewvalleywiki.com/mediawiki/api.php?action=query&list=search&srnamespace=6&srsearch=" + [uri]::EscapeDataString($term) + "&srlimit=8&format=json&formatversion=2"
    try {
        $sj = Invoke-RestMethod -Uri $searchApi -TimeoutSec 30 -Headers @{ "User-Agent" = "StardewGuideFanSite/1.0" }
        if (-not $sj.query.search -or $sj.query.search.Count -eq 0) { return $null }
        # 优先：完全同名 .png → 名称开头 .png → 任意 .png → 第一个结果
        $hit = $null
        foreach ($r in $sj.query.search) { $t = $r.title -replace "^File:", ""; if ($t -eq ($term + ".png")) { $hit = $t; break } }
        if (-not $hit) { foreach ($r in $sj.query.search) { $t = $r.title -replace "^File:", ""; if ($t -like ($term + "*") -and $t -like "*.png") { $hit = $t; break } } }
        if (-not $hit) { foreach ($r in $sj.query.search) { $t = $r.title -replace "^File:", ""; if ($t -like "*.png") { $hit = $t; break } } }
        if (-not $hit -and $sj.query.search.Count -gt 0) { $hit = $sj.query.search[0].title -replace "^File:", "" }
        if (-not $hit) { return $null }
        return Get-FileUrl $hit
    } catch { }
    return $null
}

$ok = 0; $skip = 0; $fail = @()
foreach ($e in $items.GetEnumerator()) {
    $out = Join-Path $imgDir ($e.Key + ".png")
    if ((Test-Path $out) -and ((Get-Item $out).Length -gt 0)) { $skip++; continue }
    $url = $byTitle["File:" + $e.Value]
    if (-not $url) { $url = Get-FileUrl $e.Value }
    if (-not $url -and $pageNames[$e.Key]) { $url = Get-PageImage $pageNames[$e.Key] }
    if (-not $url) { $url = Find-WikiFile $e.Key }
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
