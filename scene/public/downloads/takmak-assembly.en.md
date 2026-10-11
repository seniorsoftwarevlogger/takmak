# Takmak — assembly

## Status

3.0 is the last manufactured PCB. The available 3.1 design has not been manufactured.
This document records the assembly sequence and confirmed component information;
it is not a complete soldering tutorial. Exact hotswap sockets, fasteners, a
soldering map for each half and firmware revisions for the physical builds are
still to be documented.

## 1. Choose a profile

| Component | Low profile | Standard |
| --- | --- | --- |
| Switches | Choc v1 / v2 | MX-compatible |
| Keycaps | Matched to your switches | Matched to your switches |
| Controllers | 2 × SuperMini nRF52840 or nice!nano-compatible | 2 × SuperMini nRF52840 or nice!nano-compatible |
| Batteries | 2 × EEMB 383454LC, LiPo, 3.7 V, 720 mAh, JST | 2 × EEMB 383454LC, LiPo, 3.7 V, 720 mAh, JST |
| Central device | Dongle or left half | Dongle or left half |
| Encoders | EC11, right optional | EC11, right optional |
| Left OLED | 0.91 inch, 128×32, I²C | 0.91 inch, 128×32, I²C |

Quantities are per keyboard: one controller and battery per half. Add a separate
dongle if you choose that configuration. EEMB 383454LC is the battery specified
by the creator; choose alternatives to fit the case. The earlier provisional
2 mm thickness limit has been withdrawn.

The pictured left half has a long thumb key and a knob below the display. The
right half has a separate thumb key and an optional knob. Choc v1 + MBK and
Kailh MX + Cherry-profile caps are the creator’s builds, not required combinations.
Check switch and keycap fit against your PCB revision and case. Print in any colour.

Takmak fits the full Russian layout, including “Ъ”. The extra right-hand column
keeps letters off additional layers, with only a few changes to familiar positions.

## 2. Case

The ZIP for each profile includes STEP and STL files for both tops and bottoms,
reset buttons and knobs. STL units are millimetres; original CAD coordinates
are preserved. Place each part separately on the slicer’s print bed.

For low profile, use Low Profile Screen on the left and Low Profile Button on
the right. For standard profile, print one or two Regular knobs depending on
your configuration. Only print the right knob if fitting that encoder.

Check scale, orientation and compatibility with your PCB before printing the
full set. Material, tolerances and print settings have not yet been finalised.

## 3. PCB

One universal PCB serves both halves. Break off the extra column for the left.
Five identical PCBs give you two keyboards and one spare. Confirm orientation
and the break-off line for your specific revision first. Combined footprints
are alternatives, not positions to populate simultaneously. A soldering map
for each half and step-by-step photos are still being prepared.

3.1 adds enlarged Choc hotswap footprints. These sources are for inspection and
development; the download contains neither Gerbers nor external libraries.

## 4. RGB jumpers in schematic 3.1

| Jumper | Bypasses LEDs |
| --- | --- |
| JP1 | D72, D40, D48 |
| JP2 | D65 |
| JP3 | D62 |
| JP4 | D56 |
| JP5 | D80 |

Leave a bypass open when its section is populated. Close it when the section is
omitted, with the corresponding LEDs left out or isolated. Do not bridge active
LEDs: this connects their data outputs together. Without RGB, these jumpers are
not required for the keys to work.

This describes their schematic functions, not a left/right assembly table.
The required bridges depend on your components and the removed PCB sections.

## 5. Firmware

Keyboard module: https://github.com/seniorsoftwarevlogger/takmak/tree/master/firmware/zmk-keyboard-takmak

Choose a configuration for your controllers and central device. Both profiles
can use a separate dongle or the left half as central. The creator’s low-profile
build uses a dongle; the standard build uses the left half. Define your own
layout in the keymap. The photos and 3D model do not prescribe a layout.
Prebuilt firmware is not yet provided: source revisions have not been matched
to the firmware on the physical keyboards.

## 6. Test

Before closing the case, test every key, encoder push button and both rotation
directions, the display, and both halves’ connections to the central device.
Test-fit the PCB and check key, reset-button and knob clearance. Repeat the tests
with the bottom installed. Fastener details are still being prepared.

## Use

The original hardware README states: “You may not use this for any commercial purpose.”
Firmware and third-party libraries have their own licences.
