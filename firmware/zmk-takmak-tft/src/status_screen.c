/* SPDX-License-Identifier: MIT */
#include <stdio.h>
#include <zephyr/kernel.h>
#include <zephyr/device.h>
#include <zephyr/drivers/gpio.h>
#include <zephyr/drivers/spi.h>
#include <zephyr/logging/log.h>
#include <lvgl.h>
#include <zmk/display/status_screen.h>
#include <zmk/usb.h>
#include <zmk/keymap.h>
#include <zmk/split/central.h>
#include <zephyr/sys/atomic.h>
#include <zmk/events/battery_state_changed.h>
#include <zmk/events/position_state_changed.h>
#include <zmk/battery.h>

LOG_MODULE_REGISTER(takmak_tft, LOG_LEVEL_INF);

static lv_obj_t *status_label;
static lv_obj_t *layer_label;
static lv_obj_t *battery_label;
static atomic_t battery_seen;
#if (IS_ENABLED(CONFIG_SHIELD_TAKMAK_TFT_LEFT) || IS_ENABLED(CONFIG_SHIELD_TAKMAK_TFT_LEFT_BENCH))
static atomic_t key_presses;
static int key_listener(const zmk_event_t *event) {
    const struct zmk_position_state_changed *key = as_zmk_position_state_changed(event);
    if (key && key->state) atomic_inc(&key_presses);
    return ZMK_EV_EVENT_BUBBLE;
}
ZMK_LISTENER(takmak_tft_keys, key_listener);
ZMK_SUBSCRIPTION(takmak_tft_keys, zmk_position_state_changed);
#endif

static int battery_listener(const zmk_event_t *event) {
    const struct zmk_peripheral_battery_state_changed *battery =
        as_zmk_peripheral_battery_state_changed(event);
    if (battery && battery->source < 2) atomic_set_bit(&battery_seen, battery->source);
    return ZMK_EV_EVENT_BUBBLE;
}
ZMK_LISTENER(takmak_tft_battery, battery_listener);
ZMK_SUBSCRIPTION(takmak_tft_battery, zmk_peripheral_battery_state_changed);

/* Zephyr 3.5's ST7789V driver always sends INVON. This panel requires INVOFF.
 * This runs once on the display queue before the first LVGL refresh. */
static int disable_panel_inversion(void) {
    const struct spi_dt_spec bus = SPI_DT_SPEC_GET(DT_NODELABEL(tft),
        SPI_OP_MODE_MASTER | SPI_WORD_SET(8), 0);
    const struct gpio_dt_spec dc = GPIO_DT_SPEC_GET(DT_NODELABEL(tft), cmd_data_gpios);
    uint8_t command = 0x20;
    struct spi_buf buffer = {.buf = &command, .len = 1};
    const struct spi_buf_set buffers = {.buffers = &buffer, .count = 1};
    if (!spi_is_ready_dt(&bus) || !gpio_is_ready_dt(&dc)) return -ENODEV;
    int err = gpio_pin_set_dt(&dc, 1); // Active-low D/C: command mode.
    if (err) return err;
    return spi_write_dt(&bus, &buffers);
}

static void refresh_status(lv_timer_t *timer) {
    ARG_UNUSED(timer);
#if !(IS_ENABLED(CONFIG_SHIELD_TAKMAK_TFT_LEFT) || IS_ENABLED(CONFIG_SHIELD_TAKMAK_TFT_LEFT_BENCH))
    const char *usb = zmk_usb_is_hid_ready() ? "USB connected" : "Waiting for USB";
#endif
#if (IS_ENABLED(CONFIG_SHIELD_TAKMAK_TFT_LEFT) || IS_ENABLED(CONFIG_SHIELD_TAKMAK_TFT_LEFT_BENCH))
    lv_label_set_text_fmt(status_label, "%s | %lus | Keys %ld",
                         zmk_usb_is_hid_ready() ? "USB" : "USB off",
                         (unsigned long)(k_uptime_get() / 1000), (long)atomic_get(&key_presses));
#else
    lv_label_set_text_fmt(status_label, "%s  |  %lus", usb,
                         (unsigned long)(k_uptime_get() / 1000));
#endif
    zmk_keymap_layer_id_t layer = zmk_keymap_layer_index_to_id(zmk_keymap_highest_layer_active());
    const char *name = zmk_keymap_layer_name(layer);
    lv_label_set_text_fmt(layer_label, "Layer: %s", name ? name : "?");
    char left[8] = "--", right[8] = "--";
    uint8_t level;
#if (IS_ENABLED(CONFIG_SHIELD_TAKMAK_TFT_LEFT) || IS_ENABLED(CONFIG_SHIELD_TAKMAK_TFT_LEFT_BENCH))
    snprintf(left, sizeof(left), "%u%%", zmk_battery_state_of_charge());
    if (atomic_test_bit(&battery_seen, 0) &&
        zmk_split_central_get_peripheral_battery_level(0, &level) == 0)
        snprintf(right, sizeof(right), "%u%%", level);
    lv_label_set_text_fmt(battery_label, "L %s  R %s", left, right);
#else
    if (atomic_test_bit(&battery_seen, 0) &&
        zmk_split_central_get_peripheral_battery_level(0, &level) == 0)
        snprintf(left, sizeof(left), "%u%%", level);
    if (atomic_test_bit(&battery_seen, 1) &&
        zmk_split_central_get_peripheral_battery_level(1, &level) == 0)
        snprintf(right, sizeof(right), "%u%%", level);
    lv_label_set_text_fmt(battery_label, "P1 %s  P2 %s", left, right);
#endif
}

static lv_obj_t *make_label(lv_obj_t *parent, int x, int y, int width) {
    lv_obj_t *label = lv_label_create(parent);
    lv_obj_set_pos(label, x, y);
    lv_obj_set_width(label, width);
    lv_label_set_long_mode(label, LV_LABEL_LONG_CLIP);
    lv_obj_set_style_text_font(label, &lv_font_montserrat_12, LV_PART_MAIN);
    lv_obj_set_style_text_color(label, lv_color_white(), LV_PART_MAIN);
    return label;
}

lv_obj_t *zmk_display_status_screen(void) {
    int err = disable_panel_inversion();
    if (err) LOG_ERR("ST7789 INVOFF failed: %d", err);
    else LOG_INF("ST7789 284x76 ready, offset 18/82, inversion OFF, SPI 1 MHz");

    lv_obj_t *screen = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(screen, lv_color_black(), LV_PART_MAIN);
    lv_obj_set_style_bg_opa(screen, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_pad_all(screen, 0, LV_PART_MAIN);
    lv_obj_set_style_border_width(screen, 1, LV_PART_MAIN);
    lv_obj_set_style_border_color(screen, lv_color_white(), LV_PART_MAIN);
    lv_obj_clear_flag(screen, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *title = make_label(screen, 6, 3, 270);
    lv_obj_set_style_text_font(title, &lv_font_montserrat_16, LV_PART_MAIN);
#if (IS_ENABLED(CONFIG_SHIELD_TAKMAK_TFT_LEFT) || IS_ENABLED(CONFIG_SHIELD_TAKMAK_TFT_LEFT_BENCH))
#if IS_ENABLED(CONFIG_SHIELD_TAKMAK_TFT_LEFT_BENCH)
    lv_label_set_text(title, "TAKMAK / left test");
#else
    lv_label_set_text(title, "TAKMAK  /  left half");
#endif
#else
    lv_label_set_text(title, "TAKMAK  /  ZMK dongle");
#endif
    status_label = make_label(screen, 6, 27, 270);
    layer_label = make_label(screen, 6, 52, 140);
    battery_label = make_label(screen, 146, 52, 130);
    refresh_status(NULL);
    lv_timer_create(refresh_status, 1000, NULL);
    return screen;
}
