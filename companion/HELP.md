## B_inTime (edyds medienproduktion)

Steuert den Bühnen-Timer **B_inTime** auf dem Mac über das Netzwerk.

### Einrichten
1. B_inTime auf dem Mac starten.
2. In Companion eine Verbindung „edyds B_inTime“ anlegen.
3. **IP-Adresse des Macs** eintragen (steht in B_inTime oben unter „Links & Companion“). Läuft Companion auf demselben Mac: `127.0.0.1`.
4. Port bleibt **8099**, außer er wurde in B_inTime geändert.

### Aktionen
Start/Pause, Start, Pause, Reset, Nächster/Vorheriger Punkt, Zeit ± Sekunden, Schnell-Timer, Punkt aus dem Ablauf laden, gespeicherte Nachricht zeigen/ausblenden, eigene Nachricht senden (mit Variablen), Nachricht ausblenden, Blinken, Blackout, Uhrzeit statt Timer, NDI an/aus.

### Wie beim Irisdown-Countdown-Modul
- **PLAY** (bei Irisdown „GO“), **PAUSE**, Pause umschalten, **RESET**
- **RESET mit neuer Zeit**: `5` (Minuten), `05:00` oder `01:30:00`
- **JOG**: Zeit um Minuten ändern (`1`, `-1`, `0.5`)
- **Nachricht** senden / löschen
- **Anzeige-Modus**: TIMER, CLOCK, BLACK, TEST
- Feedbacks „Farbe nach Status“ (läuft/pausiert, Farben frei wählbar), „Anzeige-Modus“, „Nachricht aktiv“
- Variablen `state`, `mode`, `time_hms`, `time_hm`, `time_h`, `time_m`, `time_s`
- Presets „Mode“ und „Display time“ wie bei Irisdown; die Irisdown-Tasten aus „Timer control“ sind im Reiter „Timer“ enthalten

### Feedbacks
Timer läuft · Phase (gelb/orange/rot) · Farbe nach Phase · Blackout · Uhrzeit aktiv · NDI · Blinken · Nachricht sichtbar · Punkt geladen · Verbunden

### Variablen
`time`, `timer`, `remaining`, `remaining_seconds`, `elapsed`, `duration`, `progress`, `phase`, `running`, `title`, `speaker`, `next`, `index`, `cue_count`, `clock`, `planned_end`, `message`, `weather`, sowie `cue_N_title`, `cue_N_start`, `cue_N_duration` `cue_N_label` (Titel, sonst die Dauer) und `cue_N_short` bzw. `message_N_short` (gekürzt, für Tasten) und `message_N` für jeden Punkt bzw. jede Nachricht.

### Aktionen im Überblick (neu: Testbild für die Signalkontrolle)
Start/Pause/Reset, Vor/Zurück, Punkt laden, Schnell-Timer, Zeit setzen, ±Minuten, Nachrichten, Blinken, Blackout, Uhrzeit, Anzeige-Modus, Farbbalken-Testbild, **Testbild für die Signalkontrolle** (SMPTE, EBU, PLUGE, Graustufen, Rampe, Multiburst, Zonenplatte, Gitter, Sicherheitsbereiche, ColorChecker), NDI.

### Presets
Fertige Tasten unter „Timer“, „Schnell-Timer“, „Ablauf“, „Nachrichten“, „Output“, „Mode“ und „Display time“. Die Tasten für Ablauf und Nachrichten erscheinen, sobald B_inTime verbunden ist.
