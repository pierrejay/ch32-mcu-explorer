# Part record schema

One record = one **orderable part number** (exact package variant), never a family aggregate.
All text in plain technical English. No marketing adjectives ("powerful", "ultra-low", "rich peripherals"...).

## Value conventions

- `null` = not established from a vendor document. Never guess. `false` / `0` mean *documented absent*.
- Never copy a family maximum onto a smaller package: GPIO, ADC channels, UART/SPI/I2C counts, USB, Ethernet,
  timers, etc. must come from the per-package table (datasheet "product resources / selection" table or pinout).
- When sources disagree (old vs new datasheet, website vs PDF), use the newest vendor document and add a note.

## Fields

```jsonc
{
  "id": "CH32V003F4P6",          // exact part number as printed in WCH ordering table
  "family": "CH32V003",
  "line": "CH32V0",               // one of: CH32V0 CH32V1 CH32V2 CH32V3 CH32V4 CH32L1 CH32X0 CH32X3 CH32H4 CH32M CH64x CH56x CH57x CH58x CH59x
  "status": "active",             // "active" | "new" (sampling / released < 12 months) | "nrnd" | null
  "core": "QingKe V2A",           // WCH core name; for multi-core: "QingKe V5F + V3F"
  "isa": "RV32EC",                // e.g. RV32EC, RV32IMAC, RV32IMACF, RV32IMAFC... (+ "_Zba..." only if documented)
  "cores": 1,
  "mhz": 48,                      // max documented system clock of the main core
  "fpu": "none",                  // "none" | "FP32" | "FP64"
  "flashKB": 16,                  // user program flash (CodeFlash); for split parts the default zero-wait area. Extra data flash → dataFlashKB
  "flashTotalKB": null,           // only when total CodeFlash > zero-wait area (CH32V20x/V30x): total incl. wait-state region
  "dataFlashKB": null,            // separate DataFlash/EEPROM area if documented, else 0 or null
  "ramKB": 2,                     // total SRAM
  "package": "TSSOP20",           // vendor package name, normalized: no spaces, e.g. QFN20, LQFP64M, SOP8, DFN10
  "pins": 20,
  "packageSize": "6.5x4.4 mm",    // body size if documented, else null
  "gpio": 18,
  "vMin": 2.7, "vMax": 5.5,       // main supply range (VDD). Extra domains → "supplyRanges" + notes
  "supplyRanges": null,           // optional [[lo,hi],...] when union of separate ranges matters
  "usbSupplyRanges": null,        // optional [[lo,hi]] if USB needs a narrower VDD range
  "tempMin": -40, "tempMax": 85,  // operating ambient range of THIS part number
  "uart": 1, "spi": 1, "i2c": 1, "i2s": 0, "can": 0,   // instance counts usable on this package
  "usb": "none",                  // human label, e.g. "1× USB FS Host/Device + 1× USB FS Device", "USB 2.0 HS Host/Device (480 Mbps, PHY integrated)"
  "eth": "none",                  // e.g. "10BASE-T MAC + PHY", "10/100 MAC (RMII/MII, ext. PHY)", "1000 MAC (RGMII) + 10M PHY"
  "radio": "none",                // e.g. "BLE 5.4 + 2.4 GHz proprietary, +7 dBm TX, -98 dBm RX (1M)"
  "adcBits": 10, "adcChannels": 8,// external analog input channels on this package
  "dacChannels": 0,
  "opamps": 1, "comparators": 0,
  "touchChannels": null,          // TouchKey channels if documented (count)
  "timers": "1× 16-bit advanced, 1× 16-bit general, SysTick, 2× WDG",  // short summary for this part
  "dmaChannels": 7,
  "debug": "1-wire SDI",          // debug interface (SDI 1-wire, 2-wire SWD-like, JTAG...)
  "features": {                   // true / false / null for EVERY key below
    "usbFS": false,  "usbHS": false,  "usbSS": false,  "usbHost": false, "usbDevice": false,
    "usbPD": false,               // USB Type-C / PD controller (CC logic) on chip
    "ethernet": false,            // any Ethernet MAC
    "ethPHY": false,              // integrated Ethernet PHY
    "ble": false, "rf24": false,  // BLE / 2.4 GHz proprietary radio
    "can": false, "canFD": false,
    "adc": true, "dac": false, "opamp": true, "comparator": false,
    "touch": false,               // TouchKey / capacitive touch hardware
    "lcd": false,                 // any LCD drive (segment LCD or TFT/LTDC) – describe in notes
    "sdio": false,                // SDIO / SDMMC host
    "extMem": false,              // FSMC / FMC / external bus / QSPI-XIP for memory
    "dvp": false,                 // camera DVP interface
    "i2s": false,
    "rtc": false,                 // RTC with independent LSE/LSI domain
    "crypto": false,              // AES/SM4/TRNG etc hardware
    "lowPower": true,             // documented sleep/standby modes
    "pioc": false                 // programmable IO coprocessor (PIOC / eMCU-style)
  },
  "notes": [                      // short factual caveats, one sentence each; no marketing
    "16 KB CodeFlash; some older docs list 16 KB, Oct-2026 selection table lists 17 KB."
  ],
  "sources": [                    // at least one vendor document; be specific
    { "title": "WCH CH32V003 datasheet V1.7", "url": "https://...", "detail": "Table 1-1 product resources; §3 electrical" }
  ],
  "checkedAt": "2026-11-22"
}
```

Field order as above. Keep notes terse. Units: KB, MHz, V, °C.
