/* KomiAnime collection: catalog is public; ownership and paid openings are server-authoritative. */
(function(root){
'use strict';
const rarityById=Object.freeze({kaneki:'legendary',eto:'legendary',arima:'legendary',touka:'epic',juuzou:'epic',rize:'epic',furuta:'epic',uta:'rare',tsukiyama:'rare',ayato:'rare',yoshimura:'rare',takizawa:'rare',mado:'rare',irimi:'rare',hide:'common',hinami:'common',amon:'common',nishiki:'common',yomo:'common',akira:'common'});
const rarityNames=Object.freeze({common:'Обычный',rare:'Редкий',epic:'Эпический',legendary:'Легендарный'});
const rarityRank=Object.freeze({legendary:0,epic:1,rare:2,common:3});
// Sort display copies only: catalog serials and server rewards remain unchanged.
const byRarity=items=>[...items].sort((a,b)=>rarityRank[a.rarity]-rarityRank[b.rarity]);
const ghoulRoster=[["kaneki","Кэн Канэки","Ken Kaneki"],["touka","Тока Кирисима","Touka Kirishima"],["juuzou","Дзюдзо Судзуя","Juuzou Suzuya"],["uta","Ута","Uta"],["tsukiyama","Сю Цукияма","Shuu Tsukiyama"],["hide","Хидэёси Нагатика","Hideyoshi Nagachika"],["rize","Ридзэ Камисиро","Rize Kamishiro"],["arima","Кисё Арима","Kishou Arima"],["eto","Это Ёсимура","Eto Yoshimura"],["ayato","Аято Кирисима","Ayato Kirishima"],["hinami","Хинами Фуэгути","Hinami Fueguchi"],["amon","Котаро Амон","Koutarou Amon"],["nishiki","Нисики Нисио","Nishiki Nishio"],["yomo","Рэндзи Ёмо","Renji Yomo"],["yoshimura","Ёсимура","Kuzen Yoshimura"],["akira","Акира Мадо","Akira Mado"],["furuta","Нимура Фурута","Nimura Furuta"],["takizawa","Сэйдо Такидзава","Seidou Takizawa"],["mado","Курэо Мадо","Kureo Mado"],["irimi","Кая Ирими","Kaya Irimi"]].map(([id,name,query])=>Object.freeze({id,name,query,rarity:rarityById[id]}));
const seriesList=Object.freeze({
 ghoul:{title:'Токийский гуль',pack:'Токийский гуль',edition:'01',code:'TG',script:'東京喰種',album:'Альбом 01',dossier:'Досье CCG',world:'Ночной Токио',roster:ghoulRoster},
 jujutsu:{title:'Магическая битва',pack:'Печати проклятий',edition:'02',code:'JK',script:'呪術廻戦',album:'Альбом печатей',dossier:'Архив печатей',world:'Токийская школа магии',rows:[
  ['itadori','Юдзи Итадори','rare','Токийская школа магии','Искренний и атлетичный ученик. В опасной ситуации прежде всего думает о тех, кто рядом.','Удар','spark','#f14568'],
  ['fushiguro','Мэгуми Фусигуро','epic','Токийская школа магии','Сдержанный ученик, призывающий сикигами с помощью теней.','Десять теней','claw','#9e9aec'],
  ['kugisaki','Нобара Кугисаки','rare','Токийская школа магии','Уверенная в себе колдунья. В её технике важны молоток, гвозди и соломенная кукла.','Резонанс','streak','#fab16c'],
  ['gojo','Сатору Годзё','legendary','Токийская школа магии','Учитель, который не теряет чувства юмора даже перед сильнейшими противниками.','Бесконечность','ring','#9deaff'],
  ['sukuna','Рёмэн Сукуна','legendary','Проклятия','Древний Король проклятий. В его присутствии даже тишина становится угрозой.','След печати','claw','#f2474c'],
  ["maki","Маки Дзэнин","epic","Токийская школа магии","Уверенно обращается с проклятыми инструментами. Не любит, когда способности оценивают по фамилии.","Зелёная дуга","claw","#91dcab"],
  ["toge","Тогэ Инумаки","rare","Токийская школа магии","Осторожно выбирает слова. В обычном разговоре прячется за названиями начинок для онигири.","Эхо слова","ring","#b3b6ff"],
  ["panda","Панда","rare","Токийская школа магии","Энергичный и заботливый однокурсник, который разбирается в чужих чувствах лучше, чем кажется.","Отпечаток лапы","spark","#e5cbb5"],
  ["nanami","Кэнто Нанами","epic","Маги","Методичный колдун, для которого работа должна заканчиваться вовремя.","Соотношение 7:3","streak","#e9b87b"],
  ["yuta","Юта Оккоцу","legendary","Токийская школа магии","Вежливый и нерешительный на первый взгляд, но стойкий, когда на кону безопасность друзей.","Тихий обет","orbit","#a9d3f6"],
  ["shoko","Сёко Иэири","rare","Токийская школа магии","Врач школы, которая лечит ранения обратной проклятой техникой.","Обратная техника","ring","#a7d9c7"],
  ["geto","Сугуру Гэто","legendary","Колдуны","Маг с техникой управления проклятыми духами.","Сфера духа","orbit","#9d85e1"],
  ["toji","Тодзи Фусигуро","legendary","Вольные бойцы","Наёмник, который полагается на скорость и острое чутьё.","Разрыв контура","streak","#83b6a2"],
  ["choso","Тёсо","epic","Утробные картины","Владеет манипуляцией кровью; сильнее всего дорожит братьями.","Багровая нить","claw","#ef6688"],
  ["mahito","Махито","epic","Проклятия","Проклятие, одержимое формой человеческой души.","Контур души","orbit","#8ca3ff"],
  ["todo","Аой Тодо","rare","Киотская школа магии","Прямолинейный ученик с необычной техникой смены позиций.","Хлопок","spark","#deb47a"],
  ["meimei","Мэй Мэй","rare","Маги","Независимая волшебница, использующая в бою ворон.","Перо ворона","claw","#cae3eb"],
  ["utahime","Утахимэ Иори","rare","Киотская школа магии","Преподавательница, которая заботится о своих учениках.","Ритуальный круг","seal","#e6a1b6"],
  ["miwa","Касуми Мива","common","Киотская школа магии","Серьёзная ученица, тренирующаяся обращаться с мечом.","Синяя черта","streak","#8ccdff"],
  ["kusakabe","Ацуя Кусакабэ","rare","Токийская школа магии","Опытный преподаватель и мастер простого домена.","Граница домена","seal","#d6cca7"]
 ]},
 frieren:{title:'Фрирен',pack:'Дневник пути',edition:'03',code:'FR',script:'葬送のフリーレン',album:'Альбом путника',dossier:'Запись путника',world:'Дорога на север',rows:[
  ['frieren','Фрирен','legendary','Маги','Эльфийка, для которой десятилетие может пролететь за миг. Собирает необычные заклинания.','Малое чудо','orbit','#d8b865'],
  ['fern','Ферн','epic','Маги','Собранная ученица Фрирен, способная заметить то, что её наставница не сочтёт важным.','Звезда посоха','spark','#c6a1fd'],
  ['stark','Штарк','rare','Воины','Ученик Айзена. Даже когда ему страшно, он старается не подвести тех, кто на него рассчитывает.','Взмах топора','claw','#ef865b'],
  ['himmel','Химмель','legendary','Отряд героя','Герой старого похода. Его маленькие добрые поступки запоминаются не хуже больших побед.','Цветы памяти','orbit','#a6d8fe'],
  ['heiter','Хайтер','common','Отряд героя','Жрец старого отряда. За лёгкой манерой говорить скрывается внимательность к людям.','Тёплый свет','ring','#afd08c'],
  ["eisen","Айзен","epic","Отряд героя","Немногословный дворф и опытный воин. Его выдержка не мешает ему признавать страх.","Каменный отзвук","ring","#bcc0aa"],
  ["flamme","Фламме","legendary","Маги","Наставница, которая учит смотреть на магию шире привычных правил.","Поле цветов","orbit","#e6ac82"],
  ["serie","Зериэ","legendary","Маги","Эльфийская волшебница, для которой знания важнее званий.","Круг гримуара","seal","#f4df8d"],
  ["denken","Денкен","epic","Маги","Опытный имперский маг. В трудной ситуации рассчитывает и на заклинания, и на здравый смысл.","Порыв ветра","claw","#b0dbcd"],
  ["ubel","Юбель","epic","Маги","Наблюдательная и непредсказуемая волшебница. Полагается на интуицию.","Тонкий разрез","streak","#7cd7a0"],
  ["lawine","Лавине","rare","Экзамен магов","Волшебница, работающая со льдом. Часто спорит с Каннэ.","Ледяная грань","seal","#96d8ef"],
  ["kanne","Каннэ","rare","Экзамен магов","Волшебница воды. Лучше всего раскрывается, когда рядом есть источник.","Дождевая дуга","orbit","#87c1ed"],
  ["land","Ланд","epic","Экзамен магов","Спокойный маг, которому удобно действовать через двойников.","Двойной след","ring","#beabec"],
  ["methode","Методэ","epic","Экзамен магов","Внимательная волшебница, умеющая анализировать чары и лечить.","Свет маны","spark","#f2d7a6"],
  ["wirbel","Вирбель","epic","Северные земли","Маг, привыкший быстро оценивать противника и ситуацию.","Узел заклинания","seal","#c5d6e5"],
  ["ehre","Эрэ","rare","Экзамен магов","Коллега Вирбеля. Использует простые заклинания с большой точностью.","Каменная искра","spark","#dabd9b"],
  ["scharf","Шарф","common","Экзамен магов","Участник экзамена, превращающий лепестки в острые снаряды.","Рой лепестков","claw","#d88daa"],
  ["laufen","Лауфен","rare","Экзамен магов","Подвижная волшебница, неожиданно быстро сокращающая расстояние.","Быстрый шаг","streak","#edba84"],
  ["richter","Рихтер","rare","Экзамен магов","Маг земли и владелец лавки. Предпочитает надёжные решения.","Каменный пласт","seal","#c0a381"],
  ["lernen","Лернен","epic","Ассоциация магов","Опытный маг и ученик Зериэ. Изучает устройство големов.","Контур голема","ring","#a4c7a7"]
 ]},
 alchemist:{title:'Стальной алхимик',pack:'Архив Аместриса',edition:'04',code:'FA',script:'鋼の錬金術師',album:'Альбом Аместриса',dossier:'Личное дело',world:'Аместрис',rows:[
  ['edward','Эдвард Элрик','legendary','Государственные алхимики','Молодой алхимик, упрямый даже перед старшими по званию. Путешествует вместе с братом.','Круг трансмутации','seal','#ffc977'],
  ['alphonse','Альфонс Элрик','epic','Братья Элрики','Спокойный и заботливый брат Эдварда. Его доспехи скрывают очень мягкий характер.','Отзвук брони','ring','#b6cfef'],
  ['winry','Уинри Рокбелл','rare','Механики','Мастер автомейла, близкая подруга братьев. Механизмы для неё такой же язык, как для них алхимия.','Чертёж автомейла','orbit','#a7dce9'],
  ['roy','Рой Мустанг','legendary','Армия Аместриса','Офицер и государственный алхимик. Известен не только пламенем, но и умением вести людей.','Огненная искра','spark','#ff875a'],
  ['riza','Риза Хоукай','epic','Армия Аместриса','Дисциплинированная офицерка, которой доверяют за выдержку и точность.','Линия прицела','streak','#ecd3a0'],
  ["alex","Алекс Луи Армстронг","epic","Государственные алхимики","Громогласный и добросердечный офицер. Он гордится семейной школой алхимии.","Каменные грани","seal","#e3a882"],
  ["maes","Маэс Хьюз","rare","Армия Аместриса","Наблюдательный офицер. С удовольствием рассказывает коллегам о своей семье.","Лист из дела","streak","#bad5ef"],
  ["scar","Шрам","legendary","Ишвар","Молчаливый странник. Заметнее всего его шрам и узор на правой руке.","Трещина на камне","claw","#db9d83"],
  ["olivier","Оливия Мира Армстронг","legendary","Бриггс","Командир северной крепости, требовательная к себе и тем, кто ей подчиняется.","Северный иней","ring","#a0ddf5"],
  ["lanfan","Лан Фан","epic","Син","Преданная телохранительница, привыкшая наблюдать прежде, чем действовать.","Тень маски","eye","#d7a9bd"],
  ["ling","Лин Яо","epic","Син","Принц из Сина, который отправился в Аместрис за знаниями об алхимии.","Императорская дуга","orbit","#e9d096"],
  ["mei","Мэй Чан","rare","Син","Юная путешественница с маленькой пандой. Практикует восточную алхимию.","Рисунок на земле","seal","#e3a7d1"],
  ["greed","Грид","epic","Гомункулы","Считает свободу важнее приказов и жаждет собрать всё, что ценит.","Углеродная броня","seal","#b193dd"],
  ["lust","Ласт","epic","Гомункулы","Хладнокровная гомункул, чьё главное оружие скрыто в пальцах.","Алый росчерк","streak","#ef849a"],
  ["envy","Энви","epic","Гомункулы","Меняет облик и использует это, чтобы сбивать людей с толку.","Сломанный контур","claw","#a5d484"],
  ["gluttony","Глаттони","rare","Гомункулы","Гомункул с голодом, который невозможно утолить.","Круг пустоты","ring","#dac4a3"],
  ["wrath","Рэт","legendary","Гомункулы","Мастер клинка, который замечает мельчайшие движения.","Линия клинка","streak","#92d8ed"],
  ["pride","Прайд","legendary","Гомункулы","За спокойным голосом скрывается власть над тенями.","Глаза в тени","eye","#cbb0f4"],
  ["hohenheim","Ван Хоэнхайм","legendary","Путешественники","Странствующий алхимик, который видел куда больше, чем рассказывает.","Круг памяти","ring","#e4c57b"],
  ["izumi","Идзуми Кёртис","epic","Наставники","Обучила братьев Элриков алхимии и умению полагаться на себя.","Удар земли","spark","#a9ded6"]
 ]},
 demon:{title:"Клинок, рассекающий демонов",pack:"Дыхание воды",edition:"05",code:"DS",script:"鬼滅の刃",album:"Альбом истребителей",dossier:"Запись корпуса",world:"Эпоха Тайсё",rows:[["tanjiro","Тандзиро Камадо","legendary","Корпус истребителей","Старший брат Нэдзуко. Находит след демонов по запаху и не теряет сострадания.","Дыхание воды","orbit","#82d8f2"],
  ["nezuko","Нэдзуко Камадо","legendary","Семья Камадо","Сестра Тандзиро. Даже изменившись, защищает близких.","Розовые угли","spark","#f8a1be"],
  ["zenitsu","Дзэницу Агацума","epic","Корпус истребителей","Ученик Громового дыхания. Слышит то, что ускользает от остальных.","Громовой шаг","streak","#ffd773"],
  ["inosuke","Иноскэ Хасибира","epic","Корпус истребителей","Вырос в горах. Носит маску кабана и привык первым бросаться вперёд.","След зверя","claw","#9cc8e7"],
  ["giyu","Гию Томиока","epic","Столпы","Немногословный Столп Воды. Оценивает поступки, а не громкие слова.","Водяной круг","ring","#88d8f5"],
  ["shinobu","Синобу Котё","epic","Столпы","Столп Насекомого. Использует знания о ядах и быстрые выпады.","След бабочки","orbit","#ce9af6"],
  ["rengoku","Кёдзюро Рэнгоку","legendary","Столпы","Жизнерадостный Столп Пламени, который ставит безопасность других на первое место.","Кольцо пламени","ring","#ffb967"],
  ["tengen","Тэнгэн Удзуй","epic","Столпы","Столп Звука, любящий всё заметное и громкое.","Перекрёстный ритм","spark","#a6dbdd"],
  ["mitsuri","Мицури Канродзи","epic","Столпы","Добрая Столп Любви. За мягкими манерами скрывается невероятная сила.","Розовая лента","orbit","#fcb3d4"],
  ["muichiro","Муитиро Токито","epic","Столпы","Юный Столп Тумана с рассеянным взглядом и точными движениями.","Туманная дуга","claw","#a3e7da"],
  ["gyomei","Гёмэй Химэдзима","epic","Столпы","Сдержанный Столп Камня. Носит чётки и не любит ненужных слов.","Каменный круг","seal","#cabf9e"],
  ["sanemi","Санэми Синадзугава","epic","Столпы","Резкий и прямой Столп Ветра. Относится к тренировкам без поблажек.","Резкий ветер","claw","#a4dcb5"],
  ["obanai","Обанай Игуро","rare","Столпы","Столп Змеи. Его неизменный спутник Кабурамару сидит на плечах.","Змеиная петля","orbit","#c8df9d"],
  ["kanao","Канао Цуюри","rare","Корпус истребителей","Молчаливая ученица сестёр Котё. В начале пути часто доверяет выбор монете.","Лепесток","spark","#f2bbeb"],
  ["genya","Гэнъя Синадзугава","rare","Корпус истребителей","Упрямый новичок, который ищет собственный способ сражаться.","Тёмный след","streak","#b3a2e5"],
  ["muzan","Мудзан Кибуцудзи","legendary","Демоны","Скрытный предводитель демонов. Умеет теряться среди обычных людей.","Багровый глаз","eye","#f87583"],
  ["akaza","Акадза","legendary","Двенадцать лун","Демон, который ценит мастерство сильного соперника.","Ледяная печать","seal","#9fd7fd"],
  ["doma","Дома","epic","Двенадцать лун","Демон с неизменной улыбкой. В бою использует веера и лёд.","Хрустальный веер","spark","#9ee8f1"],
  ["kokushibo","Кокушибо","legendary","Двенадцать лун","Молчаливый демон-мечник с необычными глазами.","Лунные дуги","claw","#c797f7"],
  ["daki","Даки","rare","Двенадцать лун","Демон, которая использует длинные пояса как часть своей техники.","Узор пояса","orbit","#ef8fb9"]
 ]},
 aot:{title:"Атака титанов",pack:"За стеной",edition:"06",code:"AT",script:"進撃の巨人",album:"Альбом разведкорпуса",dossier:"Досье разведкорпуса",world:"Город за стенами",rows:[["eren","Эрен Йегер","legendary","Разведкорпус","Решительный кадет, мечтающий увидеть мир за стенами.","За стеной","spark","#ecc989"],
  ["mikasa","Микаса Аккерман","legendary","Разведкорпус","Собранная и быстрая кадетка. Узнаваема по красному шарфу.","Красная нить","streak","#f0878b"],
  ["armin","Армин Арлерт","epic","Разведкорпус","Любознательный кадет, которому помогают наблюдательность и воображение.","Линия горизонта","orbit","#b9dff0"],
  ["levi","Леви Аккерман","legendary","Разведкорпус","Капитан с безупречной техникой и очень высокими требованиями к порядку.","Стальной скос","streak","#c5e0e8"],
  ["erwin","Эрвин Смит","legendary","Разведкорпус","Командир, который способен принимать сложные решения под давлением.","Сигнал разведки","seal","#e3cfaa"],
  ["hange","Ханджи Зоэ","epic","Разведкорпус","Исследователь, чей азарт и дотошность пугают даже соратников.","Запись опыта","orbit","#b6d4ac"],
  ["jean","Жан Кирштайн","rare","Разведкорпус","Практичный кадет с резким языком и хорошим чувством обстановки.","Линия строя","streak","#cdd6a3"],
  ["connie","Конни Спрингер","common","Разведкорпус","Быстрый и открытый кадет из деревни Рагако.","Короткий рывок","spark","#cbdabd"],
  ["sasha","Саша Браус","rare","Разведкорпус","Кадетка с отличным слухом и аппетитом. Выросла в семье охотников.","Лесной след","orbit","#dfbc88"],
  ["reiner","Райнер Браун","epic","Кадеты","Физически сильный кадет, которому однокурсники привыкли доверять.","Тяжёлая грань","seal","#e5ce9a"],
  ["bertholdt","Бертольд Гувер","rare","Кадеты","Высокий и тихий кадет, часто оставляющий разговор другим.","Дальний силуэт","ring","#b7c6b4"],
  ["annie","Энни Леонхарт","epic","Кадеты","Сдержанная кадетка с отточенной техникой рукопашного боя.","Ледяной след","streak","#b7dcf8"],
  ["historia","Хистория Рейсс","rare","Кадеты","Внимательная и приветливая кадетка, которая учится делать собственный выбор.","Лента света","ring","#ecce9f"],
  ["ymir","Имир","rare","Кадеты","Остроумная кадетка, которая не любит раскрывать свои мотивы.","Лунный излом","claw","#bdd7c9"],
  ["zeke","Зик Йегер","epic","Марлия","Спокойный воин с привычкой взвешивать каждое слово.","Разлёт искр","spark","#e1bd85"],
  ["pieck","Пик Фингер","rare","Марлия","Наблюдательная воительница, умеющая видеть ситуацию целиком.","След на карте","orbit","#a5cbb9"],
  ["porco","Порко Галлиард","rare","Марлия","Гордый воин, которому трудно оставаться в стороне.","Рваная черта","claw","#dbc092"],
  ["gabi","Габи Браун","rare","Кандидаты в воины","Упорная кандидатка, привыкшая доказывать своё место в команде.","Сигнальная вспышка","spark","#f0bb90"],
  ["falco","Фалько Грайс","common","Кандидаты в воины","Добрый кандидат в воины, который внимательно относится к окружающим.","Лёгкое крыло","orbit","#c5dcb9"],
  ["moblit","Моблит Бернер","common","Разведкорпус","Помощник Ханджи. Ведёт записи и напоминает о полевой безопасности.","Чернила отчёта","seal","#c1cfad"]
 ]}
});
for(const v of Object.values(seriesList)){if(v.rows)v.roster=v.rows.map(([id,name,rarity,group,intro,reveal,fx,tint])=>Object.freeze({id,name,rarity,group,intro,reveal,fx,tint}));Object.freeze(v.roster);Object.freeze(v);}
const ghoulFx=Object.freeze({
 kaneki:['Красный глаз','eye','#fa466a'],touka:['Крыло ворона','claw','#e868a8'],juuzou:['Росчерк нитей','streak','#f4edea'],
 uta:['Контур маски','seal','#ca96f2'],tsukiyama:['Бархатная роза','orbit','#c671cb'],hide:['Лампа в окне','spark','#ffd58a'],
 rize:['Багровые ленты','claw','#fa557e'],arima:['Холодный импульс','streak','#c1eaff'],eto:['За архивной печатью','seal','#7dd8b8'],
 ayato:['Сечение крыла','claw','#b18afa'],hinami:['Хрупкий цветок','orbit','#ffc59b'],amon:['Стальная дуга','ring','#92baf1'],
 nishiki:['Спираль хвоста','orbit','#f5ae7a'],yomo:['Крыло в тумане','claw','#8ab1c4'],yoshimura:['Кольца кофе','ring','#e7b588'],
 akira:['Сетка отчёта','seal','#f1d48f'],furuta:['Раскол грима','streak','#f779a4'],takizawa:['Сигнальная искра','spark','#ece398'],mado:["Лезвие отчёта","streak","#c7d7ec"],irimi:["Тень чёрной собаки","claw","#af91d1"]
});
let seriesKey='ghoul', series=seriesList.ghoul, roster=series.roster, ids=new Set(roster.map(c=>c.id));
// Original, spoiler-free copy; groups refer to the character's early appearance.
const dossier=Object.freeze({
 kaneki:['Антэйку','Тихий любитель книг, оказавшийся между двумя мирами.'],
 touka:['Антэйку','Работает в кафе и не бросает своих в беде.'],
 juuzou:['CCG','Следователь, который предпочитает действовать по-своему.'],
 uta:['Мастерская масок','Художник, создающий маски для жителей ночного Токио.'],
 tsukiyama:['Гули','Ценит изысканный стиль и требует того же от окружающих.'],
 hide:['Люди','Наблюдательный друг Канэки с детства.'],
 rize:['Гули','Загадочная любительница книг с собственными правилами.'],
 arima:['CCG','Сдержанный следователь с безупречной репутацией.'],
 eto:['Гули','Загадочная фигура. Остальные сведения закрыты.'],
 ayato:['Аогири','Импульсивный гуль, привыкший решать всё сам.'],
 hinami:['Гули','Добрая и внимательная девочка, которая любит читать.'],
 amon:['CCG','Принципиальный следователь с острым чувством долга.'],
 nishiki:['Гули','Колкий студент, который не любит чужих вопросов.'],
 yomo:['Антэйку','Молчаливый помощник кафе, на которого можно положиться.'],
 yoshimura:['Антэйку','Хозяин кафе, где за чашкой кофе всегда найдётся место.'],
 akira:['CCG','Собранная следовательница с аналитическим складом ума.'],
 furuta:['CCG','Вежливый сотрудник, которого трудно прочитать.'],
 takizawa:['CCG','Молодой следователь, стремящийся проявить себя.'],mado:["CCG","Опытный следователь. Ведёт расследования вместе с Котаро Амоном."],irimi:["Антэйку","Официантка «Антэйку», внимательная к гостям и своим товарищам."]
});
const CASE_PRICE=50;
const purchaseIds=new Map();
function pendingKey(owner){return 'komi:collection:purchase:'+owner+(seriesKey==='ghoul'?'':':'+seriesKey);}
function pending(owner){try{return purchaseIds.get(pendingKey(owner))||sessionStorage.getItem(pendingKey(owner))||null;}catch{return purchaseIds.get(pendingKey(owner))||null;}}
function remember(owner,id){if(id)purchaseIds.set(pendingKey(owner),id);else purchaseIds.delete(pendingKey(owner));try{if(id)sessionStorage.setItem(pendingKey(owner),id);else sessionStorage.removeItem(pendingKey(owner));}catch{}}
const portraitFallback=c=>root.KomiCollectionArt?.silhouette(c.id)||'';
const lock='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/></svg>';
const artRoot='/assets/collection/ghoul-cel/';
const boosterRoot='/assets/collection/ghoul-booster/';
const ghoulPack='<div class="kc-pack"><img class="kc-case-image" src="'+boosterRoot+'pack-320.webp" srcset="'+boosterRoot+'pack-320.webp 320w, '+boosterRoot+'pack-640.webp 640w" sizes="(max-width: 900px) 180px, 235px" width="640" height="1024" alt="Запечатанный бустер «Токийский гуль» с Кэном Канэки на упаковке" decoding="async"></div>';
const motifPaths={
 eye:'M40 105Q150 16 260 105Q150 194 40 105Z M150 72Q127 103 150 138Q173 103 150 72Z',
 claw:'M41 197Q88 48 251 27Q152 68 92 192 M105 204Q149 102 252 66 M167 192Q205 125 262 111',
 streak:'M25 143L251 51 M54 171L272 70 M112 180L244 130 M22 75h58m-29-29v58',
 orbit:'M28 112a122 65 0 1 0 244 0a122 65 0 1 0-244 0 M151 23l7 17 17 7-17 7-7 17-7-17-17-7 17-7Z',
 ring:'M150 30a75 75 0 1 0 0 150a75 75 0 1 0 0-150 M150 48a57 57 0 1 0 0 114a57 57 0 1 0 0-114',
 spark:'M150 20l12 67 61-30-41 49 57 22-68 2 14 65-36-53-31 53 8-64-66-6 61-23-42-50 57 30Z',
 seal:'M150 28L227 73v76l-77 45-77-45V73Z M150 194V28 M73 73l154 76m0-76L73 149'
};
function artworkRoot(){return seriesKey==='ghoul'?artRoot:'/assets/collection/'+seriesKey+'/';}
function packArt(){
 return '<div class="kc-pack"><img class="kc-case-image" src="/assets/collection/deluxe-packs/'+seriesKey+'.webp"'+(seriesKey==='ghoul'?' data-kc-pack-fallback="1"':'')+' width="360" height="640" alt="Бустер «'+esc(series.pack)+'»" decoding="async"><span class="kc-pack-fallback" aria-hidden="true">'+esc(series.pack)+'</span></div>';
}
function heroInfo(c){
 if(seriesKey==='ghoul'){
  const [group,intro]=dossier[c.id],[reveal,fx,tint]=ghoulFx[c.id];
  return {group,intro,reveal,fx,tint};
 }
 return c;
}
const chapterSets={
 ghoul:[['Антэйку',['kaneki','touka','yomo','yoshimura']],['Следствие CCG',['arima','amon','akira','juuzou']],['Город после заката',['uta','rize','tsukiyama','nishiki']],['Антэйку и следователи',['irimi','mado']]],
 jujutsu:[['Первый курс',['itadori','fushiguro','kugisaki']],['Второй курс',['maki','toge','panda','yuta']],['Мастера и легенды',['gojo','sukuna','nanami']],['Киотская школа',['todo','utahime','miwa']],['В старых записях',['shoko','geto','toji']]],
 frieren:[['Старый отряд',['himmel','heiter','eisen','frieren']],['Новый путь',['frieren','fern','stark']],['Школа магии',['flamme','serie','denken','ubel']],['Практический экзамен',['lawine','kanne','land','methode']],['Северный отряд',['wirbel','ehre','scharf']]],
 alchemist:[['Резембул',['edward','alphonse','winry']],['Штаб',['roy','riza','maes','alex']],['Другие дороги',['scar','olivier','lanfan']],['Путь из Сина',['ling','mei','lanfan']],['Гомункулы',['greed','lust','envy','gluttony','wrath','pride']]],
 demon:[['Камадо',['tanjiro','nezuko','zenitsu','inosuke']],['Столпы',['giyu','shinobu','rengoku','tengen','mitsuri']],['Кандидаты',['kanao','genya']],['Двенадцать лун',['muzan','akaza','doma','kokushibo','daki']]],
 aot:[['Три кадета',['eren','mikasa','armin']],['Командование',['levi','erwin','hange','moblit']],['Из одного выпуска',['jean','connie','sasha','historia','ymir']],['Воины Марлии',['reiner','bertholdt','annie','zeke','pieck','porco','gabi','falco']]]
};
const posterTones={ghoul:['#180d18','#63263a','#f3a4b9'],jujutsu:['#151021','#453363','#c6b0fc'],frieren:['#201809','#5b4726','#f2d198'],alchemist:['#0d1820','#284b62','#a6d9e7'],demon:['#08151f','#184266','#8adcf1'],aot:['#16160f','#393b24','#d5d6a1']};
function collectorProgress(s,owned,known){
 const count=owned.size,missing=roster.length-count;
 const label=!known?'Прогресс появится после входа и загрузки коллекции.':missing
  ?'Осталось: '+missing+' из '+roster.length+' · '+missing+' × 50 = '+(missing*CASE_PRICE)+' AniCoin.'
  :'Серия собрана. Можно выбрать её фон в профиле.';
 const chapters=chapterSets[seriesKey].map(([name,cards])=>{
  const n=cards.filter(id=>owned.has(id)).length,done=known&&n===cards.length;
  return '<li class="'+(done?'kc-page-stamped':'')+'"><strong>'+esc(name)+'</strong><span>'+(known?n+' / '+cards.length:'— / '+cards.length)+'</span>'+(done?'<small>Печать получена</small>':'')+'</li>';
 }).join('');
 return '<section class="kc-collector-progress" aria-label="Тематические страницы"><div class="kc-collector-head"><div><div class="kc-kicker">Страницы серии</div><h3>До полного альбома</h3></div><p>'+esc(label)+'</p></div><ul>'+chapters+'</ul></section>';
}
function journalMarkup(s){
 if(!s.owner)return '';
 const rows=s.journalRows||[];
 const contents=!s.journalOpen?'':s.journalStatus==='loading'?'<p role="status">Загружаем открытия…</p>':s.journalStatus==='error'?'<p role="status">Не удалось загрузить журнал.</p>'+button('Повторить','journal-retry'):rows.length
  ?'<ol>'+rows.map(({id,date})=>{
   const c=roster.find(x=>x.id===id);
   return '<li><div><strong>'+esc(c.name)+'</strong><time datetime="'+esc(date.toISOString())+'">'+esc(date.toLocaleString('ru-RU',{dateStyle:'medium',timeStyle:'short'}))+'</time></div>'+button('Повторить сцену','replay-'+id,{disabled:!!s.reel||s.status!=='ready'})+'</li>';
  }).join('')+'</ol>':'<p>Подтверждённых открытий этой серии пока нет.</p>';
 return '<section class="kc-journal" aria-label="Личный журнал открытий"><div class="kc-collector-head"><div><div class="kc-kicker">Видно только тебе</div><h3>Журнал открытий</h3></div><button type="button" data-kc-action="journal" aria-expanded="'+s.journalOpen+'" aria-controls="kc-journal-body"'+(s.status==='ready'?'':' disabled')+'>'+(s.journalOpen?'Свернуть':'Посмотреть')+'</button></div><div id="kc-journal-body"'+(s.journalOpen?'':' hidden')+'>'+contents+'</div></section>';
}
function paintJournal(s){
 if(!active()||!current(s))return;
 const old=host.querySelector('.kc-journal');
 if(!old)return;
 const focused=old.contains(document.activeElement);
 const t=document.createElement('template');t.innerHTML=journalMarkup(s);
 old.replaceWith(t.content);
 if(focused)host.querySelector('[data-kc-action="journal"]')?.focus({preventScroll:true});
}
async function readJournal(s){
 if(!current(s)||!s.journalOpen||!s.owner||s.status!=='ready'||s.journalStatus==='loading')return;
 s.journalStatus='loading';paintJournal(s);
 try{
  if(typeof _supabase==='undefined'||!_supabase)throw Error('Unavailable');
  const {data:auth,error:authError}=await _supabase.auth.getSession();
  if(!current(s))return;
  if(authError||auth?.session?.user?.id!==s.owner)throw Error('Session changed');
  const {data,error}=await _supabase.rpc('komi_collection_journal_read',{p_series_id:s.seriesKey});
  if(!current(s))return;
  if(error||!Array.isArray(data))throw Error('Invalid journal');
  const seen=new Set(),owned=new Set(s.owned);
  s.journalRows=data.slice(0,20).flatMap(row=>{
   const id=row?.character_id,date=new Date(row?.opened_at||'');
   if(!owned.has(id)||!ids.has(id)||seen.has(id)||!Number.isFinite(date.valueOf()))return [];
   seen.add(id);return [{id,date}];
  });
  s.journalStatus='ready';paintJournal(s);
 }catch{if(current(s)){s.journalStatus='error';paintJournal(s);}}
}
function startReplay(id){
 const s=state;
 if(!current(s)||s.status!=='ready'||s.reel||!s.owned.includes(id)||!s.journalRows?.some(x=>x.id===id))return;
 s.replayResult=null;tab='cases';
 s.reel={payload:{result:id},isReplay:true,phase:'choose',timer:null};
 paint('pick-card-1');
}
function albumFinalMarkup(s,owned){
 if(!s.finalUnlock||s.replayResult||owned.size!==roster.length)return '';
 const animated=!s.finalAnimated;s.finalAnimated=true;
 return '<section class="kc-album-finale'+(animated?' kc-finale-playing':'')+'" aria-label="Серия собрана"><div class="kc-kicker">Последний слот</div><h3>Альбом собран</h3><p>'+roster.length+' / '+roster.length+' · '+esc(series.title)+'</p><div class="kc-finale-tiles" aria-hidden="true">'+roster.map(c=>'<img src="'+artworkRoot()+c.id+'.webp" alt="" width="48" height="68" loading="lazy">').join('')+'</div><span class="kc-finale-stamp">Коллекция завершена</span></section>';
}
async function downloadMiniPoster(c,asset,button,status){
 const v=activeDialog,vSeries=seriesKey,plate=series.title,serialCode=serial(roster.indexOf(c)),tones=posterTones[vSeries];
 const valid=()=>v&&activeDialog===v&&active()&&current(v.state)&&v.state.owned.includes(c.id);
 if(!valid()||button.disabled)return;
 button.disabled=true;status.textContent='Готовим постер…';
 try{
  const artwork=new Image();
  artwork.src=asset;await artwork.decode();
  if(!valid())return;
  const canvas=document.createElement('canvas');canvas.width=720;canvas.height=1000;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Canvas unavailable');
  const fade=ctx.createRadialGradient(360,400,25,360,455,530);
  fade.addColorStop(0,tones[1]);fade.addColorStop(1,tones[0]);ctx.fillStyle=fade;ctx.fillRect(0,0,720,1000);
  ctx.strokeStyle=tones[2];ctx.lineWidth=4;ctx.strokeRect(22,22,676,956);ctx.lineWidth=1;ctx.strokeRect(35,35,650,930);
  ctx.fillStyle=tones[2];ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText('KOMIANIME · '+serialCode,360,80,620);
  const ratio=Math.min(595/artwork.naturalWidth,705/artwork.naturalHeight);
  const w=artwork.naturalWidth*ratio,h=artwork.naturalHeight*ratio;
  ctx.drawImage(artwork,(720-w)/2,98+(705-h)/2,w,h);
  ctx.fillStyle='#fff6f4';ctx.font='bold 42px sans-serif';ctx.fillText(c.name,360,871,620);
  ctx.fillStyle=tones[2];ctx.font='bold 25px sans-serif';ctx.fillText(plate+' · '+rarityNames[c.rarity],360,925,600);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!valid())return;
  if(!blob)throw Error('Export unavailable');
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='komianime-'+vSeries+'-'+c.id+'.png';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  status.textContent='Постер готов.';
 }catch{if(valid())status.textContent='Не удалось скачать постер. Попробуй ещё раз.';}
 finally{if(valid())button.disabled=false;}
}
// Promotional portraits are separate from the ownership-controlled album cards.
const shelfHeroes=Object.freeze({ghoul:'kaneki',jujutsu:'gojo',frieren:'frieren',alchemist:'edward',demon:'tanjiro',aot:'eren'});
function shelfHero(id,cssClass){
 const folder=id==='ghoul'?'ghoul-cel':id;
 return '<img class="'+cssClass+'" src="/assets/collection/'+folder+'/'+shelfHeroes[id]+'.webp" width="432" height="648" alt="" aria-hidden="true" decoding="async">';
}
function seriesPicker(){
 const busy=state?.status==='opening'||!!state?.reel,inAlbum=tab==='collection';
 return '<nav class="kc-shelves kc-world-shelves'+(inAlbum?' kc-album-shelves':' kc-pack-shelves')+'" aria-label="'+(inAlbum?'Коллекции':'Выбор пака')+'">'+Object.entries(seriesList).map(([id,v])=>'<button type="button" class="kc-world-window kc-theme-'+id+'" data-kc-action="series-'+id+'" aria-label="'+esc(v.title)+'" aria-pressed="'+(seriesKey===id)+'"'+(busy?' disabled':'')+'><span class="kc-window-motif" aria-hidden="true"></span>'+shelfHero(id,'kc-shelf-hero')+'<span class="kc-window-shade" aria-hidden="true"></span><span class="kc-window-copy">'+(inAlbum?'':'<img class="kc-pack-thumb" src="/assets/collection/deluxe-packs/'+id+'.webp" alt="" width="26" height="45" decoding="async">')+'<span class="kc-window-label"><strong>'+esc(v.title)+'</strong><small aria-hidden="true">'+(inAlbum?v.roster.length+' персонажей':'Серия '+v.edition)+'</small></span></span></button>').join('')+'</nav>';
}
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
function normalizePayload(data){
 if(!data||!Array.isArray(data.owned))throw new Error('Invalid collection response');
 const owned=[...new Set(data.owned.filter(id=>ids.has(id)))];
 const result=ids.has(data.result)&&owned.includes(data.result)?data.result:null;
 const balance=Number.isSafeInteger(data.balance)&&data.balance>=0?data.balance:null;
 return {owned,result,balance,price:data.price===CASE_PRICE?CASE_PRICE:null,purchaseStatus:['ok','insufficient','complete'].includes(data.purchase_status)?data.purchase_status:null};
}
let state=null,observedOwner,host=null,tab='collection';
let auraRequest=0;
async function loadOwnedAura(id){const serial=++auraRequest;if(!id||typeof _supabase==='undefined'||!_supabase)return;try{const {data,error}=await _supabase.from('komi_premium_cosmetic_equips').select('aura_id').eq('user_id',id).maybeSingle();if(error||serial!==auraRequest||owner()!==id||!active()||state?.owner!==id)return;const p=root.KomiShopCatalog?.find(data?.aura_id);state.auraClass=p?.type==='aura'?p.cosmeticClass:'';const page=host?.querySelector('.kc-page');if(page)page.dataset.komiAura=state.auraClass;}catch{}}
let filter='all',rarityFilter='all',searchQuery='',searchComposing=false,deferredPaint=false;
const collectionFilters=Object.freeze({all:'Все',owned:'Открытые',locked:'Закрытые'});
const normalizedName=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').trim().replace(/\s+/g,' ');
function resetFilters(){
 filter='all';rarityFilter='all';searchQuery='';searchComposing=false;deferredPaint=false;
}
function matchesAlbum(c,owned,term=normalizedName(searchQuery)){
 const opened=owned.has(c.id);
 if(filter==='owned'&&!opened||filter==='locked'&&opened||rarityFilter!=='all'&&c.rarity!==rarityFilter)return false;
 // Query text never participates in matching a locked card, even by its ID.
 return !term||opened&&term.split(' ').every(word=>normalizedName(c.name).includes(word));
}
function hasFilters(){return filter!=='all'||rarityFilter!=='all'||searchQuery.length>0;}
function active(){return typeof currentView==='string'&&currentView==='collection'&&host?.isConnected;}
function owner(){const id=typeof currentUser==='undefined'?'':currentUser?.authUserId||'';return observedOwner===undefined||observedOwner===id?id:'';}
function fresh(id){return {owner:id,seriesKey,status:id?'idle':'guest',owned:[],result:null,balance:null,price:null,confirmBuy:false,purchaseStatus:null,reel:null,inspected:'',extrasOpen:false,journalOpen:false,journalRows:[],journalStatus:'idle',finalUnlock:false,replayResult:null};}
// A request may finish after navigating away; keep the same account's result,
// but paint() only touches the DOM when collection is the active route.
function current(s){return !!s&&state===s&&owner()===s.owner&&s.seriesKey===seriesKey;}
function authChanged(id){observedOwner=id||'';if(state&&state.owner!==observedOwner){if(state.reel){clearTimeout(state.reel.timer);}closeViewer(false);resetFilters();state=fresh(owner());if(active())paint();}}
function rarityLabel(c){return '<span class="kc-rarity kc-rarity-'+c.rarity+'"><i aria-hidden="true"></i>'+rarityNames[c.rarity]+'</span>';}
function art(c,opened){
 const image=artworkRoot()+(opened?'':'locked/')+c.id+'.webp';
 const width=432, height=648;
 return (seriesKey==='ghoul'?portraitFallback(c):'')+'<img class="kc-portrait" src="'+image+'" alt="" width="'+width+'" height="'+height+'" loading="lazy" decoding="async">';
}
function serial(i){return series.code+'-'+String(i+1).padStart(2,'0');}
const flipIcon='<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4"/></svg>';
function card(c,opened,place='grid'){
 const number=serial(roster.indexOf(c));
 const key=place+'-'+c.id, backId='kc-back-'+key;
 const flipped=opened&&state?.inspected===key;
 const label=opened?c.name:'Неизвестный персонаж';
 const {group,intro,tint}=heroInfo(c);
 const back=opened?'<div class="kc-card-back" id="'+backId+'"'+(flipped?'':' hidden')+'><div class="kc-file-code">'+esc(seriesKey==='ghoul'?'CCG':series.code)+' · '+number+'</div><h4>'+esc(c.name)+'</h4><p class="kc-file-group">'+esc(group)+'</p><p class="kc-file-intro">'+esc(intro)+'</p><div class="kc-file-footer">'+rarityLabel(c)+'</div></div>':'';
 const viewer=opened?'<button type="button" '+(flipped?'hidden ':'')+'class="kc-view-hero" data-kc-action="view-'+c.id+'" data-kc-focus="view-'+key+'" aria-label="Открыть персонажа: '+esc(c.name)+'"><span>В полный рост</span></button>':'';
 const control=opened?'<button type="button" class="kc-inspect" data-kc-action="inspect" data-kc-focus="inspect-'+key+'" aria-controls="'+backId+'" aria-expanded="'+flipped+'" aria-label="'+esc(series.dossier)+': '+esc(c.name)+'">'+flipIcon+'<span>'+(flipped?'Лицевая':'Досье')+'</span></button>':'';
 return '<article class="kc-card kc-tier-'+c.rarity+(opened?' kc-owned':' kc-locked')+(flipped?' kc-flipped':'')+'"'+(opened?' style="--kc-character-fx:'+tint+'"':'')+' data-kc-card="'+c.id+'" data-kc-place="'+place+'"'+(place==='grid'?' tabindex="-1" data-kc-focus="card-'+c.id+'" aria-label="'+number+' · '+esc(label)+'"':'')+'><div class="kc-art" aria-hidden="true">'+art(c,opened)+'<div class="kc-card-register"><span class="kc-number">'+number+'</span>'+(!opened?'<span class="kc-card-edition">'+series.edition+'</span>':'')+'</div>'+(!opened?'<div class="kc-lock"><span>'+lock+'</span></div>':'')+'</div><div class="kc-card-info"'+(flipped?' aria-hidden="true"':'')+'><strong>'+esc(label)+'</strong><div class="kc-card-details">'+rarityLabel(c)+'<small>'+(opened?'В коллекции':'Не открыт')+'</small></div></div>'+back+viewer+control+'</article>';
}
function album(owned,known){
 const slots=byRarity(roster).map(c=>{
  const open=owned.has(c.id),num=serial(roster.indexOf(c));
  const image=artworkRoot()+(open?'':'locked/')+c.id+'.webp';
  return '<li><button type="button" class="kc-slot kc-tier-'+c.rarity+(open?' kc-slot-owned':'')+'" data-kc-action="slot-'+c.id+'" aria-label="'+num+' · '+(open?esc(c.name):'не открыта')+'"><span class="kc-slot-art" aria-hidden="true"><img class="kc-album-image" src="'+image+'" width="80" height="80" alt="" loading="lazy" decoding="async"></span><span aria-hidden="true">'+num.slice(3)+'</span></button></li>';
 }).join('');
 return '<section class="kc-album" aria-label="'+esc(series.album)+'"><div class="kc-album-heading"><div><div class="kc-kicker">'+esc(series.title)+' · Коллекция '+series.edition+'</div><h3>'+esc(series.album)+'</h3></div><span class="kc-album-count">'+(known?owned.size+' / '+roster.length:roster.length+' слотов')+'</span></div><p class="kc-muted">Выбери слот, чтобы перейти к карточке.</p><ol class="kc-album-grid">'+slots+'</ol></section>';
}
function setInspection(el,open,glint=false){
 const button=el.querySelector('.kc-inspect'),back=el.querySelector('.kc-card-back');
 if(!button||!back)return;
 button.setAttribute('aria-expanded',String(open));
 button.querySelector('span').textContent=open?'Лицевая':'Досье';
 back.hidden=!open;
 el.querySelector('.kc-card-info').toggleAttribute('aria-hidden',open);
 if(open)el.querySelector('.kc-card-info').setAttribute('aria-hidden','true');
 el.classList.toggle('kc-flipped',open);
 el.querySelector('.kc-view-hero').hidden=open;
 el.classList.remove('kc-foil-shine');
 if(open&&glint){void el.offsetWidth;el.classList.add('kc-foil-shine');}
}
function inspect(button){
 const el=button.closest('.kc-owned'),id=el?.dataset.kcCard;
 if(!id||!current(state)||!state.owned.includes(id))return;
 const key=el.dataset.kcPlace+'-'+id,open=state.inspected!==key;
 for(const old of host.querySelectorAll('.kc-card.kc-flipped'))if(old!==el)setInspection(old,false);
 state.inspected=open?key:'';
 setInspection(el,open,true);
}
function jumpToCard(id){
 if(!ids.has(id)||!current(state)||tab!=='collection')return;
 const item=roster.find(c=>c.id===id),owned=new Set(state.owned);
 // The optional index remains accessible. Clear conflicting filters before jumping.
 if(!item||!matchesAlbum(item,owned)){resetFilters();paint();}
 const target=host.querySelector('.kc-grid [data-kc-card="'+id+'"]');
 if(!target)return;
 target.focus({preventScroll:true});
 target.scrollIntoView({block:'center',behavior:root.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
let activeDialog=null;
function closeViewer(restore=true){
 const v=activeDialog;
 if(!v)return;
 activeDialog=null;
 if(typeof v.dialog.close==='function')v.dialog.close();
 v.dialog.remove();
 if(restore&&v.trigger.isConnected&&active()&&current(v.state))v.trigger.focus({preventScroll:true});
}
function playSignature(stage){
 if(!stage||root.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
 const fx=stage.querySelector('.kc-signature');
 if(!fx)return;
 fx.classList.remove('kc-signature-play');
 void fx.offsetWidth;
 fx.classList.add('kc-signature-play');
}
function signatureMarkup(c){
 const info=heroInfo(c);
 return '<div class="kc-signature kc-fx-'+info.fx+'" style="--kc-fx:'+info.tint+'" aria-hidden="true"><svg viewBox="0 0 300 220" fill="none" focusable="false"><path d="'+motifPaths[info.fx]+'"/></svg></div>';
}
function openViewer(id,trigger){
 if(!current(state)||!state.owned.includes(id))return;
 const c=roster.find(x=>x.id===id);
 if(!c)return;
 closeViewer(false);
 const info=heroInfo(c),number=serial(roster.indexOf(c));
 const asset=artworkRoot()+c.id+'.webp';
 const dialog=document.createElement('dialog');
 dialog.className='kc-hero-view kc-theme-'+seriesKey;
 dialog.setAttribute('aria-labelledby','kc-hero-title');
 dialog.innerHTML='<div class="kc-hero-layout"><button type="button" class="kc-view-close" autofocus aria-label="Закрыть просмотр">×</button><div class="kc-hero-stage kc-tier-'+c.rarity+'"><span class="kc-hero-art-serial">'+number+'</span>'+signatureMarkup(c)+'<img src="'+asset+'" width="400" height="720" alt="'+esc(c.name)+', в полный рост" decoding="async"><p class="kc-image-unavailable" hidden>Не удалось загрузить иллюстрацию.</p></div><div class="kc-hero-info"><div class="kc-view-meta">'+rarityLabel(c)+'<span>'+esc(series.title)+'</span></div><h2 id="kc-hero-title">'+esc(c.name)+'</h2><div class="kc-hero-metrics"><div><small>Карточка</small><strong>'+number+'</strong></div><div><small>В альбоме</small><strong>'+(roster.indexOf(c)+1)+' / '+roster.length+'</strong></div></div>'+'<dl><dt>Фракция или роль</dt><dd>'+esc(info.group)+'</dd><dt>Мир</dt><dd>'+esc(series.world)+'</dd><dt>Фирменный эффект</dt><dd>'+esc(info.reveal)+'</dd></dl><p class="kc-view-intro">'+esc(info.intro)+'</p><div class="kc-hero-actions"><button type="button" class="kc-view-signature">Показать эффект</button><button type="button" class="kc-view-poster">Скачать постер</button></div><p class="kc-poster-status" role="status"></p></div></div>';
 const dismiss=dialog.querySelector('.kc-view-close');
 const stage=dialog.querySelector('.kc-hero-stage');
 const illustration=stage.querySelector('img');
 illustration.addEventListener('error',()=>{illustration.hidden=true;stage.querySelector('p').hidden=false;},{once:true});
 dismiss.addEventListener('click',()=>closeViewer());
 dialog.addEventListener('cancel',event=>{event.preventDefault();closeViewer();});
 dialog.addEventListener('click',event=>{if(event.target===dialog)closeViewer();});
 const effect=dialog.querySelector('.kc-view-signature');
 effect.hidden=!!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 effect.addEventListener('click',()=>playSignature(stage));
 const poster=dialog.querySelector('.kc-view-poster');
 poster.addEventListener('click',()=>void downloadMiniPoster(c,asset,poster,dialog.querySelector('.kc-poster-status')));
 host.append(dialog);
 activeDialog={dialog,trigger,state,id,key:focusKey(trigger)};
 if(typeof dialog.showModal==='function')dialog.showModal();
 else dialog.setAttribute('open','');
 dismiss.focus({preventScroll:true});
}
function selectSeries(id){
 if(!Object.hasOwn(seriesList,id)||seriesKey===id||state?.status==='opening'||state?.reel)return;
 closeViewer(false);
 seriesKey=id;series=seriesList[id];roster=series.roster;ids=new Set(roster.map(c=>c.id));
 state=fresh(owner());resetFilters();paint('series-'+id);
 if(state.status==='idle')void request('read');
}
const REEL_DURATION=4400,REEL_STEP=124,REEL_WIN=23,REEL_LENGTH=29;
function makeReel(prize,owned,random=Math.random){
 const pool=roster.filter(c=>!owned.includes(c.id));
 const candidates=pool.length?pool:roster;
 return Array.from({length:REEL_LENGTH},(_,i)=>i===REEL_WIN?prize:candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))].id);
}
// A pick is presentation only. The buy/read response supplies the single card.
const PICK_DURATION=950;
const pickThemes=Object.freeze({
 ghoul:{scene:'Ночной Токио',sigil:'M10 40Q50 9 90 40Q50 72 10 40ZM50 25Q40 40 50 55Q60 40 50 25ZM24 25 18 17M73 55 82 64',effects:'<path class="kc-pick-strokes" d="M34 29Q35 50 47 53T60 69Q49 63 42 63 24 64 22 57 18 49 34 29ZM91 5Q89 16 85 24 102 16 91 5ZM147 57Q150 38 163 42 166 50 147 57ZM235 32Q219 59 231 63 240 73 244 53ZM277 9Q265 24 266 36 280 28 277 9ZM316 54Q299 56 301 64 305 71 316 54ZM38 139Q50 113 59 114 64 126 38 139ZM86 130Q86 142 72 155 67 157 67 151ZM264 117Q252 133 260 140 274 144 273 130ZM324 120Q308 143 319 146 329 151 324 120Z"/><path class="kc-pick-trace" d="M15 120Q65 18 163 28T323 141M54 16Q122-2 171 32T321 61M21 162q73 20 151 2t150-11"/>'},
 jujutsu:{scene:'Печати проклятий',sigil:'M30 11 69 16 75 66 33 70ZM22 30 72 33M24 54l54-20M44 19l12 42m-9-33 20 12M17 57 85 24',effects:'<path class="kc-pick-trace" d="M43 18 86 35 74 72 30 60ZM127 124 156 108 185 143 162 161ZM229 25 277 38 266 89 215 77ZM284 119 305 101 336 134 311 154ZM22 107 315 24M49 147 293 46M87 160 317 68"/><path class="kc-pick-strokes" d="m33 97 38-12-21 8Zm102-63 44-11-21 10Zm84 88 40-16-13 10Zm-12-35 63-20-26 12Z"/>'},
 frieren:{scene:'Дневник пути',sigil:'M19 40a31 28 0 1 0 62 0 31 28 0 1 0-62 0m9 0a22 19 0 1 0 44 0 22 19 0 1 0-44 0M50 18v44m-14-22h28m-25-11 22 22M61 29 39 51',effects:'<path class="kc-pick-trace" d="M19 112Q53 48 117 65t100-18 90-15M42 140q38-53 75-10t96-9 91-20M91 92a79 43 0 1 1 158 0 79 43 0 1 1-158 0M66 92a104 63 0 1 1 208 0 104 63 0 1 1-208 0"/><path class="kc-pick-strokes" d="m38 63 3 9 9 3-9 3-3 9-3-9-9-3 9-3Zm91 53 3 10 10 3-10 3-3 10-3-10-10-3 10-3Zm89-98 2 8 8 2-8 2-2 8-2-8-8-2 8-2Zm85 89 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/>'},
 alchemist:{scene:'Архив Аместриса',sigil:'M50 9 82 26v28L50 71 18 54V26ZM50 9v62M18 26l64 28m0-28L18 54M50 15 24 53h52Z',effects:'<path class="kc-pick-trace" d="M64 14h212v154H64ZM85 35h170v112H85ZM170 20v140M70 91h200M170 26l65 112H105ZM170 157l65-112H105ZM97 91a73 63 0 1 0 146 0 73 63 0 1 0-146 0M20 25h40m-20-8v16m239 122h44m-22-8v16"/><path class="kc-pick-strokes" d="M127 91l7-7 7 7-7 7Zm66 0 7-7 7 7-7 7Zm-35-34 7-7 7 7-7 7Zm3 65 7-7 7 7-7 7Z"/>'},
 demon:{scene:'Клинок рассвета',sigil:'M21 57Q54 25 80 11Q67 43 37 63M21 57l-5 5m10-11 11 13M18 37Q25 25 33 18Q28 28 30 39M64 68Q67 54 78 44Q74 55 78 59',effects:'<path class="kc-pick-strokes" d="M5 158Q58 147 92 89 83 127 54 151 63 148 91 137 73 160 40 175ZM117 137Q165 100 179 42 195 75 174 108 207 80 242 57 220 90 195 116 163 148 108 174ZM243 148Q287 124 311 65 321 98 287 132 312 125 334 108 308 160 258 172Z"/><path class="kc-pick-trace" d="M8 145Q111 121 131 20M35 167Q173 129 207 24M95 173Q239 133 279 39M202 168q85-18 125-95"/>'},
 aot:{scene:'За стеной',sigil:'M19 16l29 16v37L18 53V41l17 10V29M81 16 52 32v37l30-16V41L65 51V29M23 16 48 28m29-12L52 28',effects:'<path class="kc-pick-trace" d="M21 156V85l27-18 22 14 30-21 17 14v82M129 161V69l22-17 23 16 28-21 20 15v99M232 156V95l31-22 22 15 26-18 13 14v72M17 159h306M3 40q35-18 91 0t82 1 96 1 64 4M13 118q53-11 115 7t127-1 84 1"/><path class="kc-pick-strokes" d="m8 122 126-44-41 27Zm77 30 128-42-63 31Zm67-125 122-25-48 18Zm52 127 130-42-35 21Z"/>'}
});
function pickScene(reel,theme){
 const choose=reel.phase==='choose',reveal=reel.phase==='reveal';
 const prize=reveal?roster.find(c=>c.id===reel.payload.result):null;
 const emblem='<svg viewBox="0 0 100 80" aria-hidden="true" focusable="false"><path d="'+theme.sigil+'"/></svg>';
 const particles='<svg class="kc-pick-atmosphere" viewBox="0 0 340 180" preserveAspectRatio="none" aria-hidden="true" focusable="false">'+theme.effects+'</svg>';
 const elapsed=reveal?Math.max(0,Date.now()-reel.started):0;
 const cards=[1,2,3].map(n=>{
  const selected=reveal&&reel.chosen===n;
  const result=selected&&prize?'<span class="kc-pick-front kc-tier-'+prize.rarity+'" aria-hidden="true"><span class="kc-art">'+art(prize,true)+'</span><span class="kc-pick-front-rarity">'+rarityLabel(prize)+'</span></span>':'';
  return '<button type="button" class="kc-pick-card'+(selected?' is-chosen':'')+'" data-kc-action="pick-card-'+n+'" aria-label="Открыть карточку '+n+' из 3"'+(choose?'':' disabled')+'><span class="kc-pick-back" aria-hidden="true">'+emblem+'</span>'+result+'</button>';
 }).join('');
 return '<div class="kc-pick-arena'+(reveal?' is-revealing kc-pick-position-'+reel.chosen:'')+'" data-kc-pick-world="'+seriesKey+'"'+(reveal?' style="--kc-pick-elapsed:-'+elapsed+'ms"':'')+'>'+particles+'<div class="kc-pick-card-row" role="group" aria-label="Три рубашки карточек">'+cards+'</div></div>';
}
function reelMarkup(s){
 const reel=s.reel;
 if(!reel)return '';
 const theme=pickThemes[seriesKey]||pickThemes.ghoul;
 const seal=reel.phase==='seal',reveal=reel.phase==='reveal';
 const heading=seal?'Пак запечатан':reveal?'Кто внутри?':'Выбери одну из трёх карточек';
 const hint=seal?'Карточка получена. Осталось открыть пак.':reveal?'Раскрываем карточку…':reel.isReplay?'Это повтор уже полученной карточки.':'Карточка уже определена. Выбор меняет только сцену.';
 const scene=seal?'<button type="button" class="kc-peel" data-kc-action="peel" aria-label="Сорвать печать с бустера"><span class="kc-peel-pack" aria-hidden="true">'+packArt()+'</span><span class="kc-peel-tab" aria-hidden="true">⟶</span><span>Сорвать печать</span></button><small class="kc-peel-help">Потяни за край или нажми кнопку.</small>':pickScene(reel,theme);
 return '<section class="kc-reel-panel kc-manga-panel kc-pick-panel" aria-label="Открытие бустера"'+(reveal?' aria-busy="true"':'')+'><div class="kc-reel-heading"><div><div class="kc-kicker">'+esc(theme.scene)+' · '+(reel.isReplay?'Повтор сцены':'Открытие')+'</div><h3>'+heading+'</h3></div><span role="status">'+hint+'</span></div>'+scene+button('Показать результат','skip-reel')+'</section>';
}
function peelReel(){
 const s=state,reel=s?.reel;
 if(!current(s)||!reel||reel.phase!=='seal')return;
 reel.phase='choose';
 paint('pick-card-1');
}
function chooseCard(n){
 const s=state,reel=s?.reel;
 if(!current(s)||!reel||reel.phase!=='choose'||![1,2,3].includes(n))return;
 // The choice is never transmitted and does not select, redraw or buy a reward.
 if(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches){finishReel(s,reel,true);return;}
 reel.chosen=n;reel.phase='reveal';reel.started=Date.now();
 paint('skip-reel');
 reel.timer=setTimeout(()=>finishReel(s,reel),PICK_DURATION);
}
let peelPointer=null;
function pointerStart(event){
 const target=event.target.closest?.('.kc-peel');
 if(!active()||!target||!event.isPrimary||event.button!==0)return;
 peelPointer={target,id:event.pointerId,x:event.clientX,y:event.clientY};
 try{target.setPointerCapture(event.pointerId);}catch{}
}
function pointerMove(event){
 const p=peelPointer;
 if(!p||p.id!==event.pointerId||!p.target.isConnected)return;
 const dx=event.clientX-p.x,dy=event.clientY-p.y;
 if(Math.abs(dy)>Math.max(20,dx)&&dy!==0){pointerCancel(event);return;}
 p.target.style.setProperty('--kc-peel-progress',String(Math.max(0,Math.min(1,dx/85))));
}
function pointerCancel(event){
 if(peelPointer?.id!==event.pointerId)return;
 peelPointer.target.style.removeProperty('--kc-peel-progress');peelPointer=null;
}
function pointerEnd(event){
 const p=peelPointer;
 if(!p||p.id!==event.pointerId)return;
 const dx=event.clientX-p.x,dy=event.clientY-p.y;
 pointerCancel(event);
 if(dx>=55&&Math.abs(dy)<Math.max(35,dx*.65))peelReel();
}
function finishReel(s,reel=s?.reel,manual=false){
 if(!current(s)||!reel||s.reel!==reel)return;
 clearTimeout(reel.timer);
 const payload=reel.payload;
 s.reel=null;
 if(reel.isReplay){s.replayResult=payload.result;paint('result');}
 else{Object.assign(s,payload,{status:'ready'});s.finalUnlock=s.owned.length===roster.length;paint(manual?'result':null);if(s.journalOpen)void readJournal(s);}if(active())playSignature(host?.querySelector('.kc-result'));
}
function showReel(s,payload){
 if(!active()){Object.assign(s,payload,{status:'ready'});s.finalUnlock=s.owned.length===roster.length;paint();if(s.journalOpen)void readJournal(s);return;}
 const reel={payload,phase:'seal',timer:null};
 s.reel=reel;paint();
}
function button(label,action,options={}){
 return '<button type="button" data-kc-action="'+action+'"'+(options.primary?' class="kc-primary"':'')+(options.pressed!==undefined?' aria-pressed="'+options.pressed+'"':'')+(options.focus?' data-kc-focus="'+options.focus+'"':'')+(options.disabled?' disabled':'')+(options.unavailable?' aria-disabled="true"':'')+'>'+esc(label)+'</button>';
}
function notice(s){
 if(s.status==='guest')return '<div class="kc-notice">Войди, чтобы собирать героев и сохранять коллекцию. '+button('Войти','login',{primary:true})+'</div>';
 if(s.status==='idle'||s.status==='loading')return '<div class="kc-notice" role="status">Загружаем твою коллекцию…</div>';
 if(s.status==='error')return '<div class="kc-notice" role="status">Не удалось получить коллекцию. Проверь соединение и попробуй ещё раз. '+button('Повторить','retry')+'</div>';
 return '';
}
const searchIcon='<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10.5" cy="10.5" r="5.75"/><path d="m15 15 4.5 4.5"/></svg>';
const clearSearchIcon='<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="m7 7 10 10M17 7 7 17"/></svg>';
function albumTools(){
 const rareOptions=[['all','Любая редкость'],...Object.entries(rarityNames).reverse()].map(([id,label])=>'<option value="'+id+'"'+(rarityFilter===id?' selected':'')+'>'+esc(label)+'</option>').join('');
 return '<div class="kc-tools kc-album-tools" role="search" aria-label="Поиск по альбому">'
  +'<div class="kc-tools-head"><h3>Персонажи <span class="kc-order-note">По редкости</span></h3><span class="kc-muted" data-kc-result-count role="status" aria-live="polite" aria-atomic="true"></span></div>'
  +'<div class="kc-tools-controls"><div class="kc-search-control"><label for="kc-album-search">Имя персонажа</label><div class="kc-search-field">'+searchIcon
  +'<input id="kc-album-search" type="search" placeholder="Имя или фамилия" maxlength="80" autocomplete="off" autocorrect="off" spellcheck="false" aria-controls="kc-album-results" aria-describedby="kc-search-help" data-kc-focus="album-search" value="'+esc(searchQuery)+'">'
  +'<button type="button" aria-label="Очистить поиск" data-kc-action="clear-search"'+(searchQuery?'':' hidden')+'>'+clearSearchIcon+'</button></div></div>'
  +'<div class="kc-rarity-control"><label for="kc-album-rarity">Редкость</label><select id="kc-album-rarity" aria-controls="kc-album-results" data-kc-focus="album-rarity">'+rareOptions+'</select></div></div>'
  +'<div class="kc-tools-options"><div class="kc-filters" role="group" aria-label="Карточки по статусу">'+Object.entries(collectionFilters).map(([id,title])=>button(title,'filter-'+id,{pressed:filter===id})).join('')+'</div>'
  +'<button type="button" class="kc-reset-filters" data-kc-action="reset-album-filters"'+(hasFilters()?'':' hidden')+'>Сбросить фильтры</button></div>'
  +'<p class="kc-muted kc-tools-hint" id="kc-search-help">Поиск по имени доступен только для открытых карточек.</p>'
  +'</div><section class="kc-album-results" id="kc-album-results" aria-label="Карточки серии"></section>';
}
function bindArtwork(container){
 for(const img of container.querySelectorAll('.kc-portrait,.kc-case-image,.kc-album-image,.kc-pack-thumb,.kc-shelf-hero,.kc-feature-hero')){
  const ready=()=>{if(img.naturalWidth>0)img.setAttribute('data-kc-art-ready','');};
  const failed=()=>{
   if(img.classList.contains('kc-case-image')&&img.hasAttribute('data-kc-pack-fallback')){
    img.removeAttribute('data-kc-pack-fallback');img.src=boosterRoot+'pack-fallback.svg';return;
   }
   img.hidden=true;
  };
  img.addEventListener('load',ready,{once:true});
  img.addEventListener('error',failed);
  if(img.complete){if(img.naturalWidth)ready();else failed();}
 }
}
function refreshAlbumResults(){
 if(!active()||!current(state)||tab!=='collection')return;
 const panel=host.querySelector('#kc-album-results');
 if(!panel)return;
 const owned=new Set(state.owned),term=normalizedName(searchQuery);
 const visible=byRarity(roster.filter(c=>matchesAlbum(c,owned,term)));
 panel.innerHTML=visible.length?'<div class="kc-grid">'+visible.map(c=>card(c,owned.has(c.id))).join('')+'</div>'
  :'<p class="kc-empty">'+(term?'Среди открытых карточек совпадений нет.':'Пока нет персонажей с такими фильтрами.')+'</p>';
 bindArtwork(panel);
 const text='Найдено: '+visible.length;
 const count=host.querySelector('[data-kc-result-count]');
 if(count&&count.textContent!==text)count.textContent=text;
 host.querySelector('[data-kc-action="clear-search"]').hidden=!searchQuery;
 host.querySelector('[data-kc-action="reset-album-filters"]').hidden=!hasFilters();
 for(const control of host.querySelectorAll('.kc-filters [data-kc-action]')){
  control.setAttribute('aria-pressed',String(control.dataset.kcAction==='filter-'+filter));
 }
 host.querySelector('#kc-album-rarity').value=rarityFilter;
}
function updateSearch(input,clear=false){
 if(clear)input.value='';
 const next=input.value.slice(0,80);
 if(next===searchQuery&&!clear)return;
 searchQuery=next;
 refreshAlbumResults();
}
function inputSearch(event){
 const input=event.target.closest?.('#kc-album-search');
 if(!input||!active()||!current(state)||searchComposing||event.isComposing)return;
 updateSearch(input);
}
function changeRarity(event){
 const select=event.target.closest?.('#kc-album-rarity');
 if(!select||!active()||!current(state))return;
 if(select.value!=='all'&&!Object.hasOwn(rarityNames,select.value))return;
 rarityFilter=select.value;refreshAlbumResults();
}
function startSearchComposition(event){
 if(event.target.matches?.('#kc-album-search')&&active()&&current(state))searchComposing=true;
}
function endSearchComposition(event){
 if(!event.target.matches?.('#kc-album-search')||!active()||!current(state))return;
 searchComposing=false;updateSearch(event.target);
 if(deferredPaint){deferredPaint=false;paint();}
}
function focusKey(el){return el?.dataset.kcFocus||el?.dataset.kcAction||null;}
function paint(nextFocus=null){
 if(!active()||!state)return;
 if(searchComposing&&host.contains(document.activeElement)&&document.activeElement.matches('#kc-album-search')){deferredPaint=true;return;}
 if(searchComposing){searchComposing=false;deferredPaint=false;}
 const s=state,owned=new Set(s.owned),known=s.status==='ready'||s.status==='opening',count=known?owned.size:0;
 const previous=host.contains(document.activeElement)?focusKey(document.activeElement):null;
 const selection=previous==='album-search'?[document.activeElement.selectionStart,document.activeElement.selectionEnd]:null;
 if(activeDialog&&(!current(activeDialog.state)||!owned.has(activeDialog.id)))closeViewer(false);
 const inAlbum=tab==='collection',tabBusy=s.status==='opening'||!!s.reel;
 const header=inAlbum?'<header class="kc-header"><h1>Коллекции</h1></header>':'<header class="kc-header"><div><div class="kc-kicker">KomiAnime / Коллекционные карточки</div><h1>Паки</h1><p class="kc-muted">Выбери пак, чтобы открыть новую карточку.</p></div></header>';
 const tabs='<nav class="kc-tabs" aria-label="Коллекции и паки">'+button('Коллекции','collection',{pressed:inAlbum,unavailable:tabBusy&&!inAlbum})+button('Паки','cases',{pressed:!inAlbum,unavailable:tabBusy&&inAlbum})+'</nav>';
 let body='';
 const complete=known&&count===roster.length;
 const retryPurchase=!!s.owner&&!!pending(s.owner);
 const canBuy=s.status==='ready'&&!s.reel&&s.price===CASE_PRICE&&(retryPurchase||!complete&&s.balance>=CASE_PRICE);
 const description=complete?'Все персонажи уже собраны!':s.status==='guest'?'Войди, чтобы купить бустер.':s.status==='opening'?'Открываем бустер…':'В бустере всегда новый персонаж.';
 const balanceText=known&&s.balance!==null?'Баланс: '+s.balance.toLocaleString('ru-RU')+' AniCoin':'Цена: 50 AniCoin';
 const purchase=s.status==='guest'?button('Купить за 50 AniCoin','login',{primary:true}):s.confirmBuy&&canBuy?'<div class="kc-buy-confirm">'+button(retryPurchase?'Повторить запрос':'Подтвердить · 50 AniCoin','buy',{primary:true})+button('Отмена','cancel-buy')+'</div>':button(retryPurchase?'Повторить покупку':complete?'Коллекция собрана':s.status==='opening'?'Открываем…':'Купить за 50 AniCoin','confirm-buy',{primary:true,disabled:!canBuy});
 const purchaseNotice=s.purchaseStatus==='insufficient'||known&&!complete&&!retryPurchase&&s.balance!==null&&s.balance<CASE_PRICE?'Недостаточно AniCoin для покупки.':s.purchaseStatus==='complete'?'Коллекция уже собрана, монеты не списаны.':retryPurchase?'Предыдущая покупка не подтверждена. Повтор запроса не спишет монеты дважды.':'';
 const feature='<article class="kc-case"'+(s.status==='opening'?' aria-busy="true"':'')+'><div class="kc-case-visual"><span class="kc-feature-motif" aria-hidden="true"></span>'+shelfHero(seriesKey,'kc-feature-hero')+packArt()+'<div class="kc-case-edition"><span aria-hidden="true" lang="ja">'+esc(series.script)+'</span><small>СЕРИЯ '+series.edition+'</small></div><span class="kc-case-count">'+roster.length+' персонажей</span></div><div class="kc-case-copy"><div class="kc-kicker">'+esc(series.title)+' · Коллекция '+series.edition+'</div><h2>Бустер «'+esc(series.pack)+'»</h2><p class="kc-muted">Карточек в серии: '+roster.length+'. В каждом бустере одна новая карточка. Шансы равные, повторов нет.</p><div class="kc-rarity-legend" aria-label="Классы редкости">'+Object.keys(rarityNames).map(r=>rarityLabel({rarity:r})).join('')+'</div><p class="kc-muted kc-case-status" role="status" tabindex="-1" data-kc-focus="case-status">'+esc(description)+'</p>'+'<div class="kc-case-actions">' +purchase+'</div><p class="kc-muted kc-wallet">'+esc(balanceText)+'</p>'+(purchaseNotice?'<p class="kc-muted" role="status">'+esc(purchaseNotice)+'</p>':'')+(s.status==='ready'&&!complete?button('Обновить доступность','retry'):'')+'</div></article>';
 const prize=s.reel?null:roster.find(c=>c.id===(s.replayResult||s.result));
 const reward=prize&&known?'<div class="kc-result" role="status">'+signatureMarkup(prize)+card(prize,true,'result')+'<div class="kc-result-copy"><div class="kc-kicker">'+(s.replayResult?'Повтор сцены':'Новый персонаж')+'</div><h3 tabindex="-1" data-kc-focus="result">'+esc(prize.name)+'</h3>'+rarityLabel(prize)+(s.replayResult?button('К журналу','leave-replay'):button('В коллекцию','collection',{primary:true,focus:'result-collection'}))+'</div></div>':'';
 if(inAlbum){
  const extras='<section class="kc-extras"><button type="button" class="kc-extras-toggle" data-kc-action="album-details" aria-expanded="'+s.extrasOpen+'" aria-controls="kc-extras-body"><span>Альбом и журнал</span><svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></button><div id="kc-extras-body"'+(s.extrasOpen?'':' hidden')+'>'+album(owned,known)+collectorProgress(s,owned,known)+journalMarkup(s)+'</div></section>';
  body=albumFinalMarkup(s,owned)+'<div class="kc-series"><div class="kc-series-info"><h2>'+esc(series.title)+'</h2><p class="kc-muted">'+(known?count+' из '+roster.length+' открыто':roster.length+' персонажей')+'</p><div class="kc-progress" role="progressbar" aria-label="Прогресс коллекции" aria-valuemin="0" aria-valuemax="'+roster.length+'"'+(known?' aria-valuenow="'+count+'"':'')+'><span style="width:'+100*count/roster.length+'%"></span></div></div>'+button('Перейти к пакам','cases',{primary:true})+'</div>'+albumTools()+extras;
 }else{
  body=(s.reel||s.replayResult?'':feature)+reelMarkup(s)+reward;
 }
 const markup='<section class="kc-page kc-theme-'+seriesKey+(inAlbum?' kc-clean-album':'')+'" data-komi-aura="'+esc(s.auraClass||'')+'" aria-label="Коллекции и паки">'+header+tabs+seriesPicker()+notice(s)+body+'</section>';
 if(activeDialog?.dialog.isConnected){
  const template=document.createElement('template');template.innerHTML=markup;
  host.querySelector('.kc-page').replaceWith(template.content);
 }else host.innerHTML=markup;
 bindArtwork(host);
 refreshAlbumResults();
 if(activeDialog?.dialog.isConnected){
  const matching=[...host.querySelectorAll('.kc-view-hero')].find(el=>focusKey(el)===activeDialog.key);
  if(matching)activeDialog.trigger=matching;
 }
 // The purchase controls are replaced on each step, but do not steal focus
 // if the viewer has already moved to another control.
 let focus=nextFocus||previous;
 if(focus==='case-status'){
  if(s.reel)focus=s.reel.phase==='seal'?'peel':s.reel.phase==='choose'?'pick-card-1':'skip-reel';
  else if(s.status==='error')focus='retry';
  else if(prize&&known)focus='result';
  else if(canBuy)focus='confirm-buy';
 }else if(focus==='skip-reel'&&!s.reel&&prize&&known)focus='result';
 if(focus){
  const target=[...host.querySelectorAll('[data-kc-action],[data-kc-focus]')].find(el=>focusKey(el)===focus&&!el.disabled);
  target?.focus({preventScroll:focus===previous||!['result','skip-reel','peel','pick-card-1'].includes(focus)});
  if(selection&&focus==='album-search'&&target)target.setSelectionRange(...selection);
 }
}
async function request(action){
 const s=state;
 if(!active()||!current(s)||!s.owner||s.status==='loading'||s.status==='opening')return;
 if(action!=='read'&&action!=='buy')return;
 if(action==='buy'&&(tab!=='cases'||s.status!=='ready'||!!s.reel||s.price!==CASE_PRICE||!s.confirmBuy||(!pending(s.owner)&&(s.balance<CASE_PRICE||s.owned.length===roster.length))))return;
 let purchaseId=null;
 if(action==='buy'){try{purchaseId=pending(s.owner)||root.crypto.randomUUID();remember(s.owner,purchaseId);}catch{return;}}
 s.confirmBuy=false;s.status=action==='read'?'loading':'opening';if(action==='buy'){s.result=null;s.finalUnlock=false;s.finalAnimated=false;s.replayResult=null;}paint(action==='buy'?'case-status':null);
 try{
  if(typeof _supabase==='undefined'||!_supabase)throw new Error('Unavailable');
  const {data:sessionData,error:sessionError}=await _supabase.auth.getSession();
  if(!current(s))return;
  if(sessionError||sessionData?.session?.user?.id!==s.owner)throw new Error('Session changed');
  const {data,error}=seriesKey==='ghoul'
   ?(action==='buy'?await _supabase.rpc('komi_collection_ghoul_buy_v2',{p_request_id:purchaseId}):await _supabase.rpc('komi_collection_action',{p_action:action}))
   :(action==='buy'?await _supabase.rpc('komi_collection_series_buy_v2',{p_series_id:s.seriesKey,p_request_id:purchaseId}):await _supabase.rpc('komi_collection_series_read',{p_series_id:s.seriesKey}));
  if(!current(s))return;
  if(error)throw error;
  const payload=normalizePayload(data);
  if(action==='buy'){if(!payload.purchaseStatus||payload.purchaseStatus==='ok'&&!payload.result)throw Error('Unconfirmed purchase');remember(s.owner,null);}
  if(action==='buy'&&payload.purchaseStatus==='ok'&&payload.result){showReel(s,payload);}else{Object.assign(s,payload,{status:'ready'});paint();}
  if(action==='buy'&&payload.purchaseStatus==='ok'&&typeof aniCoinRequest==='function')void Promise.resolve().then(()=>aniCoinRequest('read',{},s.owner)).catch(()=>{});
 }catch{if(current(s)){s.status='error';s.owned=[];s.result=null;paint();}}
}
function click(event){if(!active())return;const b=event.target.closest?.('.kc-page [data-kc-action]');if(!b||b.disabled||b.getAttribute('aria-disabled')==='true')return;const a=b.dataset.kcAction;if(a.startsWith('series-')){selectSeries(a.slice(7));return;}if(a.startsWith('view-')){openViewer(a.slice(5),b);return;}if(a==='inspect'){inspect(b);return;}if(a.startsWith('slot-')){jumpToCard(a.slice(5));return;}if(a==='album-details'&&tab==='collection'){state.extrasOpen=!state.extrasOpen;paint('album-details');return;}if(a==='journal'||a==='journal-retry'){
 state.journalOpen=a==='journal-retry'||!state.journalOpen;paint('journal');if(state.journalOpen)void readJournal(state);return;
 }if(a.startsWith('replay-')){startReplay(a.slice(7));return;}
 if(a==='leave-replay'){state.replayResult=null;state.extrasOpen=true;tab='collection';paint('journal');return;}
 if(a==='peel'){peelReel();return;}
 if(a.startsWith('pick-card-')){chooseCard(Number(a.slice(10)));return;}
 if(a==='skip-reel'){finishReel(state,state.reel,true);return;}if(a==='collection'||a==='cases'){if(tab!==a){state.confirmBuy=false;state.replayResult=null;state.inspected='';}tab=a;paint(a);}else if(a.startsWith('filter-')){const id=a.slice(7);if(Object.hasOwn(collectionFilters,id)){filter=id;refreshAlbumResults();}}else if(a==='clear-search'||a==='reset-album-filters'){
 const query=host.querySelector('#kc-album-search');
 if(query){if(a==='reset-album-filters')resetFilters();updateSearch(query,true);query.focus({preventScroll:true});}
 }else if(a==='login'){if(typeof openAuthModal==='function')openAuthModal('login','Войди, чтобы сохранить коллекцию персонажей.');}else if(a==='retry')void request('read');else if(a==='confirm-buy'){state.confirmBuy=true;paint('cancel-buy');}else if(a==='cancel-buy'){cancelPurchase();}else if(a==='buy')void request('buy');}
function cancelPurchase(){state.confirmBuy=false;paint('confirm-buy');}
function keydown(event){
 if(event.key!=='Escape'||event.defaultPrevented||!active()||!current(state)||
    document.getElementById('komiMobileMoreToggle')?.getAttribute('aria-expanded')==='true')return;
 if(event.target.matches?.('#kc-album-search')){
  if(event.isComposing||searchComposing)return;
  if(!event.target.value)return;
  event.preventDefault();event.stopPropagation();updateSearch(event.target,true);return;
 }
 if(state.reel&&event.target.closest?.('.kc-pick-panel')){
  event.preventDefault();event.stopPropagation();finishReel(state,state.reel,true);return;
 }
 const inspectButton=event.target.closest?.('.kc-inspect[aria-expanded="true"]');
 if(inspectButton){event.preventDefault();event.stopPropagation();inspect(inspectButton);return;}
 if(!state?.confirmBuy||
    !event.target.closest?.('.kc-buy-confirm'))return;
 event.preventDefault();event.stopPropagation();cancelPurchase();
}
function render(container){
 const style=document.querySelector('link[data-komi-collection-style]');if(style&&style.media!=='all')style.media='all';
 if(host!==container){
  closeViewer(false);searchComposing=false;deferredPaint=false;
  const listeners={click,keydown,input:inputSearch,change:changeRarity,compositionstart:startSearchComposition,compositionend:endSearchComposition,pointerdown:pointerStart,pointermove:pointerMove,pointerup:pointerEnd,pointercancel:pointerCancel};
  for(const [name,handle] of Object.entries(listeners)){host?.removeEventListener(name,handle);container.addEventListener(name,handle);}
  host=container;
 }
 const id=owner();if(!state||state.owner!==id){if(state?.reel){clearTimeout(state.reel.timer);}resetFilters();state=fresh(id);}
 paint();if(state.status==='idle')void request('read');
 if(id)void loadOwnedAura(id);
}
root.KomiCollection=Object.freeze({render,authChanged,roster:ghoulRoster,normalizePayload,makeReel,seriesList,ghoulFx});
})(typeof window==='object'?window:{});
