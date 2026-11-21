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
  }
].map(Object.freeze));
root.KomiShopCatalog=Object.freeze({items,find(id){return items.find(item=>item.id===id)||null;}});
})(window);
