# Руководство по генерации и подключению графики для слотов SpinKit

В SpinKit любая игра может работать в двух режимах:
1. **Базовый (процедурный)** — не требует картинок. Движок сам рисует символы через Twemoji, накладывает золотые и неоновые медали, градиенты, эффекты частиц и анимацию барабанов.
2. **Арт-режим (`collection: 'artwork'`)** — игра использует отрисованный кабинет (`stage.jpg`), прозрачные PNG-символы высокого разрешения и обложку лобби.

---

## 1. Структура файлов графики

Все картинки игры хранятся в папке:
```
public/games/<game_id>/assets/
```

| Файл | Разрешение | Назначение |
|---|---|---|
| `stage.jpg` | 1400×1100 (или 1400×1254, 1024×917) | Корпус автомата: фон темы, колонны, логотип игры и **пустая внутренняя панель** под барабаны. |
| `cover.jpg` | Копия кабинета или 600×450 | Обложка слота в лобби. |
| `sym_<id>.png` | 320×320 (PNG с прозрачностью) | Иконки символов: Scatter, Wild, высокооплачиваемые (H1–H4), низкие (Gems/Royals). |
| `giant.png` *(только для Giants)* | 400×1060 | Вертикальный баннер 3×1 главного персонажа-гиганта. |
| `wild.png` *(только для Giants)* | 400×1060 | Вертикальный баннер 3×1 дикого символа (Wild). |

---

## 2. Подключение графики в коде игры

### Для шаблонов (`src/games/definitions/<game_id>.js`):
В объекте описания игры добавьте `stage` и пути к картинкам:

```javascript
theme: {
  accent: '#ff5fa2',
  bg1: '#2a0845',
  bg2: '#0b001a',
  frame: 'none',
  particles: 'sparkle',
  font: 'Cinzel',
  title: ['GAME', 'TITLE'],
  icon: '💎',
  plainSymbols: true,
  symbolScale: 1,
  cover: '/games/<game_id>/assets/cover.jpg',
  stage: {
    image: '/games/<game_id>/assets/stage.jpg',
    width: 1400,        // ширина картинки stage.jpg
    height: 1100,       // высота картинки stage.jpg
    reels: {
      x: 320,           // левый отступ области барабанов (px)
      y: 280,           // верхний отступ (px)
      w: 760,           // ширина области барабанов (px)
      h: 760            // высота области барабанов (px)
    },
    pad: 6
  }
},
symbols: {
  SCATTER: scatter('Scatter Name', '⭐', '#ffc933', { image: '/games/<game_id>/assets/sym_scatter.png' }),
  H1: icon('H1', 'High 1', '👑', '#ffd700', { image: '/games/<game_id>/assets/sym_h1.png' }),
  // ...
}
```

### Для скинов гигантов (`src/games/skins/giants.js`):
Укажите флаг `custom_art: true` (он запрещает процедурному генератору затирать ручной арт):

```javascript
{
  id: 'my_skin_giants',
  name: 'My Skin Giants',
  cat: 'mythology',
  // ...
  custom_art: true,
  stage: { width: 1024, height: 917, reels: { x: 213, y: 297, w: 597, h: 415 }, pad: 6, symbol_scale: 1 },
  images: {
    scatter: 'sym_scatter.png',
    h: ['sym_h1.png', 'sym_h2.png', 'sym_h3.png', 'sym_h4.png'],
    gems: ['sym_gem1.png', 'sym_gem2.png', 'sym_gem3.png', 'sym_gem4.png']
  }
}
```

---

## 3. Как генерировать графику в Midjourney / DALL-E / Flux

Для полного оформления одной игры нужно сгенерировать **2 (или 3) изображения**:

### Шаг 1. Кабинет автомата (Cabinet / Stage)
* **Формат:** альбомный (например, `--ar 4:3` или `--ar 16:11`).
* **Критически важно:** в центральной части должна быть **ПУСТАЯ темная панель** без символов и текста — туда браузер будет вставлять вращающиеся барабаны!

> **Промпт (пример):**
> `premium modern online slot game art, painterly 2.5D illustration, rich lighting, highly detailed, vibrant colors. Slot machine cabinet for a 7x7 cluster reel grid: an ornate frame with columns and golden ornaments, the reel area in the center is an EMPTY dark blue velvet flat panel with NO symbols. At the top center a bold glowing game logo "GEM CLUSTER FRENZY". Background: crystal cave with glowing crystals and magical waterfalls. Main accent colors #4fc3f7 and #0d2748. --ar 4:3`

### Шаг 2. Спрайт-шит символов (3×3 Grid)
* **Формат:** квадратный (`--ar 1:1`, 1024×1024).
* **Критически важно:** сплошной плоский белый фон (`plain flat white background`), символы расположены с отступами друг от друга, без подписей.

> **Промпт (пример):**
> `premium modern online slot game art, painterly 2.5D illustration, rich lighting, highly detailed, vibrant colors. Sprite sheet of 9 separate slot symbols in a 3x3 grid on a plain flat white background, each symbol centered with generous space around it, no text: Diamond Star (glowing scatter), Flawless Diamond, Royal Ruby Heart, Sacred Emerald, Deep Sapphire Star, Imperial Amethyst Hexagon, Golden Topaz, Mystic Opal Orb, Aquamarine Tear. --ar 1:1`

### Шаг 3 (Только для механики Giants). Баннеры персонажей
* **Формат:** 2 вертикальные карты рядом.

> **Промпт (пример):**
> `premium modern online slot game art, painterly 2.5D illustration, rich lighting, highly detailed, vibrant colors. Two tall vertical portrait cards side by side, each in an ornate golden frame, character shown from waist up filling the card: left — Athena Goddess with golden helmet and shield; right — Zeus with white beard and lightning bolt in hand. Plain dark background between the cards, no text. --ar 2:5`

---

## 4. Нарезка и автоматическая обработка

### Способ А. Для Giant-скинов через скрипт нарезки:
В проекте есть готовый скрипт:
```bash
node scripts/slice-giant-game.js olympus_titans
```
Он:
1. Копирует кабинет в `stage.jpg` и `cover.jpg`.
2. Нарезает персонажей в `giant.png` и `wild.png` (400×1060).
3. Разрезает сетку 3×3 на 9 символов, удаляет белый фон и центрирует в `sym_*.png` (320×320).

### Способ Б. Универсальная нарезка через ImageMagick:
Если вы нарезаете 9 символов из файла `symbols_sheet.png`:
```bash
# Пример нарезки одного символа (колонка 0, строка 0):
magick symbols_sheet.png -crop 341x341+0+0 +repage \
  -fuzz 12% -transparent white -trim +repage \
  -resize 280x280 -gravity center -background none -extent 320x320 \
  public/games/<id>/assets/sym_scatter.png
```

### Способ В. Процедурная генерация через Chromium (`scripts/gen-art.js`):
Если вы хотите, чтобы игра сама рисовалась кодом через Canvas и Twemoji:
```bash
# Список модулей:
node scripts/gen-art.js --list

# Сгенерировать графику для игры:
node scripts/gen-art.js <game_id>

# Снять красивую обложку для лобби с запущенного сервера:
node scripts/gen-art.js <game_id> --cover http://localhost:3000
```

---

## 5. Почему игры могут не отображаться в лобби?

Если игра создана, но отсутствует в общем списке лобби:
1. **Проверьте настройки мерчанта в базе данных:**
   В демо-лобби отображаются только те игры, которые включены для демо-мерчанта (`merchant_id = 1`). Если в таблице `merchant_games` у игры стоит `enabled = 0`, она скрыта из списка.
   *Включить все игры разом:*
   ```sql
   UPDATE merchant_games SET enabled = 1 WHERE merchant_id = 1;
   ```
2. **Проверьте регистрацию в каталоге:**
   Игра должна быть подключена в [`src/games/definitions/index.js`](file:///Users/mihailssegins/SpinKit/src/games/definitions/index.js) (для шаблонов) или в [`src/games/skins/classic.js`](file:///Users/mihailssegins/SpinKit/src/games/skins/classic.js) / [`src/games/skins/giants.js`](file:///Users/mihailssegins/SpinKit/src/games/skins/giants.js) (для скинов).
3. **Перезапустите сервер:**
   Сервер кэширует каталог игр при старте. После добавления файлов перезапустите сервер (`npm start`).
