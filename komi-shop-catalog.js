/* Shared AniCoin catalog. Target prices and revision mirror the checked-in shop migration. */
(function(root){
'use strict';
const items=Object.freeze([
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
    "label": "Ночной дождь",
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
    "label": "Ночной дождь",
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
  }
].map(Object.freeze));
const sets=Object.freeze([{"id":"eclipse","label":"Ночное затмение","items":["frame_eclipse","shape_octagon","title_nightmarathon"],"className":"komi-set-eclipse"},{"id":"film","label":"Кинолегенда","items":["frame_film35","plate_manga","title_critic"],"className":"komi-set-film"},{"id":"sakura","label":"Сад сакуры","items":["frame_sakura","shape_drop","mascot_spirit"],"className":"komi-set-sakura"}].map(Object.freeze));
const revision='20261125-shop-v6';
const preview=()=>Boolean(root.location?.hostname&&root.location.hostname!=='komianime.online');
let pricingConfirmed=false,checking=null;
function checkPricing(client){
 if(preview()||!client?.rpc)return Promise.resolve(false);
 if(pricingConfirmed)return Promise.resolve(true);
 if(checking)return checking;
 checking=Promise.resolve().then(()=>client.rpc('komi_shop_catalog_revision')).then(result=>{
  pricingConfirmed=!result?.error&&result?.data===revision;
  return pricingConfirmed;
 },()=>{pricingConfirmed=false;return false;}).finally(()=>{checking=null;});
 return checking;
}
const canCheckout=()=>!preview()&&pricingConfirmed;
root.KomiShopCatalog=Object.freeze({items,sets,revision,isPreview:preview,checkPricing,canCheckout,find(id){return items.find(item=>item.id===id)||null;},rarityFor(id){return items.find(x=>x.id===id)?.rarity||'common';},activeSets(equip){return sets.filter(set=>set.items.every(id=>equip?.[id.split('_',1)[0]+'_id']===id));}});
})(window);
