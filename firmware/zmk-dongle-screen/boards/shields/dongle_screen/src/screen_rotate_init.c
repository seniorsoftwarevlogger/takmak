#include <zephyr/kernel.h>
#include <zephyr/device.h>
#include <zephyr/drivers/display.h>
#include <zephyr/logging/log.h>
LOG_MODULE_DECLARE(zmk, CONFIG_ZMK_LOG_LEVEL);
int disp_set_orientation(void)
{
	// Set the orientation
	const struct device *display = DEVICE_DT_GET(DT_CHOSEN(zephyr_display));
	if (!device_is_ready(display))
	{
		return -EIO;
	}

#ifdef CONFIG_DONGLE_SCREEN_HORIZONTAL
#ifdef CONFIG_DONGLE_SCREEN_FLIPPED
	int ret = display_set_orientation(display, DISPLAY_ORIENTATION_ROTATED_90);
#else
	int ret = display_set_orientation(display, DISPLAY_ORIENTATION_ROTATED_270);
#endif
#else
#ifdef CONFIG_DONGLE_SCREEN_FLIPPED
	int ret = display_set_orientation(display, DISPLAY_ORIENTATION_NORMAL);
#else
	int ret = display_set_orientation(display, DISPLAY_ORIENTATION_ROTATED_180);
#endif
#endif

	if (ret < 0)
	{
		return ret;
	}

	return 0;
}

SYS_INIT(disp_set_orientation, APPLICATION, 60);