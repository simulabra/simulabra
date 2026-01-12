import { __, base } from "simulabra";
import test from "simulabra/test";
import session from "../src/session.js";

export default await async function (_, $, $test, $session) {

  let mockResponse;
  let capturedRequests = [];
  const originalFetch = globalThis.fetch;

  function setupMockFetch(response) {
    capturedRequests = [];
    mockResponse = response;
    globalThis.fetch = async (url, opts) => {
      capturedRequests.push({ url, body: JSON.parse(opts.body) });
      return {
        ok: true,
        json: async () => mockResponse,
      };
    };
  }

  function restoreFetch() {
    globalThis.fetch = originalFetch;
  }

  // Mock localStorage for storage tests
  function createMockStorage() {
    const store = {};
    return {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => { store[key] = value; },
      removeItem: (key) => { delete store[key]; },
      _store: store
    };
  }

  $test.Case.new({
    name: "LoomStorageSaveLoad",
    doc: "LoomStorage saves and loads text",
    do() {
      const mockLS = createMockStorage();
      const originalLS = globalThis.localStorage;
      globalThis.localStorage = mockLS;

      try {
        const storage = $session.LoomStorage.new();
        storage.save("hello world");
        this.assertEq(mockLS._store["SWYPELOOM_TEXT"], "hello world");
        this.assertEq(storage.load(), "hello world");
      } finally {
        globalThis.localStorage = originalLS;
      }
    }
  });

  $test.Case.new({
    name: "LoomStorageCustomKey",
    doc: "LoomStorage uses custom key",
    do() {
      const mockLS = createMockStorage();
      const originalLS = globalThis.localStorage;
      globalThis.localStorage = mockLS;

      try {
        const storage = $session.LoomStorage.new({ key: "MY_CUSTOM_KEY" });
        storage.save("custom data");
        this.assertEq(mockLS._store["MY_CUSTOM_KEY"], "custom data");
        this.assertEq(storage.load(), "custom data");
      } finally {
        globalThis.localStorage = originalLS;
      }
    }
  });

  $test.Case.new({
    name: "LoomStorageClear",
    doc: "LoomStorage clear removes data",
    do() {
      const mockLS = createMockStorage();
      const originalLS = globalThis.localStorage;
      globalThis.localStorage = mockLS;

      try {
        const storage = $session.LoomStorage.new();
        storage.save("to be cleared");
        this.assertEq(storage.load(), "to be cleared");

        storage.clear();
        this.assertEq(storage.load(), "");
      } finally {
        globalThis.localStorage = originalLS;
      }
    }
  });

  $test.Case.new({
    name: "LoomStorageNoLocalStorage",
    doc: "LoomStorage handles missing localStorage gracefully",
    do() {
      const originalLS = globalThis.localStorage;
      delete globalThis.localStorage;

      try {
        const storage = $session.LoomStorage.new();
        // Should not throw
        storage.save("test");
        this.assertEq(storage.load(), "");
        storage.clear();
      } finally {
        globalThis.localStorage = originalLS;
      }
    }
  });

  $test.Case.new({
    name: "SwypeSessionUsesInjectedStorage",
    doc: "SwypeSession delegates to injected storage",
    do() {
      const mockLS = createMockStorage();
      const originalLS = globalThis.localStorage;
      globalThis.localStorage = mockLS;

      try {
        const storage = $session.LoomStorage.new({ key: "TEST_SESSION" });
        const session = $session.SwypeSession.new({
          generatorConfig: { baseURL: "http://test:3731" },
          storage
        });

        session.text("saved text");
        session.saveToStorage();

        this.assertEq(mockLS._store["TEST_SESSION"], "saved text");
        this.assertEq(session.storage(), storage);
      } finally {
        globalThis.localStorage = originalLS;
      }
    }
  });

  $test.Case.new({
    name: "SwypeSessionCreation",
    doc: "Session initializes with default state",
    do() {
      const session = $session.SwypeSession.new({
        generatorConfig: { baseURL: "http://test:3731" }
      });
      this.assertEq(session.text(), "");
      this.assertEq(session.choices().length, 0);
      this.assertEq(session.loading(), false);
      this.assertEq(session.editing(), false);
      this.assertEq(session.preview(), "");
      this.assertEq(session.generator().hasImage(), false);
    }
  });

  $test.Case.new({
    name: "SwypeSessionSnapshot",
    doc: "Snapshot captures current state",
    do() {
      const session = $session.SwypeSession.new({
        generatorConfig: { baseURL: "http://test:3731" }
      });
      session.text("test text");
      session.choices(["a", "b", "c", "d"]);

      const snap = session.snapshot();

      this.assertEq(snap.text, "test text");
      this.assertEq(snap.choices.length, 4);
      this.assert(snap.choices !== session.choices(), "Snapshot should be a copy");
    }
  });

  $test.Case.new({
    name: "SwypeSessionUndoRedo",
    doc: "Undo/redo correctly manages state",
    do() {
      const session = $session.SwypeSession.new({
        generatorConfig: { baseURL: "http://test:3731" }
      });
      session.text("initial");

      session.pushUndo();
      session.text("after change");

      this.assertEq(session.text(), "after change");
      this.assert(session.canUndo());
      this.assert(!session.canRedo());

      session.undo();
      this.assertEq(session.text(), "initial");
      this.assert(!session.canUndo());
      this.assert(session.canRedo());

      session.redo();
      this.assertEq(session.text(), "after change");
    }
  });

  $test.Case.new({
    name: "SwypeSessionUndoStackCleared",
    doc: "Redo stack cleared on new change",
    do() {
      const session = $session.SwypeSession.new({
        generatorConfig: { baseURL: "http://test:3731" }
      });
      session.text("state1");
      session.pushUndo();
      session.text("state2");
      session.undo();

      this.assert(session.canRedo());

      session.pushUndo();
      session.text("state3");

      this.assert(!session.canRedo(), "Redo stack should be cleared");
    }
  });

  $test.Case.new({
    name: "SwypeSessionPreview",
    doc: "Preview sets and clears correctly",
    do() {
      const session = $session.SwypeSession.new({
        generatorConfig: { baseURL: "http://test:3731" }
      });
      session.choices(["choice1", "choice2", "choice3", "choice4"]);

      session.previewChoice(1);
      this.assertEq(session.preview(), "choice2");

      session.clearPreview();
      this.assertEq(session.preview(), "");
    }
  });

  $test.Case.new({
    name: "SwypeSessionPreviewInvalidIndex",
    doc: "Preview with invalid index does nothing",
    do() {
      const session = $session.SwypeSession.new({
        generatorConfig: { baseURL: "http://test:3731" }
      });
      session.choices(["a", "b"]);

      session.previewChoice(5);
      this.assertEq(session.preview(), "");
    }
  });

  $test.Case.new({
    name: "SwypeSessionEditing",
    doc: "Editing state transitions work",
    do() {
      const session = $session.SwypeSession.new({
        generatorConfig: { baseURL: "http://test:3731" }
      });

      this.assertEq(session.editing(), false);

      session.startEditing();
      this.assertEq(session.editing(), true);

      session.editText("new content");
      this.assertEq(session.text(), "new content");
    }
  });

  $test.Case.new({
    name: "SwypeSessionAttachImage",
    doc: "Image attachment delegates to client",
    do() {
      const session = $session.SwypeSession.new({
        generatorConfig: { baseURL: "http://test:3731" }
      });

      this.assertEq(session.generator().hasImage(), false);

      session.attachImage("base64data");
      this.assertEq(session.generator().hasImage(), true);
      this.assertEq(session.generator().client().imageData(), "base64data");
      this.assertEq(session.generator().client().imageMode(), true);

      session.clearImage();
      this.assertEq(session.generator().hasImage(), false);
      this.assertEq(session.generator().client().imageData(), null);
      this.assertEq(session.generator().client().imageMode(), false);
    }
  });

  $test.AsyncCase.new({
    name: "SwypeSessionGenerateChoices",
    doc: "generateChoices makes 4 API calls and populates state",
    async do() {
      setupMockFetch({
        choices: [{
          text: " generated text",
          logprobs: {
            content: [{
              top_logprobs: [
                { token: " the", logprob: -0.3 },
                { token: " a", logprob: -0.8 }
              ]
            }]
          }
        }]
      });

      try {
        const session = $session.SwypeSession.new({
          generatorConfig: { baseURL: "http://test:3731" }
        });
        session.text("Once upon");

        await session.generateChoices();

        this.assertEq(capturedRequests.length, 4, "Should make 4 requests");
        this.assertEq(session.choices().length, 4);
        this.assertEq(session.loading(), false);
        this.assert(session.logprobs().length > 0, "Should have logprobs");
      } finally {
        restoreFetch();
      }
    }
  });

  $test.AsyncCase.new({
    name: "SwypeSessionSelectChoice",
    doc: "Selecting choice appends text and pushes undo",
    async do() {
      setupMockFetch({
        choices: [{ text: " more text", logprobs: null }]
      });

      try {
        const session = $session.SwypeSession.new({
          generatorConfig: { baseURL: "http://test:3731" }
        });
        session.text("Start");
        session.choices([" alpha", " beta", " gamma", " delta"]);

        session.selectChoice(0);

        this.assertEq(session.text(), "Start alpha");
        this.assert(session.canUndo(), "Should be undoable");
      } finally {
        restoreFetch();
      }
    }
  });

  $test.AsyncCase.new({
    name: "SwypeSessionInsertToken",
    doc: "insertToken appends and pushes undo",
    async do() {
      setupMockFetch({
        choices: [{ text: " next", logprobs: null }]
      });

      try {
        const session = $session.SwypeSession.new({
          generatorConfig: { baseURL: "http://test:3731" }
        });
        session.text("Hello");

        session.insertToken(" world");

        this.assertEq(session.text(), "Hello world");
        this.assert(session.canUndo());
      } finally {
        restoreFetch();
      }
    }
  });

  $test.Case.new({
    name: "SwypeSessionSelectInvalidChoice",
    doc: "Selecting invalid index returns false",
    do() {
      const session = $session.SwypeSession.new({
        generatorConfig: { baseURL: "http://test:3731" }
      });
      session.choices(["a", "b"]);

      const result = session.selectChoice(5);
      this.assertEq(result, false);
    }
  });

  $test.Case.new({
    name: "SwypeSessionRestoreSnapshot",
    doc: "restoreSnapshot correctly restores all state",
    do() {
      const session = $session.SwypeSession.new({
        generatorConfig: { baseURL: "http://test:3731" }
      });
      session.text("original");
      session.choices(["a", "b", "c", "d"]);

      const snap = session.snapshot();

      session.text("changed");
      session.choices(["x", "y"]);

      session.restoreSnapshot(snap);

      this.assertEq(session.text(), "original");
      this.assertEq(session.choices().length, 4);
      this.assertEq(session.choices()[0], "a");
    }
  });

}.module({
  name: "test.swyperloom.session",
  imports: [base, test, session],
}).load();
