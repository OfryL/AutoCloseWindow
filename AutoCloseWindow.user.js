// ==UserScript==
// @name         Auto Close Window
// @version      1.9
// @description  Automatically close browser windows/tabs when specific text patterns are detected. Useful for OAuth callbacks, AWS SSO, and temporary pages.
// @namespace    https://github.com/ofryl/userscripts
// @author       Ofry Linkovsky <ofryl@gmail.com>
// @license      MIT
// @homepageURL  https://github.com/OfryL/AutoCloseWindow
// @supportURL   https://github.com/OfryL/AutoCloseWindow/issues
// @updateURL    https://raw.githubusercontent.com/OfryL/AutoCloseWindow/main/AutoCloseWindow.user.js
// @downloadURL  https://raw.githubusercontent.com/OfryL/AutoCloseWindow/main/AutoCloseWindow.user.js
// @icon         data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMiIgaGVpZ2h0PSIzMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM0Q0FGNTAiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjxwb2x5bGluZSBwb2ludHM9IjEyIDYgMTIgMTIgMTYgMTQiLz48L3N2Zz4=
// @match        *://*/*
// @exclude      https://github.com/OfryL/AutoCloseWindow*
// @exclude      https://raw.githubusercontent.com/OfryL/AutoCloseWindow/*
// @run-at       document-start
// @noframes
// @grant        window.close
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @grant        GM_setClipboard
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// @grant        GM.xmlHttpRequest
// @grant        GM.setClipboard
// @connect      api.github.com
// @connect      github.com
// ==/UserScript==

/*
 * MIT License
 *
 * Copyright (c) 2025 Ofry Linkovsky
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// Requires Firefox about:config: dom.allow_scripts_to_close_windows = true

(function() {
  'use strict';

  // ============================================================================
  // ENUMS
  // ============================================================================
  const Enum = {
    Theme: { AUTO: 'auto', LIGHT: 'light', DARK: 'dark' },
    SaveState: { SAVED: 'saved', SAVING: 'saving', UNSAVED: 'unsaved' },
    Tab: { PATTERNS: 'patterns', CONFIG: 'config', ADVANCED: 'advanced', SYNC: 'sync', CREDITS: 'credits' },
    ElementId: {
      DIALOG: 'auto-close-config-dialog',
      PATTERNS_TEXTAREA: 'auto-close-patterns',
      LINE_NUMBERS: 'auto-close-line-numbers',
      RESET_BTN: 'auto-close-reset',
      CLOSE_BTN: 'auto-close-x',
      THEME_BTN: 'auto-close-theme',
      DEBUG_CHECKBOX: 'auto-close-debug',
      ABORT_CHECKBOX: 'auto-close-show-abort',
      COUNTDOWN_INPUT: 'auto-close-countdown',
      DELAY_INPUT: 'auto-close-delay',
      COUNTDOWN_DISPLAY: 'auto-close-countdown-display',
      OVERLAY: 'auto-close-overlay',
      ABORT_BTN: 'auto-close-abort-btn',
      CLIENT_ID_INPUT: 'auto-close-sync-client-id',
      CONNECT_BTN: 'auto-close-sync-connect',
      DEVICE_CODE: 'auto-close-sync-device-code',
      PUSH_BTN: 'auto-close-sync-push',
      PULL_BTN: 'auto-close-sync-pull',
      SYNC_STATUS: 'auto-close-sync-status'
    }
  };

  // ============================================================================
  // COMMON - Shared utilities and state
  // ============================================================================
  const Common = {
    CONFIG: {
      STORAGE_KEY: 'autoCloseStrings',
      DEBUG_KEY: 'autoCloseDebug',
      COUNTDOWN_KEY: 'autoCloseCountdown',
      DELAY_KEY: 'autoCloseDelay',
      ABORT_KEY: 'autoCloseShowAbort',
      THEME_KEY: 'autoCloseTheme',
      OAUTH_CLIENT_ID_KEY: 'autoCloseOauthClientId',
      GIST_TOKEN_KEY: 'autoCloseGistToken',
      GIST_ID_KEY: 'autoCloseGistId',
      LAST_SYNC_KEY: 'autoCloseLastSync',
      UPDATED_AT_KEY: 'autoCloseUpdatedAt',
      SAVE_INDICATOR_DELAY_MS: 400,
      AUTOSAVE_DEBOUNCE_MS: 800,
      SYNC_DEBOUNCE_MS: 2000,
      SYNC_PULL_TIMEOUT_MS: 4000,
      DEFAULTS: {
        COUNTDOWN_SECONDS: 5,
        DETECTION_DELAY_MS: 1000,
        SHOW_ABORT_BUTTON: false,
        THEME: Enum.Theme.AUTO
      }
    },

    state: {
      debugEnabled: false,
      showAbortButton: false,
      theme: Enum.Theme.AUTO,
      detectionPatterns: [],
      settings: {
        countdownSeconds: 5,
        detectionDelayMs: 1000
      }
    },

    DEFAULT_PATTERNS: [
      "You can close this window and start using the AWS CLI.",
      "Authentication details received, processing details. You may close this window at any time.",
      "You can close this window",
      "We couldn't complete your request right now. Please try again later."
    ],

    Storage: {
      getValue: null,
      setValue: null,
      registerMenuCommand: null,

      init() {
        this.getValue = Common.createStorageMethod('getValue', (key, defaultValue) => defaultValue);
        this.setValue = Common.createStorageMethod('setValue', () => {});
        this.registerMenuCommand = Common.createStorageMethod('registerMenuCommand', () => {});
      }
    },

    createStorageMethod(methodName, fallback) {
      const gmUnderscore = window[`GM_${methodName}`];
      if (typeof gmUnderscore !== 'undefined') {
        return gmUnderscore;
      }

      const gmDot = typeof GM !== 'undefined' && GM[methodName];
      if (gmDot) {
        return (...args) => GM[methodName](...args);
      }

      return fallback;
    },

    Debug: {
      log(...args) {
        if (Common.state.debugEnabled) {
          console.log('[AutoClose]', ...args);
        }
      }
    },

    Theme: {
      COLORS: {
        [Enum.Theme.DARK]: {
          bg: '#1a1a1a',
          bgAlt: '#252525',
          bgEditor: '#0d0d0d',
          bgLineNumbers: '#151515',
          text: '#ffffff',
          textMuted: '#aaaaaa',
          textDim: '#888888',
          textLineNumbers: '#555555',
          border: '#444444',
          borderDim: '#333333',
          accent: '#4CAF50',
          btnPrimary: '#4CAF50',
          btnSecondary: '#444444',
          btnTertiary: '#666666',
          code: '#333333'
        },
        [Enum.Theme.LIGHT]: {
          bg: '#ffffff',
          bgAlt: '#f5f5f5',
          bgEditor: '#fafafa',
          bgLineNumbers: '#f0f0f0',
          text: '#1a1a1a',
          textMuted: '#666666',
          textDim: '#888888',
          textLineNumbers: '#999999',
          border: '#dddddd',
          borderDim: '#eeeeee',
          accent: '#2e7d32',
          btnPrimary: '#2e7d32',
          btnSecondary: '#666666',
          btnTertiary: '#888888',
          code: '#e8e8e8'
        }
      },

      ICONS: {
        [Enum.Theme.AUTO]: '◐',
        [Enum.Theme.LIGHT]: '☀',
        [Enum.Theme.DARK]: '☾'
      },

      systemPrefersDark() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      },

      isDark() {
        const theme = Common.state.theme;
        if (theme === Enum.Theme.AUTO) {
          return this.systemPrefersDark();
        }
        return theme === Enum.Theme.DARK;
      },

      get() {
        return this.COLORS[this.isDark() ? Enum.Theme.DARK : Enum.Theme.LIGHT];
      },

      getIcon() {
        return this.ICONS[Common.state.theme] || this.ICONS[Enum.Theme.AUTO];
      },

      async toggle() {
        const modes = [Enum.Theme.AUTO, Enum.Theme.LIGHT, Enum.Theme.DARK];
        const currentIndex = modes.indexOf(Common.state.theme);
        const nextIndex = (currentIndex + 1) % modes.length;
        Common.state.theme = modes[nextIndex];
        await Promise.resolve(Common.Storage.setValue(Common.CONFIG.THEME_KEY, Common.state.theme));
        return Common.state.theme;
      }
    },

    init() {
      this.Storage.init();
      this.state.detectionPatterns = [...this.DEFAULT_PATTERNS];
      this.state.settings.countdownSeconds = this.CONFIG.DEFAULTS.COUNTDOWN_SECONDS;
      this.state.settings.detectionDelayMs = this.CONFIG.DEFAULTS.DETECTION_DELAY_MS;
    }
  };

  // ============================================================================
  // SYNC - Settings backup to a secret GitHub Gist
  // ============================================================================
  const Sync = {
    FILE_NAME: 'autoTabCloser.settings.json',
    API_BASE: 'https://api.github.com',
    GIST_DESCRIPTION: 'Auto Close Window settings',
    OAUTH_SCOPE: 'gist',
    DEVICE_CODE_URL: 'https://github.com/login/device/code',
    ACCESS_TOKEN_URL: 'https://github.com/login/oauth/access_token',
    REQUEST_TIMEOUT_MS: 10000,
    SYNCED_KEYS: [
      Common.CONFIG.STORAGE_KEY,
      Common.CONFIG.DEBUG_KEY,
      Common.CONFIG.COUNTDOWN_KEY,
      Common.CONFIG.DELAY_KEY,
      Common.CONFIG.ABORT_KEY,
      Common.CONFIG.THEME_KEY
    ],
    pushTimeout: null,
    pollGeneration: 0,

    transport() {
      const gmUnderscore = window.GM_xmlhttpRequest;
      if (typeof gmUnderscore !== 'undefined') {
        return gmUnderscore;
      }
      if (typeof GM !== 'undefined' && GM.xmlHttpRequest) {
        return (...args) => GM.xmlHttpRequest(...args);
      }
      return null;
    },

    copyToClipboard(text) {
      const gmUnderscore = window.GM_setClipboard;
      if (typeof gmUnderscore !== 'undefined') {
        gmUnderscore(text);
        return;
      }
      if (typeof GM !== 'undefined' && GM.setClipboard) {
        GM.setClipboard(text);
      }
    },

    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },

    async request(method, path, body) {
      const send = this.transport();
      if (!send) {
        throw new Error('GM_xmlhttpRequest unavailable');
      }
      const token = await Promise.resolve(Common.Storage.getValue(Common.CONFIG.GIST_TOKEN_KEY, ''));
      if (!token) {
        throw new Error('Not connected');
      }
      return new Promise((resolve, reject) => {
        send({
          method,
          url: `${this.API_BASE}${path}`,
          headers: {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json'
          },
          data: body ? JSON.stringify(body) : undefined,
          timeout: this.REQUEST_TIMEOUT_MS,
          onload: (response) => {
            if (response.status >= 200 && response.status < 300) {
              resolve(JSON.parse(response.responseText));
            } else {
              const error = new Error(`GitHub API ${response.status}`);
              error.status = response.status;
              reject(error);
            }
          },
          onerror: () => reject(new Error('Network error')),
          ontimeout: () => reject(new Error('Request timed out'))
        });
      });
    },

    oauthRequest(url, params) {
      const send = this.transport();
      if (!send) {
        return Promise.reject(new Error('GM_xmlhttpRequest unavailable'));
      }
      return new Promise((resolve, reject) => {
        send({
          method: 'POST',
          url,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          data: new URLSearchParams(params).toString(),
          timeout: this.REQUEST_TIMEOUT_MS,
          onload: (response) => resolve(JSON.parse(response.responseText)),
          onerror: () => reject(new Error('Network error')),
          ontimeout: () => reject(new Error('Request timed out'))
        });
      });
    },

    async requestDeviceCode(clientId) {
      const device = await this.oauthRequest(this.DEVICE_CODE_URL, {
        client_id: clientId,
        scope: this.OAUTH_SCOPE
      });
      if (device.error) {
        throw new Error(device.error);
      }
      return device;
    },

    async pollForToken(clientId, device) {
      const generation = ++this.pollGeneration;
      const deadline = Date.now() + device.expires_in * 1000;
      let intervalMs = (device.interval || 5) * 1000;

      while (Date.now() < deadline) {
        await this.sleep(intervalMs);
        if (generation !== this.pollGeneration) {
          return false;
        }

        const result = await this.oauthRequest(this.ACCESS_TOKEN_URL, {
          client_id: clientId,
          device_code: device.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        });

        if (result.access_token) {
          await Promise.resolve(Common.Storage.setValue(Common.CONFIG.GIST_TOKEN_KEY, result.access_token));
          this.report('Connected');
          await this.adoptExistingGist().catch(() => '');
          await this.pull().catch(error => this.reportFailure('Pull', error));
          await this.push().catch(error => this.reportFailure('Push', error));
          return true;
        }
        if (result.error === 'slow_down') {
          intervalMs += 5000;
        } else if (result.error !== 'authorization_pending') {
          this.report(`Connect failed: ${result.error}`);
          return false;
        }
      }

      this.report('Connect timed out');
      return false;
    },

    async disconnect() {
      this.pollGeneration++;
      clearTimeout(this.pushTimeout);
      await Promise.resolve(Common.Storage.setValue(Common.CONFIG.GIST_TOKEN_KEY, ''));
      this.report('Disconnected');
    },

    async collectSettings() {
      const c = Common.CONFIG;
      return {
        [c.STORAGE_KEY]: await Promise.resolve(Common.Storage.getValue(c.STORAGE_KEY, Common.DEFAULT_PATTERNS)),
        [c.DEBUG_KEY]: await Promise.resolve(Common.Storage.getValue(c.DEBUG_KEY, false)),
        [c.COUNTDOWN_KEY]: await Promise.resolve(Common.Storage.getValue(c.COUNTDOWN_KEY, c.DEFAULTS.COUNTDOWN_SECONDS)),
        [c.DELAY_KEY]: await Promise.resolve(Common.Storage.getValue(c.DELAY_KEY, c.DEFAULTS.DETECTION_DELAY_MS)),
        [c.ABORT_KEY]: await Promise.resolve(Common.Storage.getValue(c.ABORT_KEY, c.DEFAULTS.SHOW_ABORT_BUTTON)),
        [c.THEME_KEY]: await Promise.resolve(Common.Storage.getValue(c.THEME_KEY, c.DEFAULTS.THEME))
      };
    },

    async applySettings(payload) {
      const c = Common.CONFIG;
      const settings = payload.settings || {};

      for (const key of this.SYNCED_KEYS) {
        if (key in settings) {
          await Promise.resolve(Common.Storage.setValue(key, settings[key]));
        }
      }

      if (Logic.Storage.isValid(settings[c.STORAGE_KEY])) {
        Common.state.detectionPatterns = settings[c.STORAGE_KEY];
      }
      Common.state.debugEnabled = settings[c.DEBUG_KEY] ?? Common.state.debugEnabled;
      Common.state.showAbortButton = settings[c.ABORT_KEY] ?? Common.state.showAbortButton;
      Common.state.theme = settings[c.THEME_KEY] ?? Common.state.theme;
      Common.state.settings.countdownSeconds = settings[c.COUNTDOWN_KEY] ?? Common.state.settings.countdownSeconds;
      Common.state.settings.detectionDelayMs = settings[c.DELAY_KEY] ?? Common.state.settings.detectionDelayMs;

      await Promise.resolve(Common.Storage.setValue(c.UPDATED_AT_KEY, payload.updatedAt));
    },

    async buildPayload() {
      return {
        schemaVersion: 1,
        updatedAt: await Promise.resolve(
          Common.Storage.getValue(Common.CONFIG.UPDATED_AT_KEY, new Date().toISOString())
        ),
        settings: await this.collectSettings()
      };
    },

    async findExistingGist() {
      const gists = await this.request('GET', '/gists?per_page=100');
      const match = gists.find(gist => gist.files && gist.files[this.FILE_NAME]);
      return match ? match.id : '';
    },

    async adoptExistingGist() {
      const storedId = await Promise.resolve(Common.Storage.getValue(Common.CONFIG.GIST_ID_KEY, ''));
      if (storedId) {
        return storedId;
      }
      const foundId = await this.findExistingGist();
      if (foundId) {
        await Promise.resolve(Common.Storage.setValue(Common.CONFIG.GIST_ID_KEY, foundId));
      }
      return foundId;
    },

    async push() {
      const payload = await this.buildPayload();
      const files = { [this.FILE_NAME]: { content: JSON.stringify(payload, null, 2) } };
      const gistId = await this.adoptExistingGist().catch(() => '');

      const response = gistId
        ? await this.request('PATCH', `/gists/${gistId}`, { files }).catch(error => this.recreateOnMissing(error, files))
        : await this.createGist(files);

      await Promise.resolve(Common.Storage.setValue(Common.CONFIG.GIST_ID_KEY, response.id));
      await this.markSynced();
      return response;
    },

    createGist(files) {
      return this.request('POST', '/gists', {
        description: this.GIST_DESCRIPTION,
        public: false,
        files
      });
    },

    async recreateOnMissing(error, files) {
      if (error.status !== 404) {
        throw error;
      }
      await Promise.resolve(Common.Storage.setValue(Common.CONFIG.GIST_ID_KEY, ''));
      return this.createGist(files);
    },

    async pull() {
      const gistId = await this.adoptExistingGist().catch(() => '');
      if (!gistId) {
        return null;
      }

      const gist = await this.request('GET', `/gists/${gistId}`);
      const file = gist.files && gist.files[this.FILE_NAME];
      if (!file) {
        return null;
      }

      const payload = JSON.parse(file.content);
      const localUpdatedAt = await Promise.resolve(Common.Storage.getValue(Common.CONFIG.UPDATED_AT_KEY, ''));
      const remoteIsNewer = Boolean(payload.updatedAt) && payload.updatedAt > localUpdatedAt;

      if (remoteIsNewer) {
        await this.applySettings(payload);
      }
      await this.markSynced();
      return remoteIsNewer ? payload : null;
    },

    async pullOnOpen() {
      const token = await Promise.resolve(Common.Storage.getValue(Common.CONFIG.GIST_TOKEN_KEY, ''));
      if (!token) {
        return;
      }
      await Promise.race([
        this.pull().catch(error => this.reportFailure('Pull', error)),
        this.sleep(Common.CONFIG.SYNC_PULL_TIMEOUT_MS)
      ]);
    },

    schedulePush() {
      Promise.resolve(Common.Storage.setValue(Common.CONFIG.UPDATED_AT_KEY, new Date().toISOString()))
        .then(() => Promise.resolve(Common.Storage.getValue(Common.CONFIG.GIST_TOKEN_KEY, '')))
        .then(token => {
          if (!token) {
            return;
          }
          clearTimeout(this.pushTimeout);
          this.pushTimeout = setTimeout(() => {
            this.report('Pushing...');
            this.push().catch(error => this.reportFailure('Push', error));
          }, Common.CONFIG.SYNC_DEBOUNCE_MS);
        })
        .catch(() => {});
    },

    async markSynced() {
      const now = new Date().toISOString();
      await Promise.resolve(Common.Storage.setValue(Common.CONFIG.LAST_SYNC_KEY, now));
      this.report(`Last synced: ${new Date(now).toLocaleString()}`);
    },

    reportFailure(action, error) {
      const suffix = error.status === 401 ? ' — reconnect' : '';
      this.report(`${action} failed: ${error.message}${suffix}`);
    },

    report(text) {
      Common.Debug.log('Sync:', text);
      const statusElement = document.getElementById(Enum.ElementId.SYNC_STATUS);
      if (statusElement) {
        statusElement.textContent = text;
      }
    }
  };

  // ============================================================================
  // UI - Configuration interface
  // ============================================================================
  const UI = {
    Styles: {
      get() {
        const t = Common.Theme.get();
        return {
          overlay: `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: ${t.bg}; z-index: 999999; display: flex; flex-direction: column;
            font-family: sans-serif; color: ${t.text};
          `,
          header: `
            display: flex; justify-content: space-between; align-items: center;
            padding: 15px 25px; background: ${t.bgAlt}; border-bottom: 1px solid ${t.border};
          `,
          tabs: `
            display: flex; gap: 0; background: ${t.bgAlt}; border-bottom: 1px solid ${t.border};
          `,
          tab: `
            padding: 12px 25px; cursor: pointer; border: none; background: transparent;
            color: ${t.textDim}; font-size: 14px; border-bottom: 2px solid transparent;
          `,
          tabActive: `
            padding: 12px 25px; cursor: pointer; border: none; background: ${t.bg};
            color: ${t.text}; font-size: 14px; border-bottom: 2px solid ${t.accent};
          `,
          content: `
            flex: 1; padding: 25px; overflow-y: auto; display: flex; flex-direction: column;
            width: 100%; box-sizing: border-box;
          `,
          button: `
            padding: 10px 20px; color: #fff; border: none; border-radius: 4px;
            cursor: pointer; font-size: 14px;
          `,
          closeButton: `
            background: transparent; border: none; color: ${t.textDim}; font-size: 28px;
            cursor: pointer; padding: 0; line-height: 1;
          `,
          themeToggle: `
            background: transparent; border: 1px solid ${t.border}; color: ${t.textDim};
            font-size: 18px; cursor: pointer; padding: 6px 10px; border-radius: 4px;
            line-height: 1; margin-right: 15px;
          `,
          headerButtons: `display: flex; align-items: center;`,
          pageHeader: `
            display: flex; justify-content: space-between; align-items: center;
            margin: 0 0 15px;
          `,
          textMuted: `color: ${t.textMuted};`,
          link: `color: ${t.accent}; text-decoration: none;`,
          code: `background: ${t.code}; padding: 2px 6px; border-radius: 3px;`
        };
      }
    },

    Components: {
      Button: {
        render(id, label, color) {
          const s = UI.Styles.get();
          return `<button id="${id}" style="${s.button}background:${color};">${label}</button>`;
        }
      },

      SaveIndicator: {
        getStyles() {
          const t = Common.Theme.get();
          return {
            container: `
              display: inline-flex; align-items: center; gap: 6px;
              font-size: 12px; padding: 4px 10px; border-radius: 4px;
              transition: all 0.2s ease;
            `,
            saved: `background: ${t.accent}22; color: ${t.accent};`,
            saving: `background: ${t.accent}22; color: ${t.accent};`,
            unsaved: `background: #ff990022; color: #ff9900;`
          };
        },

        render(id) {
          const s = this.getStyles();
          return `<span id="${id}" style="${s.container}${s.saved}">✓ Saved</span>`;
        },

        update(id, state) {
          const el = document.getElementById(id);
          if (!el) return;

          const s = this.getStyles();
          const states = {
            [Enum.SaveState.SAVED]: { style: s.saved, text: '✓ Saved' },
            [Enum.SaveState.SAVING]: { style: s.saving, text: '⟳ Saving...' },
            [Enum.SaveState.UNSAVED]: { style: s.unsaved, text: '● Unsaved' }
          };

          const { style, text } = states[state];
          el.style.cssText = s.container + style;
          el.textContent = text;
        },

        async save(id, saveOperation) {
          this.update(id, Enum.SaveState.SAVING);
          await Promise.all([
            saveOperation(),
            new Promise(resolve => setTimeout(resolve, Common.CONFIG.SAVE_INDICATOR_DELAY_MS))
          ]);
          this.update(id, Enum.SaveState.SAVED);
        }
      },

      SettingCheckbox: {
        getStyles() {
          const t = Common.Theme.get();
          return {
            label: `
              display: flex; align-items: center; gap: 12px; cursor: pointer;
              padding: 15px; background: ${t.bgAlt}; border-radius: 6px;
              border: 1px solid ${t.border}; margin-bottom: 12px;
            `,
            checkbox: `width: 18px; height: 18px; cursor: pointer; accent-color: ${t.accent};`,
            description: `margin: 5px 0 0; font-size: 13px; color: ${t.textMuted};`
          };
        },

        render(id, label, description, checked) {
          const s = this.getStyles();
          return `
            <label style="${s.label}">
              <input type="checkbox" id="${id}" style="${s.checkbox}" ${checked ? 'checked' : ''}>
              <span>
                <strong>${label}</strong>
                <p style="${s.description}">${description}</p>
              </span>
            </label>
          `;
        }
      },

      SettingNumber: {
        getStyles() {
          const t = Common.Theme.get();
          return {
            container: `
              display: flex; justify-content: space-between; align-items: center;
              padding: 15px; background: ${t.bgAlt}; border-radius: 6px;
              border: 1px solid ${t.border}; margin-bottom: 12px;
            `,
            input: `
              width: 80px; padding: 8px 12px; border: 1px solid ${t.border};
              border-radius: 4px; background: ${t.bg}; color: ${t.text};
              font-size: 14px; text-align: center;
            `,
            description: `margin: 5px 0 0; font-size: 13px; color: ${t.textMuted};`
          };
        },

        render(id, label, description, value, unit, min, max) {
          const s = this.getStyles();
          return `
            <div style="${s.container}">
              <span>
                <strong>${label}</strong>
                <p style="${s.description}">${description}</p>
              </span>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="number" id="${id}" style="${s.input}" value="${value}" min="${min}" max="${max}">
                <span>${unit}</span>
              </div>
            </div>
          `;
        }
      },

      SettingText: {
        getStyles() {
          const t = Common.Theme.get();
          return {
            container: `
              padding: 15px; background: ${t.bgAlt}; border-radius: 6px;
              border: 1px solid ${t.border}; margin-bottom: 12px;
            `,
            input: `
              width: 100%; box-sizing: border-box; margin-top: 10px;
              padding: 8px 12px; border: 1px solid ${t.border}; border-radius: 4px;
              background: ${t.bg}; color: ${t.text}; font-size: 14px; font-family: monospace;
            `,
            description: `margin: 5px 0 0; font-size: 13px; color: ${t.textMuted}; line-height: 1.6;`
          };
        },

        render(id, label, description, value, attributes) {
          const s = this.getStyles();
          return `
            <div style="${s.container}">
              <span>
                <strong>${label}</strong>
                <p style="${s.description}">${description}</p>
              </span>
              <input id="${id}" style="${s.input}" value="${value}" ${attributes} spellcheck="false" autocomplete="off">
            </div>
          `;
        }
      },

      Editor: {
        getStyles() {
          const t = Common.Theme.get();
          return {
            container: `
              display: flex; border: 1px solid ${t.border}; border-radius: 4px;
              background: ${t.bgEditor}; flex: 1; overflow: hidden;
            `,
            lineNumbers: `
              padding: 15px 10px; background: ${t.bgLineNumbers}; color: ${t.textLineNumbers};
              font-family: monospace; font-size: 14px; line-height: 1.5;
              text-align: right; user-select: none; border-right: 1px solid ${t.borderDim};
              overflow: hidden; min-width: 45px;
            `,
            textarea: `
              flex: 1; background: ${t.bgEditor}; color: ${t.text}; border: none; padding: 15px;
              font-family: monospace; font-size: 14px; line-height: 1.5;
              resize: none; outline: none; white-space: pre; overflow: auto;
            `
          };
        },

        render(patterns) {
          const s = this.getStyles();
          return `
            <div style="${s.container}">
              <div id="${Enum.ElementId.LINE_NUMBERS}" style="${s.lineNumbers}"></div>
              <textarea id="${Enum.ElementId.PATTERNS_TEXTAREA}" style="${s.textarea}" spellcheck="false">${patterns.join('\n')}</textarea>
            </div>
          `;
        },

        bindEvents() {
          const textarea = document.getElementById(Enum.ElementId.PATTERNS_TEXTAREA);
          const lineNumbers = document.getElementById(Enum.ElementId.LINE_NUMBERS);

          textarea.oninput = () => this.updateLineNumbers();
          textarea.onscroll = () => { lineNumbers.scrollTop = textarea.scrollTop; };
        },

        updateLineNumbers() {
          const textarea = document.getElementById(Enum.ElementId.PATTERNS_TEXTAREA);
          const lineNumbers = document.getElementById(Enum.ElementId.LINE_NUMBERS);
          const lineCount = textarea.value.split('\n').length;

          lineNumbers.innerHTML = Array.from({ length: lineCount }, (_, i) => i + 1).join('<br>');
        },

        getValue() {
          return document.getElementById(Enum.ElementId.PATTERNS_TEXTAREA).value;
        },

        setValue(text) {
          document.getElementById(Enum.ElementId.PATTERNS_TEXTAREA).value = text;
          this.updateLineNumbers();
        },

        parsePatterns(text) {
          return text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        }
      }
    },

    Tabs: {
      TABS: [Enum.Tab.PATTERNS, Enum.Tab.CONFIG, Enum.Tab.ADVANCED, Enum.Tab.SYNC, Enum.Tab.CREDITS],
      activeTab: Enum.Tab.PATTERNS,

      render() {
        const s = UI.Styles.get();
        return `
          <div style="${s.tabs}">
            ${this.TABS.map(name =>
              `<button id="tab-${name}" class="tab-btn" style="${name === this.activeTab ? s.tabActive : s.tab}">
                ${name.charAt(0).toUpperCase() + name.slice(1)}
              </button>`
            ).join('')}
          </div>
        `;
      },

      bindEvents() {
        this.TABS.forEach(name => {
          document.getElementById(`tab-${name}`).onclick = () => this.show(name);
        });
      },

      show(tabName) {
        this.activeTab = tabName;
        const s = UI.Styles.get();

        document.querySelectorAll('.tab-btn').forEach(btn => {
          btn.style.cssText = s.tab;
        });
        document.getElementById(`tab-${tabName}`).style.cssText = s.tabActive;

        this.TABS.forEach(name => {
          document.getElementById(`tab-content-${name}`).style.display = name === tabName ? 'flex' : 'none';
          document.getElementById(`tab-footer-${name}`).style.display = name === tabName ? 'flex' : 'none';
        });
      }
    },

    Pages: {
      Patterns: {
        saveTimeout: null,
        originalValue: '',

        render(patterns) {
          const s = UI.Styles.get();
          const t = Common.Theme.get();
          const resetStyle = `
            background: transparent; border: none; color: ${t.textDim};
            cursor: pointer; font-size: 13px; text-decoration: underline;
          `;
          return `
            <div id="tab-content-patterns" style="${s.content}">
              <div style="${s.pageHeader}">
                <span style="${s.textMuted}">One pattern per line. Page closes when any pattern is detected.</span>
                <div style="display:flex;align-items:center;gap:15px;">
                  <button id="${Enum.ElementId.RESET_BTN}" style="${resetStyle}">Reset to Default</button>
                  ${UI.Components.SaveIndicator.render('patterns-save-status')}
                </div>
              </div>
              ${UI.Components.Editor.render(patterns)}
            </div>
            <div id="tab-footer-patterns" style="display:none;"></div>
          `;
        },

        bindEvents() {
          this.originalValue = UI.Components.Editor.getValue();

          document.getElementById(Enum.ElementId.RESET_BTN).onclick = () => this.handleReset();

          const textarea = document.getElementById(Enum.ElementId.PATTERNS_TEXTAREA);
          textarea.oninput = () => {
            UI.Components.Editor.updateLineNumbers();
            this.scheduleAutosave();
          };

          UI.Components.Editor.updateLineNumbers();
        },

        scheduleAutosave() {
          const currentValue = UI.Components.Editor.getValue();
          const hasChanges = currentValue !== this.originalValue;

          if (!hasChanges) {
            UI.Components.SaveIndicator.update('patterns-save-status', Enum.SaveState.SAVED);
            return;
          }

          UI.Components.SaveIndicator.update('patterns-save-status', Enum.SaveState.UNSAVED);

          clearTimeout(this.saveTimeout);
          this.saveTimeout = setTimeout(() => this.handleSave(), Common.CONFIG.AUTOSAVE_DEBOUNCE_MS);
        },

        async handleSave() {
          const newPatterns = UI.Components.Editor.parsePatterns(UI.Components.Editor.getValue());

          await UI.Components.SaveIndicator.save('patterns-save-status', async () => {
            await Promise.resolve(Common.Storage.setValue(Common.CONFIG.STORAGE_KEY, newPatterns));
            Common.state.detectionPatterns = newPatterns;
          });

          this.originalValue = UI.Components.Editor.getValue();
          Sync.schedulePush();
        },

        handleReset() {
          UI.Components.Editor.setValue(Common.DEFAULT_PATTERNS.join('\n'));
          this.scheduleAutosave();
        }
      },

      Config: {
        originalValues: {},

        render(isDebugEnabled, showAbortButton) {
          const s = UI.Styles.get();
          return `
            <div id="tab-content-config" style="${s.content}display:none;">
              <div style="width:100%;">
                <div style="${s.pageHeader}margin-bottom:20px;">
                  <h3 style="margin:0;">Settings</h3>
                  ${UI.Components.SaveIndicator.render('config-save-status')}
                </div>
                ${UI.Components.SettingCheckbox.render(
                  Enum.ElementId.DEBUG_CHECKBOX,
                  'Enable Debug Mode',
                  'Log pattern detection and matching info to the console',
                  isDebugEnabled
                )}
                ${UI.Components.SettingCheckbox.render(
                  Enum.ElementId.ABORT_CHECKBOX,
                  'Show Abort Button',
                  'Display an abort button during countdown to cancel auto-close',
                  showAbortButton
                )}
              </div>
            </div>
            <div id="tab-footer-config" style="display:none;"></div>
          `;
        },

        bindEvents(isDebugEnabled, showAbortButton) {
          this.originalValues = { isDebugEnabled, showAbortButton };
          document.getElementById(Enum.ElementId.DEBUG_CHECKBOX).onchange = () => this.handleSave();
          document.getElementById(Enum.ElementId.ABORT_CHECKBOX).onchange = () => this.handleSave();
        },

        async handleSave() {
          const debugChecked = document.getElementById(Enum.ElementId.DEBUG_CHECKBOX).checked;
          const abortChecked = document.getElementById(Enum.ElementId.ABORT_CHECKBOX).checked;

          const hasChanges = debugChecked !== this.originalValues.isDebugEnabled ||
                             abortChecked !== this.originalValues.showAbortButton;

          if (!hasChanges) {
            return;
          }

          await UI.Components.SaveIndicator.save('config-save-status', async () => {
            await Promise.resolve(Common.Storage.setValue(Common.CONFIG.DEBUG_KEY, debugChecked));
            await Promise.resolve(Common.Storage.setValue(Common.CONFIG.ABORT_KEY, abortChecked));
            Common.state.debugEnabled = debugChecked;
            Common.state.showAbortButton = abortChecked;
          });

          this.originalValues = { isDebugEnabled: debugChecked, showAbortButton: abortChecked };
          Sync.schedulePush();
        }
      },

      Advanced: {
        originalValues: {},

        render(countdownSeconds, detectionDelayMs) {
          const s = UI.Styles.get();
          return `
            <div id="tab-content-advanced" style="${s.content}display:none;">
              <div style="width:100%;">
                <div style="${s.pageHeader}margin-bottom:20px;">
                  <h3 style="margin:0;">Advanced Settings</h3>
                  ${UI.Components.SaveIndicator.render('advanced-save-status')}
                </div>
                ${UI.Components.SettingNumber.render(
                  Enum.ElementId.COUNTDOWN_INPUT,
                  'Countdown Duration',
                  'Time to wait before closing the window',
                  countdownSeconds,
                  'seconds',
                  1,
                  60
                )}
                ${UI.Components.SettingNumber.render(
                  Enum.ElementId.DELAY_INPUT,
                  'Detection Delay',
                  'Time to wait after page load before scanning for patterns',
                  detectionDelayMs,
                  'ms',
                  0,
                  10000
                )}
              </div>
            </div>
            <div id="tab-footer-advanced" style="display:none;"></div>
          `;
        },

        bindEvents(countdownSeconds, detectionDelayMs) {
          this.originalValues = { countdownSeconds, detectionDelayMs };

          document.getElementById(Enum.ElementId.COUNTDOWN_INPUT).onchange = () => this.handleSave();
          document.getElementById(Enum.ElementId.DELAY_INPUT).onchange = () => this.handleSave();
        },

        async handleSave() {
          const countdown = parseInt(document.getElementById(Enum.ElementId.COUNTDOWN_INPUT).value, 10);
          const delay = parseInt(document.getElementById(Enum.ElementId.DELAY_INPUT).value, 10);

          const hasChanges = countdown !== this.originalValues.countdownSeconds ||
                             delay !== this.originalValues.detectionDelayMs;

          if (!hasChanges) {
            return;
          }

          await UI.Components.SaveIndicator.save('advanced-save-status', async () => {
            await Promise.resolve(Common.Storage.setValue(Common.CONFIG.COUNTDOWN_KEY, countdown));
            await Promise.resolve(Common.Storage.setValue(Common.CONFIG.DELAY_KEY, delay));
            Common.state.settings.countdownSeconds = countdown;
            Common.state.settings.detectionDelayMs = delay;
          });

          this.originalValues = { countdownSeconds: countdown, detectionDelayMs: delay };
          Sync.schedulePush();
        }
      },

      Sync: {
        originalClientId: '',

        render(clientId, isConnected, gistId, lastSyncAt) {
          const s = UI.Styles.get();
          const lastSyncText = lastSyncAt ? `Last synced: ${new Date(lastSyncAt).toLocaleString()}` : '';
          return `
            <div id="tab-content-sync" style="${s.content}display:none;">
              <div style="width:100%;">
                <div style="${s.pageHeader}margin-bottom:20px;">
                  <h3 style="margin:0;">Gist Sync</h3>
                  ${UI.Components.SaveIndicator.render('sync-save-status')}
                </div>
                ${isConnected ? this.renderConnected(gistId) : this.renderSetup(clientId)}
                <div style="margin-top:15px;">
                  <span id="${Enum.ElementId.SYNC_STATUS}" style="${s.textMuted}font-size:13px;">${lastSyncText}</span>
                </div>
              </div>
            </div>
            <div id="tab-footer-sync" style="display:none;"></div>
          `;
        },

        renderSetup(clientId) {
          const s = UI.Styles.get();
          const t = Common.Theme.get();
          const setupSteps = `
            1. Open <a href="https://github.com/settings/developers" target="_blank" style="${s.link}">github.com/settings/developers</a>
            and create a New OAuth App (any homepage and callback URL).<br>
            2. After creating it, open the app and check <strong>Enable Device Flow</strong>.<br>
            3. Paste the Client ID below.
          `;
          return `
            ${UI.Components.SettingText.render(
              Enum.ElementId.CLIENT_ID_INPUT,
              'OAuth App Client ID',
              setupSteps,
              clientId,
              'type="text" placeholder="Client ID"'
            )}
            ${clientId ? UI.Components.Button.render(Enum.ElementId.CONNECT_BTN, 'Connect GitHub', t.btnPrimary) : ''}
            <div id="${Enum.ElementId.DEVICE_CODE}" style="margin-top:12px;"></div>
          `;
        },

        renderConnected(gistId) {
          const s = UI.Styles.get();
          const t = Common.Theme.get();
          const gistLink = gistId
            ? `<a href="https://gist.github.com/${gistId}" target="_blank" style="${s.link}">secret gist</a>`
            : 'secret gist';
          return `
            <p style="${s.textMuted}margin:0 0 15px;">Connected — settings back up to a ${gistLink}.</p>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              ${UI.Components.Button.render(Enum.ElementId.PUSH_BTN, 'Push Now', t.btnPrimary)}
              ${UI.Components.Button.render(Enum.ElementId.PULL_BTN, 'Pull Now', t.btnSecondary)}
              ${UI.Components.Button.render(Enum.ElementId.CONNECT_BTN, 'Disconnect', t.btnTertiary)}
            </div>
          `;
        },

        bindEvents(clientId, isConnected) {
          this.originalClientId = clientId;

          const clientIdInput = document.getElementById(Enum.ElementId.CLIENT_ID_INPUT);
          if (clientIdInput) {
            clientIdInput.onchange = () => this.handleClientIdSave();
          }

          const connectButton = document.getElementById(Enum.ElementId.CONNECT_BTN);
          if (connectButton) {
            connectButton.onclick = () => (isConnected ? this.handleDisconnect() : this.handleConnect());
          }

          const pushButton = document.getElementById(Enum.ElementId.PUSH_BTN);
          if (pushButton) {
            pushButton.onclick = () => this.handlePush();
          }

          const pullButton = document.getElementById(Enum.ElementId.PULL_BTN);
          if (pullButton) {
            pullButton.onclick = () => this.handlePull();
          }
        },

        async handleClientIdSave() {
          const clientId = document.getElementById(Enum.ElementId.CLIENT_ID_INPUT).value.trim();
          if (clientId === this.originalClientId) {
            return;
          }

          await UI.Components.SaveIndicator.save('sync-save-status', async () => {
            await Promise.resolve(Common.Storage.setValue(Common.CONFIG.OAUTH_CLIENT_ID_KEY, clientId));
          });

          this.originalClientId = clientId;
          await this.reopen();
        },

        async handleConnect() {
          try {
            const clientId = await Promise.resolve(
              Common.Storage.getValue(Common.CONFIG.OAUTH_CLIENT_ID_KEY, '')
            );
            if (!clientId) {
              Sync.report('Enter a Client ID first');
              return;
            }

            const device = await Sync.requestDeviceCode(clientId);
            this.showDeviceCode(device);
            Sync.copyToClipboard(device.user_code);
            window.open(device.verification_uri, '_blank');

            const connected = await Sync.pollForToken(clientId, device);
            if (connected) {
              await this.reopen();
            }
          } catch (error) {
            Sync.report(`Connect failed: ${error.message}`);
          }
        },

        async handleDisconnect() {
          await Sync.disconnect();
          await this.reopen();
        },

        async handlePush() {
          Sync.report('Pushing...');
          try {
            await Sync.push();
          } catch (error) {
            Sync.reportFailure('Push', error);
          }
        },

        async handlePull() {
          Sync.report('Pulling...');
          try {
            const applied = await Sync.pull();
            if (applied) {
              await this.reopen();
            } else {
              Sync.report('Local settings are up to date');
            }
          } catch (error) {
            Sync.reportFailure('Pull', error);
          }
        },

        showDeviceCode(device) {
          const container = document.getElementById(Enum.ElementId.DEVICE_CODE);
          if (!container) {
            return;
          }
          const s = UI.Styles.get();
          const t = Common.Theme.get();
          container.innerHTML = `
            <div style="padding:15px;background:${t.bgAlt};border:1px solid ${t.border};border-radius:6px;">
              <div style="font-family:monospace;font-size:28px;letter-spacing:3px;color:${t.accent};">${device.user_code}</div>
              <p style="${s.textMuted}font-size:13px;margin:8px 0 0;">
                Code copied to clipboard — enter it at
                <a href="${device.verification_uri}" target="_blank" style="${s.link}">${device.verification_uri}</a>.
                Waiting for authorization...
              </p>
            </div>
          `;
        },

        async reopen() {
          if (document.getElementById(Enum.ElementId.DIALOG)) {
            await UI.Controller.reopenPreservingTab();
          }
        }
      },

      Credits: {
        render() {
          const s = UI.Styles.get();
          return `
            <div id="tab-content-credits" style="${s.content}display:none;">
              <div style="width:100%;">
                <h3 style="margin-top:0;">Auto Close Window v1.9</h3>
                <p style="${s.textMuted}line-height:1.6;">
                  Automatically closes browser windows/tabs when specific text patterns are detected on the page.
                  Useful for closing OAuth callbacks, AWS SSO windows, and other temporary pages.
                </p>
                <h4>Author</h4>
                <p style="${s.textMuted}">
                  Ofry Linkovsky<br>
                  <a href="mailto:ofryl@gmail.com" style="${s.link}">ofryl@gmail.com</a>
                </p>
                <h4>Source</h4>
                <p style="${s.textMuted}">
                  <a href="https://github.com/OfryL/AutoCloseWindow" target="_blank" style="${s.link}">github.com/OfryL/AutoCloseWindow</a>
                </p>
                <h4>Requirements</h4>
                <p style="${s.textMuted}line-height:1.6;">
                  Firefox: Set <code style="${s.code}">dom.allow_scripts_to_close_windows</code>
                  to <code style="${s.code}">true</code> in about:config
                </p>
                <h4>License</h4>
                <p style="${s.textMuted}">MIT License</p>
                <h4>Changelog</h4>
                <ul style="${s.textMuted}line-height:1.8;padding-left:20px;">
                  <li><strong>v1.9</strong> - Moved from the gist to the OfryL/AutoCloseWindow GitHub repository; @updateURL/@downloadURL now point at the repo</li>
                  <li><strong>v1.8</strong> - Added auto-update from the public gist via @updateURL/@downloadURL</li>
                  <li><strong>v1.7</strong> - Added Sync tab: settings backup to a secret GitHub Gist via one-click OAuth device flow (auto-push on save, pull on open)</li>
                  <li><strong>v1.6</strong> - Refactored: centralized element IDs in Enum, extracted pageHeader style, added AUTOSAVE_DEBOUNCE_MS constant</li>
                  <li><strong>v1.5</strong> - Added Enum object for Theme, SaveState, and Tab constants</li>
                  <li><strong>v1.4</strong> - Added theme toggle button (auto/light/dark) in header</li>
                  <li><strong>v1.3</strong> - Added optional abort button (hidden by default in Config tab)</li>
                  <li><strong>v1.2</strong> - Reorganized code into Common/UI/Logic namespaces</li>
                  <li><strong>v1.1</strong> - Advanced tab with countdown/delay settings, reusable setting components</li>
                  <li><strong>v1.0</strong> - Autosave with status indicators, removed footer buttons</li>
                  <li><strong>v0.9</strong> - Added Config tab with debug mode</li>
                  <li><strong>v0.8</strong> - Refactored to component architecture, added dark mode support</li>
                  <li><strong>v0.7</strong> - Added fullscreen config with tabs</li>
                  <li><strong>v0.6</strong> - Added line numbers to pattern editor</li>
                  <li><strong>v0.5</strong> - Split config UI and auto-close logic</li>
                  <li><strong>v0.4</strong> - Added configuration UI via userscript menu</li>
                  <li><strong>v0.3</strong> - Added countdown overlay before closing</li>
                  <li><strong>v0.2</strong> - Added pattern-based detection</li>
                  <li><strong>v0.1</strong> - Initial release</li>
                </ul>
              </div>
            </div>
            <div id="tab-footer-credits" style="display:none;"></div>
          `;
        },

        bindEvents() {}
      }
    },

    Controller: {
      async open() {
        await this.waitForDomReady();
        this.removeExisting();
        await Sync.pullOnOpen();

        Common.state.theme = await Promise.resolve(
          Common.Storage.getValue(Common.CONFIG.THEME_KEY, Common.CONFIG.DEFAULTS.THEME)
        );
        const currentPatterns = await Promise.resolve(
          Common.Storage.getValue(Common.CONFIG.STORAGE_KEY, Common.DEFAULT_PATTERNS)
        );
        const isDebugEnabled = await Promise.resolve(
          Common.Storage.getValue(Common.CONFIG.DEBUG_KEY, false)
        );
        const showAbortButton = await Promise.resolve(
          Common.Storage.getValue(Common.CONFIG.ABORT_KEY, Common.CONFIG.DEFAULTS.SHOW_ABORT_BUTTON)
        );
        const countdownSeconds = await Promise.resolve(
          Common.Storage.getValue(Common.CONFIG.COUNTDOWN_KEY, Common.CONFIG.DEFAULTS.COUNTDOWN_SECONDS)
        );
        const detectionDelayMs = await Promise.resolve(
          Common.Storage.getValue(Common.CONFIG.DELAY_KEY, Common.CONFIG.DEFAULTS.DETECTION_DELAY_MS)
        );
        const clientId = await Promise.resolve(
          Common.Storage.getValue(Common.CONFIG.OAUTH_CLIENT_ID_KEY, '')
        );
        const gistToken = await Promise.resolve(
          Common.Storage.getValue(Common.CONFIG.GIST_TOKEN_KEY, '')
        );
        const gistId = await Promise.resolve(
          Common.Storage.getValue(Common.CONFIG.GIST_ID_KEY, '')
        );
        const lastSyncAt = await Promise.resolve(
          Common.Storage.getValue(Common.CONFIG.LAST_SYNC_KEY, '')
        );

        const configValues = {
          isDebugEnabled,
          showAbortButton,
          countdownSeconds,
          detectionDelayMs,
          clientId,
          isConnected: Boolean(gistToken),
          gistId,
          lastSyncAt
        };
        const dialog = this.createDialog(currentPatterns, configValues);
        document.body.appendChild(dialog);
        this.bindEvents(dialog, configValues);
        UI.Tabs.show(Enum.Tab.PATTERNS);
      },

      async reopenPreservingTab() {
        const activeTab = UI.Tabs.activeTab;
        await this.open();
        UI.Tabs.show(activeTab);
      },

      waitForDomReady() {
        if (document.readyState !== 'loading') {
          return Promise.resolve();
        }
        return new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
      },

      removeExisting() {
        const existing = document.getElementById(Enum.ElementId.DIALOG);
        if (existing) {
          existing.remove();
        }
      },

      createDialog(patterns, configValues) {
        const s = UI.Styles.get();
        const {
          isDebugEnabled, showAbortButton, countdownSeconds, detectionDelayMs,
          clientId, isConnected, gistId, lastSyncAt
        } = configValues;

        const dialog = document.createElement('div');
        dialog.id = Enum.ElementId.DIALOG;
        dialog.style.cssText = s.overlay;

        dialog.innerHTML = `
          <div style="${s.header}">
            <h2 style="margin:0;font-size:20px;">Auto Close Window</h2>
            <div style="${s.headerButtons}">
              <button id="${Enum.ElementId.THEME_BTN}" style="${s.themeToggle}" title="Toggle theme">${Common.Theme.getIcon()}</button>
              <button id="${Enum.ElementId.CLOSE_BTN}" style="${s.closeButton}">&times;</button>
            </div>
          </div>
          ${UI.Tabs.render()}
          ${UI.Pages.Patterns.render(patterns)}
          ${UI.Pages.Config.render(isDebugEnabled, showAbortButton)}
          ${UI.Pages.Advanced.render(countdownSeconds, detectionDelayMs)}
          ${UI.Pages.Sync.render(clientId, isConnected, gistId, lastSyncAt)}
          ${UI.Pages.Credits.render()}
        `;

        return dialog;
      },

      bindEvents(dialog, configValues) {
        const closeDialog = () => dialog.remove();
        const {
          isDebugEnabled, showAbortButton, countdownSeconds, detectionDelayMs,
          clientId, isConnected
        } = configValues;

        document.getElementById(Enum.ElementId.CLOSE_BTN).onclick = closeDialog;
        document.getElementById(Enum.ElementId.THEME_BTN).onclick = async () => {
          await Common.Theme.toggle();
          Sync.schedulePush();
          this.refreshDialog(configValues);
        };

        UI.Tabs.bindEvents();
        UI.Pages.Patterns.bindEvents();
        UI.Pages.Config.bindEvents(isDebugEnabled, showAbortButton);
        UI.Pages.Advanced.bindEvents(countdownSeconds, detectionDelayMs);
        UI.Pages.Sync.bindEvents(clientId, isConnected);
        UI.Pages.Credits.bindEvents();

        this.bindKeyboardEvents(closeDialog);
      },

      refreshDialog(configValues) {
        const currentPatterns = UI.Components.Editor.parsePatterns(UI.Components.Editor.getValue());
        const activeTab = UI.Tabs.activeTab;
        this.removeExisting();
        const dialog = this.createDialog(currentPatterns, configValues);
        document.body.appendChild(dialog);
        this.bindEvents(dialog, configValues);
        UI.Tabs.show(activeTab);
      },

      bindKeyboardEvents(closeDialog) {
        document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && document.getElementById(Enum.ElementId.DIALOG)) {
            closeDialog();
          }
        });
      }
    }
  };

  // ============================================================================
  // LOGIC - Auto-close functionality
  // ============================================================================
  const Logic = {
    Storage: {
      async load() {
        const stored = await Promise.resolve(Common.Storage.getValue(Common.CONFIG.STORAGE_KEY, null));
        if (this.isValid(stored)) {
          Common.state.detectionPatterns = stored;
        }

        Common.state.debugEnabled = await Promise.resolve(Common.Storage.getValue(Common.CONFIG.DEBUG_KEY, false));
        Common.state.showAbortButton = await Promise.resolve(
          Common.Storage.getValue(Common.CONFIG.ABORT_KEY, Common.CONFIG.DEFAULTS.SHOW_ABORT_BUTTON)
        );
        Common.state.settings.countdownSeconds = await Promise.resolve(
          Common.Storage.getValue(Common.CONFIG.COUNTDOWN_KEY, Common.CONFIG.DEFAULTS.COUNTDOWN_SECONDS)
        );
        Common.state.settings.detectionDelayMs = await Promise.resolve(
          Common.Storage.getValue(Common.CONFIG.DELAY_KEY, Common.CONFIG.DEFAULTS.DETECTION_DELAY_MS)
        );

        Common.Debug.log('Initialized', {
          patternCount: Common.state.detectionPatterns.length,
          debugEnabled: Common.state.debugEnabled,
          showAbortButton: Common.state.showAbortButton,
          countdownSeconds: Common.state.settings.countdownSeconds,
          detectionDelayMs: Common.state.settings.detectionDelayMs
        });
      },

      isValid(value) {
        return value && Array.isArray(value) && value.length > 0;
      }
    },

    Detector: {
      getPageText() {
        const root = document.documentElement;
        return root ? root.innerText.toLowerCase() : '';
      },

      findMatch() {
        const pageText = this.getPageText();
        Common.Debug.log('Scanning page for patterns...', {
          url: location.href,
          patternCount: Common.state.detectionPatterns.length
        });

        for (const pattern of Common.state.detectionPatterns) {
          const matches = pageText.includes(pattern.toLowerCase());
          Common.Debug.log(`Pattern "${pattern.substring(0, 50)}..."`, matches ? 'MATCHED' : 'no match');
          if (matches) {
            return pattern;
          }
        }
        return null;
      },

      hasMatch() {
        return !!this.findMatch();
      }
    },

    Overlay: {
      intervalId: null,
      closeTimeoutId: null,

      getStyles() {
        const t = Common.Theme.get();
        return {
          overlay: `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: ${t.bg}ee; display: flex; flex-direction: column;
            justify-content: center; align-items: center; z-index: 999999;
          `,
          message: `
            color: ${t.text}; font-size: 24px; text-align: center; font-family: sans-serif;
          `,
          countdown: `
            color: ${t.accent}; font-weight: bold; font-size: 32px;
          `,
          abortButton: `
            margin-top: 30px; padding: 12px 30px; font-size: 16px;
            background: #dc3545; color: white; border: none; border-radius: 6px;
            cursor: pointer; font-family: sans-serif;
          `
        };
      },

      show() {
        const overlay = this.createElement();
        document.body.appendChild(overlay);
        this.bindEvents();
        this.startCountdown();
      },

      createElement() {
        const s = this.getStyles();

        const overlay = document.createElement('div');
        overlay.id = Enum.ElementId.OVERLAY;
        overlay.style.cssText = s.overlay;

        const message = document.createElement('div');
        message.style.cssText = s.message;
        message.innerHTML = `
          This window will close in
          <span id="${Enum.ElementId.COUNTDOWN_DISPLAY}" style="${s.countdown}">${Common.state.settings.countdownSeconds}</span>
          seconds...
        `;

        overlay.appendChild(message);

        if (Common.state.showAbortButton) {
          const abortButton = document.createElement('button');
          abortButton.id = Enum.ElementId.ABORT_BTN;
          abortButton.style.cssText = s.abortButton;
          abortButton.textContent = 'Abort';
          overlay.appendChild(abortButton);
        }

        return overlay;
      },

      bindEvents() {
        if (Common.state.showAbortButton) {
          const abortButton = document.getElementById(Enum.ElementId.ABORT_BTN);
          if (abortButton) {
            abortButton.onclick = () => this.abort();
          }
        }
      },

      startCountdown() {
        let remaining = Common.state.settings.countdownSeconds;
        const element = document.getElementById(Enum.ElementId.COUNTDOWN_DISPLAY);

        this.intervalId = setInterval(() => {
          remaining--;
          element.textContent = remaining;

          if (remaining <= 0) {
            this.stopCountdown();
          }
        }, 1000);
      },

      stopCountdown() {
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
      },

      abort() {
        Common.Debug.log('Auto-close aborted by user');
        this.stopCountdown();
        Logic.WindowCloser.cancelClose();
        const overlay = document.getElementById(Enum.ElementId.OVERLAY);
        if (overlay) {
          overlay.remove();
        }
      }
    },

    WindowCloser: {
      timeoutId: null,

      scheduleClose() {
        const delayMs = Common.state.settings.countdownSeconds * 1000;
        this.timeoutId = setTimeout(() => this.close(), delayMs);
      },

      cancelClose() {
        if (this.timeoutId) {
          clearTimeout(this.timeoutId);
          this.timeoutId = null;
        }
      },

      close() {
        window.close('', '_parent', '');
      }
    },

    Scheduler: {
      onDomReady(callback) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', callback);
        } else {
          callback();
        }
      },

      delay(callback, ms) {
        setTimeout(callback, ms);
      }
    },

    Controller: {
      async loadSettings() {
        await Logic.Storage.load();
      },

      scheduleDetection() {
        Logic.Scheduler.onDomReady(() => {
          Logic.Scheduler.delay(
            () => this.detectAndClose(),
            Common.state.settings.detectionDelayMs
          );
        });
      },

      detectAndClose() {
        if (Logic.Detector.hasMatch()) {
          this.initiateClose();
        }
      },

      initiateClose() {
        Logic.Overlay.show();
        Logic.WindowCloser.scheduleClose();
      }
    }
  };

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  async function initialize() {
    Common.init();
    await Logic.Controller.loadSettings();
    Common.Storage.registerMenuCommand('Configure Auto-Close Patterns', () => UI.Controller.open());
    Logic.Controller.scheduleDetection();
  }

  initialize();
})();
