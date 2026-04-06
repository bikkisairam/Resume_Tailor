const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const POPUP_JS_PATH = path.join(__dirname, "popup.js");
const POPUP_HTML_PATH = path.join(__dirname, "popup.html");
const DISPLAY_FLEX = "flex";
const THEME_CLASS = "dark-mode";
const LIGHT_THEME = "light";
const DARK_THEME = "dark";
const STORAGE_KEY = "popupTheme";

class FakeClassList {
  constructor() {
    this.classes = new Set();
  }

  add(className) {
    this.classes.add(className);
  }

  remove(className) {
    this.classes.delete(className);
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
  const requiredIds = [
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

  requiredIds.forEach((id) => {
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
    document,
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

async function test_theme_toggle_control_present() {
  const popupHtml = fs.readFileSync(POPUP_HTML_PATH, "utf8");
  assert.ok(popupHtml.includes('id="themeToggle"'), "Theme toggle button must exist with id='themeToggle'");
  assert.ok(popupHtml.includes('id="themeToggleLabel"'), "Theme toggle label must exist with id='themeToggleLabel'");
}

async function test_apply_dark_theme_updates_root_theme_state() {
  const { context, body, elements } = buildEnvironment();
  context.applyTheme(DARK_THEME);

  assert.ok(body.classList.contains(THEME_CLASS), "Body must have 'dark-mode' class when dark theme applied");
  assert.strictEqual(elements.get("themeToggle").checked, true, "Toggle checkbox must be checked in dark mode");
  assert.strictEqual(elements.get("themeToggleLabel").textContent, "Dark mode", "Label must display 'Dark mode'");
}

async function test_apply_light_theme_restores_root_theme_state() {
  const { context, body, elements } = buildEnvironment(DARK_THEME);
  
  // First apply dark to set up state
  context.applyTheme(DARK_THEME);
  // Then apply light
  context.applyTheme(LIGHT_THEME);

  assert.ok(!body.classList.contains(THEME_CLASS), "Body must NOT have 'dark-mode' class when light theme applied");
  assert.strictEqual(elements.get("themeToggle").checked, false, "Toggle checkbox must be unchecked in light mode");
  assert.strictEqual(elements.get("themeToggleLabel").textContent, "Light mode", "Label must display 'Light mode'");
}

async function test_saved_theme_restored_on_popup_init() {
  const { body, elements } = buildEnvironment(DARK_THEME);
  await flushMicrotasks();

  assert.ok(body.classList.contains(THEME_CLASS), "Saved dark theme must be restored on popup init");
  assert.strictEqual(elements.get("themeToggle").checked, true, "Toggle checkbox must reflect saved dark theme");
}

async function test_no_saved_theme_defaults_to_light() {
  const { body, elements } = buildEnvironment();
  await flushMicrotasks();

  assert.ok(!body.classList.contains(THEME_CLASS), "Default theme must be light (no dark-mode class)");
  assert.strictEqual(elements.get("themeToggle").checked, false, "Toggle checkbox must be unchecked by default");
}

async function test_theme_toggle_persists_selection() {
  const { elements, storageSetCalls, storageState } = buildEnvironment();
  const themeToggle = elements.get("themeToggle");
  themeToggle.checked = true;

  themeToggle.dispatch("change", { target: themeToggle });
  await flushMicrotasks();

  assert.deepStrictEqual(storageSetCalls[0], { [STORAGE_KEY]: DARK_THEME }, "Theme selection must be saved to chrome.storage.local");
  assert.strictEqual(storageState[STORAGE_KEY], DARK_THEME, "Storage state must reflect dark theme");
}

async function test_theme_toggle_switches_from_dark_to_light() {
  const { elements, body, storageSetCalls } = buildEnvironment();
  const themeToggle = elements.get("themeToggle");
  
  // Toggle to dark
  themeToggle.checked = true;
  themeToggle.dispatch("change", { target: themeToggle });
  await flushMicrotasks();

  assert.ok(body.classList.contains(THEME_CLASS), "Dark mode class should be added");

  // Toggle back to light
  themeToggle.checked = false;
  themeToggle.dispatch("change", { target: themeToggle });
  await flushMicrotasks();

  assert.ok(!body.classList.contains(THEME_CLASS), "Dark mode class should be removed");
  assert.strictEqual(storageSetCalls[1][STORAGE_KEY], LIGHT_THEME, "Light theme should be saved");
}

async function test_theme_toggle_does_not_call_backend() {
  const { elements, fetchCalls } = buildEnvironment();
  const themeToggle = elements.get("themeToggle");
  themeToggle.checked = true;

  themeToggle.dispatch("change", { target: themeToggle });
  await flushMicrotasks();

  assert.strictEqual(fetchCalls.length, 0, "Theme toggle must not trigger any backend fetch calls");
}

async function runTests() {
  const tests = [
    test_theme_toggle_control_present,
    test_apply_dark_theme_updates_root_theme_state,
    test_apply_light_theme_restores_root_theme_state,
    test_saved_theme_restored_on_popup_init,
    test_no_saved_theme_defaults_to_light,
    test_theme_toggle_persists_selection,
    test_theme_toggle_switches_from_dark_to_light,
    test_theme_toggle_does_not_call_backend
  ];

  for (const test of tests) {
    await test();
  }

  console.log("✅ All frontend theme tests passed");
}

runTests().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
