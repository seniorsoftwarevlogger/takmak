#pragma once

#include "config_common.h"

/* USB Device descriptor parameter */
#define VENDOR_ID       0xFEED
#define PRODUCT_ID      0x6060
#define DEVICE_VER      0x0001
#define MANUFACTURER    Dmitrii Rozhkov
#define PRODUCT         Takmak

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

// key matrix pins PCB first revision
#define MATRIX_ROW_PINS { D1, D0, B3, B1, F7  }
#define MATRIX_COL_PINS { B5, F5, F4, B2, C6, D4, B4, E6}
#define MATRIX_ROW_PINS_RIGHT { E6, B4, F7, B1, B3 }
#define MATRIX_COL_PINS_RIGHT { D1, D0, D4, C6, D7, F4, F5, F6 }

// // key matrix pins PCB
// #define MATRIX_ROW_PINS { D1, D0, B3, B2, B6  }
// #define MATRIX_COL_PINS { B5, B1, F7, F6, F5, D7, D4, C6}
// #define MATRIX_ROW_PINS_RIGHT { E6, B4, F7, B1, B3 }
// #define MATRIX_COL_PINS_RIGHT { D1, D0, D4, C6, D7, F4, F5, F6 }

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
