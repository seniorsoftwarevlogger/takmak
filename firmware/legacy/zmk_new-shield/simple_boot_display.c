// simple_boot_display.c - Minimal custom boot message

#include <zephyr/kernel.h>
#include <zephyr/logging/log.h>
#include <zephyr/device.h>
#include <zephyr/init.h>

#if IS_ENABLED(CONFIG_ZMK_DISPLAY)

#include <lvgl.h>

LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);

static lv_obj_t *boot_message = NULL;
static bool boot_message_shown = false;

static void show_boot_message(void) {
    // Get the current screen
    lv_obj_t *screen = lv_scr_act();
    if (!screen)
        return;

    // Create a temporary boot message
    boot_message = lv_label_create(screen);
    if (!boot_message)
        return;

    lv_label_set_text(boot_message, "ZMK Ready!\n"
                                    "Keyboard Online");

    lv_obj_set_style_text_color(boot_message, lv_color_white(), LV_PART_MAIN);
    lv_obj_center(boot_message);
    boot_message_shown = true;

    LOG_INF("Boot message displayed");
}

static void hide_boot_message(struct k_timer *timer) {
    if (boot_message_shown && boot_message) {
        lv_obj_del(boot_message);
        boot_message = NULL;
        boot_message_shown = false;
        LOG_INF("Boot message hidden");
    }
}

K_TIMER_DEFINE(boot_msg_timer, hide_boot_message, NULL);

static void delayed_boot_message(struct k_timer *timer) {
    show_boot_message();
    // Hide the message after 2 seconds
    k_timer_start(&boot_msg_timer, K_SECONDS(2), K_NO_WAIT);
}

K_TIMER_DEFINE(init_timer, delayed_boot_message, NULL);

static int simple_boot_display_init(void) {
    LOG_INF("Initializing simple boot display");

    // Show boot message after a short delay to let the display system initialize
    k_timer_start(&init_timer, K_MSEC(500), K_NO_WAIT);

    return 0;
}

// Initialize after the main display system
SYS_INIT(simple_boot_display_init, APPLICATION, 99);

#endif /* IS_ENABLED(CONFIG_ZMK_DISPLAY) */