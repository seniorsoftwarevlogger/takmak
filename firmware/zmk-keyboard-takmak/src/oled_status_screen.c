/* SPDX-License-Identifier: MIT */
#include <stdio.h>
#include <string.h>
#include <zephyr/kernel.h>
#include <zephyr/device.h>
#include <zephyr/drivers/display.h>
#include <zephyr/logging/log.h>
#include <zephyr/sys/atomic.h>
#include <zmk/battery.h>
#include <zmk/ble.h>
#include <zmk/display/status_screen.h>
#include <zmk/endpoints.h>
#include <zmk/events/battery_state_changed.h>
#include <zmk/keymap.h>
#include <zmk/split/central.h>
#include <zmk/split/transport/central.h>

LOG_MODULE_REGISTER(takmak_oled, CONFIG_ZMK_LOG_LEVEL);

#define OLED_WIDTH 128
#define OLED_HEIGHT 32

/* Five 8-pixel rows, 12-pixel pitch, one extra blank row between groups.
 * The 68-pixel stack has equal 30-pixel margins on the 128-pixel display. */
enum {
    TEXT_HEIGHT = 8,
    ROW_PITCH = 12,
    OUTPUT_Y = 30,
    LAYER_Y = OUTPUT_Y + ROW_PITCH,
    BATTERY_Y = LAYER_Y + 2 * ROW_PITCH,
    LEFT_Y = BATTERY_Y + ROW_PITCH,
    RIGHT_Y = LEFT_Y + ROW_PITCH,
};

static const struct device *const oled = DEVICE_DT_GET(DT_CHOSEN(zephyr_display));
/* SSD1306 and Zephyr's mono LVGL buffers use vertical, LSB-first tiles. */
static uint8_t native_pixels[OLED_WIDTH * OLED_HEIGHT / 8];
static lv_obj_t *output_label, *layer_label, *left_label, *right_label;
/* Source 0 is the standalone right half. -1 means no current reading. */
static atomic_t peripheral_battery_level = ATOMIC_INIT(-1);

static void portrait_rounder(lv_disp_drv_t *driver, lv_area_t *area) {
    area->y1 &= ~7;
    area->y2 |= 7;
}

static void portrait_flush(lv_disp_drv_t *driver, const lv_area_t *area, lv_color_t *colors) {
    const uint8_t *pixels = (const uint8_t *)colors;
    int width = lv_area_get_width(area);
    for (int y = area->y1; y <= area->y2; y++) {
        for (int x = area->x1; x <= area->x2; x++) {
            bool lit = pixels[(y - area->y1) / 8 * width + x - area->x1] &
                       BIT((y - area->y1) % 8);
            /* Clockwise: logical (x,y) -> native (127-y,x). */
            int native_x = OLED_WIDTH - 1 - y;
            int native_y = x;
            uint8_t *pixel = &native_pixels[native_y / 8 * OLED_WIDTH + native_x];
            uint8_t mask = BIT(native_y % 8);
            if (lit) {
                *pixel |= mask;
            } else {
                *pixel &= ~mask;
            }
        }
    }
    if (lv_disp_flush_is_last(driver)) {
        const struct display_buffer_descriptor desc = {
            .buf_size = sizeof(native_pixels),
            .width = OLED_WIDTH, .height = OLED_HEIGHT, .pitch = OLED_WIDTH,
        };
        int err = display_write(oled, 0, 0, &desc, native_pixels);
        if (err) {
            LOG_ERR("OLED refresh failed: %d", err);
        }
    }
    lv_disp_flush_ready(driver);
}

static bool peripheral_is_connected(void) {
    uint8_t sources[ZMK_SPLIT_CENTRAL_PERIPHERAL_COUNT];
    STRUCT_SECTION_FOREACH(zmk_split_transport_central, transport) {
        if (!transport->api->get_available_source_ids) {
            continue;
        }
        if (transport->api->get_status) {
            struct zmk_split_transport_status status = transport->api->get_status();
            if (!status.enabled || !status.available) {
                continue;
            }
        }
        int count = transport->api->get_available_source_ids(sources);
        for (int i = 0; i < count && i < ARRAY_SIZE(sources); i++) {
            if (sources[i] == 0) {
                return true;
            }
        }
    }
    return false;
}

static int peripheral_battery_listener(const zmk_event_t *event) {
    const struct zmk_peripheral_battery_state_changed *battery =
        as_zmk_peripheral_battery_state_changed(event);
    if (battery && battery->source == 0 && battery->state_of_charge <= 100) {
        /* ZMK also emits zero when the peripheral disconnects. */
        int level = battery->state_of_charge;
        if (level == 0 && !peripheral_is_connected()) {
            level = -1;
        }
        atomic_set(&peripheral_battery_level, level);
    }
    return ZMK_EV_EVENT_BUBBLE;
}
ZMK_LISTENER(takmak_oled_battery, peripheral_battery_listener);
ZMK_SUBSCRIPTION(takmak_oled_battery, zmk_peripheral_battery_state_changed);

static void set_text(lv_obj_t *label, const char *text) {
    if (strcmp(lv_label_get_text(label), text) != 0) {
        lv_label_set_text(label, text);
    }
    lv_obj_update_layout(label);
    lv_obj_set_x(label, (OLED_HEIGHT - lv_obj_get_width(label)) / 2);
}

static void refresh_status(lv_timer_t *timer) {
    char text[8];
    struct zmk_endpoint_instance endpoint = zmk_endpoints_selected();
    if (endpoint.transport == ZMK_TRANSPORT_USB) {
        set_text(output_label, "USB");
    } else {
        char status = zmk_ble_active_profile_is_open() ? '?' :
                      zmk_ble_active_profile_is_connected() ? '+' : '-';
        snprintf(text, sizeof(text), "BT%u%c", endpoint.ble.profile_index + 1, status);
        set_text(output_label, text);
    }
    zmk_keymap_layer_index_t index = zmk_keymap_highest_layer_active();
    const char *name = zmk_keymap_layer_name(zmk_keymap_layer_index_to_id(index));
    static const char *const names[] = {"Base", "Lower", "Raise", "Gaming", "Extra"};
    static const char *const short_names[] = {"BAS", "LOW", "RAI", "GAM", "EXT"};
    const char *short_name = NULL;
    for (size_t i = 0; i < ARRAY_SIZE(names); i++) {
        if (name && strcmp(name, names[i]) == 0) {
            short_name = short_names[i];
            break;
        }
    }
    snprintf(text, sizeof(text), "L%u", index);
    set_text(layer_label, short_name ? short_name : text);
    snprintf(text, sizeof(text), "L%3u", zmk_battery_state_of_charge());
    set_text(left_label, text);
    if (!peripheral_is_connected()) {
        atomic_set(&peripheral_battery_level, -1);
    }
    int level = atomic_get(&peripheral_battery_level);
    if (level < 0) {
        set_text(right_label, "R --");
    } else {
        snprintf(text, sizeof(text), "R%3u", (uint8_t)level);
        set_text(right_label, text);
    }
}

static lv_obj_t *make_label(lv_obj_t *screen, const lv_font_t *font, int y) {
    lv_obj_t *label = lv_label_create(screen);
    lv_obj_set_style_text_font(label, font, LV_PART_MAIN);
    lv_obj_set_y(label, y);
    return label;
}

static void draw_charge(lv_event_t *event) {
    /* Native 8x8 lightning stays crisp at this panel's actual resolution. */
    static const uint8_t rows[TEXT_HEIGHT] = {0x0c, 0x18, 0x30, 0x7e,
                                            0x0c, 0x18, 0x30, 0x20};
    lv_area_t origin;
    lv_obj_get_coords(lv_event_get_target(event), &origin);
    lv_draw_rect_dsc_t style;
    lv_draw_rect_dsc_init(&style);
    style.bg_color = lv_color_white();
    for (int y = 0; y < TEXT_HEIGHT; y++) {
        for (int x = 0; x < TEXT_HEIGHT; x++) {
            if (rows[y] & BIT(7 - x)) {
                lv_area_t pixel = {origin.x1 + x, origin.y1 + y,
                                   origin.x1 + x, origin.y1 + y};
                lv_draw_rect(lv_event_get_draw_ctx(event), &style, &pixel);
            }
        }
    }
}

lv_obj_t *zmk_display_status_screen(void) {
    /* SSD1306 has no 90-degree orientation API. Keep the physical 128x32
     * panel and rotate its packed pixels after rendering a 32x128 screen. */
    lv_disp_t *display = lv_disp_get_default();
    lv_disp_drv_t *driver = display->driver;
    driver->hor_res = OLED_HEIGHT;
    driver->ver_res = OLED_WIDTH;
    driver->rounder_cb = portrait_rounder;
    driver->flush_cb = portrait_flush;
    lv_disp_drv_update(display, driver);
    lv_obj_t *screen = lv_obj_create(NULL);
    lv_obj_set_style_pad_all(screen, 0, LV_PART_MAIN);
    lv_obj_set_style_border_width(screen, 0, LV_PART_MAIN);
    lv_obj_clear_flag(screen, LV_OBJ_FLAG_SCROLLABLE);
    output_label = make_label(screen, &lv_font_unscii_8, OUTPUT_Y);
    layer_label = make_label(screen, &lv_font_unscii_8, LAYER_Y);
    lv_obj_t *charge = lv_obj_create(screen);
    lv_obj_remove_style_all(charge);
    lv_obj_clear_flag(charge, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_size(charge, TEXT_HEIGHT, TEXT_HEIGHT);
    lv_obj_set_pos(charge, (OLED_HEIGHT - TEXT_HEIGHT) / 2, BATTERY_Y);
    /* Section icon, not a measurement of either half's charging current. */
    lv_obj_add_event_cb(charge, draw_charge, LV_EVENT_DRAW_MAIN, NULL);
    left_label = make_label(screen, &lv_font_unscii_8, LEFT_Y);
    right_label = make_label(screen, &lv_font_unscii_8, RIGHT_Y);
    refresh_status(NULL);
    lv_timer_create(refresh_status, 200, NULL);
    return screen;
}
