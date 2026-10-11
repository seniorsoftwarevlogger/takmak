// custom_display.c - Add to your keymap directory

#include <zephyr/device.h>
#include <zephyr/init.h>
#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>

#if IS_ENABLED(CONFIG_ZMK_DISPLAY)

#include <lvgl.h>
#include <zmk/display.h>
#include <zmk/events/usb_conn_state_changed.h>
#include <zmk/event_manager.h>
#include <zmk/battery.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

// Boot splash screen
static lv_obj_t *boot_splash_screen = NULL;
static lv_obj_t *boot_label = NULL;
static bool splash_shown = false;
static bool display_ready = false;

static void show_boot_splash(void) {
    if (!display_ready)
        return;

    // Create splash screen
    boot_splash_screen = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(boot_splash_screen, lv_color_black(), LV_PART_MAIN);

    // Create boot message
    boot_label = lv_label_create(boot_splash_screen);
    lv_label_set_text(boot_label, "ZMK Keyboard\n"
                                  "Booting...\n"
                                  "Ready!");
    lv_obj_set_style_text_color(boot_label, lv_color_white(), LV_PART_MAIN);
    lv_obj_center(boot_label);

    // Load the screen
    lv_scr_load(boot_splash_screen);
    splash_shown = true;

    LOG_INF("Boot splash displayed");
}

static void hide_boot_splash(void) {
    if (splash_shown && boot_splash_screen) {
        lv_obj_del(boot_splash_screen);
        boot_splash_screen = NULL;
        boot_label = NULL;
        splash_shown = false;
        LOG_INF("Boot splash hidden");
    }
}

// Timer to hide splash after delay
static void splash_timer_callback(struct k_timer *timer) {
    hide_boot_splash();
    // The built-in status screen should take over automatically
}

K_TIMER_DEFINE(splash_timer, splash_timer_callback, NULL);

static int custom_display_init(void) {
    LOG_INF("Initializing custom display");

    // Check if display is available
    const struct device *display_dev = DEVICE_DT_GET(DT_CHOSEN(zephyr_display));
    if (!device_is_ready(display_dev)) {
        LOG_ERR("Display device not ready");
        return -ENODEV;
    }

    display_ready = true;

    // Delay to let LVGL initialize
    k_sleep(K_MSEC(100));

    // Show boot splash
    show_boot_splash();

    // Hide splash after 3 seconds
    k_timer_start(&splash_timer, K_SECONDS(3), K_NO_WAIT);

    return 0;
}

// Initialize after LVGL and display are ready
SYS_INIT(custom_display_init, APPLICATION, 90);

#endif /* IS_ENABLED(CONFIG_ZMK_DISPLAY) */