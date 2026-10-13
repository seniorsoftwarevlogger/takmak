/* SPDX-License-Identifier: MIT */
#define DT_DRV_COMPAT takmak_behavior_tft_mode
#include <zephyr/device.h>
#include <drivers/behavior.h>
#include <zmk/behavior.h>
#include "portrait_screen.h"

static int mode_pressed(struct zmk_behavior_binding *binding,
                        struct zmk_behavior_binding_event event) {
    ARG_UNUSED(binding);
    ARG_UNUSED(event);
    takmak_tft_next_page();
    return ZMK_BEHAVIOR_OPAQUE;
}
static int mode_released(struct zmk_behavior_binding *binding,
                         struct zmk_behavior_binding_event event) {
    ARG_UNUSED(binding);
    ARG_UNUSED(event);
    return ZMK_BEHAVIOR_OPAQUE;
}
static const struct behavior_driver_api mode_api = {
    .binding_pressed = mode_pressed,
    .binding_released = mode_released,
};
#define MODE_INST(n) BEHAVIOR_DT_INST_DEFINE(n, NULL, NULL, NULL, NULL, POST_KERNEL, \
                                             CONFIG_KERNEL_INIT_PRIORITY_DEFAULT, &mode_api);
DT_INST_FOREACH_STATUS_OKAY(MODE_INST)
