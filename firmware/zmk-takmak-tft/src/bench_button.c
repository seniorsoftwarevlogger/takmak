/* SPDX-License-Identifier: MIT */
#include <zephyr/kernel.h>
#include <zephyr/init.h>
#include <zephyr/drivers/gpio.h>
#include <zephyr/logging/log.h>
#include "portrait_screen.h"

#if DT_NODE_EXISTS(DT_NODELABEL(tft_mode_button))
LOG_MODULE_REGISTER(takmak_tft_button, LOG_LEVEL_INF);
static const struct gpio_dt_spec button = GPIO_DT_SPEC_GET(DT_NODELABEL(tft_mode_button), gpios);
static struct gpio_callback callback;
static bool held;

static void debounce(struct k_work *work) {
    ARG_UNUSED(work);
    int active = gpio_pin_get_dt(&button);
    if (active < 0) { LOG_WRN("Button read failed: %d", active); return; }
    if (active && !held) takmak_tft_next_page();
    held = active;
}
K_WORK_DELAYABLE_DEFINE(button_work, debounce);

static void button_edge(const struct device *dev, struct gpio_callback *cb, uint32_t pins) {
    ARG_UNUSED(dev); ARG_UNUSED(cb); ARG_UNUSED(pins);
    k_work_reschedule(&button_work, K_MSEC(30));
}
static int button_init(void) {
    if (!gpio_is_ready_dt(&button)) return -ENODEV;
    int err = gpio_pin_configure_dt(&button, GPIO_INPUT);
    if (err) return err;
    int initial = gpio_pin_get_dt(&button);
    if (initial < 0) return initial;
    held = initial;
    gpio_init_callback(&callback, button_edge, BIT(button.pin));
    err = gpio_add_callback(button.port, &callback);
    if (err) return err;
    err = gpio_pin_interrupt_configure_dt(&button, GPIO_INT_EDGE_BOTH);
    if (!err) LOG_INF("Screen button ready: P0.08 to GND, debounce 30 ms");
    return err;
}
SYS_INIT(button_init, APPLICATION, CONFIG_APPLICATION_INIT_PRIORITY);
#endif
