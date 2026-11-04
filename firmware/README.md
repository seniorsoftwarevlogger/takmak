# Прошивки Takmak

[OLED v0.1.0 — проверенная вертикальная версия](https://github.com/seniorsoftwarevlogger/takmak/releases/tag/oled-v0.1.0)
для ведущей левой половинки: [обновление](../docs/firmware/oled.md),
[English](../docs/firmware/oled.en.md), [манифест](releases/oled-v0.1.0.json).
UF2 и SHA-256 опубликованы в GitHub Releases. Фотография подтверждённого
результата включена в руководство; резервные копии контроллеров не публикуются.

Экспериментальная прошивка большого TFT 76×284 находится в отдельной ветке
[`codex/tft-screen`](https://github.com/seniorsoftwarevlogger/takmak/tree/codex/tft-screen/firmware/zmk-takmak-tft).
Проверена макетка с отключённой матрицей, полноценная сборка с TFT ещё требует проверки.

- `zmk-keyboard-takmak/` — рабочий снимок основного ZMK-модуля, включая локальные
  изменения `takmak.dtsi` и `takmak.keymap` владельца.
- `zmk-dongle-screen/` — модуль экрана отдельного донгла, на версии, закреплённой
  в manifest основного модуля.
- `legacy/zmk-shield/` и `legacy/zmk_new-shield/` — историческая и экспериментальная
  конфигурации из локальных рабочих деревьев. Не считать готовыми релизами.
- `legacy/github-qmk/` — QMK из прежнего состояния GitHub, сохранённый отдельно
  от текущего локального `../qmk_firmware/`.

Исходные репозитории, commit SHA, локальные изменения и SHA-256 файлов записаны
в `sources.json`. Лицензии модулей сохранены. Вложенные `.github/workflows`
служат исторической справкой и не запускаются из корня этого репозитория.

Полные ZMK/Zephyr, кеши west, SDK и результаты локальных сборок не включены.
Снимки модулей сохранены без переписывания исходных manifests: `config/west.yml`
основного модуля по-прежнему закрепляет внешние ZMK и zmk-dongle-screen.
При сборке из monorepo путь к локальному модулю — `firmware/zmk-keyboard-takmak`.
Проверенный UF2 OLED опубликован отдельно; готовые бинарные файлы для других
комплектаций пока не предлагаются. Workflow Pages собирает только сайт.
