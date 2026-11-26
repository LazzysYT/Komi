/* Shared AniCoin catalog. Target prices and revision mirror the checked-in shop migration. */
(function(root){
'use strict';
const items=Object.freeze([
  {
    "id": "frame_ghoul_seal",
    "type": "frame",
    "label": "Печать гуля",
    "cost": 30,
    "frameClass": "frame-ghoul-seal",
    "description": "Матовый обод с тонкой багровой трещиной. Купить можно без кейса.",
    "anime": "Токийский гуль",
    "rarity": "epic",
    "giftable": false,
    "introducedAt": "2026-11-26T18:00:00Z"
  },
  {
    "id": "name_mangaka_ink",
    "type": "name",
    "label": "Перо мангаки",
    "cost": 25,
    "cosmeticClass": "name-mangaka-ink",
    "description": "Неровный штрих тушью подчёркивает ник, не меняя буквы.",
    "rarity": "rare",
    "giftable": false,
    "introducedAt": "2026-11-26T18:00:00Z"
  },
  {
    "id": "xp_story_rhythm",
    "type": "xp",
    "label": "Ритм сюжета",
    "cost": 25,
    "cosmeticClass": "xp-story-rhythm",
    "description": "Лента кадров манги подсвечивает прирост опыта и новый уровень.",
    "rarity": "rare",
    "giftable": false,
    "introducedAt": "2026-11-26T18:00:00Z"
  },
  {
    "id": "showcase_personal_cinema",
    "type": "showcase",
    "label": "Личный кинотеатр",
    "cost": 40,
    "cosmeticClass": "showcase-personal-cinema",
    "description": "До трёх любимых аниме в рамках афиш с мягким светом.",
    "rarity": "epic",
    "giftable": false,
    "introducedAt": "2026-11-26T18:00:00Z"
  },
  {
    "id": "title_gojo_infinity",
    "type": "title",
    "label": "Бесконечность",
    "title": "Бесконечность",
    "character": "Сатору Годзё",
    "anime": "Магическая битва",
    "cost": 45,
    "description": "Две сферы сходятся в фиолетовый ореол.",
    "rarity": "epic",
    "introducedAt": "2026-11-26"
  },
  {
    "id": "title_levi_captain",
    "type": "title",
    "label": "Капитан разведки",
    "title": "Капитан разведки",
    "character": "Леви Аккерман",
    "anime": "Атака титанов",
    "cost": 35,
    "description": "Два серебряных следа пересекают графитовую эмаль.",
    "rarity": "rare",
    "introducedAt": "2026-11-26"
  },
  {
    "id": "title_frieren_bloom",
    "type": "title",
    "label": "Цветы сквозь века",
    "title": "Цветы сквозь века",
    "character": "Фрирен",
    "anime": "Провожающая в последний путь Фрирен",
    "cost": 30,
    "description": "Мятное кольцо раскрывается, как цветок.",
    "rarity": "rare",
    "introducedAt": "2026-11-26"
  },
  {
    "id": "title_luffy_dawn",
    "type": "title",
    "label": "Навстречу рассвету",
    "title": "Навстречу рассвету",
    "character": "Монки Д. Луффи",
    "anime": "Ван-Пис",
    "cost": 35,
    "description": "Солнце поднимается над морским горизонтом.",
    "rarity": "rare",
    "introducedAt": "2026-11-26"
  },
  {
    "id": "title_tanjiro_current",
    "type": "title",
    "label": "Дыхание воды",
    "title": "Дыхание воды",
    "character": "Тандзиро Камадо",
    "anime": "Клинок, рассекающий демонов",
    "cost": 40,
    "description": "Бирюзовая волна проходит по нижней кромке.",
    "rarity": "epic",
    "introducedAt": "2026-11-26"
  },
  {
    "id": "title_anya_signal",
    "type": "title",
    "label": "Секретная мысль",
    "title": "Секретная мысль",
    "character": "Аня Форджер",
    "anime": "Семья шпиона",
    "cost": 30,
    "description": "Розовые кольца расходятся от маленькой звезды.",
    "rarity": "rare",
    "introducedAt": "2026-11-26"
  },

  {
    "id": "title_crimson_hunter",
    "label": "Алый охотник",
    "title": "Алый охотник",
    "cost": 30,
    "type": "title",
    "rarity": "rare",
    "description": "Бордовая эмаль, алый контур и знак прицела.",
    "introducedAt": "2026-11-26"
  },
  {
    "id": "title_moon_ronin",
    "label": "Лунный ронин",
    "title": "Лунный ронин",
    "cost": 25,
    "type": "title",
    "rarity": "rare",
    "description": "Стальной полумесяц на холодной синей фольге.",
    "introducedAt": "2026-11-26"
  },
  {
    "id": "title_yokai_whisper",
    "label": "Шёпот ёкая",
    "title": "Шёпот ёкая",
    "cost": 30,
    "type": "title",
    "rarity": "rare",
    "description": "Фиолетовая маска и мягкий призрачный блик.",
    "introducedAt": "2026-11-26"
  },
  {
    "id": "title_awakening_mode",
    "label": "Режим: пробуждение",
    "title": "Режим: пробуждение",
    "cost": 35,
    "type": "title",
    "rarity": "epic",
    "description": "Янтарный разлом и диагональная искра.",
    "introducedAt": "2026-11-26"
  },
  {
    "id": "title_sakura_vow",
    "label": "Клятва сакуры",
    "title": "Клятва сакуры",
    "cost": 20,
    "type": "title",
    "rarity": "rare",
    "description": "Розовое золото и эмблема из лепестков.",
    "introducedAt": "2026-11-26"
  },
  {
    "id": "title_last_cut",
    "label": "Последний кадр",
    "title": "Последний кадр",
    "cost": 15,
    "type": "title",
    "rarity": "common",
    "description": "Серебряная рамка киноплёнки и короткий белый блик.",
    "introducedAt": "2026-11-26"
  },

  {
    "id": "banner_last_train",
    "label": "Последний поезд",
    "cost": 45,
    "type": "banner",
    "bannerClass": "banner-last-train",
    "rarity": "rare",
    "description": "Тёплые окна поезда отражаются в мокром перроне.",
    "collection": "station-0017",
    "introducedAt": "2026-11-26"
  },
  {
    "id": "banner_moon_platform",
    "label": "Лунный перрон",
    "cost": 40,
    "type": "banner",
    "bannerClass": "banner-moon-platform",
    "rarity": "rare",
    "description": "Пустая станция, луна и синие горы за рельсами.",
    "collection": "station-0017",
    "introducedAt": "2026-11-26"
  },
  {
    "id": "frame_platform_light",
    "label": "Свет платформы",
    "cost": 30,
    "type": "frame",
    "frameClass": "frame-platform-light",
    "rarity": "rare",
    "description": "Графитовый контур аватара с янтарным бликом.",
    "collection": "station-0017",
    "introducedAt": "2026-11-26"
  },
  {
    "id": "overlay_station_rain",
    "label": "Дождь у путей",
    "cost": 35,
    "type": "overlay",
    "cosmeticClass": "overlay-station-rain",
    "rarity": "rare",
    "description": "Тонкие светлые капли на обложке. Без мерцания.",
    "collection": "station-0017",
    "introducedAt": "2026-11-26"
  },
  {
    "id": "title_last_departure",
    "label": "До последнего поезда",
    "title": "До последнего поезда",
    "cost": 15,
    "type": "title",
    "rarity": "common",
    "description": "Титул для тех, кто досматривает до ночи.",
    "collection": "station-0017",
    "introducedAt": "2026-11-26"
  },

  {
    "id": "frame_moon",
    "label": "Лунная рамка",
    "cost": 20,
    "type": "frame",
    "frameClass": "frame-moon",
    "rarity": "common"
  },
  {
    "id": "frame_aurora",
    "label": "Рамка Аврора",
    "cost": 25,
    "type": "frame",
    "frameClass": "frame-aurora",
    "rarity": "common"
  },
  {
    "id": "frame_noir",
    "label": "Рамка Нуар",
    "cost": 20,
    "type": "frame",
    "frameClass": "frame-noir",
    "rarity": "common"
  },
  {
    "id": "frame_silver",
    "label": "Серебряный контур",
    "cost": 35,
    "type": "frame",
    "frameClass": "frame-silver",
    "rarity": "common"
  },
  {
    "id": "frame_frost",
    "label": "Ледяная рамка",
    "cost": 35,
    "type": "frame",
    "frameClass": "frame-frost",
    "rarity": "common"
  },
  {
    "id": "frame_neon",
    "label": "Неоновый пульс",
    "cost": 50,
    "type": "frame",
    "frameClass": "frame-neon",
    "rarity": "rare"
  },
  {
    "id": "frame_orbit",
    "label": "Орбита",
    "cost": 55,
    "type": "frame",
    "frameClass": "frame-orbit",
    "rarity": "rare"
  },
  {
    "id": "frame_eclipse",
    "label": "Затмение",
    "cost": 65,
    "type": "frame",
    "frameClass": "frame-eclipse",
    "rarity": "epic"
  },
  {
    "id": "frame_prism",
    "label": "Призма",
    "cost": 75,
    "type": "frame",
    "frameClass": "frame-prism",
    "rarity": "epic"
  },
  {
    "id": "frame_royal",
    "label": "Королевская рамка",
    "cost": 95,
    "type": "frame",
    "frameClass": "frame-royal",
    "rarity": "legendary"
  },
  {
    "id": "frame_pixel",
    "label": "Пиксельная рамка",
    "cost": 25,
    "type": "frame",
    "frameClass": "frame-pixel",
    "rarity": "common"
  },
  {
    "id": "frame_halo",
    "label": "Белый ореол",
    "cost": 85,
    "type": "frame",
    "frameClass": "frame-halo",
    "rarity": "epic"
  },
  {
    "id": "title_cinema",
    "label": "Титул «Киноман»",
    "cost": 10,
    "type": "title",
    "title": "✧ Киноман",
    "rarity": "common"
  },
  {
    "id": "title_starlight",
    "label": "Титул «Звёздный зритель»",
    "cost": 15,
    "type": "title",
    "title": "✦ Звёздный зритель",
    "rarity": "common"
  },
  {
    "id": "title_collector",
    "label": "Титул «Коллекционер»",
    "cost": 20,
    "type": "title",
    "title": "◇ Коллекционер",
    "rarity": "common"
  },
  {
    "id": "title_otaku",
    "label": "Титул «Отаку»",
    "cost": 25,
    "type": "title",
    "title": "✳ Отаку",
    "rarity": "common"
  },
  {
    "id": "title_explorer",
    "label": "Титул «Исследователь»",
    "cost": 30,
    "type": "title",
    "title": "⌁ Исследователь",
    "rarity": "common"
  },
  {
    "id": "title_nocturne",
    "label": "Титул «Ночной зритель»",
    "cost": 35,
    "type": "title",
    "title": "☾ Ночной зритель",
    "rarity": "common"
  },
  {
    "id": "title_legend",
    "label": "Титул «Легенда Komi»",
    "cost": 60,
    "type": "title",
    "title": "✶ Легенда Komi",
    "rarity": "rare"
  },
  {
    "id": "title_archivist",
    "label": "Титул «Архивариус»",
    "cost": 40,
    "type": "title",
    "title": "▣ Архивариус",
    "rarity": "rare"
  },
  {
    "id": "title_marathon",
    "label": "Титул «Марафонец»",
    "cost": 45,
    "type": "title",
    "title": "↗ Марафонец",
    "rarity": "rare"
  },
  {
    "id": "title_curator",
    "label": "Титул «Куратор»",
    "cost": 50,
    "type": "title",
    "title": "◈ Куратор",
    "rarity": "rare"
  },
  {
    "id": "title_cosmic",
    "label": "Титул «Космический»",
    "cost": 65,
    "type": "title",
    "title": "✧ Космический",
    "rarity": "epic"
  },
  {
    "id": "title_veteran",
    "label": "Титул «Ветеран Komi»",
    "cost": 85,
    "type": "title",
    "title": "◆ Ветеран Komi",
    "rarity": "epic"
  },
  {
    "id": "banner_noir",
    "label": "Обложка «Нуар»",
    "cost": 25,
    "type": "banner",
    "bannerClass": "banner-noir",
    "rarity": "common"
  },
  {
    "id": "banner_stars",
    "label": "Обложка «Звёзды»",
    "cost": 30,
    "type": "banner",
    "bannerClass": "banner-stars",
    "rarity": "common"
  },
  {
    "id": "banner_grid",
    "label": "Обложка «Сетка»",
    "cost": 35,
    "type": "banner",
    "bannerClass": "banner-grid",
    "rarity": "common"
  },
  {
    "id": "banner_moon",
    "label": "Обложка «Лунный свет»",
    "cost": 40,
    "type": "banner",
    "bannerClass": "banner-moon",
    "rarity": "rare"
  },
  {
    "id": "banner_aurora",
    "label": "Обложка «Аврора»",
    "cost": 50,
    "type": "banner",
    "bannerClass": "banner-aurora",
    "rarity": "rare"
  },
  {
    "id": "banner_frost",
    "label": "Обложка «Мороз»",
    "cost": 55,
    "type": "banner",
    "bannerClass": "banner-frost",
    "rarity": "rare"
  },
  {
    "id": "banner_glitch",
    "label": "Обложка «Глитч»",
    "cost": 60,
    "type": "banner",
    "bannerClass": "banner-glitch",
    "rarity": "rare"
  },
  {
    "id": "banner_eclipse",
    "label": "Обложка «Затмение»",
    "cost": 80,
    "type": "banner",
    "bannerClass": "banner-eclipse",
    "rarity": "epic"
  },
  {
    "id": "overlay_sakura",
    "label": "Лепестки сакуры",
    "cost": 40,
    "type": "overlay",
    "cosmeticClass": "overlay-sakura",
    "rarity": "rare"
  },
  {
    "id": "overlay_rain",
    "label": "Дождь на обложке",
    "description": "Ночной дождь поверх обложки твоего профиля.",
    "cost": 50,
    "type": "overlay",
    "cosmeticClass": "overlay-rain",
    "rarity": "rare"
  },
  {
    "id": "overlay_film",
    "label": "Плёночный шум",
    "cost": 25,
    "type": "overlay",
    "cosmeticClass": "overlay-film",
    "rarity": "common"
  },
  {
    "id": "overlay_sparks",
    "label": "Искры",
    "cost": 55,
    "type": "overlay",
    "cosmeticClass": "overlay-sparks",
    "rarity": "rare"
  },
  {
    "id": "overlay_snow",
    "label": "Лёгкий снег",
    "cost": 40,
    "type": "overlay",
    "cosmeticClass": "overlay-snow",
    "rarity": "rare"
  },
  {
    "id": "overlay_dust",
    "label": "Звёздная пыль",
    "cost": 70,
    "type": "overlay",
    "cosmeticClass": "overlay-dust",
    "rarity": "epic"
  },
  {
    "id": "showcase_film",
    "label": "Топ-3 «Киноплёнка»",
    "cost": 60,
    "type": "showcase",
    "cosmeticClass": "showcase-film",
    "rarity": "rare"
  },
  {
    "id": "showcase_gloss",
    "label": "Топ-3 «Глянец»",
    "cost": 70,
    "type": "showcase",
    "cosmeticClass": "showcase-gloss",
    "rarity": "epic"
  },
  {
    "id": "showcase_neon",
    "label": "Топ-3 «Неон»",
    "cost": 90,
    "type": "showcase",
    "cosmeticClass": "showcase-neon",
    "rarity": "legendary"
  },
  {
    "id": "card_graphite",
    "label": "Карточка «Графит»",
    "cost": 50,
    "type": "card",
    "cosmeticClass": "card-graphite",
    "rarity": "rare"
  },
  {
    "id": "card_frost",
    "label": "Карточка «Матовый лёд»",
    "cost": 65,
    "type": "card",
    "cosmeticClass": "card-frost",
    "rarity": "epic"
  },
  {
    "id": "card_aurora",
    "label": "Карточка «Аврора»",
    "cost": 80,
    "type": "card",
    "cosmeticClass": "card-aurora",
    "rarity": "epic"
  },
  {
    "id": "card_glass",
    "label": "Карточка «Стекло»",
    "cost": 85,
    "type": "card",
    "cosmeticClass": "card-glass",
    "rarity": "epic"
  },
  {
    "id": "icon_headphones",
    "label": "Статус «Наушники»",
    "cost": 20,
    "type": "icon",
    "cosmeticClass": "icon-headphones",
    "symbol": "♫",
    "rarity": "common"
  },
  {
    "id": "icon_ramen",
    "label": "Статус «Рамен»",
    "cost": 25,
    "type": "icon",
    "cosmeticClass": "icon-ramen",
    "symbol": "♨",
    "rarity": "common"
  },
  {
    "id": "icon_cassette",
    "label": "Статус «Кассета»",
    "cost": 30,
    "type": "icon",
    "cosmeticClass": "icon-cassette",
    "symbol": "▣",
    "rarity": "common"
  },
  {
    "id": "icon_crown",
    "label": "Статус «Корона»",
    "cost": 75,
    "type": "icon",
    "cosmeticClass": "icon-crown",
    "symbol": "♛",
    "rarity": "epic"
  },
  {
    "id": "icon_katana",
    "label": "Статус «Катана»",
    "cost": 55,
    "type": "icon",
    "cosmeticClass": "icon-katana",
    "symbol": "⚔",
    "rarity": "rare"
  },
  {
    "id": "icon_comet",
    "label": "Статус «Комета»",
    "cost": 45,
    "type": "icon",
    "cosmeticClass": "icon-comet",
    "symbol": "✶",
    "rarity": "rare"
  },
  {
    "id": "reaction_hype",
    "label": "Реакции «Хайп»",
    "cost": 40,
    "type": "reaction",
    "reactions": [
      {
        "id": "hype",
        "emoji": "🔥",
        "label": "Хайп"
      },
      {
        "id": "wow",
        "emoji": "😮",
        "label": "Шок"
      },
      {
        "id": "clap",
        "emoji": "👏",
        "label": "Аплодисменты"
      }
    ],
    "rarity": "rare"
  },
  {
    "id": "reaction_soft",
    "label": "Реакции «Эмоции»",
    "cost": 35,
    "type": "reaction",
    "reactions": [
      {
        "id": "tear",
        "emoji": "🥲",
        "label": "Трогательно"
      },
      {
        "id": "heart",
        "emoji": "🤍",
        "label": "Нравится"
      },
      {
        "id": "laugh",
        "emoji": "😂",
        "label": "Смешно"
      }
    ],
    "rarity": "common"
  },
  {
    "id": "reaction_cinema",
    "label": "Реакции «Кино»",
    "cost": 50,
    "type": "reaction",
    "reactions": [
      {
        "id": "star",
        "emoji": "⭐",
        "label": "Пять звёзд"
      },
      {
        "id": "suspense",
        "emoji": "👀",
        "label": "Интрига"
      },
      {
        "id": "popcorn",
        "emoji": "🍿",
        "label": "Попкорн"
      }
    ],
    "rarity": "rare"
  },
  {
    "id": "frame_sumi",
    "label": "Каллиграфия «Суми-э»",
    "cost": 55,
    "type": "frame",
    "frameClass": "frame-sumi",
    "rarity": "rare"
  },
  {
    "id": "frame_film35",
    "label": "Киноплёнка 35mm",
    "cost": 55,
    "type": "frame",
    "frameClass": "frame-film35",
    "rarity": "rare"
  },
  {
    "id": "frame_glitch",
    "label": "Глитч / Помехи",
    "cost": 70,
    "type": "frame",
    "frameClass": "frame-glitch",
    "rarity": "epic"
  },
  {
    "id": "frame_glass",
    "label": "Стеклянная призма",
    "cost": 80,
    "type": "frame",
    "frameClass": "frame-glass",
    "rarity": "epic"
  },
  {
    "id": "frame_sakura",
    "label": "Сакура в движении",
    "cost": 85,
    "type": "frame",
    "frameClass": "frame-sakura",
    "rarity": "legendary"
  },
  {
    "id": "frame_slash",
    "label": "Диагональный блик",
    "cost": 65,
    "type": "frame",
    "frameClass": "frame-slash",
    "rarity": "rare"
  },
  {
    "id": "frame_shogun",
    "label": "Венец сёгуна",
    "cost": 120,
    "type": "frame",
    "frameClass": "frame-shogun",
    "rarity": "legendary"
  },
  {
    "id": "shape_cyber",
    "label": "Кибер-срез",
    "cost": 35,
    "type": "shape",
    "cosmeticClass": "shape-cyber",
    "rarity": "common"
  },
  {
    "id": "shape_octagon",
    "label": "Октагон",
    "cost": 40,
    "type": "shape",
    "cosmeticClass": "shape-octagon",
    "rarity": "rare"
  },
  {
    "id": "shape_diamond",
    "label": "Ромб",
    "cost": 45,
    "type": "shape",
    "cosmeticClass": "shape-diamond",
    "rarity": "rare"
  },
  {
    "id": "shape_drop",
    "label": "Капля",
    "cost": 50,
    "type": "shape",
    "cosmeticClass": "shape-drop",
    "rarity": "rare"
  },
  {
    "id": "plate_manga",
    "label": "Скринтон манги",
    "cost": 40,
    "type": "plate",
    "cosmeticClass": "plate-manga",
    "rarity": "rare"
  },
  {
    "id": "plate_seigaiha",
    "label": "Японские волны",
    "cost": 55,
    "type": "plate",
    "cosmeticClass": "plate-seigaiha",
    "rarity": "rare"
  },
  {
    "id": "plate_rain",
    "label": "Дождь в комментариях",
    "description": "Ночной дождь на фоне твоих комментариев.",
    "cost": 45,
    "type": "plate",
    "cosmeticClass": "plate-rain",
    "rarity": "rare"
  },
  {
    "id": "plate_gradient",
    "label": "Градиентный контур",
    "cost": 70,
    "type": "plate",
    "cosmeticClass": "plate-gradient",
    "rarity": "epic"
  },
  {
    "id": "mascot_cat",
    "label": "Компаньон «Кот»",
    "cost": 55,
    "type": "mascot",
    "cosmeticClass": "mascot-cat",
    "symbol": "♠",
    "rarity": "rare"
  },
  {
    "id": "mascot_lantern",
    "label": "Компаньон «Фонарик»",
    "cost": 65,
    "type": "mascot",
    "cosmeticClass": "mascot-lantern",
    "symbol": "◇",
    "rarity": "epic"
  },
  {
    "id": "mascot_spirit",
    "label": "Компаньон «Дух»",
    "cost": 85,
    "type": "mascot",
    "cosmeticClass": "mascot-spirit",
    "symbol": "✦",
    "rarity": "epic"
  },
  {
    "id": "xp_silver",
    "label": "XP «Жидкое серебро»",
    "cost": 55,
    "type": "xp",
    "cosmeticClass": "xp-silver",
    "rarity": "rare"
  },
  {
    "id": "xp_hatch",
    "label": "XP «Штриховка»",
    "cost": 35,
    "type": "xp",
    "cosmeticClass": "xp-hatch",
    "rarity": "common"
  },
  {
    "id": "xp_beam",
    "label": "XP «Световой луч»",
    "cost": 70,
    "type": "xp",
    "cosmeticClass": "xp-beam",
    "rarity": "epic"
  },
  {
    "id": "xp_dots",
    "label": "XP «Пунктир»",
    "cost": 35,
    "type": "xp",
    "cosmeticClass": "xp-dots",
    "rarity": "common"
  },
  {
    "id": "name_silver",
    "label": "Ник «Жидкое серебро»",
    "cost": 70,
    "type": "name",
    "cosmeticClass": "name-silver",
    "rarity": "epic"
  },
  {
    "id": "name_ghost",
    "label": "Ник «Призрачный»",
    "cost": 60,
    "type": "name",
    "cosmeticClass": "name-ghost",
    "rarity": "rare"
  },
  {
    "id": "name_dawn",
    "label": "Ник «Алый рассвет»",
    "cost": 85,
    "type": "name",
    "cosmeticClass": "name-dawn",
    "rarity": "epic"
  },
  {
    "id": "name_chrome",
    "label": "Ник «Хром»",
    "cost": 95,
    "type": "name",
    "cosmeticClass": "name-chrome",
    "rarity": "legendary"
  },
  {
    "id": "title_ongoing",
    "label": "Титул «Охотник за онгоингами»",
    "cost": 40,
    "type": "title",
    "title": "⌁ Охотник за онгоингами",
    "rarity": "rare"
  },
  {
    "id": "title_nightmarathon",
    "label": "Титул «Ночной марафонец»",
    "cost": 50,
    "type": "title",
    "title": "☾ Ночной марафонец",
    "rarity": "rare"
  },
  {
    "id": "title_critic",
    "label": "Титул «Критик 80-го уровня»",
    "cost": 55,
    "type": "title",
    "title": "✎ Критик 80-го уровня",
    "rarity": "rare"
  },
  {
    "id": "title_spoiler",
    "label": "Титул «Хранитель спойлеров»",
    "cost": 60,
    "type": "title",
    "title": "◈ Хранитель спойлеров",
    "rarity": "rare"
  },
  {
    "id": "title_pioneer",
    "label": "Титул «Первопроходец Komi»",
    "cost": 90,
    "type": "title",
    "title": "✦ Первопроходец Komi",
    "rarity": "legendary"
  },
  {
    "id": "frame_matte",
    "label": "Рамка «Матовый контур»",
    "cost": 15,
    "type": "frame",
    "frameClass": "frame-matte",
    "rarity": "common"
  },
  {
    "id": "frame_anamorphic",
    "label": "Рамка «Анаморф»",
    "cost": 50,
    "type": "frame",
    "frameClass": "frame-anamorphic",
    "rarity": "rare"
  },
  {
    "id": "title_titres",
    "label": "Титул «После титров»",
    "cost": 10,
    "type": "title",
    "title": "▰ После титров",
    "rarity": "common"
  },
  {
    "id": "title_doublefeature",
    "label": "Титул «Двойной сеанс»",
    "cost": 25,
    "type": "title",
    "title": "▣ Двойной сеанс",
    "rarity": "rare"
  },
  {
    "id": "banner_projection",
    "label": "Обложка «Свет проектора»",
    "cost": 30,
    "type": "banner",
    "bannerClass": "banner-projection",
    "rarity": "rare"
  },
  {
    "id": "icon_ticket",
    "label": "Статус «Кинобилет»",
    "cost": 15,
    "type": "icon",
    "cosmeticClass": "icon-ticket",
    "symbol": "▰",
    "rarity": "common"
  },
  {
    "id": "plate_subtitle",
    "label": "Плашка «Субтитры»",
    "cost": 20,
    "type": "plate",
    "cosmeticClass": "plate-subtitle",
    "rarity": "common"
  },
  {
    "id": "xp_perforation",
    "label": "XP «Перфорация плёнки»",
    "cost": 35,
    "type": "xp",
    "cosmeticClass": "xp-perforation",
    "rarity": "rare"
  },
  {
    "id": "frame_velvet",
    "label": "Рамка «Ночной бархат»",
    "cost": 35,
    "type": "frame",
    "rarity": "common",
    "collection": "nocturne",
    "description": "Тёмный ободок с тонкой серебряной окантовкой.",
    "introducedAt": "2026-11-25",
    "frameClass": "frame-velvet"
  },
  {
    "id": "banner_citylight",
    "label": "Обложка «Город после полуночи»",
    "cost": 45,
    "type": "banner",
    "rarity": "rare",
    "collection": "nocturne",
    "description": "Силуэты города и мягкий свет ночных окон.",
    "introducedAt": "2026-11-25",
    "bannerClass": "banner-citylight"
  },
  {
    "id": "title_midnight",
    "label": "Титул «Ещё одну серию»",
    "cost": 15,
    "type": "title",
    "rarity": "common",
    "collection": "nocturne",
    "description": "Для тех, кто всегда остаётся ещё на одну серию.",
    "introducedAt": "2026-11-25",
    "title": "☾ Ещё одну серию"
  },
  {
    "id": "name_moonstone",
    "label": "Ник «Лунный камень»",
    "cost": 60,
    "type": "name",
    "rarity": "rare",
    "collection": "nocturne",
    "description": "Холодный серебряно-голубой перелив букв.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "name-moonstone"
  },
  {
    "id": "shape_arch",
    "label": "Форма «Арка»",
    "cost": 25,
    "type": "shape",
    "rarity": "common",
    "collection": "nocturne",
    "description": "Закруглённый верх и ровное основание аватара.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "shape-arch"
  },
  {
    "id": "plate_window",
    "label": "Комментарий «Ночное окно»",
    "cost": 35,
    "type": "plate",
    "rarity": "common",
    "collection": "nocturne",
    "description": "Тонкая оконная сетка на тёмной плашке.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "plate-window"
  },
  {
    "id": "overlay_fireflies",
    "label": "Эффект «Светлячки»",
    "cost": 55,
    "type": "overlay",
    "rarity": "rare",
    "collection": "nocturne",
    "description": "Редкие тёплые огоньки поверх обложки.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "overlay-fireflies"
  },
  {
    "id": "icon_moonrise",
    "label": "Статус «Полумесяц»",
    "cost": 20,
    "type": "icon",
    "rarity": "common",
    "collection": "nocturne",
    "description": "Маленькая луна рядом с именем.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "icon-moonrise",
    "symbol": "☾"
  },
  {
    "id": "frame_ink",
    "label": "Рамка «Чернильный штрих»",
    "cost": 40,
    "type": "frame",
    "rarity": "rare",
    "collection": "manga",
    "description": "Асимметричные светлые штрихи вокруг аватара.",
    "introducedAt": "2026-11-25",
    "frameClass": "frame-ink"
  },
  {
    "id": "banner_panels",
    "label": "Обложка «Страница манги»",
    "cost": 40,
    "type": "banner",
    "rarity": "rare",
    "collection": "manga",
    "description": "Контрастные панели и диагональная штриховка.",
    "introducedAt": "2026-11-25",
    "bannerClass": "banner-panels"
  },
  {
    "id": "title_pagekeeper",
    "label": "Титул «Между страниц»",
    "cost": 15,
    "type": "title",
    "rarity": "common",
    "collection": "manga",
    "description": "История продолжается за пределами экрана.",
    "introducedAt": "2026-11-25",
    "title": "▤ Между страниц"
  },
  {
    "id": "name_inklight",
    "label": "Ник «Белая тушь»",
    "cost": 45,
    "type": "name",
    "rarity": "rare",
    "collection": "manga",
    "description": "Чёткие белые буквы с двойной графичной тенью.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "name-inklight"
  },
  {
    "id": "shape_stamp",
    "label": "Форма «Почтовая марка»",
    "cost": 30,
    "type": "shape",
    "rarity": "common",
    "collection": "manga",
    "description": "Ступенчатый край, как у коллекционной марки.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "shape-stamp"
  },
  {
    "id": "plate_speech",
    "label": "Комментарий «Реплика манги»",
    "cost": 30,
    "type": "plate",
    "rarity": "common",
    "collection": "manga",
    "description": "Светлый двойной контур и спокойная тёмная заливка.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "plate-speech"
  },
  {
    "id": "xp_panels",
    "label": "XP «Панели манги»",
    "cost": 35,
    "type": "xp",
    "rarity": "common",
    "collection": "manga",
    "description": "Контрастные сегменты на полоске прогресса.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "xp-panels"
  },
  {
    "id": "icon_inkpen",
    "label": "Статус «Перо»",
    "cost": 15,
    "type": "icon",
    "rarity": "common",
    "collection": "manga",
    "description": "Небольшой знак пера рядом с ником.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "icon-inkpen",
    "symbol": "✎"
  },
  {
    "id": "frame_scanline",
    "label": "Рамка «Аркадный контур»",
    "cost": 55,
    "type": "frame",
    "rarity": "rare",
    "collection": "arcade",
    "description": "Голубой и сиреневый ободки в духе аркад.",
    "introducedAt": "2026-11-25",
    "frameClass": "frame-scanline"
  },
  {
    "id": "banner_synthwave",
    "label": "Обложка «Неоновый горизонт»",
    "cost": 60,
    "type": "banner",
    "rarity": "epic",
    "collection": "arcade",
    "description": "Сиреневый закат и линии аркадной сетки.",
    "introducedAt": "2026-11-25",
    "bannerClass": "banner-synthwave"
  },
  {
    "id": "title_playerone",
    "label": "Титул «Первый игрок»",
    "cost": 20,
    "type": "title",
    "rarity": "common",
    "collection": "arcade",
    "description": "Твой следующий уровень — новая история.",
    "introducedAt": "2026-11-25",
    "title": "▸ Первый игрок"
  },
  {
    "id": "name_pixelbeam",
    "label": "Ник «Пиксельный луч»",
    "cost": 65,
    "type": "name",
    "rarity": "epic",
    "collection": "arcade",
    "description": "Светлый градиент от голубого к сиреневому.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "name-pixelbeam"
  },
  {
    "id": "shape_pixelcut",
    "label": "Форма «Пиксельный срез»",
    "cost": 35,
    "type": "shape",
    "rarity": "rare",
    "collection": "arcade",
    "description": "Крупные пиксельные ступени по углам аватара.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "shape-pixelcut"
  },
  {
    "id": "plate_terminal",
    "label": "Комментарий «Терминал»",
    "cost": 40,
    "type": "plate",
    "rarity": "rare",
    "collection": "arcade",
    "description": "Тонкие экранные строки и светлая боковая линия.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "plate-terminal"
  },
  {
    "id": "xp_combo",
    "label": "XP «Комбо»",
    "cost": 45,
    "type": "xp",
    "rarity": "rare",
    "collection": "arcade",
    "description": "Сегменты от голубого к фиолетовому. Меняет только вид.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "xp-combo"
  },
  {
    "id": "overlay_datastream",
    "label": "Эффект «Поток данных»",
    "cost": 60,
    "type": "overlay",
    "rarity": "epic",
    "collection": "arcade",
    "description": "Светлые вертикальные штрихи проходят по обложке.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "overlay-datastream"
  },
  {
    "id": "frame_constellation",
    "label": "Рамка «Созвездие»",
    "cost": 65,
    "type": "frame",
    "rarity": "epic",
    "collection": "celestial",
    "description": "Серебряный контур с точечной звёздной орбитой.",
    "introducedAt": "2026-11-25",
    "frameClass": "frame-constellation"
  },
  {
    "id": "banner_orbit",
    "label": "Обложка «Далёкая орбита»",
    "cost": 60,
    "type": "banner",
    "rarity": "epic",
    "collection": "celestial",
    "description": "Тёмная планета, светлая дуга и звёздная глубина.",
    "introducedAt": "2026-11-25",
    "bannerClass": "banner-orbit"
  },
  {
    "id": "title_stargazer",
    "label": "Титул «Ловец созвездий»",
    "cost": 25,
    "type": "title",
    "rarity": "rare",
    "collection": "celestial",
    "description": "Для любителей историй о далёких мирах.",
    "introducedAt": "2026-11-25",
    "title": "✧ Ловец созвездий"
  },
  {
    "id": "name_stardust",
    "label": "Ник «Звёздная пыль»",
    "cost": 70,
    "type": "name",
    "rarity": "epic",
    "collection": "celestial",
    "description": "Жемчужные буквы с мягким светлым сиянием.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "name-stardust"
  },
  {
    "id": "shape_comet",
    "label": "Форма «Комета»",
    "cost": 40,
    "type": "shape",
    "rarity": "rare",
    "collection": "celestial",
    "description": "Скошенный силуэт со светлым, стремительным характером.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "shape-comet"
  },
  {
    "id": "plate_constellation",
    "label": "Комментарий «Звёздная карта»",
    "cost": 45,
    "type": "plate",
    "rarity": "rare",
    "collection": "celestial",
    "description": "Редкие звёзды на тёмном поле комментария.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "plate-constellation"
  },
  {
    "id": "xp_constellation",
    "label": "XP «Звёздный маршрут»",
    "cost": 45,
    "type": "xp",
    "rarity": "rare",
    "collection": "celestial",
    "description": "Светлые точки соединены тонкой линией прогресса.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "xp-constellation"
  },
  {
    "id": "overlay_meteor",
    "label": "Эффект «Метеорный дождь»",
    "cost": 70,
    "type": "overlay",
    "rarity": "epic",
    "collection": "celestial",
    "description": "Тонкие диагональные следы пересекают обложку.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "overlay-meteor"
  },
  {
    "id": "frame_aperture",
    "label": "Рамка «Диафрагма»",
    "cost": 45,
    "type": "frame",
    "rarity": "rare",
    "collection": "cinema",
    "description": "Сегментированный ободок, вдохновлённый объективом.",
    "introducedAt": "2026-11-25",
    "frameClass": "frame-aperture"
  },
  {
    "id": "banner_silverscreen",
    "label": "Обложка «Серебряный экран»",
    "cost": 35,
    "type": "banner",
    "rarity": "common",
    "collection": "cinema",
    "description": "Мягкий свет киноэкрана на тёмной сцене.",
    "introducedAt": "2026-11-25",
    "bannerClass": "banner-silverscreen"
  },
  {
    "id": "title_lastrow",
    "label": "Титул «Последний ряд»",
    "cost": 10,
    "type": "title",
    "rarity": "common",
    "collection": "cinema",
    "description": "Уютное место для большого кино.",
    "introducedAt": "2026-11-25",
    "title": "▰ Последний ряд"
  },
  {
    "id": "frame_letterbox",
    "label": "Рамка «Широкий кадр»",
    "cost": 40,
    "type": "frame",
    "rarity": "rare",
    "collection": "cinema",
    "description": "Светлые горизонтальные штрихи вокруг круглого аватара.",
    "introducedAt": "2026-11-25",
    "frameClass": "frame-letterbox"
  },
  {
    "id": "banner_contactsheet",
    "label": "Обложка «Контактный лист»",
    "cost": 45,
    "type": "banner",
    "rarity": "rare",
    "collection": "cinema",
    "description": "Геометрия кадров и перфорация фотоплёнки.",
    "introducedAt": "2026-11-25",
    "bannerClass": "banner-contactsheet"
  },
  {
    "id": "title_director",
    "label": "Титул «Режиссёр вечера»",
    "cost": 25,
    "type": "title",
    "rarity": "rare",
    "collection": "cinema",
    "description": "Тот, кто выбирает, что мы смотрим сегодня.",
    "introducedAt": "2026-11-25",
    "title": "▣ Режиссёр вечера"
  },
  {
    "id": "xp_cue",
    "label": "XP «Монтажная дорожка»",
    "cost": 35,
    "type": "xp",
    "rarity": "common",
    "collection": "cinema",
    "description": "Светлая шкала с короткими монтажными метками.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "xp-cue"
  },
  {
    "id": "icon_clapper",
    "label": "Статус «Кинохлопушка»",
    "cost": 20,
    "type": "icon",
    "rarity": "common",
    "collection": "cinema",
    "description": "Небольшой кинознак у имени.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "icon-clapper",
    "symbol": "▰"
  },
  {
    "id": "frame_ivy",
    "label": "Рамка «Серебряный плющ»",
    "cost": 50,
    "type": "frame",
    "rarity": "rare",
    "collection": "botanical",
    "description": "Оливковый ободок с тонким пунктиром по краю.",
    "introducedAt": "2026-11-25",
    "frameClass": "frame-ivy"
  },
  {
    "id": "banner_botanical",
    "label": "Обложка «Тихий сад»",
    "cost": 50,
    "type": "banner",
    "rarity": "rare",
    "collection": "botanical",
    "description": "Мягкие силуэты листьев на тёмном зелёном фоне.",
    "introducedAt": "2026-11-25",
    "bannerClass": "banner-botanical"
  },
  {
    "id": "title_gardenkeeper",
    "label": "Титул «Хранитель сада»",
    "cost": 15,
    "type": "title",
    "rarity": "common",
    "collection": "botanical",
    "description": "Спокойный уголок среди любимых историй.",
    "introducedAt": "2026-11-25",
    "title": "❧ Хранитель сада"
  },
  {
    "id": "frame_dewdrop",
    "label": "Рамка «Утренняя роса»",
    "cost": 60,
    "type": "frame",
    "rarity": "epic",
    "collection": "botanical",
    "description": "Прозрачный голубой блик и двойной светлый контур.",
    "introducedAt": "2026-11-25",
    "frameClass": "frame-dewdrop"
  },
  {
    "id": "banner_petal",
    "label": "Обложка «Лепестки в сумерках»",
    "cost": 55,
    "type": "banner",
    "rarity": "rare",
    "collection": "botanical",
    "description": "Нежные лепестки на глубоком сливовом фоне.",
    "introducedAt": "2026-11-25",
    "bannerClass": "banner-petal"
  },
  {
    "id": "title_bloom",
    "label": "Титул «Время расцветать»",
    "cost": 20,
    "type": "title",
    "rarity": "common",
    "collection": "botanical",
    "description": "Для новой главы твоей коллекции.",
    "introducedAt": "2026-11-25",
    "title": "❀ Время расцветать"
  },
  {
    "id": "overlay_pollen",
    "label": "Эффект «Золотая пыльца»",
    "cost": 50,
    "type": "overlay",
    "rarity": "rare",
    "collection": "botanical",
    "description": "Мелкие золотистые частицы медленно проходят по обложке.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "overlay-pollen"
  },
  {
    "id": "icon_leaf",
    "label": "Статус «Листок»",
    "cost": 15,
    "type": "icon",
    "rarity": "common",
    "collection": "botanical",
    "description": "Миниатюрный лист рядом с ником.",
    "introducedAt": "2026-11-25",
    "cosmeticClass": "icon-leaf",
    "symbol": "❧"
  }
].map(Object.freeze));
const sets=Object.freeze([{"id":"eclipse","label":"Ночное затмение","items":["frame_eclipse","shape_octagon","title_nightmarathon"],"className":"komi-set-eclipse"},{"id":"film","label":"Кинолегенда","items":["frame_film35","plate_manga","title_critic"],"className":"komi-set-film"},{"id":"sakura","label":"Сад сакуры","items":["frame_sakura","shape_drop","mascot_spirit"],"className":"komi-set-sakura"}].map(Object.freeze));
const collections=Object.freeze([
  {
    "id": "station-0017",
    "label": "Станция 00:17",
    "description": "Свет последнего поезда, пустой перрон и город под дождём.",
    "items": [
      "banner_last_train",
      "banner_moon_platform",
      "frame_platform_light",
      "overlay_station_rain",
      "title_last_departure"
    ],
    "preview": [
      "frame_platform_light",
      "banner_last_train",
      "title_last_departure"
    ]
  },

  {
    "id": "nocturne",
    "label": "После полуночи",
    "description": "Лунный свет, ночные окна и ещё одна серия.",
    "items": [
      "frame_velvet",
      "banner_citylight",
      "title_midnight",
      "name_moonstone",
      "shape_arch",
      "plate_window",
      "overlay_fireflies",
      "icon_moonrise"
    ],
    "preview": [
      "frame_velvet",
      "banner_citylight",
      "title_midnight"
    ]
  },
  {
    "id": "manga",
    "label": "На полях манги",
    "description": "Чернильные штрихи и истории между страниц.",
    "items": [
      "frame_ink",
      "banner_panels",
      "title_pagekeeper",
      "name_inklight",
      "shape_stamp",
      "plate_speech",
      "xp_panels",
      "icon_inkpen"
    ],
    "preview": [
      "frame_ink",
      "banner_panels",
      "title_pagekeeper"
    ]
  },
  {
    "id": "arcade",
    "label": "Новая игра",
    "description": "Пиксели, неоновый горизонт и любимые аркады.",
    "items": [
      "frame_scanline",
      "banner_synthwave",
      "title_playerone",
      "name_pixelbeam",
      "shape_pixelcut",
      "plate_terminal",
      "xp_combo",
      "overlay_datastream"
    ],
    "preview": [
      "frame_scanline",
      "banner_synthwave",
      "title_playerone"
    ]
  },
  {
    "id": "celestial",
    "label": "За созвездиями",
    "description": "Орбиты, метеоры и холодный свет далёких звёзд.",
    "items": [
      "frame_constellation",
      "banner_orbit",
      "title_stargazer",
      "name_stardust",
      "shape_comet",
      "plate_constellation",
      "xp_constellation",
      "overlay_meteor"
    ],
    "preview": [
      "frame_constellation",
      "banner_orbit",
      "title_stargazer"
    ]
  },
  {
    "id": "cinema",
    "label": "Киноклуб",
    "description": "Тихий зал, монтажная плёнка и место в последнем ряду.",
    "items": [
      "frame_aperture",
      "banner_silverscreen",
      "title_lastrow",
      "frame_letterbox",
      "banner_contactsheet",
      "title_director",
      "xp_cue",
      "icon_clapper"
    ],
    "preview": [
      "frame_aperture",
      "banner_silverscreen",
      "title_lastrow"
    ]
  },
  {
    "id": "botanical",
    "label": "Тихий сад",
    "description": "Листья, лепестки и мягкий свет среди историй.",
    "items": [
      "frame_ivy",
      "banner_botanical",
      "title_gardenkeeper",
      "frame_dewdrop",
      "banner_petal",
      "title_bloom",
      "overlay_pollen",
      "icon_leaf"
    ],
    "preview": [
      "frame_ivy",
      "banner_botanical",
      "title_gardenkeeper"
    ]
  }
].map(collection=>Object.freeze({...collection,items:Object.freeze(collection.items),preview:Object.freeze(collection.preview)})));
const revision='20261126-living-profile';
const titleText=p=>String(p?.title||p?.label||'').replace(/^[✧✦◇✳⌁☾✶▣↗◈◆✎▰▤▸❧❀]+\s+/u,'');
// Hide from new discovery only. IDs and ownership continue to resolve.
const archived=new Set(['banner_grid','frame_pixel','xp_hatch','xp_dots']);
const isArchived=id=>archived.has(id);
const preview=()=>Boolean(root.location?.hostname&&root.location.hostname!=='komianime.online');
let pricingConfirmed=false,checking=null;
function checkPricing(client){
 if(preview()||!client?.rpc)return Promise.resolve(false);
 if(pricingConfirmed)return Promise.resolve(true);
 if(checking)return checking;
 checking=Promise.resolve().then(()=>client.rpc('komi_shop_living_revision')).then(result=>{
  pricingConfirmed=!result?.error&&result?.data===revision;
  return pricingConfirmed;
 },()=>{pricingConfirmed=false;return false;}).finally(()=>{checking=null;});
 return checking;
}
const livingProfileIds=new Set(["frame_ghoul_seal", "name_mangaka_ink", "xp_story_rhythm", "showcase_personal_cinema"]);
const isOnSale=id=>items.some(p=>p.id===id&&(p.type==='title'||livingProfileIds.has(id)))&&!isArchived(id);
const isGiftable=id=>isOnSale(id)&&items.find(p=>p.id===id)?.giftable!==false;
const canCheckout=()=>!preview()&&pricingConfirmed;
root.KomiShopCatalog=Object.freeze({items,sets,collections,revision,titleText,isArchived,isOnSale,isGiftable,isPreview:preview,checkPricing,canCheckout,find(id){return items.find(item=>item.id===id)||null;},rarityFor(id){return items.find(x=>x.id===id)?.rarity||'common';},activeSets(equip){return sets.filter(set=>set.items.every(id=>equip?.[id.split('_',1)[0]+'_id']===id));}});
})(window);
