/**
 * @name TheIntroDB
 * @description Skip intros, recaps, credits, and previews in TV shows and movies in Stremio Enhanced using TheIntroDB API
 * @updateUrl https://raw.githubusercontent.com/TheIntroDB/stremio-enhanced-plugin/refs/heads/main/tidb.plugin.js
 * @version 2.0.0
 * @author TheIntroDB
 */
/* jshint esversion: 11, browser: true, devel: true */
/* global StremioEnhancedAPI */

(function() {
	"use strict";

	const PLUGIN_VERSION = "2.0.0";
	const PLUGIN_ID = "tidb";
	const SERVER_URL = "https://api.theintrodb.org/v3";
	const ACTIVE_BTN_ID = "tidb-active-btn";
	const MAX_RETRIES = 3;
	const RETRY_DELAY = 2000;
	const TIDB_API_KEY_SETTING = "tidb_api_key";
	const ANALYTICS_SETTING = "anonymous_usage_reporting";
	const THEME_SETTING = "tidb_theme";
	const TIDB_USER_AGENT = "TheIntroDB Stremio Enhanced Plugin";

	const THEMES = {
		default: {
            background: "#0f0d20",
            hover: "#1b192b",
            border: "none",
            backdropFilter: "none",
            borderRadius: "6px",
            fontSize: "24px",
            padding: "16px",
			iconSize: "24"
        },
        glass: {
            background: "rgba(70, 70, 70, 0.22)",
            hover: "rgba(90, 90, 90, 0.32)",
            border: "1px solid rgba(255, 255, 255, 0.04)",
            backdropFilter: "blur(20px) saturate(180%)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.2), 0 4px 16px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.1)",
            borderRadius: "50px",
            fontSize: "15px",
            padding: "8px 16px",
			iconSize: "20"
        }
	};

	const SEGMENT_BUTTON_SETTINGS = {
		intro: "show_intro_button",
		recap: "show_recap_button",
		credits: "show_credits_button",
		preview: "show_preview_button"
	};
	const SEGMENT_TYPES = Object.keys(SEGMENT_BUTTON_SETTINGS);

	function isLiquidGlassThemeActive() {
		try {
			const appTheme = localStorage.getItem("currentTheme") || "";
			return appTheme.includes("liquid-glass");
		} catch {
			return false;
		}
	}

	function resolveThemeName(storedTheme) {
		if (isLiquidGlassThemeActive()) {
			return "glass";
		}
		return storedTheme || "glass";
	}

	const AUTOSKIP_STORAGE_KEYS = {
		intro: "stremio-custom-autoskip-intro",
		credits: "stremio-custom-autoskip-credits",
		recap: "stremio-custom-autoskip-recap"
	};

	function isAutoSkipEnabled(segmentType) {
		if (window.StremioCustomAutoskip?.isEnabled) {
			return window.StremioCustomAutoskip.isEnabled(segmentType);
		}
		const storageKey = AUTOSKIP_STORAGE_KEYS[segmentType];
		if (!storageKey) {
			return false;
		}
		try {
			return localStorage.getItem(storageKey) === "true";
		} catch {
			return false;
		}
	}
	const SEGMENT_LABELS = Object.freeze({
		intro: "Skip Intro",
		recap: "Skip Recap",
		credits: "Skip Credits",
		preview: "Skip Preview"
	});
	const SEGMENT_COLORS = Object.freeze({
		intro: "rgba(255, 217, 0, 0.6)",
		recap: "rgba(255, 165, 0, 0.6)",
		credits: "rgba(100, 149, 237, 0.6)",
		preview: "rgba(144, 238, 144, 0.6)"
	});
	const HIDE_TIMEOUT = 5000;

	const APTABASE_APP_KEY = "A-SH-3524453842";
	const APTABASE_HOST = "https://analytics.theintrodb.org";
	const APTABASE_SDK_VERSION = "aptabase-web@userscript";
	const APTABASE_SESSION_TIMEOUT_SEC = 1 * 60 * 60;

	let _aptabaseAppKey = "";
	let _aptabaseApiUrl = null;
	let _aptabaseAppVersion = "";
	let _aptabaseIsDebug = null;
	let _aptabaseLocale = null;
	let _aptabaseSessionId = null;
	let _aptabaseLastTouched = 0;

	function aptabaseNewSessionId() {
		const epochInSeconds = Math.floor(Date.now() / 1000).toString();
		const random = Math.floor(Math.random() * 100000000).toString().padStart(8, "0");
		return epochInSeconds + random;
	}

	function aptabaseInMemorySessionId(timeoutSec) {
		const now = Date.now();
		const diffInSec = Math.floor((now - _aptabaseLastTouched) / 1000);
		if (!_aptabaseSessionId || diffInSec > timeoutSec) {
			_aptabaseSessionId = aptabaseNewSessionId();
		}
		_aptabaseLastTouched = now;
		return _aptabaseSessionId;
	}

	function aptabaseGetBrowserLocale() {
		if (_aptabaseLocale) return _aptabaseLocale;
		if (typeof navigator === "undefined") return undefined;
		_aptabaseLocale = (navigator.languages && navigator.languages.length > 0) ? navigator.languages[0] : navigator.language;
		return _aptabaseLocale;
	}

	function aptabaseGetIsDebug() {
		if (_aptabaseIsDebug !== null) return _aptabaseIsDebug;
		if (typeof location === "undefined") {
			_aptabaseIsDebug = false;
			return _aptabaseIsDebug;
		}
		_aptabaseIsDebug = location.hostname === "localhost";
		return _aptabaseIsDebug;
	}

	function aptabaseValidateAppKey(appKey) {
		const parts = String(appKey || "").split("-");
		return parts.length === 3 && ["US", "EU", "DEV", "SH"].includes(parts[1]);
	}

	function aptabaseGetApiUrl(appKey, options) {
		const region = String(appKey || "").split("-")[1];
		if (region === "SH") {
			if (!options || !options.host) return null;
			return `${options.host}/api/v0/event`;
		}
		const hosts = {
			US: "https://us.aptabase.com",
			EU: "https://eu.aptabase.com",
			DEV: "https://localhost:3000"
		};
		const host = (options && options.host) ? options.host : hosts[region];
		return host ? `${host}/api/v0/event` : null;
	}

	function aptabaseInit(appKey, options) {
		if (!aptabaseValidateAppKey(appKey)) return false;
		_aptabaseApiUrl = (options && options.apiUrl) ? options.apiUrl : aptabaseGetApiUrl(appKey, options);
		if (!_aptabaseApiUrl) return false;
		_aptabaseAppKey = appKey;
		_aptabaseAppVersion = (options && options.appVersion) ? String(options.appVersion) : "";
		return true;
	}

	async function aptabaseSendEvent(eventName, props) {
		if (typeof fetch !== "function" || !_aptabaseApiUrl || !_aptabaseAppKey) return;
		try {
			const sessionId = aptabaseInMemorySessionId(APTABASE_SESSION_TIMEOUT_SEC);
			const response = await fetch(_aptabaseApiUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"App-Key": _aptabaseAppKey
				},
				credentials: "omit",
				body: JSON.stringify({
					timestamp: new Date().toISOString(),
					sessionId,
					eventName,
					systemProps: {
						locale: aptabaseGetBrowserLocale(),
						isDebug: aptabaseGetIsDebug(),
						appVersion: _aptabaseAppVersion,
						sdkVersion: APTABASE_SDK_VERSION
					},
					props
				})
			});
			if (response.status >= 300) {
				const responseBody = await response.text();
				console.warn(`Failed to send event "${eventName}": ${response.status} ${responseBody}`);
			}
		} catch (e) {
			console.warn(`Failed to send event "${eventName}"`);
			console.warn(e);
		}
	}

	function aptabaseTrackEvent(eventName, props) {
		aptabaseSendEvent(eventName, props);
	}

	function initAnalyticsOnce() {
		if (window.__tidbAnalyticsInitialized) return;
		const ok = aptabaseInit(APTABASE_APP_KEY, {
			host: APTABASE_HOST,
			appVersion: PLUGIN_VERSION
		});
		if (!ok) return;
		window.__tidbAnalyticsInitialized = true;
		aptabaseTrackEvent("plugin_started", {
			version: PLUGIN_VERSION
		});
	}

	function capitalize(value) {
		const str = String(value || "");
		return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
	}

	function emptySegments() {
		return Object.fromEntries(SEGMENT_TYPES.map((type) => [type, []]));
	}

	function normalizeApiKey(value) {
		return typeof value === "string" ? value.trim() : "";
	}

	function normalizeToggleValue(value) {
		return value !== false;
	}

	function getVideoDurationMs(video) {
		const playbackDuration = window.StremioCustomPlayback?.getDuration?.();
		if (Number.isFinite(playbackDuration) && playbackDuration > 0) {
			return Math.round(playbackDuration * 1000);
		}
		const durationSec = video && typeof video.duration === "number" ? video.duration : NaN;
		if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
		const durationMs = Math.round(durationSec * 1000);
		return durationMs > 0 ? durationMs : null;
	}

	class TheIntroDBPlugin {
		constructor() {
			this.video = null;
			this.episodeId = null;
			this.title = null;
			this.segments = emptySegments();
			this.activeSegment = null;
			this.displayedSegmentType = null;
			this.skipButtonTimeout = null;
			this.overlayObserver = null;
			this.userApiKey = "";
			this.analyticsEnabled = true;
			this.theme = "glass";
			this.segmentButtonVisibility = Object.fromEntries(SEGMENT_TYPES.map((type) => [type, true]));
			this.onTimeUpdate = null;
			this.onSeekedHandler = null;
			this.onMouseMoveHandler = null;
			this.onLoadedMetadataHandler = null;
			this.settingsReady = this.initializeSettings();
			this._checkingPlayback = false;
			this._lastSeenUrl = null;
			this._lastStateContext = null;
			this._lastStateCheckAt = 0;
			this._lastVideoSource = null;
			this._lastFetchedDurationMs = null;
			this._checkTimer = null;
			this._observer = null;
			this._autoSkippedKeys = new Set();
			this.init();
		}

		init() {
			this._observer = new MutationObserver(() => {
				this.checkPlaybackChange();
			});
			this._observer.observe(document.body, {
				childList: true,
				subtree: true
			});
			this._checkTimer = setInterval(() => this.checkPlaybackChange(), 700);
			window.addEventListener("hashchange", () => {
				this._lastSeenUrl = null;
				setTimeout(() => this.checkPlaybackChange(), 80);
			});
			this.checkPlaybackChange();
		}

		async initializeSettings() {
			const api = window.StremioCustomAPI || window.StremioEnhancedAPI;
			if (!api) {
				return;
			}

			if (window.__tidbSettingsRegistered) {
				return;
			}

			try {
				const schema = [{
						key: TIDB_API_KEY_SETTING,
						type: "input",
						label: "TIDB API Key",
						defaultValue: ""
					},
					{
						key: THEME_SETTING,
						type: "select",
						label: "Button Theme",
						options: [{
							value: "default",
							label: "Default"
						}, {
							value: "glass",
							label: "Glass"
						}],
						defaultValue: "default"
					}
				];

				for (const segmentType of SEGMENT_TYPES) {
					schema.push({
						key: SEGMENT_BUTTON_SETTINGS[segmentType],
						type: "toggle",
						label: `Show ${capitalize(segmentType)} Button`,
						defaultValue: true
					});
				}

				schema.push({
					key: ANALYTICS_SETTING,
					type: "toggle",
					label: "Anonymous usage reporting",
					description: "Send anonymous feature usage events (e.g. button shown/clicked) to help improve the plugin. No media IDs or titles are sent.",
					defaultValue: true
				});

				await api.registerSettings(PLUGIN_ID, schema);
				window.__tidbSettingsRegistered = true;
			} catch (err) {
				const message = err && err.message ? String(err.message) : "";
				if (message.includes("settings schema registered")) {
					window.__tidbSettingsRegistered = true;
					return;
				}
				console.warn("[TheIntroDB] Failed to register settings:", err);
			}
		}

		getSettingsApi() {
			return window.StremioCustomAPI || window.StremioEnhancedAPI || null;
		}

		getSetting(key) {
			const api = this.getSettingsApi();
			return api ? api.getSetting(PLUGIN_ID, key) : Promise.resolve(null);
		}

		async loadSettings() {
			const api = this.getSettingsApi();
			if (!api) return;

			this.theme = resolveThemeName(await this.getSetting(THEME_SETTING));
			this.userApiKey = normalizeApiKey(await this.getSetting(TIDB_API_KEY_SETTING));
			this.analyticsEnabled = normalizeToggleValue(await this.getSetting(ANALYTICS_SETTING));
			if (this.analyticsEnabled) initAnalyticsOnce();

			const visibility = {};
			for (const [segmentType, settingKey] of Object.entries(SEGMENT_BUTTON_SETTINGS)) {
				visibility[segmentType] = normalizeToggleValue(await this.getSetting(settingKey));
			}
			this.segmentButtonVisibility = visibility;
		}

		track(eventName, props) {
			if (!this.analyticsEnabled) return;
			initAnalyticsOnce();
			aptabaseTrackEvent(eventName, props);
		}

		isSegmentButtonEnabled(segmentType) {
			if (!this.segmentButtonVisibility || !(segmentType in this.segmentButtonVisibility)) {
				return true;
			}
			return this.segmentButtonVisibility[segmentType] !== false;
		}

		getPlaybackVideo() {
			return (
				window.StremioCustomPlayback?.getVideo?.() ||
				document.querySelector('[class*="player-container"] video') ||
				document.querySelector("video")
			);
		}

		findActiveSegment(currentTime, duration) {
			if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) {
				return null;
			}

			for (const segmentType of SEGMENT_TYPES) {
				const segmentList = this.segments[segmentType] || [];
				for (const segment of segmentList) {
					const end = segment.end != null ? segment.end : duration;
					if (currentTime >= segment.start && currentTime <= end) {
						return {
							type: segmentType,
							start: segment.start,
							end
						};
					}
				}
			}

			return null;
		}

		getAutoSkipKey(seg) {
			return `${this.episodeId || "unknown"}:${seg.type}:${seg.start}`;
		}

		tryAutoSkip(video, seg) {
			if (seg.end == null || !Number.isFinite(seg.end)) {
				return false;
			}

			const skipKey = this.getAutoSkipKey(seg);
			if (this._autoSkippedKeys.has(skipKey)) {
				this.removeActiveButton();
				this.displayedSegmentType = null;
				return true;
			}

			if (video.currentTime < seg.start || video.currentTime >= seg.end) {
				return false;
			}

			video.currentTime = seg.end;
			this._autoSkippedKeys.add(skipKey);
			this.removeActiveButton();
			this.displayedSegmentType = null;
			console.log(`[TheIntroDB] Auto-skipped ${seg.type}: targetTime=${seg.end}`);
			this.track("auto_skip", {
				segment: seg.type
			});
			return true;
		}

		getPlaybackCurrentTime(video) {
			const shellTime = window.StremioCustomPlayback?.getCurrentTime?.();
			if (Number.isFinite(shellTime) && shellTime >= 0) {
				return shellTime;
			}
			return video?.currentTime;
		}

		syncSkipButton() {
			const video = this.getPlaybackVideo();
			const duration = window.StremioCustomPlayback?.getDuration?.() || video?.duration;
			if (!video || !Number.isFinite(duration) || duration <= 0) {
				this.removeActiveButton();
				this.activeSegment = null;
				this.displayedSegmentType = null;
				return;
			}

			this.video = video;
			const currentTime = this.getPlaybackCurrentTime(video);
			let seg = this.findActiveSegment(currentTime, duration);
			this.activeSegment = seg;

			if (!seg) {
				this.removeActiveButton();
				this.displayedSegmentType = null;
				return;
			}

			if (isAutoSkipEnabled(seg.type)) {
				this.tryAutoSkip(video, seg);
				const timeAfterSkip = this.getPlaybackCurrentTime(video);
				seg = this.findActiveSegment(timeAfterSkip, duration);
				this.activeSegment = seg;
				if (!seg) {
					this.removeActiveButton();
					this.displayedSegmentType = null;
					return;
				}
			}

			if (!this.isSegmentButtonEnabled(seg.type)) {
				this.removeActiveButton();
				this.displayedSegmentType = null;
				return;
			}

			const existing = document.getElementById(ACTIVE_BTN_ID);
			if (existing && existing.getAttribute("data-segment-type") === seg.type) {
				return;
			}

			this.showSkipButton(seg);
			this.displayedSegmentType = seg.type;
		}

		startSegmentWatcher() {
			if (this.segmentWatcher) clearInterval(this.segmentWatcher);
			this.syncSkipButton();
			this.segmentWatcher = setInterval(() => this.syncSkipButton(), 300);
		}

		stopSegmentWatcher() {
			if (this.segmentWatcher) {
				clearInterval(this.segmentWatcher);
				this.segmentWatcher = null;
			}
		}

		getTidbHeaders() {
			const headers = {
				"User-Agent": TIDB_USER_AGENT
			};

			if (this.userApiKey) {
				headers.Authorization = `Bearer ${this.userApiKey}`;
			}

			return headers;
		}

		getVideoSource(video) {
			return video ? (video.currentSrc || video.src || video.getAttribute("src") || null) : null;
		}

		extractTitleFromDocument() {
			const raw = document && document.title ? String(document.title).trim() : "";
			if (!raw) {
				return null;
			}
			const cleaned = raw.replace(/\s+-\s+Stremio.*$/i, "").trim();
			return cleaned || raw;
		}

		async resolvePlaybackContext(urlChanged, sourceChanged) {
			const now = Date.now();
			const urlEpisodeId = this.extractEpisodeIdFromUrl();
			const urlContext = urlEpisodeId ? {
				episodeId: urlEpisodeId,
				title: this.extractTitleFromDocument()
			} : null;

			const shouldRefreshState = sourceChanged || urlChanged || now - this._lastStateCheckAt > 5000 || !this._lastStateContext;
			if (!shouldRefreshState && !urlChanged) {
				return urlContext || this._lastStateContext;
			}

			if (shouldRefreshState) {
				this._lastStateCheckAt = now;
				this._lastStateContext = await this.getPlaybackContextFromState();
			}

			return this._lastStateContext || urlContext;
		}

		async checkPlaybackChange() {
			if (this._checkingPlayback) return;
			this._checkingPlayback = true;

			const video = this.getPlaybackVideo();
			try {
				if (!video) return;
				const currentUrl = window.location.href;
				const urlChanged = currentUrl !== this._lastSeenUrl;
				const videoChanged = video !== this.video;
				const currentVideoSource = this.getVideoSource(video);
				const sourceChanged = Boolean(currentVideoSource && currentVideoSource !== this._lastVideoSource);
				this._lastSeenUrl = currentUrl;
				this._lastVideoSource = currentVideoSource;

				const context = await this.resolvePlaybackContext(urlChanged, sourceChanged);
				const nextEpisodeId = context && context.episodeId ? context.episodeId : null;
				if (!nextEpisodeId) return;

				const episodeChanged = nextEpisodeId !== this.episodeId;
				if (!episodeChanged && !videoChanged && !urlChanged) {
					const durationMs = getVideoDurationMs(video);
					if (durationMs != null && durationMs !== this._lastFetchedDurationMs) {
						await this.fetchData();
					}
					if (!this.segmentWatcher && Object.values(this.segments).flat().length > 0) {
						this.startSegmentWatcher();
					}
					return;
				}
				if (this.video || this.episodeId) this.cleanup();

				this.video = video;
				this.episodeId = nextEpisodeId;
				this.title = context.title || null;

				if (!this.onLoadedMetadataHandler) this.onLoadedMetadataHandler = () => this.checkPlaybackChange();
				this.video.removeEventListener("loadedmetadata", this.onLoadedMetadataHandler);
				this.video.addEventListener("loadedmetadata", this.onLoadedMetadataHandler);

				await this.settingsReady;
				this.loadSettings().catch(() => {});

				console.log(`[TheIntroDB] \nEpisode ID: ${this.episodeId}, \nTitle: ${this.title || "Unknown Title"}`);
				await this.fetchData();
				this.attachUiObservers();
			} finally {
				this._checkingPlayback = false;
			}
		}

		extractEpisodeIdFromUrl() {
			const url = window.location.href;
			let m = url.match(/\/detail\/series\/([^/?#]+)\/(\d+)\/(\d+)/);
			if (m) {
				const episodeId = `${m[1]}:${m[2]}:${m[3]}`;
				try { sessionStorage.setItem('stremio-custom-tidb-episode', episodeId); } catch (_) {}
				return episodeId;
			}
			m = url.match(/\/detail\/series\/([^/?#]+)/);
			if (m) {
				const s = url.match(/[?&]season=(\d+)/),
					e = url.match(/[?&]episode=(\d+)/);
				if (s && e) {
					const episodeId = `${m[1]}:${s[1]}:${e[1]}`;
					try { sessionStorage.setItem('stremio-custom-tidb-episode', episodeId); } catch (_) {}
					return episodeId;
				}
			}
			m = url.match(/\/detail\/movie\/([^/?#]+)/);
			if (m) {
				const episodeId = m[1].split(":")[0];
				try { sessionStorage.setItem('stremio-custom-tidb-episode', episodeId); } catch (_) {}
				return episodeId;
			}

			try {
				const decoded = decodeURIComponent(url);

				m = decoded.match(/\/series\/[^/]+\/([^/?#]+)/);
				if (m) {
					const parts = m[1].split(":");
					if (parts.length >= 3) {
						const episodeId = `${parts[0]}:${parts[1]}:${parts[2]}`;
						try { sessionStorage.setItem('stremio-custom-tidb-episode', episodeId); } catch (_) {}
						return episodeId;
					}
				}

				m = decoded.match(/\/movie\/([^/]+)\/([^/?#]+)/);
				if (m) {
					for (const candidate of [m[2], m[1]]) {
						if (!candidate) continue;
						const imdbMatch = String(candidate).match(/tt\d{7,8}/);
						if (imdbMatch) {
							try { sessionStorage.setItem('stremio-custom-tidb-episode', imdbMatch[0]); } catch (_) {}
							return imdbMatch[0];
						}
						const raw = String(candidate).split(":")[0];
						if (/^\d+$/.test(raw)) {
							try { sessionStorage.setItem('stremio-custom-tidb-episode', raw); } catch (_) {}
							return raw;
						}
						if (raw) {
							try { sessionStorage.setItem('stremio-custom-tidb-episode', raw); } catch (_) {}
							return raw;
						}
					}
				}
			} catch (_) {}

			if (/#\/player/.test(url)) {
				try {
					const cached = sessionStorage.getItem('stremio-custom-tidb-episode');
					if (cached) return cached;
				} catch (_) {}
			}

			return null;
		}

		async getPlaybackContextFromState() {
			const state = await this.waitForPlayerState();
			const meta = state && state.metaItem ? state.metaItem.content : null;
			if (!meta || !meta.id) return null;

			const seriesInfo = state.seriesInfo;
			const id = String(meta.id);
			const episodeId = seriesInfo && seriesInfo.season && seriesInfo.episode ? `${id}:${seriesInfo.season}:${seriesInfo.episode}` : id;

			let title = meta.name ? String(meta.name) : null;
			if (title && seriesInfo && seriesInfo.season != null && seriesInfo.episode != null) title = `${title} S${String(seriesInfo.season).padStart(2, "0")}E${String(seriesInfo.episode).padStart(2, "0")}`;
			return {
				episodeId,
				title
			};
		}

		async waitForPlayerState() {
			for (let i = 0; i < 30; i++) {
				const state = await this.evalInPage("window.services && window.services.core && window.services.core.transport && window.services.core.transport.getState('player')");
				if (state && state.metaItem && state.metaItem.content) return state;
				await new Promise((resolve) => setTimeout(resolve, i < 8 ? 80 : 180));
			}
			return null;
		}

		evalInPage(js) {
			return new Promise((resolve) => {
				const event = "stremio-enhanced-" + Math.random().toString(36).slice(2);
				const script = document.createElement("script");

				window.addEventListener(event, (browserEvent) => {
					script.remove();
					resolve(browserEvent.detail);
				}, {
					once: true
				});

				script.textContent = `(async()=>{try{const out=await (${js});window.dispatchEvent(new CustomEvent("${event}",{detail:out}));}catch(err){console.error(err);window.dispatchEvent(new CustomEvent("${event}",{detail:null}));}})();`;

				document.head.appendChild(script);
			});
		}

		async fetchData() {
			const video = this.video;
			const episodeId = this.episodeId;
			if (!video || !episodeId) {
				return null;
			}

			const parts = String(episodeId).split(":");
			const id = parts[0];
			const season = parts.length >= 3 ? parts[1] : null;
			const episode = parts.length >= 3 ? parts[2] : null;
			const isTvShow = parts.length >= 3;
			for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
				console.log(`[TheIntroDB] Fetching /media for episode ${episodeId} (attempt ${attempt})`);

				try {
					const isImdb = id.startsWith("tt");
					const queryParams = new URLSearchParams();

					if (isImdb) {
						queryParams.set("imdb_id", id);
					} else {
						queryParams.set("tmdb_id", id);
					}

					if (isTvShow) {
						queryParams.set("season", season);
						queryParams.set("episode", episode);
					}

					const durationMs = getVideoDurationMs(video);
					if (durationMs != null) queryParams.set("duration_ms", String(durationMs));
					this._lastFetchedDurationMs = durationMs;

					const res = await fetch(`${SERVER_URL}/media?${queryParams}`, {
						headers: this.getTidbHeaders()
					});

					if (res.status === 204) {
						this.segments = emptySegments();
						console.log(`[TheIntroDB] No skip data for episode ${episodeId} (${res.status})`);
						return null;
					}

					if (res.status === 404) {
						this.segments = emptySegments();
						console.warn(`[TheIntroDB] No data found for episode ${episodeId}`);
						return null;
					}

					if (!res.ok) {
						console.warn(`[TheIntroDB] Unexpected response for ${episodeId}: ${res.status}`);
						return null;
					}

					const json = await res.json();
					this.segments = emptySegments();

					for (const segmentType of SEGMENT_TYPES) {
						if (json[segmentType] && json[segmentType].length > 0) {
							this.segments[segmentType] = json[segmentType].map((segment) => ({
								start: segment.start_ms == null ? 0 : segment.start_ms / 1000,
								end: segment.end_ms == null ? null : segment.end_ms / 1000
							}));
							console.log(`[TheIntroDB] Loaded ${this.segments[segmentType].length} ${segmentType} segments`);
						}
					}

					if (Object.values(this.segments).flat().length === 0) {
						console.log(`[TheIntroDB] No segment data found for episode ${episodeId}`);
					}

					this.waitAndHighlight();
					this.startSegmentWatcher();
					this.track("segments_loaded", {
						has_intro: this.segments.intro && this.segments.intro.length > 0,
						has_recap: this.segments.recap && this.segments.recap.length > 0,
						has_credits: this.segments.credits && this.segments.credits.length > 0,
						has_preview: this.segments.preview && this.segments.preview.length > 0,
						total: Object.values(this.segments).reduce((acc, list) => acc + (list ? list.length : 0), 0)
					});
					return null;
				} catch (err) {
					console.error(`[TheIntroDB] Error fetching media for ${episodeId}:`, err);

					if (attempt < MAX_RETRIES) {
						await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
					} else {
						return null;
					}
				}
			}

			return null;
		}

		waitAndHighlight() {
			let tries = 50;
			const attempt = () => {
				if (!this.video || !this.video.duration) {
					const playbackDuration = window.StremioCustomPlayback?.getDuration?.();
					if (Number.isFinite(playbackDuration) && playbackDuration > 0) {
						this.highlightRangeOnBar();
						this.syncSkipButton();
						return;
					}
					if (tries-- > 0) setTimeout(attempt, 180);
					return;
				}
				this.highlightRangeOnBar();
				this.syncSkipButton();
				setTimeout(() => {
					this.highlightRangeOnBar();
					this.syncSkipButton();
				}, 250);
			};
			attempt();
		}

		getSeekSliderContainer() {
			const seekBar = document.querySelector('[class*="seek-bar-container"]');
			return seekBar?.querySelector('[class*="slider-container"]') || null;
		}

		getSeekTrack(slider) {
			const tracks = slider.querySelectorAll('[class*="track"]');
			for (let i = 0; i < tracks.length; i += 1) {
				const className = tracks[i].className || "";
				if (className.includes("track-before") || className.includes("track-after")) continue;
				return tracks[i];
			}
			return null;
		}

		clearVolumeIndicatorHighlights() {
			document
				.querySelectorAll('[class*="volume-change-indicator"] .segment-highlight')
				.forEach((highlight) => highlight.remove());
		}

		highlightRangeOnBar() {
			const slider = this.getSeekSliderContainer();
			if (!slider || !this.video || !this.video.duration) return;
			this.clearVolumeIndicatorHighlights();
			slider.querySelectorAll(".segment-highlight").forEach((highlight) => highlight.remove());

			const trackEl = this.getSeekTrack(slider) || slider.querySelector(".track-gItfW");
			if (!trackEl) return;

			const thumbEl = slider.querySelector(".thumb-PiTF5") || slider.querySelector('[class*="thumb-"]');
			const thumbLayer = thumbEl && thumbEl.parentNode;
			const duration = this.video.duration;

			for (const [segmentType, segmentList] of Object.entries(this.segments)) {
				for (const segment of segmentList) {
					const highlight = document.createElement("div");
					const startPct = (segment.start / duration) * 100;
					const segmentEnd = segment.end != null ? segment.end : duration;
					const rawWidthPct = ((segmentEnd - segment.start) / duration) * 100;
					const widthPct = Math.max(rawWidthPct, segmentType === "credits" ? 2.5 : segmentType === "intro" ? 2 : 0.8);
					let leftPct = startPct;
					if (leftPct + widthPct > 100) leftPct = Math.max(0, 100 - widthPct);

					highlight.className = `segment-highlight segment-${segmentType}`;
					Object.assign(highlight.style, {
						position: "absolute",
						top: "50%",
						left: `${leftPct}%`,
						width: `${widthPct}%`,
						minWidth: segmentType === "credits" ? "16px" : "6px",
						borderRadius: "4px",
						height: `${trackEl.clientHeight || 4}px`,
						transform: "translateY(-50%)",
						background: SEGMENT_COLORS[segmentType],
						pointerEvents: "none",
						zIndex: "1"
					});

					slider.insertBefore(highlight, thumbLayer && slider.contains(thumbLayer) ? thumbLayer : slider.firstChild);
				}
			}

			this.syncSkipButton();
		}

		ensureHighlightsPresent() {
			this.clearVolumeIndicatorHighlights();
			const slider = this.getSeekSliderContainer();
			if (!slider || !this.video || !this.video.duration) return;
			if (slider.querySelector(".segment-highlight")) return;
			if (Object.values(this.segments).flat().length === 0) return;
			this.highlightRangeOnBar();
		}

		attachUiObservers() {
			const playerContainer = this.getPlaybackVideo()?.closest('[class*="player-container"]');
			if (!playerContainer) return;

			if (this.overlayObserver) this.overlayObserver.disconnect();
			this.overlayObserver = new MutationObserver(() => {
				this.clearVolumeIndicatorHighlights();
				this.ensureHighlightsPresent();
				this.syncSkipButton();
			});
			this.overlayObserver.observe(playerContainer, {
				attributes: true,
				attributeFilter: ["class"],
				childList: true,
				subtree: true
			});

			const seekBar = document.querySelector('[class*="seek-bar-container"]');
			if (seekBar) {
				if (this.seekBarObserver) this.seekBarObserver.disconnect();
				this.seekBarObserver = new MutationObserver(() => {
					this.ensureHighlightsPresent();
					this.syncSkipButton();
				});
				this.seekBarObserver.observe(seekBar, { childList: true, subtree: true });
			}
		}

		removeActiveButton() {
			const existingButton = document.getElementById(ACTIVE_BTN_ID);
			if (existingButton) existingButton.remove();
		}

		showSkipButton(segment) {
			const segmentType = segment.type;
			const theme = THEMES[this.theme] || THEMES.default;

			if (!this.isSegmentButtonEnabled(segmentType)) return;
			this.removeActiveButton();
			this.track("skip_button_shown", {
				segment: segmentType
			});

			const skipBtn = document.createElement("button");
			const icon = document.createElement("img");

			skipBtn.id = ACTIVE_BTN_ID;
			skipBtn.setAttribute("data-segment-type", segmentType);
			skipBtn.className = this.theme === "glass" || isLiquidGlassThemeActive()
				? "tidb-skip-btn tidb-theme-glass"
				: "tidb-skip-btn tidb-theme-default";
			skipBtn.textContent = SEGMENT_LABELS[segmentType] || "Skip Segment";

			icon.src = "https://www.svgrepo.com/show/471906/skip-forward.svg";
			icon.alt = "Skip icon";
			icon.width = theme.iconSize;
			icon.height = theme.iconSize;
			icon.style.filter = "brightness(0) invert(1)";
			icon.style.pointerEvents = "none";

			Object.assign(skipBtn.style, {
				position: "fixed",
				bottom: "140px",
				right: "max(24px, 8vw)",
				padding: theme.padding,
				background: theme.background,
				color: "#fff",
				border: theme.border,
				borderRadius: theme.borderRadius,
				cursor: "pointer",
				fontSize: theme.fontSize,
				zIndex: "2147483647",
				display: "flex",
				alignItems: "center",
				gap: "8px",
				opacity: "1",
				visibility: "visible",
				pointerEvents: "auto",
				transition: "background 0.2s ease, box-shadow 0.2s ease",
				backdropFilter: theme.backdropFilter,
				WebkitBackdropFilter: theme.backdropFilter,
				boxShadow: theme.boxShadow || "none"
			});

			skipBtn.prepend(icon);

			skipBtn.onmouseover = () => {
				skipBtn.style.background = theme.hover;
			};
			skipBtn.onmouseout = () => {
				skipBtn.style.background = theme.background;
			};
			skipBtn.onclick = (event) => {
				event.preventDefault();
				event.stopPropagation();
				this.track("skip_clicked", {
					segment: segmentType
				});
				const video = this.getPlaybackVideo();
				if (video) {
					video.currentTime = segment.end;
					console.log(`[TheIntroDB] Skipping ${segmentType}: targetTime=${segment.end}`);
				}
				skipBtn.remove();
				this.displayedSegmentType = null;
			};

			document.body.appendChild(skipBtn);
		}

		cleanup() {
			console.log("[TheIntroDB] Cleaning up previous media...");

			if (this.video && this.onLoadedMetadataHandler) {
				this.video.removeEventListener("loadedmetadata", this.onLoadedMetadataHandler);
			}

			this.stopSegmentWatcher();

			if (this.overlayObserver) {
				this.overlayObserver.disconnect();
				this.overlayObserver = null;
			}
			if (this.seekBarObserver) {
				this.seekBarObserver.disconnect();
				this.seekBarObserver = null;
			}
			this.removeActiveButton();
			if (this._autoSkippedKeys) {
				this._autoSkippedKeys.clear();
			}
			Object.assign(this, {
				video: null,
				episodeId: null,
				title: null,
				segments: emptySegments(),
				activeSegment: null,
				displayedSegmentType: null,
				_lastFetchedDurationMs: null
			});
		}

		destroy() {
			this.cleanup();
			if (this._observer) {
				this._observer.disconnect();
				this._observer = null;
			}
			if (this._checkTimer) {
				clearInterval(this._checkTimer);
				this._checkTimer = null;
			}
		}
	}

	if (window.tidbPlugin && typeof window.tidbPlugin.destroy === "function") {
		window.tidbPlugin.destroy();
	}

	window.tidbPlugin = new TheIntroDBPlugin();
	if (!window.__tidbBeforeUnloadInstalled) {
		window.__tidbBeforeUnloadInstalled = true;
		window.addEventListener("beforeunload", () => {
			localStorage.removeItem("updateReminder");
		});
	}
})();
