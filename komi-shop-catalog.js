/* Shared AniCoin catalog: prices must also match the SQL server allowlist. */
(function(root){
'use strict';
const items=Object.freeze([
  {
    "id": "frame_moon",
    "label": "Лунная рамка",
    "cost": 30,
    "type": "frame",
    "frameClass": "frame-moon",
    "rarity": "common"
  },
  {
    "id": "frame_aurora",
    "label": "Рамка Аврора",
    "cost": 45,
    "type": "frame",
    "frameClass": "frame-aurora",
    "rarity": "common"
  },
  {
    "id": "frame_noir",
    "label": "Рамка Нуар",
    "cost": 35,
    "type": "frame",
    "frameClass": "frame-noir",
    "rarity": "common"
  },
  {
    "id": "frame_silver",
    "label": "Серебряный контур",
    "cost": 55,
    "type": "frame",
    "frameClass": "frame-silver",
    "rarity": "common"
  },
  {
    "id": "frame_frost",
    "label": "Ледяная рамка",
    "cost": 60,
    "type": "frame",
    "frameClass": "frame-frost",
    "rarity": "common"
  },
  {
    "id": "frame_neon",
    "label": "Неоновый пульс",
    "cost": 80,
    "type": "frame",
    "frameClass": "frame-neon",
    "rarity": "rare"
  },
  {
    "id": "frame_orbit",
    "label": "Орбита",
    "cost": 95,
    "type": "frame",
    "frameClass": "frame-orbit",
    "rarity": "rare"
  },
  {
    "id": "frame_eclipse",
    "label": "Затмение",
    "cost": 110,
    "type": "frame",
    "frameClass": "frame-eclipse",
    "rarity": "epic"
  },
  {
    "id": "frame_prism",
    "label": "Призма",
    "cost": 125,
    "type": "frame",
    "frameClass": "frame-prism",
    "rarity": "epic"
  },
  {
    "id": "frame_royal",
    "label": "Королевская рамка",
    "cost": 160,
    "type": "frame",
    "frameClass": "frame-royal",
    "rarity": "legendary"
  },
  {
    "id": "frame_pixel",
    "label": "Пиксельная рамка",
    "cost": 40,
    "type": "frame",
    "frameClass": "frame-pixel",
    "rarity": "common"
  },
  {
    "id": "frame_halo",
    "label": "Белый ореол",
    "cost": 140,
    "type": "frame",
    "frameClass": "frame-halo",
    "rarity": "epic"
  },
  {
    "id": "title_cinema",
    "label": "Титул «Киноман»",
    "cost": 20,
    "type": "title",
    "title": "✧ Киноман",
    "rarity": "common"
  },
  {
    "id": "title_starlight",
    "label": "Титул «Звёздный зритель»",
    "cost": 25,
    "type": "title",
    "title": "✦ Звёздный зритель",
    "rarity": "common"
  },
  {
    "id": "title_collector",
    "label": "Титул «Коллекционер»",
    "cost": 35,
    "type": "title",
    "title": "◇ Коллекционер",
    "rarity": "common"
  },
  {
    "id": "title_otaku",
    "label": "Титул «Отаку»",
    "cost": 40,
    "type": "title",
    "title": "✳ Отаку",
    "rarity": "common"
  },
  {
    "id": "title_explorer",
    "label": "Титул «Исследователь»",
    "cost": 50,
    "type": "title",
    "title": "⌁ Исследователь",
    "rarity": "common"
  },
  {
    "id": "title_nocturne",
    "label": "Титул «Ночной зритель»",
    "cost": 60,
    "type": "title",
    "title": "☾ Ночной зритель",
    "rarity": "common"
  },
  {
    "id": "title_legend",
    "label": "Титул «Легенда Komi»",
    "cost": 100,
    "type": "title",
    "title": "✶ Легенда Komi",
    "rarity": "rare"
  },
  {
    "id": "title_archivist",
    "label": "Титул «Архивариус»",
    "cost": 65,
    "type": "title",
    "title": "▣ Архивариус",
    "rarity": "rare"
  },
  {
    "id": "title_marathon",
    "label": "Титул «Марафонец»",
    "cost": 75,
    "type": "title",
    "title": "↗ Марафонец",
    "rarity": "rare"
  },
  {
    "id": "title_curator",
    "label": "Титул «Куратор»",
    "cost": 85,
    "type": "title",
    "title": "◈ Куратор",
    "rarity": "rare"
  },
  {
    "id": "title_cosmic",
    "label": "Титул «Космический»",
    "cost": 110,
    "type": "title",
    "title": "✧ Космический",
    "rarity": "epic"
  },
  {
    "id": "title_veteran",
    "label": "Титул «Ветеран Komi»",
    "cost": 140,
    "type": "title",
    "title": "◆ Ветеран Komi",
    "rarity": "epic"
  },
  {
    "id": "banner_noir",
    "label": "Обложка «Нуар»",
    "cost": 40,
    "type": "banner",
    "bannerClass": "banner-noir",
    "rarity": "common"
  },
  {
    "id": "banner_stars",
    "label": "Обложка «Звёзды»",
    "cost": 50,
    "type": "banner",
    "bannerClass": "banner-stars",
    "rarity": "common"
  },
  {
    "id": "banner_grid",
    "label": "Обложка «Сетка»",
    "cost": 55,
    "type": "banner",
    "bannerClass": "banner-grid",
    "rarity": "common"
  },
  {
    "id": "banner_moon",
    "label": "Обложка «Лунный свет»",
    "cost": 65,
    "type": "banner",
    "bannerClass": "banner-moon",
    "rarity": "rare"
  },
  {
    "id": "banner_aurora",
    "label": "Обложка «Аврора»",
    "cost": 80,
    "type": "banner",
    "bannerClass": "banner-aurora",
    "rarity": "rare"
  },
  {
    "id": "banner_frost",
    "label": "Обложка «Мороз»",
    "cost": 90,
    "type": "banner",
    "bannerClass": "banner-frost",
    "rarity": "rare"
  },
  {
    "id": "banner_glitch",
    "label": "Обложка «Глитч»",
    "cost": 100,
    "type": "banner",
    "bannerClass": "banner-glitch",
    "rarity": "rare"
  },
  {
    "id": "banner_eclipse",
    "label": "Обложка «Затмение»",
    "cost": 130,
    "type": "banner",
    "bannerClass": "banner-eclipse",
    "rarity": "epic"
  },
  {
    "id": "overlay_sakura",
    "label": "Лепестки сакуры",
    "cost": 65,
    "type": "overlay",
    "cosmeticClass": "overlay-sakura",
    "rarity": "rare"
  },
  {
    "id": "overlay_rain",
    "label": "Ночной дождь",
    "cost": 85,
    "type": "overlay",
    "cosmeticClass": "overlay-rain",
    "rarity": "rare"
  },
  {
    "id": "overlay_film",
    "label": "Плёночный шум",
    "cost": 45,
    "type": "overlay",
    "cosmeticClass": "overlay-film",
    "rarity": "common"
  },
  {
    "id": "overlay_sparks",
    "label": "Искры",
    "cost": 95,
    "type": "overlay",
    "cosmeticClass": "overlay-sparks",
    "rarity": "rare"
  },
  {
    "id": "overlay_snow",
    "label": "Лёгкий снег",
    "cost": 70,
    "type": "overlay",
    "cosmeticClass": "overlay-snow",
    "rarity": "rare"
  },
  {
    "id": "overlay_dust",
    "label": "Звёздная пыль",
    "cost": 120,
    "type": "overlay",
    "cosmeticClass": "overlay-dust",
    "rarity": "epic"
  },
  {
    "id": "showcase_film",
    "label": "Топ-3 «Киноплёнка»",
    "cost": 100,
    "type": "showcase",
    "cosmeticClass": "showcase-film",
    "rarity": "rare"
  },
  {
    "id": "showcase_gloss",
    "label": "Топ-3 «Глянец»",
    "cost": 115,
    "type": "showcase",
    "cosmeticClass": "showcase-gloss",
    "rarity": "epic"
  },
  {
    "id": "showcase_neon",
    "label": "Топ-3 «Неон»",
    "cost": 150,
    "type": "showcase",
    "cosmeticClass": "showcase-neon",
    "rarity": "legendary"
  },
  {
    "id": "card_graphite",
    "label": "Карточка «Графит»",
    "cost": 80,
    "type": "card",
    "cosmeticClass": "card-graphite",
    "rarity": "rare"
  },
  {
    "id": "card_frost",
    "label": "Карточка «Матовый лёд»",
    "cost": 110,
    "type": "card",
    "cosmeticClass": "card-frost",
    "rarity": "epic"
  },
  {
    "id": "card_aurora",
    "label": "Карточка «Аврора»",
    "cost": 130,
    "type": "card",
    "cosmeticClass": "card-aurora",
    "rarity": "epic"
  },
  {
    "id": "card_glass",
    "label": "Карточка «Стекло»",
    "cost": 140,
    "type": "card",
    "cosmeticClass": "card-glass",
    "rarity": "epic"
  },
  {
    "id": "icon_headphones",
    "label": "Статус «Наушники»",
    "cost": 35,
    "type": "icon",
    "cosmeticClass": "icon-headphones",
    "symbol": "♫",
    "rarity": "common"
  },
  {
    "id": "icon_ramen",
    "label": "Статус «Рамен»",
    "cost": 40,
    "type": "icon",
    "cosmeticClass": "icon-ramen",
    "symbol": "♨",
    "rarity": "common"
  },
  {
    "id": "icon_cassette",
    "label": "Статус «Кассета»",
    "cost": 50,
    "type": "icon",
    "cosmeticClass": "icon-cassette",
    "symbol": "▣",
    "rarity": "common"
  },
  {
    "id": "icon_crown",
    "label": "Статус «Корона»",
    "cost": 125,
    "type": "icon",
    "cosmeticClass": "icon-crown",
    "symbol": "♛",
    "rarity": "epic"
  },
  {
    "id": "icon_katana",
    "label": "Статус «Катана»",
    "cost": 95,
    "type": "icon",
    "cosmeticClass": "icon-katana",
    "symbol": "⚔",
    "rarity": "rare"
  },
  {
    "id": "icon_comet",
    "label": "Статус «Комета»",
    "cost": 75,
    "type": "icon",
    "cosmeticClass": "icon-comet",
    "symbol": "✶",
    "rarity": "rare"
  },
  {
    "id": "reaction_hype",
    "label": "Реакции «Хайп»",
    "cost": 70,
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
    "cost": 60,
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
    "cost": 85,
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
    "cost": 95,
    "type": "frame",
    "frameClass": "frame-sumi",
    "rarity": "rare"
  },
  {
    "id": "frame_film35",
    "label": "Киноплёнка 35mm",
    "cost": 90,
    "type": "frame",
    "frameClass": "frame-film35",
    "rarity": "rare"
  },
  {
    "id": "frame_glitch",
    "label": "Глитч / Помехи",
    "cost": 115,
    "type": "frame",
    "frameClass": "frame-glitch",
    "rarity": "epic"
  },
  {
    "id": "frame_glass",
    "label": "Стеклянная призма",
    "cost": 130,
    "type": "frame",
    "frameClass": "frame-glass",
    "rarity": "epic"
  },
  {
    "id": "frame_sakura",
    "label": "Сакура в движении",
    "cost": 140,
    "type": "frame",
    "frameClass": "frame-sakura",
    "rarity": "legendary"
  },
  {
    "id": "frame_slash",
    "label": "Диагональный блик",
    "cost": 105,
    "type": "frame",
    "frameClass": "frame-slash",
    "rarity": "rare"
  },
  {
    "id": "frame_shogun",
    "label": "Венец сёгуна",
    "cost": 200,
    "type": "frame",
    "frameClass": "frame-shogun",
    "rarity": "legendary"
  },
  {
    "id": "shape_cyber",
    "label": "Кибер-срез",
    "cost": 60,
    "type": "shape",
    "cosmeticClass": "shape-cyber",
    "rarity": "common"
  },
  {
    "id": "shape_octagon",
    "label": "Октагон",
    "cost": 70,
    "type": "shape",
    "cosmeticClass": "shape-octagon",
    "rarity": "rare"
  },
  {
    "id": "shape_diamond",
    "label": "Ромб",
    "cost": 75,
    "type": "shape",
    "cosmeticClass": "shape-diamond",
    "rarity": "rare"
  },
  {
    "id": "shape_drop",
    "label": "Капля",
    "cost": 80,
    "type": "shape",
    "cosmeticClass": "shape-drop",
    "rarity": "rare"
  },
  {
    "id": "plate_manga",
    "label": "Скринтон манги",
    "cost": 65,
    "type": "plate",
    "cosmeticClass": "plate-manga",
    "rarity": "rare"
  },
  {
    "id": "plate_seigaiha",
    "label": "Японские волны",
    "cost": 90,
    "type": "plate",
    "cosmeticClass": "plate-seigaiha",
    "rarity": "rare"
  },
  {
    "id": "plate_rain",
    "label": "Ночной дождь",
    "cost": 75,
    "type": "plate",
    "cosmeticClass": "plate-rain",
    "rarity": "rare"
  },
  {
    "id": "plate_gradient",
    "label": "Градиентный контур",
    "cost": 120,
    "type": "plate",
    "cosmeticClass": "plate-gradient",
    "rarity": "epic"
  },
  {
    "id": "mascot_cat",
    "label": "Компаньон «Кот»",
    "cost": 95,
    "type": "mascot",
    "cosmeticClass": "mascot-cat",
    "symbol": "♠",
    "rarity": "rare"
  },
  {
    "id": "mascot_lantern",
    "label": "Компаньон «Фонарик»",
    "cost": 110,
    "type": "mascot",
    "cosmeticClass": "mascot-lantern",
    "symbol": "◇",
    "rarity": "epic"
  },
  {
    "id": "mascot_spirit",
    "label": "Компаньон «Дух»",
    "cost": 140,
    "type": "mascot",
    "cosmeticClass": "mascot-spirit",
    "symbol": "✦",
    "rarity": "epic"
  },
  {
    "id": "xp_silver",
    "label": "XP «Жидкое серебро»",
    "cost": 90,
    "type": "xp",
    "cosmeticClass": "xp-silver",
    "rarity": "rare"
  },
  {
    "id": "xp_hatch",
    "label": "XP «Штриховка»",
    "cost": 55,
    "type": "xp",
    "cosmeticClass": "xp-hatch",
    "rarity": "common"
  },
  {
    "id": "xp_beam",
    "label": "XP «Световой луч»",
    "cost": 120,
    "type": "xp",
    "cosmeticClass": "xp-beam",
    "rarity": "epic"
  },
  {
    "id": "xp_dots",
    "label": "XP «Пунктир»",
    "cost": 60,
    "type": "xp",
    "cosmeticClass": "xp-dots",
    "rarity": "common"
  },
  {
    "id": "name_silver",
    "label": "Ник «Жидкое серебро»",
    "cost": 120,
    "type": "name",
    "cosmeticClass": "name-silver",
    "rarity": "epic"
  },
  {
    "id": "name_ghost",
    "label": "Ник «Призрачный»",
    "cost": 100,
    "type": "name",
    "cosmeticClass": "name-ghost",
    "rarity": "rare"
  },
  {
    "id": "name_dawn",
    "label": "Ник «Алый рассвет»",
    "cost": 145,
    "type": "name",
    "cosmeticClass": "name-dawn",
    "rarity": "epic"
  },
  {
    "id": "name_chrome",
    "label": "Ник «Хром»",
    "cost": 155,
    "type": "name",
    "cosmeticClass": "name-chrome",
    "rarity": "legendary"
  },
  {
    "id": "title_ongoing",
    "label": "Титул «Охотник за онгоингами»",
    "cost": 70,
    "type": "title",
    "title": "⌁ Охотник за онгоингами",
    "rarity": "rare"
  },
  {
    "id": "title_nightmarathon",
    "label": "Титул «Ночной марафонец»",
    "cost": 80,
    "type": "title",
    "title": "☾ Ночной марафонец",
    "rarity": "rare"
  },
  {
    "id": "title_critic",
    "label": "Титул «Критик 80-го уровня»",
    "cost": 95,
    "type": "title",
    "title": "✎ Критик 80-го уровня",
    "rarity": "rare"
  },
  {
    "id": "title_spoiler",
    "label": "Титул «Хранитель спойлеров»",
    "cost": 100,
    "type": "title",
    "title": "◈ Хранитель спойлеров",
    "rarity": "rare"
  },
  {
    "id": "title_pioneer",
    "label": "Титул «Первопроходец Komi»",
    "cost": 150,
    "type": "title",
    "title": "✦ Первопроходец Komi",
    "rarity": "legendary"
  }
].map(Object.freeze));
const sets=Object.freeze([{"id":"eclipse","label":"Ночное затмение","items":["frame_eclipse","shape_octagon","title_nightmarathon"],"className":"komi-set-eclipse"},{"id":"film","label":"Кинолегенда","items":["frame_film35","plate_manga","title_critic"],"className":"komi-set-film"},{"id":"sakura","label":"Сад сакуры","items":["frame_sakura","shape_drop","mascot_spirit"],"className":"komi-set-sakura"}].map(Object.freeze));
root.KomiShopCatalog=Object.freeze({items,sets,find(id){return items.find(item=>item.id===id)||null;},rarityFor(id){return items.find(x=>x.id===id)?.rarity||'common';},activeSets(equip){return sets.filter(set=>set.items.every(id=>equip?.[id.split('_',1)[0]+'_id']===id));}});
})(window);
