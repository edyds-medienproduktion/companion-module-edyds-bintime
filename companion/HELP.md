## B_inTime (edyds medienproduktion)

Controls the stage and output timer **B_inTime** on a Mac over the network.

> Note: the action, feedback and preset names inside Companion are currently shown in German. This page describes them in English.

### Setup
1. Start B_inTime on the Mac.
2. In Companion, add a connection "edyds B_inTime".
3. Enter the **IP address of the Mac** (shown at the top of B_inTime under "Links & Companion"). If Companion runs on the same Mac, use `127.0.0.1`.
4. Keep the port at **8099** unless you changed it in B_inTime.

### Actions
- **Timer:** Play/Pause, Play, Pause, Reset, next/previous item, change time by ± seconds, quick timer, load an item from the run of show.
- **RESET with a new time:** `5` (minutes), `05:00` or `01:30:00`.
- **JOG:** change the time by minutes (`1`, `-1`, `0.5`).
- **Messages:** show or hide a saved message, send your own message (variables allowed), hide the message, flash the output.
- **Output:** Blackout, show the clock instead of the timer, NDI on/off.
- **Display mode:** TIMER, CLOCK, BLACK, TEST.
- **Test patterns for signal checks:** color bars, SMPTE, EBU, PLUGE, grayscale, ramp, multiburst, zone plate, grid, safe areas, ColorChecker.

The control actions follow the layout of the Irisdown Countdown module: **PLAY** (Irisdown: "GO"), **PAUSE**, toggle pause, **RESET**.

### Feedbacks
Timer running · Phase (yellow/orange/red) · Color by phase · Color by state (running/paused, colors freely selectable) · Display mode · Blackout · Clock active · NDI · Flashing · Message visible · Item loaded · Connected

### Variables
`time`, `timer`, `remaining`, `remaining_seconds`, `elapsed`, `duration`, `progress`, `phase`, `running`, `title`, `speaker`, `next`, `index`, `cue_count`, `clock`, `planned_end`, `message`, `weather`, `state`, `mode`, `time_hms`, `time_hm`, `time_h`, `time_m`, `time_s`.

For every item in the run of show: `cue_N_title`, `cue_N_start`, `cue_N_duration`, `cue_N_label` (title, otherwise the duration) and `cue_N_short` (shortened for buttons). For every message: `message_N` and `message_N_short`.

### Presets
Ready-made buttons in the categories "Timer", "Schnell-Timer" (quick timers), "Ablauf" (run of show), "Nachrichten" (messages), "Output", "Mode" and "Display time". "Mode" and "Display time" work like the Irisdown presets, and the Irisdown buttons from "Timer control" are included in "Timer". The run-of-show and message buttons appear as soon as Companion is connected to B_inTime.
