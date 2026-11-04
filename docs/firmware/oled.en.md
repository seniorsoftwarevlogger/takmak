# Takmak OLED v0.1.1

[Download UF2](https://github.com/seniorsoftwarevlogger/takmak/releases/download/oled-v0.1.1/takmak-oled-left-central-v0.1.1.uf2) · [Release and SHA-256](https://github.com/seniorsoftwarevlogger/takmak/releases/tag/oled-v0.1.1) · [Русский](oled.md)

An update for the **left central half** of Takmak using a SuperMini nRF52840 /
nice!nano v2 controller and a 0.91-inch SSD1306 128×32 I²C OLED.
The left half connects to the computer over USB/BLE; the right half is a BLE
peripheral. This is not firmware for a separate dongle or the large TFT.
This UF2 updates the left half only; keep the existing compatible right-half
firmware. For a new keyboard, use the [sources and build matrix](../../firmware/zmk-keyboard-takmak).

## Changes

- Portrait 32×128 layout: output, layer and both battery levels.
- One 8×8 monospace font throughout; output and layer labels have the same size.
- Small native 8×8 lightning icon, with the divider removed.
- 12-pixel row pitch, 24-pixel group pitch and equal 30-pixel top/bottom margins.
- `L100` / `R 67` rows replace WPM and percentage signs, with 12-pixel row spacing.
- `R --` while disconnected or waiting for data; a real empty battery reads `R  0`.
- Fresh battery data is required after reconnecting.
- ZMK Studio and the existing keymap are retained. BLE reconnection behavior is unchanged.

The lightning icon labels the battery section; it does not measure charging current.

![v0.1.1 preview rendered by real LVGL, enlarged ×3](oled-balanced-preview.png)

[Previous v0.1.0 hardware photo](oled-portrait.jpg) · [Previous release](https://github.com/seniorsoftwarevlogger/takmak/releases/tag/oled-v0.1.0)

## Update

1. Download `takmak-oled-left-central-v0.1.1.uf2` from the release.
2. Connect the **left** half using a USB data cable.
3. Double-tap Reset to mount the `NICENANO` drive.
4. Copy the UF2 onto the drive. The controller reboots after flashing.
5. Check the portrait display, input from both halves and L/R battery readings.

Normal updates do not require `settings_reset`. If the right half fails to
reconnect, first restart both halves with a single reset each. Clearing bonds
is not part of this update.

## Validation and reproducibility

Flashed on November 4, 2026; the controller re-enumerated as Takmak 3.1 SL.
The user has not yet visually confirmed the revised layout on hardware.
Rendering was checked using real LVGL and Zephyr's monochrome pixel encoder:
all battery values 0–100, layers, disconnect states, partial updates, rotation
of all 4096 pixels, label bounds and spacing. ASan/UBSan tests passed.
The lightning icon was re-rendered and reviewed after replacing the unclear
small font glyph. A physical disconnect/reconnect test is not separately confirmed.

UF2 SHA-256:

```text
2af9d085787cf41397997af6af20ab3b95ceb4e325ef0515e227961cc6e94dbb
```

The [release manifest](../../firmware/releases/oled-v0.1.1.json) records pinned
dependencies, compiled-source checksums and build parameters.
The [build command](../../firmware/zmk-keyboard-takmak/README.md) uses the local
module in this repository. FLASH: 341760 bytes; RAM: 82442 bytes.
