/* SPDX-License-Identifier: MIT */
#include <stdio.h>
#include <string.h>
#include <ctype.h>
#include <zephyr/kernel.h>
#include <zephyr/drivers/gpio.h>
#include <zephyr/drivers/spi.h>
#include <zephyr/sys/atomic.h>
#include <zephyr/logging/log.h>
#include <lvgl.h>
#include <zmk/display/status_screen.h>
#include <zmk/battery.h>
#include <zmk/ble.h>
#include <zmk/endpoints.h>
#include <zmk/keymap.h>
#include <zmk/rgb_underglow.h>
#include <zmk/split/central.h>
#include <zmk/wpm.h>
#include <zmk/events/battery_state_changed.h>
#include "portrait_screen.h"
#include "portrait_assets.h"

LOG_MODULE_REGISTER(takmak_tft, LOG_LEVEL_INF);
#define WIDTH 76
#define HEIGHT 284
BUILD_ASSERT(DT_PROP(DT_NODELABEL(tft), width) == WIDTH);
BUILD_ASSERT(DT_PROP(DT_NODELABEL(tft), height) == HEIGHT);
BUILD_ASSERT(sizeof(lv_color_t) == 2);

static lv_color_t pixels[WIDTH * HEIGHT];
static lv_obj_t *canvas;
static lv_color_t ink, muted, accent, track, background;
static atomic_t current_page = ATOMIC_INIT(2); /* Topography on power-up. */
static atomic_t right_battery_seen;
static const char *const page_names[] = {"status", "control", "topography"};

void takmak_tft_next_page(void) {
    atomic_val_t old;
    do { old = atomic_get(&current_page); }
    while (!atomic_cas(&current_page, old, (old + 1) % 3));
    LOG_INF("TFT page %ld: %s", (long)((old + 1) % 3), page_names[(old + 1) % 3]);
}
static int battery_listener(const zmk_event_t *event) {
    const struct zmk_peripheral_battery_state_changed *battery =
        as_zmk_peripheral_battery_state_changed(event);
    if (battery && battery->source == 0) atomic_set(&right_battery_seen, 1);
    return ZMK_EV_EVENT_BUBBLE;
}
ZMK_LISTENER(takmak_portrait_battery, battery_listener);
ZMK_SUBSCRIPTION(takmak_portrait_battery, zmk_peripheral_battery_state_changed);

static void rectangle(int x, int y, int width, int height, lv_color_t color) {
    int right = MIN(WIDTH, x + width), bottom = MIN(HEIGHT, y + height);
    for (int py = MAX(y, 0); py < bottom; py++)
        for (int px = MAX(x, 0); px < right; px++) pixels[py * WIDTH + px] = color;
}
static void text(const char *string, int x, int y, int scale, lv_color_t color) {
    while (*string) {
        unsigned char ch = (unsigned char)*string++;
        if (ch >= 32 && ch <= 90) {
            for (int col = 0; col < 5; col++)
                for (int row = 0; row < 7; row++)
                    if (portrait_font[ch - 32][col] & BIT(row))
                        rectangle(x + col * scale, y + row * scale, scale, scale, color);
        }
        x += 6 * scale;
    }
}
static void center(const char *string, int y, int scale, lv_color_t color) {
    int width = ((int)strlen(string) * 6 - 1) * scale;
    text(string, (WIDTH - width) / 2, y, scale, color);
}
static void divider(int y) { rectangle(8, y, 60, 1, track); }
static void bar(int y, int value) {
    rectangle(8, y, 60, 3, track);
    if (value >= 0) rectangle(8, y, CLAMP(value, 0, 100) * 60 / 100, 3, ink);
}

struct screen_state {
    int page, local_battery, remote_battery, wpm, brightness;
    bool rgb_on;
    char output[12];
    char layer[12];
};
static struct screen_state last;
static bool drawn;

static void take_snapshot(struct screen_state *state) {
    memset(state, 0, sizeof(*state));
    state->page = atomic_get(&current_page);
    state->local_battery = zmk_battery_state_of_charge();
    state->remote_battery = -1;
    uint8_t level;
    if (atomic_get(&right_battery_seen) &&
        !zmk_split_central_get_peripheral_battery_level(0, &level)) state->remote_battery = level;
    state->wpm = CLAMP(zmk_wpm_get_state(), 0, 999);
    state->brightness = zmk_rgb_underglow_calc_brt(0).b; /* direction 0 reads current setting */
    zmk_rgb_underglow_get_state(&state->rgb_on);
    struct zmk_endpoint_instance endpoint = zmk_endpoints_selected();
    if (endpoint.transport == ZMK_TRANSPORT_USB) {
        strcpy(state->output, "USB");
    } else {
        unsigned int profile = CLAMP(zmk_ble_active_profile_index(), 0, 9) + 1;
        snprintf(state->output, sizeof(state->output), "BT %u%s",
                 profile,
                 zmk_ble_active_profile_is_connected() ? "" : " --");
    }
    zmk_keymap_layer_id_t layer = zmk_keymap_layer_index_to_id(zmk_keymap_highest_layer_active());
    const char *name = zmk_keymap_layer_name(layer);
    if (name) {
        for (int i = 0; i < sizeof(state->layer) - 1 && name[i]; i++)
            state->layer[i] = toupper((unsigned char)name[i]);
    } else {
        snprintf(state->layer, sizeof(state->layer), "L%u", (unsigned)layer);
    }
}
static void draw_layer(const struct screen_state *state, int y) {
    center(state->layer, y, strlen(state->layer) <= 6 ? 2 : 1, ink);
}
static void battery_text(int value, char *buffer, size_t length) {
    if (value < 0) snprintf(buffer, length, "--");
    else snprintf(buffer, length, "%d%%", value);
}
static void compact_batteries(const struct screen_state *state, int y) {
    char left[6], right[6], both[14];
    battery_text(state->local_battery, left, sizeof(left));
    battery_text(state->remote_battery, right, sizeof(right));
    snprintf(both, sizeof(both), "L%s R%s", left, right);
    center(both, y, 1, muted);
}
static void draw_status(const struct screen_state *state) {
    char buffer[12];
    center("LAYER", 40, 1, muted); draw_layer(state, 56); divider(85);
    text("L", 8, 100, 1, ink);
    battery_text(state->local_battery, buffer, sizeof(buffer)); text(buffer, 42, 100, 1, ink);
    bar(115, state->local_battery);
    text("R", 8, 131, 1, ink);
    battery_text(state->remote_battery, buffer, sizeof(buffer)); text(buffer, 42, 131, 1, ink);
    bar(146, state->remote_battery); divider(162);
    center("WPM", 175, 1, muted);
    snprintf(buffer, sizeof(buffer), "%d", state->wpm); center(buffer, 191, 3, ink);
    divider(228); center(state->rgb_on ? "RGB" : "RGB OFF", 238, 1, muted);
    snprintf(buffer, sizeof(buffer), "%d%%", state->brightness); center(buffer, 253, 2, accent);
}
static void draw_control(const struct screen_state *state) {
    char buffer[8];
    center("RGB", 47, 1, ink); center("BRIGHTNESS", 64, 1, muted);
    snprintf(buffer, sizeof(buffer), "%d", state->brightness); center(buffer, 100, 4, accent);
    center("%", 140, 1, muted);
    for (int i = 0; i < 15; i++)
        rectangle(9 + i * 4, 162, 2, 25, i < (state->brightness * 15 + 50) / 100 ? accent : track);
    center(state->rgb_on ? "ON" : "OFF", 195, 1, muted);
    divider(212); draw_layer(state, 226); compact_batteries(state, 256);
}
static void draw_topography(const struct screen_state *state) {
    compact_batteries(state, 40);
    for (int y = 0; y < 146; y++) for (int x = 0; x < WIDTH; x++) {
        int i = y * WIDTH + x;
        if (portrait_topography[i / 8] & BIT(i % 8)) pixels[(y + 65) * WIDTH + x] = muted;
    }
    center("TAKMAK", 217, 1, muted); divider(237); draw_layer(state, 251);
}
static void refresh(lv_timer_t *timer) {
    ARG_UNUSED(timer);
    struct screen_state now;
    take_snapshot(&now);
    if (drawn && !memcmp(&now, &last, sizeof(now))) return;
    last = now; drawn = true;
    rectangle(0, 0, WIDTH, HEIGHT, background);
    center(now.output, 10, 1, ink); divider(27);
    switch (now.page) {
    case 0: draw_status(&now); break;
    case 1: draw_control(&now); break;
    default: draw_topography(&now); break;
    }
    for (int page = 0; page < 3; page++) rectangle(25 + page * 10, 276, 6, 2, page == now.page ? ink : track);
    lv_obj_invalidate(canvas);
}
static int disable_inversion(void) {
    const struct spi_dt_spec bus = SPI_DT_SPEC_GET(DT_NODELABEL(tft), SPI_OP_MODE_MASTER | SPI_WORD_SET(8), 0);
    const struct gpio_dt_spec dc = GPIO_DT_SPEC_GET(DT_NODELABEL(tft), cmd_data_gpios);
    uint8_t command = 0x20;
    struct spi_buf buffer = {.buf = &command, .len = 1};
    const struct spi_buf_set buffers = {.buffers = &buffer, .count = 1};
    if (!spi_is_ready_dt(&bus) || !gpio_is_ready_dt(&dc)) return -ENODEV;
    int err = gpio_pin_set_dt(&dc, 1);
    return err ? err : spi_write_dt(&bus, &buffers);
}
lv_obj_t *zmk_display_status_screen(void) {
    int err = disable_inversion();
    if (err) LOG_ERR("ST7789 INVOFF failed: %d", err);
    background = lv_color_hex(0x050707); ink = lv_color_hex(0xeaf5ef);
    muted = lv_color_hex(0x8b9d91); accent = lv_color_hex(0xff934c); track = lv_color_hex(0x29332e);
    lv_obj_t *screen = lv_obj_create(NULL);
    lv_obj_remove_style_all(screen);
    lv_obj_set_size(screen, WIDTH, HEIGHT);
    lv_obj_set_style_bg_color(screen, background, 0);
    lv_obj_set_style_bg_opa(screen, LV_OPA_COVER, 0);
    lv_obj_clear_flag(screen, LV_OBJ_FLAG_SCROLLABLE);
    canvas = lv_canvas_create(screen);
    lv_canvas_set_buffer(canvas, pixels, WIDTH, HEIGHT, LV_IMG_CF_TRUE_COLOR);
    lv_obj_set_pos(canvas, 0, 0);
    refresh(NULL);
    lv_timer_create(refresh, 200, NULL);
    LOG_INF("Portrait TFT 76x284, offsets 82/18, three pages; starts with topography");
    return screen;
}
