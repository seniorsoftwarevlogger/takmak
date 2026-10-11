// custom_status_screen.c - Complete custom status screen implementation

#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/device.h>
#include <zephyr/init.h>

#include <lvgl.h>
#include <zmk/display.h>
#include <zmk/events/usb_conn_state_changed.h>
#include <zmk/events/battery_state_changed.h>
#include <zmk/events/layer_state_changed.h>
#include <zmk/battery.h>
#include <zmk/ble.h>
#include <zmk/keymap.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

static lv_obj_t *screen;
static lv_obj_t *boot_info_label;
static lv_obj_t *status_label;
static lv_obj_t *battery_label;
static lv_obj_t *layer_label;
static lv_obj_t *connection_label;

static bool boot_phase = true;
static uint32_t boot_time;

static void update_boot_info(void) {
    if (!boot_phase)
        return;

    uint32_t uptime = k_uptime_get_32();
    char boot_text[128];

    snprintf(boot_text, sizeof(boot_text),
             "ZMK Keyboard Ready\n"
             "Boot time: %d ms\n"
             "Free heap: %d bytes",
             uptime, k_heap_free_get(&k_malloc_heap));

    lv_label_set_text(boot_info_label, boot_text);
}

static void update_battery_status(void) {
    uint8_t battery_level = zmk_battery_state_of_charge();
    bool charging = zmk_battery_is_charging();

    char battery_text[32];
    snprintf(battery_text, sizeof(battery_text), "Battery: %d%% %s", battery_level,
             charging ? "CHG" : "");

    lv_label_set_text(battery_label, battery_text);
}

static void update_layer_status(void) {
    uint8_t layer = zmk_keymap_highest_layer_active();
    char layer_text[32];
    snprintf(layer_text, sizeof(layer_text), "Layer: %d", layer);
    lv_label_set_text(layer_label, layer_text);
}

static void update_connection_status(void) {
    bool ble_connected = zmk_ble_active_profile_is_connected();
    bool usb_connected = zmk_usb_is_hid_ready();

    const char *conn_text;
    if (usb_connected) {
        conn_text = "USB Connected";
    } else if (ble_connected) {
        conn_text = "BLE Connected";
    } else {
        conn_text = "Disconnected";
    }

    lv_label_set_text(connection_label, conn_text);
}

static void update_all_status(void) {
    if (boot_phase) {
        update_boot_info();
    }
    update_battery_status();
    update_layer_status();
    update_connection_status();
}

static void transition_to_normal_mode(struct k_timer *timer) {
    boot_phase = false;

    // Hide boot info
    lv_obj_add_flag(boot_info_label, LV_OBJ_FLAG_HIDDEN);

    // Show normal status
    lv_obj_clear_flag(status_label, LV_OBJ_FLAG_HIDDEN);
    lv_label_set_text(status_label, "Ready");

    update_all_status();
    LOG_INF("Transitioned to normal display mode");
}

K_TIMER_DEFINE(boot_timer, transition_to_normal_mode, NULL);

static void create_status_screen(void) {
    screen = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(screen, lv_color_black(), LV_PART_MAIN);

    // Boot info (shown initially)
    boot_info_label = lv_label_create(screen);
    lv_obj_set_style_text_color(boot_info_label, lv_color_white(), LV_PART_MAIN);
    lv_obj_align(boot_info_label, LV_ALIGN_TOP_MID, 0, 10);

    // Status message (hidden initially)
    status_label = lv_label_create(screen);
    lv_obj_set_style_text_color(status_label, lv_color_white(), LV_PART_MAIN);
    lv_obj_align(status_label, LV_ALIGN_TOP_MID, 0, 10);
    lv_obj_add_flag(status_label, LV_OBJ_FLAG_HIDDEN);

    // Battery status
    battery_label = lv_label_create(screen);
    lv_obj_set_style_text_color(battery_label, lv_color_white(), LV_PART_MAIN);
    lv_obj_align(battery_label, LV_ALIGN_CENTER, 0, -20);

    // Layer status
    layer_label = lv_label_create(screen);
    lv_obj_set_style_text_color(layer_label, lv_color_white(), LV_PART_MAIN);
    lv_obj_align(layer_label, LV_ALIGN_CENTER, 0, 0);

    // Connection status
    connection_label = lv_label_create(screen);
    lv_obj_set_style_text_color(connection_label, lv_color_white(), LV_PART_MAIN);
    lv_obj_align(connection_label, LV_ALIGN_CENTER, 0, 20);

    lv_scr_load(screen);
}

// Periodic update timer
static void status_update_timer(struct k_timer *timer) { update_all_status(); }

K_TIMER_DEFINE(update_timer, status_update_timer, NULL);

// Event handlers
static int handle_battery_event(const zmk_event_t *eh) {
    update_battery_status();
    return ZMK_EV_EVENT_BUBBLE;
}

static int handle_layer_event(const zmk_event_t *eh) {
    update_layer_status();
    return ZMK_EV_EVENT_BUBBLE;
}

static int handle_usb_event(const zmk_event_t *eh) {
    update_connection_status();
    return ZMK_EV_EVENT_BUBBLE;
}

ZMK_LISTENER(custom_display_battery, handle_battery_event);
ZMK_SUBSCRIPTION(custom_display_battery, zmk_battery_state_changed);

ZMK_LISTENER(custom_display_layer, handle_layer_event);
ZMK_SUBSCRIPTION(custom_display_layer, zmk_layer_state_changed);

ZMK_LISTENER(custom_display_usb, handle_usb_event);
ZMK_SUBSCRIPTION(custom_display_usb, zmk_usb_conn_state_changed);

static int custom_status_screen_init(void) {
    LOG_INF("Initializing custom status screen");

    boot_time = k_uptime_get_32();
    create_status_screen();
    update_all_status();

    // Start timers
    k_timer_start(&boot_timer, K_SECONDS(5), K_NO_WAIT);
    k_timer_start(&update_timer, K_SECONDS(1), K_SECONDS(1));

    return 0;
}

SYS_INIT(custom_status_screen_init, APPLICATION, CONFIG_APPLICATION_INIT_PRIORITY);