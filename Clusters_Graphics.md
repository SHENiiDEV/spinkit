# Промпты для генерации графики 10 Cluster-слотов (7×7)

Этот файл содержит готовые промпты для нейросетей (**Midjourney v6**, **DALL-E 3**, **Flux**, **Stable Diffusion**) для 10 новых игр механики **Clusters** (сетка 7×7, взрывающиеся кластеры, каскады и множители спотов до x1024).

Для каждой игры нужно сгенерировать **2 изображения**:
1. **Кабинет (Cabinet / Stage)** — корпус автомата с пустой центральной квадратной областью и логотипом. Формат: `--ar 4:3` или `--ar 16:11`.
2. **Спрайт-шит 3×3 (Symbol Sheet)** — 9 отдельных символов в сетке 3×3 на сплошном белом фоне для быстрой нарезки. Формат: `--ar 1:1`.

---

## Памятка по нарезке и размещению

После генерации сохраните файлы в папку игры:
`public/games/<game_id>/assets/`

* `stage.jpg` — файл кабинета (1400×1254 или 1400×1100).
* `cover.jpg` — копия кабинета или превью для лобби.
* `sym_<id>.png` — 8 символов игры, нарезанных из сетки 3×3 с прозрачным фоном в размер 320×320:
  * `sym_scatter.png` (ячейка 0,0 — скаттер)
  * `sym_<название1>.png` ... `sym_<название7>.png`

---

## 1. Gem Cluster Frenzy (`gem_cluster_frenzy`)
* **Тема:** Пещера сверкающих кристаллов и драгоценностей
* **Палитра:** Неоновый циан `#4fc3f7`, сапфировый `#0d2748`, золотые акценты

### 1.1 Кабинет (Cabinet)
> **Prompt:**
> `premium modern online slot game art, painterly 2.5D digital illustration, rich volumetric lighting, highly detailed, vibrant colors. Casino slot machine cabinet for a 7x7 grid cluster game. Massive glowing crystal and gold frame decorated with faceted cut sapphires, diamonds, and glowing geodes. In the center, a large SQUARE reel area that is a completely EMPTY flat dark navy velvet panel with NO symbols and no grid lines. At the top center, a bold 3D glowing game logo "GEM CLUSTER FRENZY" made of polished gold and glowing blue crystal. Background: deep underground crystal cavern with glowing stalactites, shimmering amethyst clusters, and sparkling dust particles. Main colors: #4fc3f7, #0d2748, polished gold. --ar 4:3 --v 6.1 --style raw`

### 1.2 Спрайт-шит символов 3×3 (Symbol Sheet)
> **Prompt:**
> `premium mobile slot game symbol sprite sheet, 2.5D painterly rendered vector style, glossy 3D icons, vibrant saturated colors, rim lighting, specular highlights. Sprite sheet of 9 separate slot symbols arranged in a neat 3x3 grid on a clean flat solid pure white background with wide spacing between items, no text, no shadows on background: 1) Glowing Diamond Star with golden rays (scatter), 2) Flawless Blue Diamond, 3) Heart-cut Royal Ruby, 4) Cushion-cut Emerald, 5) Star-shaped Royal Sapphire, 6) Hexagonal Imperial Amethyst, 7) Teardrop Golden Topaz, 8) Spherical Mystic Opal, 9) Golden Crown with jewels. --ar 1:1 --v 6.1`

* **Имена файлов:**
  * 0,0 → `sym_scatter.png` (Diamond Star)
  * 0,1 → `sym_diamond.png` (Flawless Diamond)
  * 0,2 → `sym_ruby.png` (Royal Ruby)
  * 1,0 → `sym_emerald.png` (Sacred Emerald)
  * 1,1 → `sym_sapphire.png` (Deep Sapphire)
  * 1,2 → `sym_amethyst.png` (Imperial Amethyst)
  * 2,0 → `sym_topaz.png` (Golden Topaz)
  * 2,1 → `sym_opal.png` (Mystic Opal)

---

## 2. Fruit Cluster Splash (`fruit_cluster_splash`)
* **Тема:** Пляжный бар, брызги тропических фруктов и коктейли
* **Палитра:** Сочный оранжевый `#ff9100`, маджента `#6b1d4a`, бирюзовый

### 2.1 Кабинет (Cabinet)
> **Prompt:**
> `premium modern online slot game art, painterly 2.5D illustration, bright cheerful lighting, highly detailed, vivid tropical colors. Slot machine cabinet for a 7x7 cascade slot game. Modern tiki and bamboo casing adorned with fresh tropical flowers, palm leaves, glowing neon fruit signs, and water splash droplets. In the center, a large SQUARE reel panel that is an EMPTY flat dark magenta-purple surface with NO symbols and no text. At the top center, a vibrant 3D title logo "FRUIT CLUSTER SPLASH" in bold tropical cartoon lettering with fruit slices. Background: sunny tropical beach with turquoise ocean waves, tiki bar, surfboard, and sun flare. Main colors: #ff9100, #ff2a7a, #00d2d3. --ar 4:3 --v 6.1`

### 2.2 Спрайт-шит символов 3×3 (Symbol Sheet)
> **Prompt:**
> `premium mobile slot game symbol sprite sheet, 2.5D glossy juicy cartoon style, high-end 3D slot assets, saturated bright colors, wet glossy reflections, fresh water droplets. 9 separate tropical fruit slot symbols in a 3x3 grid on a pure white flat background with wide spacing, no text: 1) Exotic Tiki Cocktail with umbrella and straw (scatter), 2) Golden Pineapple, 3) Big Watermelon Slice with seeds, 4) Glossy Red Strawberry, 5) Fresh Ripe Mango half, 6) Plump Purple Grapes bunch, 7) Sliced Green Kiwi, 8) Dewy Blueberries cluster, 9) Golden Starfruit slice. --ar 1:1 --v 6.1`

* **Имена файлов:**
  * 0,0 → `sym_scatter.png` (Tropical Cocktail)
  * 0,1 → `sym_pineapple.png`
  * 0,2 → `sym_watermelon.png`
  * 1,0 → `sym_strawberry.png`
  * 1,1 → `sym_mango.png`
  * 1,2 → `sym_grapes.png`
  * 2,0 → `sym_kiwi.png`
  * 2,1 → `sym_blueberry.png`

---

## 3. Potion Craft Clusters (`magic_potion_clusters`)
* **Тема:** Лаборатория алхимика, светящиеся колбы, древние свитки
* **Палитра:** Мистический пурпурный `#d6a8ff`, глубокий индиго `#2a0845`, светящийся циан

### 3.1 Кабинет (Cabinet)
> **Prompt:**
> `premium fantasy slot game art, painterly 2.5D illustration, magical glowing ambient light, ornate detail. Wizard laboratory slot machine cabinet for a 7x7 cluster game. Elaborate gothic brass and dark mahogany wood frame with glowing runes, brass gears, bubbling glass alembic pipes, and celestial astrolabes. In the center, a large SQUARE reel window with an EMPTY flat deep-violet velvet panel with NO symbols. Top center features an ornate engraved gold plaque with glowing title "POTION CRAFT CLUSTERS". Background: atmospheric wizard's tower filled with dusty spellbooks, floating magic candles, glowing crystal jars, and starry night window. Main colors: #d6a8ff, #2a0845, warm antique brass. --ar 4:3 --v 6.1`

### 3.2 Спрайт-шит символов 3×3 (Symbol Sheet)
> **Prompt:**
> `premium mobile slot game symbol sprite sheet, 2.5D magical fantasy art, glowing liquids inside glass, intricate ornate stoppers, specular shine. 9 separate fantasy alchemy slot symbols in a 3x3 grid on a pure flat solid white background with generous space around each icon, no text: 1) Ancient Leather Spellbook with glowing gold clasp (scatter), 2) Cyan Elixir of Life flask, 3) Crimson Dragon Blood potion bottle, 4) Bubbling Purple Magic Cauldron, 5) Sapphire Mana Phial, 6) Floating Amethyst Crystal Dust vial, 7) Glowing Green Alchemical Herb, 8) Bioluminescent Orange Mushroom, 9) Golden Philosopher's Stone. --ar 1:1 --v 6.1`

* **Имена файлов:**
  * 0,0 → `sym_scatter.png` (Grimoire Spellbook)
  * 0,1 → `sym_elixir.png`
  * 0,2 → `sym_dragon_potion.png`
  * 1,0 → `sym_cauldron.png`
  * 1,1 → `sym_mana_flask.png`
  * 1,2 → `sym_crystal_dust.png`
  * 2,0 → `sym_magic_herb.png`
  * 2,1 → `sym_glow_shroom.png`

---

## 4. Jungle Totem Clusters (`jungle_totem_clusters`)
* **Тема:** Древние храмы майя/инков в густых джунглях, золотые реликвии
* **Палитра:** Золотой `#ffd23f`, нефритовый `#1b4332`, терракотовый

### 4.1 Кабинет (Cabinet)
> **Prompt:**
> `premium ancient adventure slot game art, painterly 2.5D digital illustration, cinematic god rays through foliage, highly detailed. Mayan stone and gold temple cabinet for a 7x7 grid cluster slot. Frame sculpted from ancient carved stone blocks, golden Aztec serpent relief carvings, jade inlays, and hanging jungle vines. In the center, a large SQUARE reel panel that is an EMPTY flat dark moss-stone textured slate with NO symbols and no lines. At the top center, a grand golden sun disc with bold 3D carved title "JUNGLE TOTEM CLUSTERS". Background: mystical Mesoamerican step pyramid ruins surrounded by misty jungle canopy, exotic waterfalls, and sunbeams. Main colors: #ffd23f, #1b4332, antique gold. --ar 4:3 --v 6.1`

### 4.2 Спрайт-шит символов 3×3 (Symbol Sheet)
> **Prompt:**
> `premium mobile slot game symbol sprite sheet, 2.5D ancient Mayan Inca artifact style, polished gold, carved jade, polished precious stones. 9 separate jungle adventure slot symbols in a 3x3 grid on a plain flat solid white background, well-spaced, no text: 1) Glowing Mayan Sun Temple Pyramid (scatter), 2) Golden Totem Mask with turquoise eyes, 3) Emerald Feathered Serpent head, 4) Fiery Scarlet Macaw, 5) Golden Aztec Jaguar idol, 6) Carved Green Jade Idol, 7) Tribal Wooden Drum with feathers, 8) Exotic Purple Jungle Orchid, 9) Ancient Sun Stone Medallion. --ar 1:1 --v 6.1`

* **Имена файлов:**
  * 0,0 → `sym_scatter.png` (Sun Temple)
  * 0,1 → `sym_gold_mask.png`
  * 0,2 → `sym_serpent.png`
  * 1,0 → `sym_macaw.png`
  * 1,1 → `sym_jaguar.png`
  * 1,2 → `sym_jade_idol.png`
  * 2,0 → `sym_drum.png`
  * 2,1 → `sym_flower.png`

---

## 5. Cosmic Cluster Nova (`cosmic_cluster_nova`)
* **Тема:** Глубокий космос, туманности, кольца планет, сверхновые
* **Палитра:** Неоновый циан `#00f0ff`, космический ультрамарин `#0a0a2a`, пурпурный

### 5.1 Кабинет (Cabinet)
> **Prompt:**
> `premium sci-fi space slot game art, painterly 2.5D illustration, futuristic neon glow, volumetric lighting, epic astronomy aesthetic. Futuristic spaceship cockpit slot machine cabinet for a 7x7 grid cluster game. Frame made of titanium sci-fi alloy, glowing neon energy conduits in cyan and magenta, quantum hologram emitters. In the center, a large SQUARE reel area that is an EMPTY flat pitch-black starfield panel with NO symbols. Top center features a high-tech holographic 3D title "COSMIC CLUSTER NOVA" with starburst energy effects. Background: breathtaking deep space panorama with colorful swirling nebula, glowing pulsar, asteroid field, and distant galaxy. Main colors: #00f0ff, #ff007f, #0a0a2a. --ar 4:3 --v 6.1`

### 5.2 Спрайт-шит символов 3×3 (Symbol Sheet)
> **Prompt:**
> `premium mobile slot game symbol sprite sheet, 2.5D glossy sci-fi space icons, glowing energy cores, hyper-detailed planets and minerals, specular reflections. 9 separate celestial slot symbols in a 3x3 grid on a solid clean white background, well separated, no text: 1) Blazing Supernova Explosion with colorful cosmic flare (scatter), 2) Golden Saturn with glowing rings, 3) Radiant Green Pulsar Star, 4) Fiery Blue Space Comet, 5) Alien Flying Saucer Hologram, 6) Swirling Dark Matter Void Orb, 7) Glowing Cyan Nebula Diamond, 8) Solar Flare Plasma Sun, 9) High-tech Astronaut Gold Helmet. --ar 1:1 --v 6.1`

* **Имена файлов:**
  * 0,0 → `sym_scatter.png` (Supernova Burst)
  * 0,1 → `sym_planet.png`
  * 0,2 → `sym_pulsar.png`
  * 1,0 → `sym_comet.png`
  * 1,1 → `sym_ufo_crystal.png`
  * 1,2 → `sym_dark_matter.png`
  * 2,0 → `sym_star_gem.png`
  * 2,1 → `sym_solar_flare.png`

---

## 6. Spooky Sweet Clusters (`spooky_candy_clusters`)
* **Тема:** Хэллоуинские конфеты, маршмеллоу-призраки, желейные летучие мыши
* **Палитра:** Тыквенный оранжевый `#ff7518`, полуночный фиолетовый `#231123`, ядовито-зеленый

### 6.1 Кабинет (Cabinet)
> **Prompt:**
> `premium stylized halloween slot game art, 2.5D painterly illustration, spooky fun atmosphere, glowing jack-o'-lantern lights, rich shadows. Haunted candy mansion slot cabinet for a 7x7 cluster game. Frame crafted from twisted gothic wrought iron intertwined with orange glowing candy canes, spiderwebs with dew drops, and carved pumpkins at the corners. In the center, a large SQUARE reel window with an EMPTY flat dark velvet plum panel with NO symbols. Top center has an ornate spooky wooden sign with glowing orange 3D title "SPOOKY SWEET CLUSTERS". Background: full moon night with crooked gothic mansion, glowing bats silhouette, pumpkin patch, and purple mist. Main colors: #ff7518, #9b5de5, #231123. --ar 4:3 --v 6.1`

### 6.2 Спрайт-шит символов 3×3 (Symbol Sheet)
> **Prompt:**
> `premium mobile slot game symbol sprite sheet, 2.5D glossy spooky candy icons, playful halloween treats, glossy gelatinous candy textures. 9 separate halloween candy slot symbols in a 3x3 grid on a flat pure white background, evenly spaced, no text: 1) Glowing Carved Jack-o'-Lantern Candy Basket (scatter), 2) Cute White Ghost Marshmallow, 3) Classic Striped Candy Corn, 4) Translucent Purple Gummy Bat, 5) Candy Red Poison Apple with drizzle, 6) Decorated Sugar Skull Bonbon, 7) Green Witch's Cauldron Potion Drop, 8) Chocolate Spider Truffle, 9) Striped Witch Hat Cookie. --ar 1:1 --v 6.1`

* **Имена файлов:**
  * 0,0 → `sym_scatter.png` (Jack-o-Lantern)
  * 0,1 → `sym_ghost.png`
  * 0,2 → `sym_candy_corn.png`
  * 1,0 → `sym_gummy_bat.png`
  * 1,1 → `sym_caramel_apple.png`
  * 1,2 → `sym_skull_drop.png`
  * 2,0 → `sym_potion_treat.png`
  * 2,1 → `sym_spider_sweet.png`

---

## 7. Cyber Cluster 2099 (`neon_cyber_clusters`)
* **Тема:** Киберпанк, неоновая матрица, квантовые ядра и кристаллы
* **Палитра:** Неоновый бирюзовый `#00ffcc`, неоновый розовый `#ff007f`, темный индиго `#120e2e`

### 7.1 Кабинет (Cabinet)
> **Prompt:**
> `premium cyberpunk slot game art, 2.5D painterly illustration, neon light reflections, glossy wet street aesthetic, futuristic interface. Cyberpunk arcade slot machine cabinet for a 7x7 grid cluster game. Frame constructed from matte dark carbon fiber with embedded glowing neon fiber optic strips in teal and hot magenta, cooling fans, and digital circuit boards. In the center, a large SQUARE reel area that is an EMPTY flat dark translucent smoked-glass screen with NO symbols and no text. Top center displays an electric neon sign in bold geometric typography "CYBER CLUSTER 2099". Background: rainy futuristic neo-Tokyo cyberpunk city street at night with glowing neon billboards and flying vehicles. Main colors: #00ffcc, #ff007f, #120e2e. --ar 4:3 --v 6.1`

### 7.2 Спрайт-шит символов 3×3 (Symbol Sheet)
> **Prompt:**
> `premium mobile slot game symbol sprite sheet, 2.5D isometric cyberpunk digital icons, glowing translucent neon glass and holograms, clean hard edges. 9 separate futuristic cyber slot symbols in a 3x3 grid on a pure white flat background, wide margins, no text: 1) Glowing Quantum CPU Core with rotating data rings (scatter), 2) Glowing Cyan Hologram Tesseract Cube, 3) Hot Pink Cyber Node Hexagon, 4) Glowing Laser Apex Pyramid, 5) Pulsing Purple Plasma Data Sphere, 6) Bright Yellow Neon Matrix Star, 7) Green Circuit Board Microchip, 8) Magenta Digital Data Bit, 9) Cybernetic Skull with glowing visor. --ar 1:1 --v 6.1`

* **Имена файлов:**
  * 0,0 → `sym_scatter.png` (Quantum Core)
  * 0,1 → `sym_holo_cube.png`
  * 0,2 → `sym_cyber_hex.png`
  * 1,0 → `sym_laser_pyramid.png`
  * 1,1 → `sym_data_orb.png`
  * 1,2 → `sym_neon_star.png`
  * 2,0 → `sym_bit_chip.png`
  * 2,1 → `sym_data_node.png`

---

## 8. Dragon Egg Clusters (`dragon_egg_clusters`)
* **Тема:** Гнездо драконов, стихийные чешуйчатые яйца (огонь, лед, молния)
* **Палитра:** Огненно-рыжий `#ff5500`, магма-бордовый `#3d0c02`, золотая лава

### 8.1 Кабинет (Cabinet)
> **Prompt:**
> `premium high fantasy slot game art, painterly 2.5D digital illustration, dramatic volcanic lighting, hyper-detailed scales and rock. Dragon lair slot machine cabinet for a 7x7 cluster game. Frame sculpted from obsidian volcanic rock and dragon horns, wrapped in fiery molten gold filigree and glowing magma cracks. In the center, a large SQUARE reel screen with an EMPTY flat dark volcanic stone panel with NO symbols. Top center features an imposing dragon crest with glowing ruby eyes and bold 3D forged-metal title "DRAGON EGG CLUSTERS". Background: colossal dragon treasure cave filled with overflowing gold coins, molten lava falls, and smoking cavern pillars. Main colors: #ff5500, #ffd700, #3d0c02. --ar 4:3 --v 6.1`

### 8.2 Спрайт-шит символов 3×3 (Symbol Sheet)
> **Prompt:**
> `premium mobile slot game symbol sprite sheet, 2.5D mythical fantasy slot symbols, scaled dragon eggs with elemental glows, polished mineral crystals. 9 separate dragon fantasy slot symbols in a 3x3 grid on a plain flat pure white background, generous spacing, no text: 1) Ancient Golden Dragon War Horn with ruby gems (scatter), 2) Imperial Golden Scaled Dragon Egg, 3) Blazing Inferno Fire Ruby, 4) Frost Drake Ice Crystal Shard, 5) Storm Dragon Lightning Orb, 6) Mountain Drake Earth Rune Stone, 7) Gale Dragon Wind Sphere, 8) Acid Green Wyvern Fang, 9) Golden Dragon Eye Medallion. --ar 1:1 --v 6.1`

* **Имена файлов:**
  * 0,0 → `sym_scatter.png` (Dragon Horn)
  * 0,1 → `sym_gold_egg.png`
  * 0,2 → `sym_fire_ruby.png`
  * 1,0 → `sym_ice_crystal.png`
  * 1,1 → `sym_lightning_orb.png`
  * 1,2 → `sym_earth_stone.png`
  * 2,0 → `sym_wind_orb.png`
  * 2,1 → `sym_poison_fang.png`

---

## 9. Coral Reef Clusters (`ocean_coral_clusters`)
* **Тема:** Подводный риф, жемчужные раковины, тропические морские обитатели
* **Палитра:** Морской циан `#00e5ff`, глубокий аквамарин `#002b49`, кораллово-розовый

### 9.1 Кабинет (Cabinet)
> **Prompt:**
> `premium underwater slot game art, painterly 2.5D illustration, sun rays piercing through crystal blue ocean water, shimmering caustics. Submarine coral reef slot cabinet for a 7x7 grid cluster game. Frame decorated with sculpted golden seashells, colorful sea fans, glowing pink brain corals, and pearlescent mother-of-pearl inlays. In the center, a large SQUARE reel area that is an EMPTY flat dark navy water surface with NO symbols. Top center features an ornate golden nautilus shell crest with 3D title "CORAL REEF CLUSTERS". Background: vibrant tropical coral reef with sunlit turquoise water, swimming tropical fish schools, sea anemones, and rising bubbles. Main colors: #00e5ff, #ff4d6d, #002b49. --ar 4:3 --v 6.1`

### 9.2 Спрайт-шит символов 3×3 (Symbol Sheet)
> **Prompt:**
> `premium mobile slot game symbol sprite sheet, 2.5D glossy underwater aquatic icons, iridescent pearl sheen, cute marine life. 9 separate ocean coral slot symbols in a 3x3 grid on a solid pure flat white background, wide margins between icons, no text: 1) Glowing Open Giant Oyster with iridescent pearl inside (scatter), 2) Golden Crowned Seahorse, 3) Vibrant Orange Clownfish, 4) Ancient Sea Turtle with carved shell, 5) Brilliant Pink Coral Starfish, 6) Translucent Glowing Violet Jellyfish, 7) Striped Golden Nautilus Shell, 8) Blooming Pink Coral Branch, 9) Jeweled Golden Trident. --ar 1:1 --v 6.1`

* **Имена файлов:**
  * 0,0 → `sym_scatter.png` (Giant Pearl Clam)
  * 0,1 → `sym_seahorse.png`
  * 0,2 → `sym_clownfish.png`
  * 1,0 → `sym_turtle.png`
  * 1,1 → `sym_starfish.png`
  * 1,2 → `sym_jellyfish.png`
  * 2,0 → `sym_nautilus.png`
  * 2,1 → `sym_coral.png`

---

## 10. Farm Harvest Clusters (`lucky_farm_clusters`)
* **Тема:** Солнечная уютная ферма, спелые гигантские овощи и фрукты
* **Палитра:** Теплый медовый `#ffbb00`, сочный зеленый `#2d5a27`, тыквенный оранжевый

### 10.1 Кабинет (Cabinet)
> **Prompt:**
> `premium rustic farm slot game art, painterly 2.5D digital illustration, warm golden hour sunshine, friendly charming atmosphere. Country barn slot machine cabinet for a 7x7 grid cluster game. Frame built from polished red barn wood with decorative wrought-iron hinges, woven wheat stalks, and sunflowers. In the center, a large SQUARE reel area that is an EMPTY flat dark cedar wood panel with NO symbols. At the top center, an embossed wooden barn roof sign with bold 3D golden letters "FARM HARVEST CLUSTERS". Background: picturesque sunny countryside farm at sunset with rolling green hills, red tractor, hay bales, and windmill. Main colors: #ffbb00, #2d5a27, warm barn red. --ar 4:3 --v 6.1`

### 10.2 Спрайт-шит символов 3×3 (Symbol Sheet)
> **Prompt:**
> `premium mobile slot game symbol sprite sheet, 2.5D glossy charming cartoon farm harvest produce, plump fresh vegetables, glossy highlights, dew drops. 9 separate farm harvest slot symbols in a 3x3 grid on a pure white flat background with ample space around each item, no text: 1) Shiny Golden Farm Tractor with glowing headlights (scatter), 2) Plump Red Apple with green leaf, 3) Sweet Golden Corn Cob in husk, 4) Big Ripe Orange Pumpkin, 5) Glossy Red Farm Tomato, 6) Crunchy Orange Carrot with green top, 7) Fresh Green Garden Cucumber, 8) Deep Purple Royal Eggplant, 9) Golden Lucky Horseshoe with clover. --ar 1:1 --v 6.1`

* **Имена файлов:**
  * 0,0 → `sym_scatter.png` (Golden Tractor)
  * 0,1 → `sym_apple.png`
  * 0,2 → `sym_corn.png`
  * 1,0 → `sym_pumpkin.png`
  * 1,1 → `sym_tomato.png`
  * 1,2 → `sym_carrot.png`
  * 2,0 → `sym_cucumber.png`
  * 2,1 → `sym_eggplant.png`

---

## Быстрая нарезка сгенерированной сетки 3×3

Когда нейросеть выдаст изображение 1024×1024 с 9 символами (`symbols_sheet.png`), нарежьте их одной командой Python прямо в папку игры:

```bash
python3 -c "
import os, collections
from PIL import Image

game_id = 'gem_cluster_frenzy' # замените на ID вашей игры
sheet_file = 'path/to/symbols_sheet.png'
out_dir = f'public/games/{game_id}/assets'
os.makedirs(out_dir, exist_ok=True)

SYM_NAMES = [
  'sym_scatter.png', 'sym_diamond.png', 'sym_ruby.png',
  'sym_emerald.png', 'sym_sapphire.png', 'sym_amethyst.png',
  'sym_topaz.png',   'sym_opal.png',     'sym_extra.png'
]

sheet = Image.open(sheet_file).convert('RGBA')
W, H = sheet.size
cell_w, cell_h = W / 3.0, H / 3.0

def make_trans(img, threshold=240):
    img = img.copy()
    pix = img.load()
    w, h = img.size
    visited = set()
    q = collections.deque()
    for x in range(w):
        for y in [0, h - 1]:
            if pix[x, y][0] >= threshold and pix[x, y][1] >= threshold and pix[x, y][2] >= threshold:
                q.append((x, y)); visited.add((x, y))
    for y in range(h):
        for x in [0, w - 1]:
            if pix[x, y][0] >= threshold and pix[x, y][1] >= threshold and pix[x, y][2] >= threshold and (x, y) not in visited:
                q.append((x, y)); visited.add((x, y))
    while q:
        cx, cy = q.popleft()
        pix[cx, cy] = (0, 0, 0, 0)
        for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                if pix[nx, ny][0] >= threshold and pix[nx, ny][1] >= threshold and pix[nx, ny][2] >= threshold:
                    visited.add((nx, ny)); q.append((nx, ny))
    return img

for row in range(3):
    for col in range(3):
        idx = row * 3 + col
        x0, y0 = int(col * cell_w), int(row * cell_h)
        cell = sheet.crop((x0, y0, int((col+1)*cell_w), int((row+1)*cell_h)))
        cleaned = make_trans(cell)
        bbox = cleaned.getbbox()
        if not bbox: continue
        trimmed = cleaned.crop(bbox)
        scale = min(280.0 / trimmed.size[0], 280.0 / trimmed.size[1])
        nw = max(1, int(trimmed.size[0] * scale))
        nh = max(1, int(trimmed.size[1] * scale))
        resized = trimmed.resize((nw, nh), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (320, 320), (0, 0, 0, 0))
        canvas.paste(resized, ((320 - nw) // 2, (320 - nh) // 2), resized)
        canvas.save(os.path.join(out_dir, SYM_NAMES[idx]), 'PNG')
        print('Saved', SYM_NAMES[idx])
"
```
