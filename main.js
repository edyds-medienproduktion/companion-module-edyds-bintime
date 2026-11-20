// Bitfocus Companion – Modul für B_inTime (edyds medienproduktion)
// Spricht die HTTP-Schnittstelle von B_inTime an (Standard-Port 8099) und fragt den Status regelmäßig ab.

const { InstanceBase, InstanceStatus, Regex, combineRgb, runEntrypoint } = require('@companion-module/base')

// Farben. Das helle Blau (Zustand „an“, mit schwarzer Schrift), Gold (Play), Magenta (Pause/Aus) und das dunkle Blau der
// Ablauf-, Nachrichten- und Schnell-Timer-Tasten (mit weißer Schrift) stammen aus dem edyds-Logo bzw. der App.
const WHITE = combineRgb(255, 255, 255)
const BLACK = combineRgb(0, 0, 0)
const GREEN = combineRgb(19, 163, 60)
const DARKGREEN = combineRgb(11, 77, 31)
const YELLOW = combineRgb(255, 214, 10)
const ORANGE = combineRgb(255, 159, 10)
const RED = combineRgb(255, 69, 58)
const DARKRED = combineRgb(110, 18, 18)
const BLUE = combineRgb(20, 171, 227)
const CUEBLUE = combineRgb(12, 98, 140)
const GOLD = combineRgb(230, 181, 18)
const MAGENTA = combineRgb(233, 31, 125)

/** Name für Tasten kürzen: eine 72-px-Taste fasst bei Schriftgröße 14 etwa 9 Zeichen pro Zeile und 4 Zeilen. */
function short(text, max) {
	const t = String(text ?? '').replace(/\s+/g, ' ').trim()
	return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t
}
const GREY = combineRgb(51, 51, 51)

const PHASES = [
	{ id: 'normal', label: 'Normal' },
	{ id: 'warn', label: 'Gelb (Warnung)' },
	{ id: 'danger', label: 'Orange (kurz vor Ende)' },
	{ id: 'over', label: 'Rot (überzogen)' },
]

const MESSAGE_COLORS = [
	{ id: 'white', label: 'Weiß' },
	{ id: 'green', label: 'Grün' },
	{ id: 'yellow', label: 'Gelb' },
	{ id: 'red', label: 'Rot' },
]

const DISPLAY_MODES = [
	{ id: 'TIMER', label: 'Timer' },
	{ id: 'CLOCK', label: 'Uhrzeit (Clock)' },
	{ id: 'BLACK', label: 'Schwarz (Black)' },
	{ id: 'TEST', label: 'Testbild (Test)' },
]

const ON_OFF_TOGGLE = [
	{ id: 'toggle', label: 'Umschalten' },
	{ id: 'on', label: 'An' },
	{ id: 'off', label: 'Aus' },
]

class BInTimeInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.state = {}
		this.pollTimer = null
		this.polling = false
		this.connected = null
		this.listSignature = ''
	}

	async init(config) {
		this.config = config
		this.updateStatus(InstanceStatus.Connecting)
		this.updateDefinitions()
		this.startPolling()
	}

	async destroy() {
		this.stopPolling()
	}

	async configUpdated(config) {
		this.config = config
		this.connected = null
		this.updateStatus(InstanceStatus.Connecting)
		this.stopPolling()
		this.updateDefinitions()
		this.startPolling()
	}

	getConfigFields() {
		return [
			{
				type: 'static-text',
				id: 'info',
				width: 12,
				label: 'Hinweis',
				value:
					'Steuert B_inTime über das lokale Netzwerk. Die IP-Adresse des Macs steht in B_inTime oben unter „Links &amp; Companion“. Läuft Companion auf demselben Mac, reicht 127.0.0.1.',
			},
			{
				type: 'textinput',
				id: 'host',
				label: 'IP-Adresse des Macs',
				width: 8,
				default: '127.0.0.1',
				regex: Regex.HOSTNAME,
			},
			{
				type: 'number',
				id: 'port',
				label: 'Port',
				width: 4,
				default: 8099,
				min: 1,
				max: 65535,
			},
			{
				type: 'number',
				id: 'interval',
				label: 'Abfrage alle … ms',
				width: 4,
				default: 400,
				min: 100,
				max: 5000,
			},
		]
	}

	// ---------------------------------------------------------------- Netzwerk

	baseUrl() {
		const host = (this.config?.host || '127.0.0.1').trim()
		const port = Number(this.config?.port) || 8099
		return `http://${host}:${port}`
	}

	async request(path) {
		const url = `${this.baseUrl()}/${path.replace(/^\/+/, '')}`
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(2000), cache: 'no-store' })
			if (!res.ok) throw new Error(`HTTP ${res.status}`)
			const json = await res.json()
			this.applyStatus(json)
			return true
		} catch (e) {
			this.setDisconnected(e)
			return false
		}
	}

	startPolling() {
		const interval = Math.max(100, Number(this.config?.interval) || 400)
		const tick = async () => {
			if (this.polling) return
			this.polling = true
			try {
				await this.request('status')
			} finally {
				this.polling = false
			}
		}
		this.pollTimer = setInterval(tick, interval)
		tick()
	}

	stopPolling() {
		if (this.pollTimer) clearInterval(this.pollTimer)
		this.pollTimer = null
	}

	setDisconnected(e) {
		if (this.connected !== false) {
			this.connected = false
			const msg = e?.name === 'TimeoutError' ? 'Zeitüberschreitung' : e?.message === 'fetch failed' ? 'keine Verbindung (läuft B_inTime? IP/Port richtig?)' : String(e?.message || e)
			this.updateStatus(InstanceStatus.ConnectionFailure, msg)
			this.log('warn', `B_inTime unter ${this.baseUrl()} nicht erreichbar: ${msg}`)
		}
	}

	applyStatus(s) {
		if (!s || typeof s !== 'object') return
		if (this.connected !== true) {
			this.connected = true
			this.updateStatus(InstanceStatus.Ok)
			this.log('info', `Verbunden mit B_inTime unter ${this.baseUrl()}`)
		}
		this.state = s

		// Ablauf oder Nachrichten geändert → Auswahllisten und Presets aktualisieren
		const sig = JSON.stringify([
			(s.cues || []).map((c) => [c.title, c.durationText]),
			(s.messages || []).map((m) => m.text),
		])
		if (sig !== this.listSignature) {
			this.listSignature = sig
			this.updateDefinitions()
		}

		this.updateVariableValues()
		this.checkFeedbacks()
	}

	// ---------------------------------------------------------------- Definitionen

	updateDefinitions() {
		this.setActionDefinitions(this.actionDefinitions())
		this.setFeedbackDefinitions(this.feedbackDefinitions())
		this.setVariableDefinitions(this.variableDefinitions())
		this.setPresetDefinitions(this.presetDefinitions())
		this.updateVariableValues()
	}

	cueChoices() {
		const cues = this.state.cues || []
		if (cues.length === 0) {
			return Array.from({ length: 10 }, (_, i) => ({ id: i + 1, label: `Punkt ${i + 1}` }))
		}
		return cues.map((c) => ({ id: c.index, label: `${c.index}: ${c.title || c.durationText || '–'}` }))
	}

	messageChoices() {
		const msgs = this.state.messages || []
		if (msgs.length === 0) {
			return Array.from({ length: 6 }, (_, i) => ({ id: i + 1, label: `Nachricht ${i + 1}` }))
		}
		return msgs.map((m) => ({ id: m.index, label: `${m.index}: ${m.text || '–'}` }))
	}

	actionDefinitions() {
		const simple = (name, path) => ({
			name,
			options: [],
			callback: async () => {
				await this.request(path)
			},
		})

		return {
			toggle: simple('Start / Pause umschalten', 'toggle'),
			start: simple('Start', 'start'),
			pause: simple('Pause', 'pause'),
			reset: simple('Reset', 'reset'),
			next: simple('Nächster Punkt', 'next'),
			prev: simple('Vorheriger Punkt', 'prev'),

			adjust: {
				name: 'Zeit ändern (+/−)',
				options: [
					{
						type: 'number',
						id: 'seconds',
						label: 'Sekunden (negativ = abziehen)',
						default: 60,
						min: -3600,
						max: 3600,
					},
				],
				callback: async (action) => {
					const sec = Math.round(Number(action.options.seconds) || 0)
					if (sec === 0) return
					await this.request(sec > 0 ? `add/${sec}` : `sub/${-sec}`)
				},
			},

			preset: {
				name: 'Schnell-Timer (Minuten)',
				options: [
					{ type: 'number', id: 'minutes', label: 'Minuten', default: 20, min: 0, max: 600 },
					{ type: 'checkbox', id: 'start', label: 'Sofort starten', default: false },
				],
				callback: async (action) => {
					const m = Math.max(0, Math.round(Number(action.options.minutes) || 0))
					await this.request(`preset/${m}${action.options.start ? '/start' : ''}`)
				},
			},

			cue: {
				name: 'Punkt aus dem Ablauf laden',
				options: [
					{
						type: 'dropdown',
						id: 'index',
						label: 'Punkt',
						default: this.cueChoices()[0]?.id ?? 1,
						choices: this.cueChoices(),
						allowCustom: true,
					},
					{ type: 'checkbox', id: 'start', label: 'Sofort starten', default: true },
				],
				callback: async (action) => {
					const n = Math.max(1, Math.round(Number(action.options.index) || 1))
					await this.request(`cue/${n}${action.options.start ? '/start' : ''}`)
				},
			},

			message: {
				name: 'Gespeicherte Nachricht zeigen / ausblenden',
				options: [
					{
						type: 'dropdown',
						id: 'index',
						label: 'Nachricht',
						default: this.messageChoices()[0]?.id ?? 1,
						choices: this.messageChoices(),
						allowCustom: true,
					},
					{
						type: 'dropdown',
						id: 'mode',
						label: 'Aktion',
						default: 'toggle',
						choices: [
							{ id: 'toggle', label: 'Umschalten' },
							{ id: 'show', label: 'Zeigen' },
							{ id: 'hide', label: 'Ausblenden' },
						],
					},
				],
				callback: async (action) => {
					const n = Math.max(1, Math.round(Number(action.options.index) || 1))
					const mode = action.options.mode
					await this.request(mode === 'show' ? `message/${n}` : `message/${n}/${mode}`)
				},
			},

			message_text: {
				name: 'Eigene Nachricht senden',
				options: [
					{ type: 'textinput', id: 'text', label: 'Text', default: 'Bitte zum Ende kommen', useVariables: true },
					{ type: 'dropdown', id: 'color', label: 'Farbe', default: 'yellow', choices: MESSAGE_COLORS },
				],
				callback: async (action, context) => {
					const text = await context.parseVariablesInString(String(action.options.text || ''))
					const q = `text=${encodeURIComponent(text)}&color=${encodeURIComponent(action.options.color)}`
					await this.request(`message/show?${q}`)
				},
			},

			message_hide: simple('Nachricht ausblenden', 'message/hide'),

			// --- Irisdown-kompatible Aktionen ---
			go: simple('PLAY – Timer starten oder fortsetzen', 'start'),
			set_time: {
				name: 'RESET mit neuer Zeit (Timer neu setzen)',
				description: 'Wie Irisdown „RESET <time>“: mm, mm:ss oder hh:mm:ss',
				options: [
					{
						type: 'textinput',
						id: 'time',
						label: 'Zeit (mm, mm:ss oder hh:mm:ss)',
						default: '05:00',
						useVariables: true,
					},
					{ type: 'checkbox', id: 'start', label: 'Sofort starten', default: false },
				],
				callback: async (action, context) => {
					const raw = (await context.parseVariablesInString(String(action.options.time || ''))).trim()
					let seconds = null
					if (/^\d+(?:[.,]\d+)?$/.test(raw)) {
						seconds = Math.round(parseFloat(raw.replace(',', '.')) * 60) // nur Zahl = Minuten
					} else if (/^\d{1,3}:\d{1,2}(?::\d{1,2})?$/.test(raw)) {
						const p = raw.split(':').map(Number)
						seconds = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]
					}
					if (seconds === null) {
						this.log('warn', `Ungültige Zeit: "${raw}"`)
						return
					}
					await this.request(`set/${seconds}${action.options.start ? '/start' : ''}`)
				},
			},
			jog: {
				name: 'JOG – Zeit um Minuten ändern',
				options: [
					{ type: 'textinput', id: 'minutes', label: 'Minuten (z. B. 1, -1, 0.5)', default: '1', useVariables: true },
				],
				callback: async (action, context) => {
					const raw = (await context.parseVariablesInString(String(action.options.minutes || '0'))).trim()
					const m = parseFloat(raw.replace(',', '.'))
					if (!Number.isFinite(m) || m === 0) return
					await this.request(`jog/${m}`)
				},
			},
			display: {
				name: 'Anzeige-Modus (Timer / Uhrzeit / Schwarz / Test)',
				options: [{ type: 'dropdown', id: 'mode', label: 'Modus', default: 'TIMER', choices: DISPLAY_MODES }],
				callback: async (action) => {
					await this.request(`display/${String(action.options.mode).toLowerCase()}`)
				},
			},
			chart: {
				name: 'Testbild für die Signalkontrolle',
				options: [
					{
						type: 'dropdown',
						id: 'chart',
						label: 'Testbild',
						default: '1',
						choices: [
							{ id: '1', label: '1 · SMPTE-Farbbalken' },
							{ id: '2', label: '2 · EBU-Farbbalken' },
							{ id: '3', label: '3 · PLUGE (Schwarzwert)' },
							{ id: '4', label: '4 · Graustufentreppe' },
							{ id: '5', label: '5 · Luma-Rampe' },
							{ id: '6', label: '6 · Multiburst' },
							{ id: '7', label: '7 · Zonenplatte' },
							{ id: '8', label: '8 · Gitter und Kreis' },
							{ id: '9', label: '9 · Sicherheitsbereiche' },
							{ id: '10', label: '10 · ColorChecker' },
							{ id: 'off', label: 'Aus' },
						],
					},
				],
				callback: async (action) => {
					await this.request(`chart/${action.options.chart}`)
				},
			},
			test: {
				name: 'Testbild',
				options: [{ type: 'dropdown', id: 'mode', label: 'Aktion', default: 'toggle', choices: ON_OFF_TOGGLE }],
				callback: async (action) => {
					await this.request(`test/${action.options.mode}`)
				},
			},

			flash: {
				name: 'Output blinken lassen',
				options: [{ type: 'number', id: 'seconds', label: 'Dauer (Sekunden)', default: 3, min: 1, max: 30 }],
				callback: async (action) => {
					await this.request(`flash/${Math.max(1, Number(action.options.seconds) || 3)}`)
				},
			},

			blackout: {
				name: 'Blackout',
				options: [{ type: 'dropdown', id: 'mode', label: 'Aktion', default: 'toggle', choices: ON_OFF_TOGGLE }],
				callback: async (action) => {
					await this.request(`blackout/${action.options.mode}`)
				},
			},

			clock: {
				name: 'Output: Timer ⇄ Uhrzeit umschalten',
				options: [{ type: 'dropdown', id: 'mode', label: 'Aktion', default: 'toggle', choices: ON_OFF_TOGGLE }],
				callback: async (action) => {
					await this.request(`clock/${action.options.mode}`)
				},
			},

			ndi: {
				name: 'NDI-Ausgang',
				options: [{ type: 'dropdown', id: 'mode', label: 'Aktion', default: 'toggle', choices: ON_OFF_TOGGLE }],
				callback: async (action) => {
					await this.request(`ndi/${action.options.mode}`)
				},
			},
		}
	}

	feedbackDefinitions() {
		const bool = (name, description, defaultStyle, check, options = []) => ({
			type: 'boolean',
			name,
			description,
			defaultStyle,
			options,
			callback: (fb) => !!check(fb),
		})

		return {
			running: bool('Timer läuft', 'Aktiv, solange der Timer läuft', { bgcolor: GREEN, color: WHITE }, () => this.state.running),

			phase: bool(
				'Phase',
				'Aktiv, wenn der Timer in der gewählten Phase ist',
				{ bgcolor: RED, color: WHITE },
				(fb) => this.state.phase === fb.options.phase,
				[{ type: 'dropdown', id: 'phase', label: 'Phase', default: 'over', choices: PHASES }]
			),

			phase_color: {
				type: 'advanced',
				name: 'Farbe nach Phase (Countdown-Anzeige)',
				description: 'Färbt die Taste wie der Timer: normal, gelb, orange, rot',
				options: [],
				callback: () => {
					switch (this.state.phase) {
						case 'warn':
							return { bgcolor: YELLOW, color: BLACK }
						case 'danger':
							return { bgcolor: ORANGE, color: BLACK }
						case 'over':
							return { bgcolor: RED, color: WHITE }
						default:
							return {}
					}
				},
			},

			blackout: bool('Blackout aktiv', '', { bgcolor: DARKRED, color: WHITE }, () => this.state.blackout),
			clock: bool('Output zeigt Uhrzeit', '', { bgcolor: BLUE, color: WHITE }, () => this.state.clockOverride),
			ndi: bool('NDI sendet', '', { bgcolor: GREEN, color: WHITE }, () => this.state.ndi),
			flash: bool('Output blinkt', '', { bgcolor: WHITE, color: BLACK }, () => this.state.flash),

			message_any: bool('Eine Nachricht ist sichtbar', '', { bgcolor: GREEN, color: WHITE }, () => !!this.state.message),

			message: bool(
				'Bestimmte Nachricht ist sichtbar',
				'',
				{ bgcolor: GREEN, color: WHITE },
				(fb) => (this.state.messages || []).some((m) => m.index === Number(fb.options.index) && m.active),
				[
					{
						type: 'dropdown',
						id: 'index',
						label: 'Nachricht',
						default: this.messageChoices()[0]?.id ?? 1,
						choices: this.messageChoices(),
						allowCustom: true,
					},
				]
			),

			cue_current: bool(
				'Punkt ist geladen',
				'Aktiv, wenn der gewählte Punkt aus dem Ablauf gerade aktuell ist',
				{ bgcolor: DARKGREEN, color: WHITE },
				(fb) => Number(this.state.index) === Number(fb.options.index),
				[
					{
						type: 'dropdown',
						id: 'index',
						label: 'Punkt',
						default: this.cueChoices()[0]?.id ?? 1,
						choices: this.cueChoices(),
						allowCustom: true,
					},
				]
			),

			// --- Irisdown-kompatible Feedbacks ---
			state_color: {
				type: 'advanced',
				name: 'Farbe nach Status (läuft / pausiert)',
				description: 'Wie Irisdown: Farben je nach Timer-Status',
				options: [
					{ type: 'colorpicker', id: 'run_fg', label: 'Läuft: Schriftfarbe', default: WHITE },
					{ type: 'colorpicker', id: 'run_bg', label: 'Läuft: Hintergrund', default: GREEN },
					{ type: 'colorpicker', id: 'pause_fg', label: 'Pausiert: Schriftfarbe', default: BLACK },
					{ type: 'colorpicker', id: 'pause_bg', label: 'Pausiert: Hintergrund', default: ORANGE },
				],
				callback: (fb) => {
					if (this.state.state === 'running') return { color: fb.options.run_fg, bgcolor: fb.options.run_bg }
					if (this.state.state === 'paused') return { color: fb.options.pause_fg, bgcolor: fb.options.pause_bg }
					return {}
				},
			},
			mode_color: bool(
				'Anzeige-Modus',
				'Aktiv, wenn der Output den gewählten Modus zeigt',
				{ bgcolor: RED, color: WHITE },
				(fb) => this.state.display === fb.options.mode,
				[{ type: 'dropdown', id: 'mode', label: 'Modus', default: 'TIMER', choices: DISPLAY_MODES }]
			),
			message_on: bool('Nachricht aktiv', '', { bgcolor: RED, color: WHITE }, () => !!this.state.message),
			test: bool('Testbild aktiv', '', { bgcolor: combineRgb(128, 0, 160), color: WHITE }, () => this.state.test),

			connected: bool('Verbunden', 'Aktiv, wenn B_inTime erreichbar ist', { bgcolor: GREEN, color: WHITE }, () => this.connected === true),
		}
	}

	variableDefinitions() {
		const defs = [
			{ variableId: 'time', name: 'Angezeigte Zeit (wie im Output)' },
			{ variableId: 'timer', name: 'Timer (auch wenn der Output die Uhrzeit zeigt)' },
			{ variableId: 'remaining', name: 'Restzeit mm:ss' },
			{ variableId: 'remaining_seconds', name: 'Restzeit in Sekunden' },
			{ variableId: 'elapsed', name: 'Gelaufen mm:ss' },
			{ variableId: 'duration', name: 'Dauer mm:ss' },
			{ variableId: 'progress', name: 'Restzeit in Prozent' },
			{ variableId: 'phase', name: 'Phase (normal, warn, danger, over)' },
			{ variableId: 'running', name: 'Läuft (true/false)' },
			{ variableId: 'title', name: 'Titel' },
			{ variableId: 'speaker', name: 'Sprecher' },
			{ variableId: 'next', name: 'Nächster Punkt' },
			{ variableId: 'index', name: 'Nummer des aktuellen Punkts' },
			{ variableId: 'cue_count', name: 'Anzahl Punkte im Ablauf' },
			{ variableId: 'clock', name: 'Uhrzeit' },
			{ variableId: 'output', name: 'Output zeigt gerade: TIMER oder UHR' },
			{ variableId: 'planned_end', name: 'Voraussichtliches Ende' },
			{ variableId: 'message', name: 'Sichtbare Nachricht' },
			{ variableId: 'weather', name: 'Wetter' },
			{ variableId: 'state', name: 'Status (Running, Paused, Stopped)' },
			{ variableId: 'mode', name: 'Anzeige-Modus (TIMER, CLOCK, BLACK, TEST)' },
			{ variableId: 'time_hms', name: 'Timer hh:mm:ss' },
			{ variableId: 'time_hm', name: 'Timer hh:mm' },
			{ variableId: 'time_h', name: 'Timer Stunden' },
			{ variableId: 'time_m', name: 'Timer Minuten' },
			{ variableId: 'time_s', name: 'Timer Sekunden' },
		]
		const cues = this.state.cues || []
		for (const c of cues) {
			defs.push({ variableId: `cue_${c.index}_title`, name: `Punkt ${c.index}: Titel` })
			defs.push({ variableId: `cue_${c.index}_start`, name: `Punkt ${c.index}: geplanter Start` })
			defs.push({ variableId: `cue_${c.index}_label`, name: `Punkt ${c.index}: Titel, sonst Dauer (für Tasten)` })
			defs.push({ variableId: `cue_${c.index}_duration`, name: `Punkt ${c.index}: Dauer` })
		}
		const msgs = this.state.messages || []
		for (const m of msgs) {
			defs.push({ variableId: `message_${m.index}`, name: `Nachricht ${m.index}: Text` })
			defs.push({ variableId: `message_${m.index}_short`, name: `Nachricht ${m.index}: Text, gekürzt (für Tasten)` })
		}
		return defs
	}

	updateVariableValues() {
		const s = this.state || {}
		const fmt = (sec) => {
			const v = Math.max(0, Math.floor(Number(sec) || 0))
			const h = Math.floor(v / 3600)
			const m = Math.floor((v % 3600) / 60)
			const ss = String(v % 60).padStart(2, '0')
			return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${String(m).padStart(2, '0')}:${ss}`
		}
		const remaining = Number(s.remaining) || 0
		const values = {
			time: s.time ?? '',
			timer: s.timerTime ?? s.time ?? '',
			remaining: remaining >= 0 ? fmt(Math.ceil(remaining)) : `-${fmt(-remaining)}`,
			remaining_seconds: Math.round(remaining),
			elapsed: fmt(s.elapsed),
			duration: fmt(s.duration),
			progress: Math.round((Number(s.progress) || 0) * 100),
			phase: s.phase ?? '',
			running: !!s.running,
			title: s.title ?? '',
			speaker: s.speaker ?? '',
			next: s.next ?? '',
			index: s.index ?? 0,
			cue_count: (s.cues || []).length,
			clock: s.clock ?? '',
			output: s.clockOverride ? 'UHR' : 'TIMER',
			planned_end: s.plannedEnd ?? '',
			message: s.message?.text ?? '',
			weather: s.weather ?? '',
			state: s.state === 'running' ? 'Running' : s.state === 'paused' ? 'Paused' : 'Stopped',
			mode: s.display ?? 'TIMER',
			...this.splitTime(remaining, s.mode),
		}
		for (const c of s.cues || []) {
			values[`cue_${c.index}_title`] = c.title ?? ''
			values[`cue_${c.index}_start`] = c.start ?? ''
			values[`cue_${c.index}_label`] = c.title || c.durationText || ''
			values[`cue_${c.index}_short`] = short(c.title || c.durationText, 27)
			values[`cue_${c.index}_duration`] = c.durationText ?? ''
		}
		for (const m of s.messages || []) {
			values[`message_${m.index}`] = m.text ?? ''
			values[`message_${m.index}_short`] = short(m.text, 27)
		}
		this.setVariableValues(values)
	}

	/** Restzeit (bzw. Stoppuhr-Zeit) in Stunden/Minuten/Sekunden wie bei Irisdown */
	splitTime(remaining, mode) {
		let secs = mode === 'countup' ? Number(this.state.elapsed) || 0 : remaining
		const neg = secs < 0
		secs = neg ? Math.floor(-secs) : Math.ceil(secs)
		const h = Math.floor(secs / 3600)
		const m = Math.floor((secs % 3600) / 60)
		const sec = secs % 60
		const p = (n) => String(n).padStart(2, '0')
		const sign = neg ? '-' : ''
		return {
			time_hms: `${sign}${p(h)}:${p(m)}:${p(sec)}`,
			time_hm: `${sign}${p(h)}:${p(m)}`,
			time_h: `${sign}${p(h)}`,
			time_m: p(m),
			time_s: p(sec),
		}
	}

	presetDefinitions() {
		const v = (id) => `$(${this.label}:${id})`
		const presets = {}
		// Einheitlich Schriftgröße 14; nur die großen Zahlenanzeigen sind größer.
		const button = (id, category, name, text, actionId, options = {}, feedbacks = [], style = {}) => {
			presets[id] = {
				type: 'button',
				category,
				name,
				style: { text, size: '14', color: WHITE, bgcolor: GREY, ...style },
				steps: [{ down: [{ actionId, options }], up: [] }],
				feedbacks,
			}
		}
		const phaseColor = { feedbackId: 'phase_color', options: {} }
		const stateColor = {
			feedbackId: 'state_color',
			options: { run_fg: WHITE, run_bg: GREEN, pause_fg: BLACK, pause_bg: ORANGE },
		}

		// Timer
		button('time', 'Timer', 'Zeitanzeige (Play/Pause)', v('time'), 'toggle', {}, [
			{ feedbackId: 'running', options: {}, style: { bgcolor: DARKGREEN, color: WHITE } },
			phaseColor,
		], { size: '18', bgcolor: BLACK })
		button('play', 'Timer', 'Play', '▶\nPLAY', 'go', {}, [stateColor], { bgcolor: GOLD, color: BLACK })
		button('pause', 'Timer', 'Pause', '❚❚\nPAUSE', 'pause', {}, [], { bgcolor: MAGENTA })
		button('toggle', 'Timer', 'Play / Pause', '⏯', 'toggle', {}, [stateColor], { size: '30', bgcolor: GOLD, color: BLACK })
		button('clock', 'Mode', 'Mode (Timer ⇄ Uhrzeit umschalten)', '⇄\n' + v('output'), 'clock', { mode: 'toggle' }, [
			{ feedbackId: 'clock', options: {}, style: { bgcolor: BLUE, color: BLACK } },
		], { bgcolor: CUEBLUE })
		button('reset', 'Timer', 'Reset', '↺\nRESET', 'reset')
		button('prev', 'Timer', 'Vorheriger Punkt', '⏮ Zurück', 'prev')
		button('next', 'Timer', 'Nächster Punkt', '⏭ Weiter', 'next')
		button('add60', 'Timer', '+1 Minute', '+1 min', 'adjust', { seconds: 60 })
		button('sub60', 'Timer', '−1 Minute', '-1 min', 'adjust', { seconds: -60 })
		button('add10', 'Timer', '+10 Sekunden', '+10 s', 'adjust', { seconds: 10 })
		button('sub10', 'Timer', '−10 Sekunden', '-10 s', 'adjust', { seconds: -10 })

		// Schnell-Timer
		for (const m of [5, 10, 15, 20, 30, 45, 60]) {
			button(`preset_${m}`, 'Schnell-Timer', `${m} Minuten`, `${m} min`, 'preset', { minutes: m, start: false }, [], { bgcolor: CUEBLUE })
		}

		// Ablauf
		for (const c of this.state.cues || []) {
			button(
				`cue_${c.index}`,
				'Ablauf',
				`Punkt ${c.index}: ${c.title || c.durationText || ''}`,
				`${c.index}\n${v(`cue_${c.index}_short`)}`,
				'cue',
				{ index: c.index, start: true },
				[{ feedbackId: 'cue_current', options: { index: c.index }, style: { bgcolor: GREEN, color: WHITE } }],
				{ bgcolor: CUEBLUE }
			)
		}

		// Nachrichten
		for (const m of this.state.messages || []) {
			button(
				`msg_${m.index}`,
				'Nachrichten',
				`Nachricht ${m.index}: ${m.text}`,
				v(`message_${m.index}_short`),
				'message',
				{ index: m.index, mode: 'toggle' },
				[{ feedbackId: 'message', options: { index: m.index }, style: { bgcolor: GREEN, color: WHITE } }],
				{ bgcolor: CUEBLUE }
			)
		}
		button('msg_hide', 'Nachrichten', 'Nachricht ausblenden', 'TEXT\nAUS', 'message_hide', {}, [], { bgcolor: MAGENTA })

		// Output
		button('blackout', 'Output', 'Blackout', 'BLACK\nOUT', 'blackout', { mode: 'toggle' }, [
			{ feedbackId: 'blackout', options: {}, style: { bgcolor: MAGENTA, color: WHITE } },
		])
		button('flash', 'Output', 'Blinken', '✺\nBLINKEN', 'flash', { seconds: 3 }, [
			{ feedbackId: 'flash', options: {}, style: { bgcolor: WHITE, color: BLACK } },
		])
		button('ndi', 'Output', 'NDI an/aus', 'NDI', 'ndi', { mode: 'toggle' }, [
			{ feedbackId: 'ndi', options: {}, style: { bgcolor: BLUE, color: BLACK } },
		])

		// Wie Irisdown: Mode
		for (const mode of DISPLAY_MODES) {
			button(`mode_${mode.id}`, 'Mode', mode.label, mode.id, 'display', { mode: mode.id }, [
				{ feedbackId: 'mode_color', options: { mode: mode.id }, style: { bgcolor: BLUE, color: BLACK } },
			])
		}

		// Wie Irisdown: Display time (Stunden / Minuten / Sekunden einzeln)
		for (const part of [
			['h', 'Stunden'],
			['m', 'Minuten'],
			['s', 'Sekunden'],
		]) {
			presets[`time_${part[0]}`] = {
				type: 'button',
				category: 'Display time',
				name: part[1],
				style: { text: v(`time_${part[0]}`), size: '44', color: WHITE, bgcolor: BLACK },
				steps: [],
				feedbacks: [stateColor],
			}
		}

		return presets
	}
}

runEntrypoint(BInTimeInstance, [])
