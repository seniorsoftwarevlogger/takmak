"""Run with Zephyr's python-devicetree on PYTHONPATH and a compiled edt.pickle."""
import pickle
import sys

with open(sys.argv[1], "rb") as source:
    edt = pickle.load(source)  # Only a trusted local build artifact.

used = {}


def claim(port, pin, owner):
    key = (port, pin)
    assert key not in used, f"GPIO conflict: {owner} and {used.get(key)} on {key}"
    used[key] = owner


def gpio_pins(label, property_name):
    node = edt.label2node[label]
    assert node.status == "okay", f"{label} is disabled"
    for index, spec in enumerate(node.props[property_name].val):
        port = int(next(label[-1] for label in spec.controller.labels if label in ("gpio0", "gpio1")))
        claim(port, spec.data["pin"], f"{label}.{property_name}[{index}]")


def spi_pins(label):
    node = edt.label2node[label]
    assert node.status == "okay"
    for state in node.pinctrls:
        if state.name == "default":
            for config in state.conf_nodes:
                for group in config.children.values():
                    for psel in group.props["psels"].val:
                        # nRF pinctrl uses bits 0..4 for pin and bit 5 for port.
                        claim((psel >> 5) & 1, psel & 31, f"{label}.pinctrl")


assert edt.chosen_node("zmk,kscan") == edt.label2node["kscan0"]
assert "zmk,kscan-gpio-matrix" in edt.label2node["kscan0"].compats
assert len(edt.label2node["kscan0"].props["row-gpios"].val) == 5
assert len(edt.label2node["kscan0"].props["col-gpios"].val) == 7
assert edt.label2node["tft"].parent == edt.label2node["spi1"]
assert edt.label2node["led_strip"].parent == edt.label2node["spi3"]
assert edt.label2node["i2c0"].status == "disabled"
assert edt.label2node["uart0"].status == "disabled"
assert edt.chosen_node("zephyr,display") == edt.label2node["tft"]

for label, prop in [
    ("kscan0", "row-gpios"), ("kscan0", "col-gpios"),
    ("left_encoder", "a-gpios"), ("left_encoder", "b-gpios"),
    ("spi1", "cs-gpios"), ("tft", "cmd-data-gpios"), ("tft", "reset-gpios"),
]:
    gpio_pins(label, prop)
spi_pins("spi1")
spi_pins("spi3")
claim(0, 13, "external VCC enable")
assert len(used) == 21
for (port, pin), owner in sorted(used.items()):
    print(f"P{port}.{pin:02d}  {owner}")
print("PASS: real 5x7 matrix, encoder, TFT and RGB have no shared GPIOs.")
