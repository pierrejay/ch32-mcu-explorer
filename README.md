# WCH RISC-V MCU Explorer

Specs of WCH RISC-V microcontrollers, one row per part number. Look up a part, filter by what you need, compare a few.

https://pierrejay.github.io/ch32-mcu-explorer/

Also works by opening `index.html` locally.

## Data

`?` means I didn't find the value in a WCH document, `—` means WCH says it's absent. Each part page lists the datasheets used.

Records are in `data/parts/*.json`, format in `data/SCHEMA.md`. After editing:

```sh
python3 tools/build_data.py   # checks the records, regenerates js/data.js
node --test tests/            # optional
```

No prices, stock or pin muxing. Check the datasheet before designing.

Not affiliated with WCH.
