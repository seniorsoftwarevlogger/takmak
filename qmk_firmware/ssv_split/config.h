#pragma once

#include "config_common.h"

/* USB Device descriptor parameter */
#define VENDOR_ID       0xFEED
#define PRODUCT_ID      0x6060
#define DEVICE_VER      0x0001
#define MANUFACTURER    SeniorSoftwareVlogger
#define PRODUCT         SSV_Split

/* key matrix size */

/**
 * Rows are doubled-up
 *
 * https://www.reddit.com/r/olkb/comments/829ubq/rows_and_columns_of_split_using_2_pro_micros/
 *
 * The reason why the rows are doubled up instead of columns is due to the way the keyboard matrix is scanned.
 * It scans one row at a time. What the slave does it scan its rows and passes it to the master.
 * The master then stores all the row data together by virtually stacking the rows of the left
 * half on top of the right half.
 *
 * A macro remaps the stacked rows to the correct layout later on.
 */
#define MATRIX_ROWS 10
#define MATRIX_COLS 8

/* key matrix pins */
#define MATRIX_ROW_PINS { F4, F5, F6, F7, B1  }
#define MATRIX_COL_PINS { D1, D0, D4, C6, D7, E6, B4, B5}
#define MATRIX_ROW_PINS_RIGHT { F4, F5, F7, F6, B1 }
#define MATRIX_COL_PINS_RIGHT { B5, B4, E6, D7, C6, D4, D0, D1 }

/* COL2ROW or ROW2COL */
// COL2ROW means the black mark on your diode is facing to the rows, and between the switch and the rows.
#define DIODE_DIRECTION COL2ROW

/* number of backlight levels */
// #define BACKLIGHT_PIN B5

#ifdef BACKLIGHT_PIN
#define BACKLIGHT_LEVELS 3
#endif

#define SOFT_SERIAL_PIN D2
#define SPLIT_USB_DETECT

/* Set 0 if debouncing isn't needed */
#define DEBOUNCING_DELAY 5

#define MASTER_RIGHT
