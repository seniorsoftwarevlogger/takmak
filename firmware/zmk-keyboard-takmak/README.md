# ZMK Module Template

This repository contains a template for a ZMK module, as it would most frequently be used. 

## Usage

Read through the [ZMK Module Creation](https://zmk.dev/docs/development/module-creation) page for details on how to configure this template.

## More Info

For more info on modules, you can read through  through the [Zephyr modules page](https://docs.zephyrproject.org/3.5.0/develop/modules.html) and [ZMK's page on using modules](https://zmk.dev/docs/features/modules). [Zephyr's west manifest page](https://docs.zephyrproject.org/3.5.0/develop/west/manifest.html#west-manifests) may also be of use.

## OLED центральной левой половинки

[Скачать OLED v0.1.0](https://github.com/seniorsoftwarevlogger/takmak/releases/tag/oled-v0.1.0) · [Инструкция обновления](../../docs/firmware/oled.md) · [Update guide in English](../../docs/firmware/oled.en.md)

В сборке `standalone_left_central` физический OLED 128×32 используется
вертикально: интерфейс 32×128 поворачивается программно на 90° по часовой
стрелке перед отправкой однобитных пикселей в SSD1306. Проводка не меняется.

Сверху вниз: `USB` либо BT-профиль, слой `BAS`/`LOW`/`RAI`/`GAM`/`EXT`,
разделитель, монохромная молния, затем строки `L100` и `R 67`.
Молния обозначает блок батарей, а не измеренный процесс зарядки.
Знаков процента нет. Моноширинный шрифт 8×8 вмещает ровно четыре символа;
расстояние между началами строк L/R — 12 пикселей. Неизвестные или
переименованные слои показываются номером (`L5`), поэтому длинные и
не-латинские названия не обрезаются на узком экране.

Используется peripheral source 0 — первая ведомая половинка standalone.
До первого показания и при потере связи отображается `R --`; реальный
нулевой заряд подключённой половинки — `R  0`. Служебный ноль ZMK при
отключении фильтруется по состоянию соединения. После переподключения
экран ждёт новое показание, не восстанавливая устаревший заряд.
Снимок состояния проверяется каждые 200 мс в очереди LVGL, физический
экран обновляется только при изменении данных. Это исправление индикации
не изменяет механизм переподключения BLE.

Экран реализован в `src/oled_status_screen.c` этого модуля; изменения ZMK не
требуются. Режим левой половинки с отдельным донглом использует стандартный
экран. Для обновления standalone-клавиатуры достаточно прошить центральную
левую половинку, прошивка правой не менялась.

Сборка в подготовленном west workspace с зависимостями из `config/west.yml`:

```sh
west build -p always -s zmk/app -d build/standalone_left_central -b nice_nano_v2 \
  -S studio-rpc-usb-uart -- \
  -DZMK_EXTRA_MODULES=/absolute/path/to/takmak/firmware/zmk-keyboard-takmak \
  -DSHIELD=takmak_left \
  -DCONFIG_ZMK_STUDIO=y \
  -DCONFIG_ZMK_SPLIT_ROLE_CENTRAL=y \
  '-DCONFIG_ZMK_KEYBOARD_NAME="Takmak 3.1 SL"'
```

Локальный UF2: `artifacts/standalone_left_central-portrait.uf2`, рядом SHA-256.
Снимки реального кода экрана с тестовыми данными: `artifacts/portrait/`.
Проверены USB и все состояния BT-профиля, пять слоёв и длинные/не-латинские
названия, значения заряда 0/5/66/67/100, ожидание данных, события до запуска
экрана, отключение и переподключение, реальный нулевой заряд. Host-проверка
использует настоящие LVGL и Zephyr `lvgl_set_px_cb_mono`, буфер 327 байт,
как в прошивке, и ASan/UBSan. Проверены все 4096 положений пикселя при
повороте, очистка частичной области, границы надписей и отсутствие лишних
перерисовок. Дополнительный буфер поворота — 512 байт, heap LVGL — 8192 байта.
Вертикальная версия прошита 4 ноября 2026 на ведущую левую половинку.
Пользователь подтвердил работу фотографией:
правильная ориентация, читаемые `USB`, `BAS`, молния, `L100` и `R 66`.
UF2 SHA-256: `a8d8899c9b5205647a85baefde905de175f598161424d74e7d0d5000d187b868`.
Фотография: [OLED на клавиатуре](../../docs/firmware/oled-portrait.jpg).
Исправление ложного нуля проверено host-тестами; повторная физическая
проверка отключения/переподключения правой половинки отдельно не подтверждена.
