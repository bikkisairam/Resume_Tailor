const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const POPUP_JS_PATH = path.join(__dirname, "popup.js");
const POPUP_HTML_PATH = path.join(__dirname, "popup.html");
const DISPLAY_FLEX = "flex";
const THEME_ATTRIBUTE = "data-theme";
const LIGHT_THEME = "light";
const DARK_THEME = "dark";
const STORAGE_KEY = "popupTheme";
const REQUIRED_IDS = [
  "getJD",
  "tailorBtn",
  "downloadDocxBtn",
  "downloadPdfBtn",
  "uploadBtn",
  "resumeUpload",
  "status",
  "appliedBtn",
  "checkMatchBtn",
  "matchResult",
  "downloads",
  "flipBtn",
  "flipContainer",
  "chatBox",
  "chatInput",
  "company",
  "role",
  "jdText",
  "themeToggle",
  "themeToggleLabel"
];
const PREMIUM_LAYOUT_MARKERS = [
  'class="popup-shell"',
  'class="premium-panel hero-panel"',
  'class="premium-panel action-panel"',
  'class="premium-panel content-panel"',
  'class="premium-panel feedback-panel"',
  'class="premium-panel chat-panel"',
  'class="section-grid"',
  'class="header-row premium-header"'
];

class FakeClassList {
  constructor() {
    this.classes = new Set();
  }

  toggle(className) {
    if (this.classes.has(className)) {
      this.classes.delete(className);
      return false;
    }

    this.classes.add(className);
    return true;
  }

  contains(className) {
    return this.classes.has(className);
  }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.value = "";
    this.textContent = "";
    this.innerHTML = "";
    this.files = [];
    this.style = { display: "" };
    this.listeners = {};
    this.attributes = {};
    this.className = "";
    this.classList = new FakeClassList();
    this.children = [];
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.checked = false;
    this.title = "";
    this.onclick = null;
  }

  addEventListener(eventName, listener) {
    this.listeners[eventName] = listener;
  }

  dispatch(eventName, event = {}) {
    if (this.listeners[eventName]) {
      this.listeners[eventName](event);
    }
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  getAttribute(name) {
    return this.attributes[name];
  }
}

function buildEnvironment(savedTheme) {
  const elements = new Map();

  REQUIRED_IDS.forEach((id) => {
    elements.set(id, new FakeElement(id));
  });

  const body = new FakeElement("body");
  const document = {
    body,
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, new FakeElement(id));
      }
      return elements.get(id);
    },
    createElement() {
      return new FakeElement();
    }
  };

  const storageState = {};
  if (savedTheme !== undefined) {
    storageState[STORAGE_KEY] = savedTheme;
  }

  const fetchCalls = [];
  const storageSetCalls = [];
  const runtimeListeners = [];

  const chrome = {
    tabs: {
      query: async () => [{ id: 1 }]
    },
    scripting: {
      executeScript: (_options, callback) => {
        if (callback) {
          callback();
        }
      }
    },
    runtime: {
      lastError: null,
      onMessage: {
        addListener(listener) {
          runtimeListeners.push(listener);
        }
      }
    },
    storage: {
      local: {
        get(key, callback) {
          callback({ [key]: storageState[key] });
        },
        set(value, callback) {
          Object.assign(storageState, value);
          storageSetCalls.push(value);
          if (callback) {
            callback();
          }
        }
      }
    }
  };

  const context = {
    document,
    chrome,
    console,
    navigator: { clipboard: { writeText: async () => {} } },
    FormData: class {
      append() {}
    },
    fetch: async (...args) => {
      fetchCalls.push(args);
      return {
        ok: true,
        async json() {
          return { score: 80, reason: "Good fit", answer: "Answer" };
        }
      };
    }
  };

  vm.createContext(context);
  const popupScript = fs.readFileSync(POPUP_JS_PATH, "utf8");
  vm.runInContext(popupScript, context);

  return {
    context,
    body,
    elements,
    fetchCalls,
    storageSetCalls,
    storageState,
    runtimeListeners
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function test_popup_html_contains_all_required_ids() {
  const popupHtml = fs.readFileSync(POPUP_HTML_PATH, "utf8");

  REQUIRED_IDS.forEach((id) => {
    assert.ok(popupHtml.includes(`id="${id}"`), `Expected popup.html to include id="${id}"`);
  });
}

async function test_popup_html_contains_premium_layout_sections() {
  const popupHtml = fs.readFileSync(POPUP_HTML_PATH, "utf8");

  PREMIUM_LAYOUT_MARKERS.forEach((marker) => {
    assert.ok(popupHtml.includes(marker), `Expected popup.html to include ${marker}`);
  });
}

async function test_apply_theme_dark_updates_ui_and_label() {
  const { context, body, elements } = buildEnvironment();
  context.applyTheme(DARK_THEME);

  assert.strictEqual(body.getAttribute(THEME_ATTRIBUTE), DARK_THEME);
  assert.strictEqual(elements.get("themeToggle").checked, true);
  assert.strictEqual(elements.get("themeToggleLabel").textContent, "Dark mode");
}

async function test_apply_theme_light_restores_ui_and_label() {
  const { context, body, elements } = buildEnvironment(DARK_THEME);
  context.applyTheme(LIGHT_THEME);

  assert.strictEqual(body.getAttribute(THEME_ATTRIBUTE), LIGHT_THEME);
  assert.strictEqual(elements.get("themeToggle").checked, false);
  assert.strictEqual(elements.get("themeToggleLabel").textContent, "Light mode");
}

async function test_saved_theme_restores_on_init() {
  const { body, elements } = buildEnvironment(DARK_THEME);
  await flushMicrotasks();

  assert.strictEqual(body.getAttribute(THEME_ATTRIBUTE), DARK_THEME);
  assert.strictEqual(elements.get("themeToggle").checked, true);
  assert.strictEqual(elements.get("themeToggleLabel").textContent, "Dark mode");
}

async function test_default_theme_is_light() {
  const { body, elements } = buildEnvironment();
  await flushMicrotasks();

  assert.strictEqual(body.getAttribute(THEME_ATTRIBUTE), LIGHT_THEME);
  assert.strictEqual(elements.get("themeToggle").checked, false);
  assert.strictEqual(elements.get("themeToggleLabel").textContent, "Light mode");
}

async function test_theme_change_persists_to_storage() {
  const { body, elements, storageSetCalls, storageState } = buildEnvironment();
  const themeToggle = elements.get("themeToggle");
  themeToggle.checked = true;

  themeToggle.dispatch("change", { target: themeToggle });
  await flushMicrotasks();

  assert.strictEqual(body.getAttribute(THEME_ATTRIBUTE), DARK_THEME);
  assert.deepStrictEqual(storageSetCalls[0], { [STORAGE_KEY]: DARK_THEME });
  assert.strictEqual(storageState[STORAGE_KEY], DARK_THEME);
}

async function test_theme_toggle_does_not_call_fetch() {
  const { elements, fetchCalls } = buildEnvironment();
  const themeToggle = elements.get("themeToggle");
  themeToggle.checked = true;

  themeToggle.dispatch("change", { target: themeToggle });
  await flushMicrotasks();

  assert.strictEqual(fetchCalls.length, 0);
}

async function test_popup_controls_remain_present_after_ui_refresh() {
  const { elements } = buildEnvironment();

  REQUIRED_IDS.forEach((id) => {
    assert.ok(elements.get(id), `Expected fake DOM to include ${id}`);
  });

  assert.strictEqual(elements.get("downloads").style.display, "");
  elements.get("tailorBtn").dispatch("click");
  assert.strictEqual(typeof elements.get("flipBtn").listeners.click, "function");
  assert.strictEqual(typeof elements.get("chatInput").listeners.keypress, "function");
}

async function test_show_downloads_uses_flex_display() {
  const { context, elements } = buildEnvironment();
  context.showDownloads();

  assert.strictEqual(elements.get("downloads").style.display, DISPLAY_FLEX);
}

async function runTests() {
  const tests = [
    test_popup_html_contains_all_required_ids,
    test_popup_html_contains_premium_layout_sections,
    test_apply_theme_dark_updates_ui_and_label,
    test_apply_theme_light_restores_ui_and_label,
    test_saved_theme_restores_on_init,
    test_default_theme_is_light,
    test_theme_change_persists_to_storage,
    test_theme_toggle_does_not_call_fetch,
    test_popup_controls_remain_present_after_ui_refresh,
    test_show_downloads_uses_flex_display
  ];

  for (const test of tests) {
    await test();
  }

  console.log("frontend theme tests passed");
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
