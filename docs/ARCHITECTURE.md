# SpinKit — архитектура и как добавлять слоты

Коротко: **игра = один файл с данными**, **механика = один модуль на сервере + один презентер в клиенте**. Всё остальное (ставки, фриспины, Feature Buy, лимит выигрыша, RTP-профили, кошелёк, API, админка, лобби) общее и про механики не знает.

```
src/
  engine/                     математика (без знания о конкретных играх)
    core/                     общие кирпичики
      reels.js                ленты: окно, спин, выбор лент base/FS
      evaluate.js             линии (evaluatePaylines), ways (evaluateWays), сумма выплат
      cascade.js              гравитация для каскадов (collapseGrid / collapseColumns)
      free-spins.js           скаттеры, выплаты скаттеров, начисление фриспинов, Feature Buy
    mechanics/
      index.js                реестр механик + значения по умолчанию для API
      lines.js ways.js tumble.js giants.js clusters.js megaways.js holdwin.js matchlines.js
    rgs.js                    спин: вызывает mechanic.play(), применяет фриспины, buy, max win
    rng.js strips.js          RNG (crypto / seeded), генератор лент
  games/                      каталог (данные)
    definitions/<id>.js       шаблоны игр — по файлу на игру
    definitions/index.js      порядок в лобби
    kit.js                    хелперы для описаний: royal / icon / wild / scatter / reels / LINES_*
    skins/classic.js          93 скина классических шаблонов (та же математика, новая тема)
    skins/giants.js           9 скинов гигантов
    skinning.js               применение скинов
    calibration.json          pay_scale / RTP / цена Buy (пишет simulate.js)
    build.js                  описание -> готовая игра (ставки, калибровка, mechanic.build)
    catalog.js                GAMES_CATALOG, RTP-профили (getGame)
public/games/common/          клиент (один на все игры)
  kit.js                      SlotKit: реестр вьюх и механик, утилиты
  views/*.js                  канвас-рендеры: GridView, ReelView, TumbleView, GiantReelView, MegawaysView, HoldWinView
  mechanics/*.js              презентеры механик (анимация спина, правила, плашки)
  slot-engine.js              UI-оболочка: ставки, автоигра, фриспины, big win, инфо
scripts/
  new-game.js                 генератор новой игры (npm run new-game)
  simulate.js                 Monte-Carlo и калибровка RTP
  gen-art.js + art/           процедурная графика (runner, painter-библиотеки, модули игр)
  golden-master.js            «слепок» математики и API для проверки рефакторинга
```

## Новая игра на существующей механике (5 минут)

```bash
npm run new-game -- --list                                   # механики и их эталонные шаблоны
npm run new-game -- --id desert_gold --name "Desert Gold" --mechanic lines
# или от конкретного шаблона:
npm run new-game -- --id desert_gold --name "Desert Gold" --from wild_safari
```

Скрипт создаёт `src/games/definitions/desert_gold.js` — полную редактируемую копию математики шаблона (без его графики, с его калибровкой), регистрирует игру в лобби и сразу проверяет её 3 000 спинов. Дальше:

1. Правите файл: символы, paytable, ленты / веса, фриспины, тему.
2. `node scripts/simulate.js --game desert_gold --calibrate --write` — подгонка RTP к 96% и цены Buy.
3. Графика: положите картинки в `public/games/desert_gold/assets/` и укажите их в `theme.stage` / `symbol.image`, или напишите painter в `scripts/art/games/desert_gold.js` и запустите `node scripts/gen-art.js desert_gold`.
4. Перезапустите сервер.

**Скин** (та же математика, новая тема, калибровка не нужна) — одна запись в `src/games/skins/classic.js` или `skins/giants.js`, либо для любого шаблона файл `src/games/definitions/<id>.js` c `reskin(require('./<template>'), { id, name, theme, symbols })` из `kit.js` (пути картинок сами переезжают в `/games/<id>/assets/`).

**Своя графика:** `scripts/import-art.py` (Pillow + numpy + scipy) — `sheet` режет листы символов с белого фона, `card`/`strip` вырезают персонажей и тотемы с тёмного фона, `stage --windows 2,4,5,...` чистит автомат и печатает `theme.stage` с `reel_rects` — окна барабанов в пикселях картинки, по ним клиент ставит каждый барабан (окна могут быть разного размера).

## Поля описания игры

Общие для всех механик:

| поле | что это |
|---|---|
| `id`, `name`, `tagline`, `category` | идентификатор (snake_case), название, подзаголовок, категория лобби |
| `mechanic` | одна из `src/engine/mechanics` |
| `reels_count`, `rows_count` | сетка |
| `bet_multiplier` | ставка = coin value × bet_multiplier (по умолчанию число линий или 20) |
| `symbols` | `{ ID: royal(...) / icon(...) / wild(...) / scatter(...) }`; `image` — своя картинка вместо Twemoji |
| `paytable` | `{ SYM: { count: pay } }` (единица зависит от механики, см. ниже); умножается на откалиброванный `pay_scale` |
| `free_spins` | `trigger`, `spins` (число или `{ скаттеров: спинов }`), `retrigger_min`, `retrigger_spins`, `max_spins`, `win_multiplier`, `buy: true` |
| `max_win_x`, `volatility` | лимит выигрыша (× ставка), волатильность |
| `theme` | цвета, рамка, частицы, шрифт, `title`; `stage` — картинка всего автомата с прямоугольником барабанов; `cover` — обложка в лобби |

Специфичные для механик:

| механика | paytable в | данные |
|---|---|---|
| `lines` | × ставка на линию | `paylines`, `reels` / `fs_reels` (числа символов на ленте), `stacks` |
| `ways` | × coin value на путь | `reels`, `free_spins.wild_multipliers` |
| `tumble` | × общая ставка | `weights` / `fs_weights`, `multipliers` |
| `giants` | × coin value на путь | `giants: { SYM: { height } }`, `reels`, `free_spins.sticky_giants`, `sticky_multipliers` |
| `clusters` | × общая ставка | `weights`, `min_cluster`, `spots: { max }`, `free_spins.sticky_spots` |
| `megaways` | × coin value на путь | `heights` / `fs_heights`, `reel_weights` / `fs_reel_weights`, `free_spins.persistent_multiplier` |
| `holdwin` | × ставка на линию (монеты × общая ставка) | `paylines`, `reels` c `COIN`, `holdwin: { trigger, respins, land_chance, values, jackpots, jackpot_names, jackpot_weights, specials }` |
| `matchlines` | × общая ставка | `weights`, `min_line`, `multiplier: { base: {start, step}, fs: {start, step}, max }`, `free_spins.persistent_multiplier` |

Подробные комментарии — в шапке каждого файла `src/engine/mechanics/<id>.js`.

## 50 игр с ИИ-графикой (OpenAI Images)

`src/games/skins/ai.js` — 50 готовых тем: по 10 на Megaways, Cluster Pays, Hold & Win, Line Cascades и Titans (как Tiki Titans). Каждая игра — `reskin` шаблона (та же математика и RTP), у каждой своя сцена, логотип и названия всех символов. Игра появляется в лобби, только когда её графика импортирована.

```bash
# 1. ключ в SpinKit/.env (файл в .gitignore):  OPENAI_API_KEY=sk-...
node scripts/gen-ai-art.js --list              # что готово
node scripts/gen-ai-art.js --kind megaways     # или <id> / --all;  --dry = только показать промпты
python3 scripts/import-ai-art.py --all         # нарезка в public/games/<id>/assets + stage.json
# 2. перезапуск сервера — игры в лобби
```

`gen-ai-art.js` на игру рисует автомат (1536×1024) и листы символов с прозрачным фоном (у Titans ещё столб-Wild и карточку гиганта). `import-ai-art.py` находит окно барабанов (у Titans — 7 ступенчатых окон), режет листы, делает обложку и `stage.json`. Модель и качество: `OPENAI_IMAGE_MODEL` (по умолчанию gpt-image-1), `OPENAI_IMAGE_QUALITY` (high).

## Новая механика

### Сервер: `src/engine/mechanics/<id>.js`

```js
module.exports = {
  id: 'my_mech',
  label: 'My Mechanic',
  paytableUnit: 'x total bet',                  // для Merchant API
  waysCount: (raw) => ...,                       // необязательно: «способов» для лобби/клиента
  build(game, raw, { seed, scale }) { ... },     // один раз при загрузке: ленты, веса, кэш
  play(game, { bet, rng, inFreeSpins, forceTrigger, customStops, bonus }) {
    return {
      matrix, final_matrix?, stop_positions,     // экран (rows × cols)
      winning_lines: [{ symbol, count, positions, multiplier, payout }],
      scatter_win,                               // scatterResult(...) из core/free-spins или null
      win,                                       // сумма всех выплат спина (в центах)
      free_spins_awarded,
      bonus,                                     // состояние между фриспинами (липкие символы, множитель...)
      cascades?, ...                             // любые поля из RESULT_KEYS в mechanics/index.js
    };
  },
  publicConfig: (game) => ({ ... }),             // необязательно: поля для клиента (/rgs/init)
  publicFreeSpins: (game) => ({ ... }),          // необязательно: поля в config.free_spins
  features: (game) => ({ ... })                  // необязательно: флаги в Merchant API
};
```

Затем одна строка в списке `src/engine/mechanics/index.js`. Если механика возвращает новое поле спина — добавьте его в `RESULT_KEYS`, новое поле конфига — в `PUBLIC_DEFAULTS` (чтобы у всех игр оно было `null`).

Готовые кирпичики: `spinReels` / `stripsFor` (ленты), `evaluatePaylines` / `evaluateWays` (выигрыши), `collapseGrid` / `collapseColumns` (каскады), `scatterPositions` / `scatterResult` / `forceScattersAnywhere` (скаттеры, фриспины, Buy). Правила платформы (фриспины, Buy, max win, RTP-профили) делает `rgs.js` — механике о них думать не нужно.

### Клиент: `public/games/common/mechanics/<id>.js`

```js
SlotKit.mechanic('my_mech', {
  cascading: true,                       // true: символы падают/взрываются (TumbleView), false: крутятся ленты
  view: 'TumbleView',                    // или своя createView(game, canvas)
  plate: (cfg) => ({ value: '8+', label: 'PAY ANYWHERE' }),
  payUnit: (cfg, bet) => bet,            // во сколько раз умножать paytable для таблицы выплат
  rules: (cfg, { bet, fmt }) => ['<p>…</p>'],
  async present(game, r) {               // анимация результата спина
    await game.view.dropIn(r.matrix, game.quick);
    await game.runCascades(r, { suffix: (step) => '' });   // общий цикл каскадов с хуками
    await game.finishCascades(r, r.final_matrix, 4);
  }
});
```

Все поля и значения по умолчанию — в `public/games/common/kit.js`. Добавьте `<script>` в `slot.html` (после views). Для совсем нового рендера — класс в `views/<name>.js`, регистрируется как `SlotKit.views.Name`.

## Проверки

```bash
npm test                                            # движок, механики, контроллер, интеграция, Merchant API
node scripts/golden-master.js --write /tmp/g.json   # слепок до изменений
node scripts/golden-master.js --check /tmp/g.json   # после: все 114 игр должны совпасть бит в бит
node scripts/simulate.js --game <id> --rounds 1000000
```

Golden master снимает хэши готовых описаний игр, клиентского конфига, ответа Merchant API и 150+ спинов (включая купленные фриспины) на фиксированном сиде: любой рефакторинг, который случайно меняет математику или контракт API, сразу виден.

## SpinKit Exclusive (не слоты)

Категория лобби `exclusive` — собственные игры с раундом из нескольких запросов: **Apple Shooter** (ретро step crash с ветром) и **Fruit Slash** (свайп-нарезка волн с бомбами).

```
src/games/exclusive/              описания игр (kind: 'exclusive', своя mechanic и свой client)
  apple_shooter.js                уровни, шансы Medium/High, ветер, шлем (без сайд-бетов), Revenge, скины
src/engine/exclusive/step-crash.js  математика + Provably Fair (чистые функции)
src/engine/mechanics/step_crash.js  регистрация в реестре механик (stateful: true)
src/services/exclusive-service.js   раунд, кошелёк, запись раунда в rgs_transactions
  fruit_slash.js                  волны, фрукты/бомбы, Frenzy Banana (бонус ×1.5), Samurai Shield (шаг назад, 1 раз)
public/games/apple_shooter/       свой клиент: index.html, style.css, scene.js (canvas 400×225), game.js, sfx.js
public/games/fruit_slash/         свой клиент: canvas 960×540 в разрешении экрана, свайп-лезвие, авто-нарезка под исход
scripts/simulate-exclusive.js     точный расчёт RTP (+ --mc N: Monte-Carlo на настоящем HMAC)
test/exclusive.test.js            математика, PF, денежный поток, проверка раундов раскрытым сидом
```

**API клиента** (токен сессии, как у слотов; `/rgs/spin` для таких игр отвечает `USE_ACTION_ENDPOINT`):

| запрос | что делает |
|---|---|
| `POST /api/v1/rgs/init { token }` | конфиг (`game_config.crash`), незавершённый раунд, `next` — котировка следующего выстрела, PF-хэш, скины, Revenge |
| `POST /api/v1/rgs/action { token, action: 'start', bet, mode }` | списывает ставку, открывает раунд (`mode`: `medium` / `high`) |
| `… action: 'shoot', helmet, expect_shot }` | один выстрел; шлем — только на этот выстрел; `expect_shot` защищает от двойного клика (Fruit Slash: ещё `cut` и `side_bets`) |
| `… action: 'cashout'` | выплата `bet × multiplier` (после ≥ 1 пройденного уровня) |
| `… action: 'seed', client_seed` | между раундами: раскрывает старый server seed, выдаёт новый |
| `… action: 'skin', skin` | выбрать открытый скин (каждые 100 пройденных выстрелов) |

**Математика.** Выстрел = `HMAC_SHA256(server_seed, client_seed:nonce:shot)`: байты 0-3 → `u`, байты 4-5 → ветер ±10 м/с.
`chance = survival[mode][level] / (1 + бонус ветра)`, `u ≥ chance` → летальный, иначе `u/chance` делится на bullseye / hat_trick / near_miss / hit.
Множитель = `rtp / chance₁ / … / chanceₖ`: край казино только в первом выстреле, все следующие EV-нейтральны, поэтому RTP основной ставки = 96.5% при любой стратегии кэшаута (с округлением множителя до 0.01: 96.4–96.7% на 1–3 выстрелах, дальше 96.50%). Сайд-беты (только Fruit Slash): `odds = floor(0.965 / P(событие))`. Шлем: цена = `P(летальный) × 0.5 × множитель × ставка / 0.965`. RTP-профили оператора (88/94/…) масштабируют целевой RTP.

**Revenge** — подарок поверх RTP. В GDD x1.30 вместо x1.06 (буст лестницы ×1.226) дал бы игроку, который всегда идёт до 10-го уровня, ~99.7%; по умолчанию стоит x1.10 (×1.0377, худший случай +0.55 п.п.). Меняется одной строкой `revenge.boost` в `apple_shooter.js`, проверка — `npm run simulate:exclusive`.

**Прицел косметический**: угол и натяжение только рисуют полёт, сервер логирует их в `details.shots[].aim`, но не использует. Об этом сказано в правилах игры.

Каждый раунд — одна строка `rgs_transactions` (`bet_type = 'step_crash'`): `bet_amount` = ставка + шлемы (+ сайд-беты во Fruit Slash), `details.shots` — все выстрелы с хэшами, шансами, ветром и ставками; по раскрытому сиду раунд проверяется целиком.

**Опции движка step crash** (в `crash` описания игры): `wind` — тиры ветра (без него ветра нет); `bonus: { outcome, boost }` — исход, умножающий лестницу (шаг делится на D = 1 + доля × (boost − 1), поэтому остаётся EV-нейтральным); `helmet: { from_level, keep }` — сохраняет долю множителя, или `{ from_level, step_back: true, max_saves }` — откат на шаг назад; `revenge` — необязателен. Новая игра этого типа = файл в `src/games/exclusive/` + клиент в `public/games/<client>/`.

**Fruit Slash** работает на отдельном движке `lane_slash` (`src/engine/exclusive/lane-slash.js`): 8 дорожек, перед волной игрок свайпом задаёт разрез (непрерывный отрезок из k дорожек) и жмёт THROW. Запрос `shoot` несёт `cut: { from, to }`; сервер только после этого строит волну из HMAC (слова 0–6 — тасовка Фишера–Йетса «фрукт / бомба / пусто», слово 7 — драконий фрукт) и считает результат: бомба в разрезе — проигрыш (щит поглощает 1 раз за раунд, шаг назад), ни одного фрукта — проигрыш, f фруктов — множитель × g(f)/Z(k), g(f) = 1 + 0.25(f − 1). Z(k) — среднее g по всем исходам ширины k, поэтому каждая волна EV-нейтральна при любой ширине, а RTP = 96.5% для любой стратегии (точный расчёт с округлением и лимитом: `node scripts/simulate-lanes.js` → 96.2–96.8% на 1–3 волнах, 96.5% дальше). Ширина предлагается, только пока её лучший исход не превышает max win; если не осталось ни одной — автокэшаут. Котировка (`next.spans`) зависит только от номера волны и ширины, о раскладе волны до фиксации разреза клиент не получает ничего.

### Настройки оператора и языки

**Лестница ставок.** Exclusive-игры объявляют свою `coin_values` (× `bet_multiplier` 20 = $0.20 … $5 000) и `default_max_bet: 10000`: без настроек игроку доступно до $100. Оператор открывает больше, задав `max_bet` игры (`PATCH /api/v2/games/:id/settings { max_bet }` в минорных единицах или в админке → Merchant → Games). Общий `max_bet` мерчанта (ставит провайдер) действует поверх. Слоты не меняются: у них ладдер по-прежнему до $100. Поля в `build.js`: `max_bet` — потолок по умолчанию, `max_bet_limit` — верх лестницы.

**Опции игры** — `operator_options` в описании игры (схема: label / min / max / default / hint), значения в `merchant_games.options` (JSON). Сейчас одна: `helmet_max_saves` — спасений шлемом (Apple Shooter) / щитом (Fruit Slash) за раунд; пусто — по умолчанию игры (Apple — без лимита, Fruit — 1), `0` — шлем выключен. `merchants.effective()` накладывает опции на копию игры (`applyOptions`), каталог не мутируется; клиент получает итог в `game_config.crash.helmet`. Оператор меняет: `PATCH /api/v2/games/:id/settings { options: { helmet_max_saves: 2 } }`; RTP-профили остаются за провайдером.

**Языки.** 13 языков: en, ru, uk, lv, lt, et, pl, de, es, pt, fr, it, tr. Словари — `public/games/<игра>/lang/<код>.json`, загрузчик — `public/games/common/i18n.js` (`I18N.t`, `I18N.p` для множественного числа через `Intl.PluralRules`, `data-i18n*` атрибуты). Порядок выбора: `?lang=` в URL → выбор игрока в правилах (запоминается в браузере) → язык сессии (`lang` в `POST /api/v2/sessions`, иначе `default_lang` мерчанта) → язык браузера → английский. Деньги форматируются `Intl.NumberFormat` под локаль. Проверка словарей: `node scripts/check-i18n.js` (ключи, плейсхолдеры, HTML-теги против en.json). Шрифты: Press Start 2P / Bungee / Roboto Condensed с latin-ext и кириллицей; в Apple Shooter у Silkscreen нет кириллицы и ł ą š ğ…, поэтому для ru/uk/pl/lv/lt/et/tr весь текст идёт в Press Start 2P. Новый язык = файл `<код>.json` в обеих играх + код в `LANGS` (`merchants.js`, `i18n.js`).
