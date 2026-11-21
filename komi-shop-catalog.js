/* Shared AniCoin catalog: prices must also match the SQL server allowlist. */
(function(root){
'use strict';
const items=Object.freeze([
  {
    "id": "frame_moon",
    "label": "Лунная рамка",
    "cost": 30,
    "type": "frame",
    "frameClass": "frame-moon"
  },
  {
    "id": "frame_aurora",
    "label": "Рамка Аврора",
    "cost": 45,
    "type": "frame",
    "frameClass": "frame-aurora"
  },
  {
    "id": "frame_noir",
    "label": "Рамка Нуар",
    "cost": 35,
    "type": "frame",
    "frameClass": "frame-noir"
  },
  {
    "id": "frame_silver",
    "label": "Серебряный контур",
    "cost": 55,
    "type": "frame",
    "frameClass": "frame-silver"
  },
  {
    "id": "frame_frost",
    "label": "Ледяная рамка",
    "cost": 60,
    "type": "frame",
    "frameClass": "frame-frost"
  },
  {
    "id": "frame_neon",
    "label": "Неоновый пульс",
    "cost": 80,
    "type": "frame",
    "frameClass": "frame-neon"
  },
  {
    "id": "frame_orbit",
    "label": "Орбита",
    "cost": 95,
    "type": "frame",
    "frameClass": "frame-orbit"
  },
  {
    "id": "frame_eclipse",
    "label": "Затмение",
    "cost": 110,
    "type": "frame",
    "frameClass": "frame-eclipse"
  },
  {
    "id": "frame_prism",
    "label": "Призма",
    "cost": 125,
    "type": "frame",
    "frameClass": "frame-prism"
  },
  {
    "id": "frame_royal",
    "label": "Королевская рамка",
    "cost": 160,
    "type": "frame",
    "frameClass": "frame-royal"
  },
  {
    "id": "frame_pixel",
    "label": "Пиксельная рамка",
    "cost": 40,
    "type": "frame",
    "frameClass": "frame-pixel"
  },
  {
    "id": "frame_halo",
    "label": "Белый ореол",
    "cost": 140,
    "type": "frame",
    "frameClass": "frame-halo"
  },
  {
    "id": "title_cinema",
    "label": "Титул «Киноман»",
    "cost": 20,
    "type": "title",
    "title": "✧ Киноман"
  },
  {
    "id": "title_starlight",
    "label": "Титул «Звёздный зритель»",
    "cost": 25,
    "type": "title",
    "title": "✦ Звёздный зритель"
  },
  {
    "id": "title_collector",
    "label": "Титул «Коллекционер»",
    "cost": 35,
    "type": "title",
    "title": "◇ Коллекционер"
  },
  {
    "id": "title_otaku",
    "label": "Титул «Отаку»",
    "cost": 40,
    "type": "title",
    "title": "✳ Отаку"
  },
  {
    "id": "title_explorer",
    "label": "Титул «Исследователь»",
    "cost": 50,
    "type": "title",
    "title": "⌁ Исследователь"
  },
  {
    "id": "title_nocturne",
    "label": "Титул «Ночной зритель»",
    "cost": 60,
    "type": "title",
    "title": "☾ Ночной зритель"
  },
  {
    "id": "title_legend",
    "label": "Титул «Легенда Komi»",
    "cost": 100,
    "type": "title",
    "title": "✶ Легенда Komi"
  },
  {
    "id": "title_archivist",
    "label": "Титул «Архивариус»",
    "cost": 65,
    "type": "title",
    "title": "▣ Архивариус"
  },
  {
    "id": "title_marathon",
    "label": "Титул «Марафонец»",
    "cost": 75,
    "type": "title",
    "title": "↗ Марафонец"
  },
  {
    "id": "title_curator",
    "label": "Титул «Куратор»",
    "cost": 85,
    "type": "title",
    "title": "◈ Куратор"
  },
  {
    "id": "title_cosmic",
    "label": "Титул «Космический»",
    "cost": 110,
    "type": "title",
    "title": "✧ Космический"
  },
  {
    "id": "title_veteran",
    "label": "Титул «Ветеран Komi»",
    "cost": 140,
    "type": "title",
    "title": "◆ Ветеран Komi"
  },
  {
    "id": "banner_noir",
    "label": "Обложка «Нуар»",
    "cost": 40,
    "type": "banner",
    "bannerClass": "banner-noir"
  },
  {
    "id": "banner_stars",
    "label": "Обложка «Звёзды»",
    "cost": 50,
    "type": "banner",
    "bannerClass": "banner-stars"
  },
  {
    "id": "banner_grid",
    "label": "Обложка «Сетка»",
    "cost": 55,
    "type": "banner",
    "bannerClass": "banner-grid"
  },
  {
    "id": "banner_moon",
    "label": "Обложка «Лунный свет»",
    "cost": 65,
    "type": "banner",
    "bannerClass": "banner-moon"
  },
  {
    "id": "banner_aurora",
    "label": "Обложка «Аврора»",
    "cost": 80,
    "type": "banner",
    "bannerClass": "banner-aurora"
  },
  {
    "id": "banner_frost",
    "label": "Обложка «Мороз»",
    "cost": 90,
    "type": "banner",
    "bannerClass": "banner-frost"
  },
  {
    "id": "banner_glitch",
    "label": "Обложка «Глитч»",
    "cost": 100,
    "type": "banner",
    "bannerClass": "banner-glitch"
  },
  {
    "id": "banner_eclipse",
    "label": "Обложка «Затмение»",
    "cost": 130,
    "type": "banner",
    "bannerClass": "banner-eclipse"
  },
  {
    "id": "overlay_sakura",
    "label": "Лепестки сакуры",
    "cost": 65,
    "type": "overlay",
    "cosmeticClass": "overlay-sakura"
  },
  {
    "id": "overlay_rain",
    "label": "Ночной дождь",
    "cost": 85,
    "type": "overlay",
    "cosmeticClass": "overlay-rain"
  },
  {
    "id": "overlay_film",
    "label": "Плёночный шум",
    "cost": 45,
    "type": "overlay",
    "cosmeticClass": "overlay-film"
  },
  {
    "id": "overlay_sparks",
    "label": "Искры",
    "cost": 95,
    "type": "overlay",
    "cosmeticClass": "overlay-sparks"
  },
  {
    "id": "overlay_snow",
    "label": "Лёгкий снег",
    "cost": 70,
    "type": "overlay",
    "cosmeticClass": "overlay-snow"
  },
  {
    "id": "overlay_dust",
    "label": "Звёздная пыль",
    "cost": 120,
    "type": "overlay",
    "cosmeticClass": "overlay-dust"
  },
  {
    "id": "showcase_film",
    "label": "Топ-3 «Киноплёнка»",
    "cost": 100,
    "type": "showcase",
    "cosmeticClass": "showcase-film"
  },
  {
    "id": "showcase_gloss",
    "label": "Топ-3 «Глянец»",
    "cost": 115,
    "type": "showcase",
    "cosmeticClass": "showcase-gloss"
  },
  {
    "id": "showcase_neon",
    "label": "Топ-3 «Неон»",
    "cost": 150,
    "type": "showcase",
    "cosmeticClass": "showcase-neon"
  },
  {
    "id": "card_graphite",
    "label": "Карточка «Графит»",
    "cost": 80,
    "type": "card",
    "cosmeticClass": "card-graphite"
  },
  {
    "id": "card_frost",
    "label": "Карточка «Матовый лёд»",
    "cost": 110,
    "type": "card",
    "cosmeticClass": "card-frost"
  },
  {
    "id": "card_aurora",
    "label": "Карточка «Аврора»",
    "cost": 130,
    "type": "card",
    "cosmeticClass": "card-aurora"
  },
  {
    "id": "card_glass",
    "label": "Карточка «Стекло»",
    "cost": 140,
    "type": "card",
    "cosmeticClass": "card-glass"
  },
  {
    "id": "icon_headphones",
    "label": "Статус «Наушники»",
    "cost": 35,
    "type": "icon",
    "cosmeticClass": "icon-headphones",
    "symbol": "♫"
  },
  {
    "id": "icon_ramen",
    "label": "Статус «Рамен»",
    "cost": 40,
    "type": "icon",
    "cosmeticClass": "icon-ramen",
    "symbol": "♨"
  },
  {
    "id": "icon_cassette",
    "label": "Статус «Кассета»",
    "cost": 50,
    "type": "icon",
    "cosmeticClass": "icon-cassette",
    "symbol": "▣"
  },
  {
    "id": "icon_crown",
    "label": "Статус «Корона»",
    "cost": 125,
    "type": "icon",
    "cosmeticClass": "icon-crown",
    "symbol": "♛"
  },
  {
    "id": "icon_katana",
    "label": "Статус «Катана»",
    "cost": 95,
    "type": "icon",
    "cosmeticClass": "icon-katana",
    "symbol": "⚔"
  },
  {
    "id": "icon_comet",
    "label": "Статус «Комета»",
    "cost": 75,
    "type": "icon",
    "cosmeticClass": "icon-comet",
    "symbol": "✶"
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
    ]
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
    ]
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
    ]
  }
].map(Object.freeze));
root.KomiShopCatalog=Object.freeze({items,find(id){return items.find(item=>item.id===id)||null;}});
})(window);
