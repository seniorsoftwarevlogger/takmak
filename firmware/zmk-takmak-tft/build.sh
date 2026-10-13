#!/usr/bin/env bash
set -euo pipefail
shield="${1:-takmak_tft_left}"
case "$shield" in takmak_tft_left|takmak_tft_dongle|takmak_tft_left_bench) ;; *) echo 'Unknown shield' >&2; exit 1 ;; esac
module_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
firmware_dir="$(dirname -- "$module_dir")"
build_root="${TAKMAK_TFT_WORKSPACE:-$HOME/.cache/takmak-zmk-tft}"
image='zmkfirmware/zmk-build-arm@sha256:edb1c953438c6f720ddb79c3762f3972013b7fbbaf4fff3592fc869983e7afc5'
mkdir -p "$build_root"
if [ ! -d "$build_root/.west" ]; then
  mkdir -p "$build_root/manifest"
  cp "$module_dir/manifest/west.yml" "$build_root/manifest/west.yml"
elif ! cmp -s "$module_dir/manifest/west.yml" "$build_root/manifest/west.yml"; then
  echo 'Existing workspace uses a different manifest; choose an empty TAKMAK_TFT_WORKSPACE.' >&2
  exit 1
fi
docker run --rm -v "$build_root:/workspace" -v "$firmware_dir:/firmware:ro" -w /workspace "$image" sh -ec '
  if [ ! -d .west ]; then west init -l manifest; fi
  west update --narrow -o=--depth=1
  west zephyr-export
  west build -s zmk/app -d "build/$1" -b nice_nano_v2 -S zmk-usb-logging -- -DZMK_EXTRA_MODULES=/firmware/zmk-takmak-tft -DSHIELD="$1"
  if [ "$1" = takmak_tft_left ]; then
    PYTHONPATH=zephyr/scripts/dts/python-devicetree/src python3 /firmware/zmk-takmak-tft/scripts/check_left_pins.py "build/$1/zephyr/edt.pickle"
  fi
' sh "$shield"
mkdir -p "$module_dir/artifacts"
cp "$build_root/build/$shield/zephyr/zmk.uf2" "$module_dir/artifacts/$shield.uf2"
echo "UF2: $module_dir/artifacts/$shield.uf2"
