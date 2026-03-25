export function createMockUiHtml(apiBasePath = "/api/mock"): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Teleforge Mock</title>
    <style>
      :root {
        color-scheme: light;
        font-family: "IBM Plex Sans", sans-serif;
        background:
          radial-gradient(circle at top left, rgba(17, 138, 178, 0.18), transparent 28%),
          radial-gradient(circle at bottom right, rgba(239, 108, 0, 0.16), transparent 32%),
          #eef3f8;
        color: #132033;
      }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; }
      main {
        width: min(1200px, calc(100% - 2rem));
        margin: 0 auto;
        padding: 2rem 0 4rem;
      }
      header {
        display: grid;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
      }
      h1, h2, h3, p { margin: 0; }
      .lede { max-width: 56rem; line-height: 1.6; }
      .grid {
        display: grid;
        grid-template-columns: 320px 1fr;
        gap: 1rem;
        align-items: start;
      }
      .panel, .preview {
        background: rgba(255, 255, 255, 0.88);
        border-radius: 24px;
        border: 1px solid rgba(19, 32, 51, 0.08);
        box-shadow: 0 18px 60px rgba(19, 32, 51, 0.08);
        backdrop-filter: blur(14px);
      }
      .panel {
        padding: 1rem;
        display: grid;
        gap: 1rem;
        position: sticky;
        top: 1rem;
      }
      .preview {
        padding: 1.25rem;
        display: grid;
        gap: 1rem;
      }
      .section {
        display: grid;
        gap: 0.75rem;
        padding-bottom: 0.75rem;
        border-bottom: 1px solid rgba(19, 32, 51, 0.08);
      }
      .section:last-child { border-bottom: 0; padding-bottom: 0; }
      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.82rem;
        color: #45556e;
      }
      input, select, textarea, button {
        width: 100%;
        border-radius: 12px;
        border: 1px solid rgba(19, 32, 51, 0.14);
        padding: 0.7rem 0.8rem;
        font: inherit;
      }
      textarea { min-height: 9rem; resize: vertical; }
      button {
        background: #132033;
        color: #fff;
        cursor: pointer;
      }
      button.secondary {
        background: #fff;
        color: #132033;
      }
      .button-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }
      .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .pill {
        padding: 0.45rem 0.7rem;
        border-radius: 999px;
        border: 1px solid rgba(19, 32, 51, 0.14);
        background: rgba(255, 255, 255, 0.8);
        cursor: pointer;
      }
      .preview-card {
        border-radius: 22px;
        padding: 1rem;
        min-height: 20rem;
        display: grid;
        gap: 0.75rem;
        align-content: start;
      }
      .preview-card.light {
        background: linear-gradient(180deg, #ffffff, #eef6ff);
        color: #132033;
      }
      .preview-card.dark {
        background: linear-gradient(180deg, #152032, #0e1725);
        color: #eef3ff;
      }
      .log {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        white-space: pre-wrap;
        word-break: break-word;
        background: rgba(19, 32, 51, 0.04);
        border-radius: 14px;
        padding: 0.9rem;
        max-height: 16rem;
        overflow: auto;
      }
      .status {
        padding: 0.8rem 1rem;
        border-radius: 14px;
        background: rgba(17, 138, 178, 0.1);
        color: #0d5675;
      }
      @media (max-width: 960px) {
        .grid {
          grid-template-columns: 1fr;
        }
        .panel {
          position: static;
        }
        .form-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <p>Teleforge Mock Environment</p>
        <h1>Standalone Telegram WebApp Mock</h1>
        <p class="lede">
          Configure user personas, launch parameters, theme, viewport, and event simulation without
          running a framework dev server. Profiles save locally and export as shareable JSON.
        </p>
      </header>
      <div class="grid">
        <aside class="panel">
          <section class="section">
            <h2>Profiles</h2>
            <div class="button-row">
              <button id="save-profile" type="button">Save Profile</button>
              <button id="refresh-profiles" class="secondary" type="button">Refresh</button>
            </div>
            <div id="profiles" class="pill-row"></div>
          </section>
          <section class="section">
            <h2>Export / Import</h2>
            <div class="button-row">
              <button id="export-profile" type="button">Export JSON</button>
              <label class="secondary">
                <span>Import JSON</span>
                <input id="import-file" type="file" accept="application/json" />
              </label>
            </div>
          </section>
          <section class="section">
            <h2>Events</h2>
            <div class="button-row">
              <button data-event="mainButtonClicked" type="button">Main Button</button>
              <button data-event="backButtonPressed" type="button">Back Button</button>
              <button data-event="hapticFeedback" type="button">Haptic</button>
              <button data-event="popupClosed" type="button">Popup</button>
            </div>
            <div id="events" class="log">Waiting for events…</div>
          </section>
        </aside>
        <section class="preview">
          <div id="status" class="status">Loading mock state…</div>
          <section class="section">
            <h2>User Profile</h2>
            <div class="form-grid">
              <label>Profile Name<input id="profile-name" /></label>
              <label>Description<input id="profile-description" /></label>
              <label>User ID<input id="user-id" type="number" /></label>
              <label>First Name<input id="first-name" /></label>
              <label>Last Name<input id="last-name" /></label>
              <label>Username<input id="username" /></label>
              <label>Language<input id="language-code" /></label>
              <label>Photo URL<input id="photo-url" /></label>
              <label>Premium<select id="premium"><option value="false">false</option><option value="true">true</option></select></label>
            </div>
          </section>
          <section class="section">
            <h2>Launch Parameters</h2>
            <div class="form-grid">
              <label>Query ID<input id="query-id" /></label>
              <label>Auth Date<input id="auth-date" type="number" /></label>
              <label>Start Param<input id="start-param" /></label>
              <label>Startapp<input id="startapp" /></label>
              <label style="grid-column: 1 / -1;">Hash<textarea id="hash" readonly></textarea></label>
            </div>
          </section>
          <section class="section">
            <h2>App Context</h2>
            <div class="form-grid">
              <label>Version<input id="app-version" /></label>
              <label>Platform<select id="platform"><option>ios</option><option>android</option><option>web</option><option>macos</option><option>tdesktop</option></select></label>
              <label>Theme<select id="color-scheme"><option>light</option><option>dark</option></select></label>
              <label>Expanded<select id="expanded"><option value="true">true</option><option value="false">false</option></select></label>
              <label>Viewport Width<input id="viewport-width" type="number" /></label>
              <label>Viewport Height<input id="viewport-height" type="number" /></label>
              <label>Read Capability<select id="cap-read"><option value="true">true</option><option value="false">false</option></select></label>
              <label>Write Capability<select id="cap-write"><option value="true">true</option><option value="false">false</option></select></label>
            </div>
            <div class="button-row">
              <button id="apply-state" type="button">Apply State</button>
            </div>
          </section>
          <section class="section">
            <h2>Preview</h2>
            <div id="preview-card" class="preview-card light">
              <p id="preview-eyebrow">Platform: ios</p>
              <h3 id="preview-name">Dev</h3>
              <p id="preview-meta">Launch: inline</p>
              <p id="preview-copy">Mock environment ready.</p>
            </div>
          </section>
        </section>
      </div>
    </main>
    <script>
      const apiBase = ${JSON.stringify(apiBasePath)};
      let currentState = null;

      const ids = {
        status: document.getElementById("status"),
        profiles: document.getElementById("profiles"),
        events: document.getElementById("events"),
        previewCard: document.getElementById("preview-card"),
        previewEyebrow: document.getElementById("preview-eyebrow"),
        previewName: document.getElementById("preview-name"),
        previewMeta: document.getElementById("preview-meta"),
        previewCopy: document.getElementById("preview-copy")
      };

      const fields = {
        profileName: document.getElementById("profile-name"),
        profileDescription: document.getElementById("profile-description"),
        userId: document.getElementById("user-id"),
        firstName: document.getElementById("first-name"),
        lastName: document.getElementById("last-name"),
        username: document.getElementById("username"),
        languageCode: document.getElementById("language-code"),
        photoUrl: document.getElementById("photo-url"),
        premium: document.getElementById("premium"),
        queryId: document.getElementById("query-id"),
        authDate: document.getElementById("auth-date"),
        startParam: document.getElementById("start-param"),
        startapp: document.getElementById("startapp"),
        hash: document.getElementById("hash"),
        appVersion: document.getElementById("app-version"),
        platform: document.getElementById("platform"),
        colorScheme: document.getElementById("color-scheme"),
        expanded: document.getElementById("expanded"),
        viewportWidth: document.getElementById("viewport-width"),
        viewportHeight: document.getElementById("viewport-height"),
        capRead: document.getElementById("cap-read"),
        capWrite: document.getElementById("cap-write")
      };

      async function request(path, init) {
        const response = await fetch(apiBase + path, {
          headers: { "content-type": "application/json" },
          ...init
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || ("Request failed: " + response.status));
        }
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          return response.json();
        }
        return response.text();
      }

      function setStatus(message) {
        ids.status.textContent = message;
      }

      function renderState(state) {
        currentState = state;
        const profile = state.profile;
        fields.profileName.value = profile.name || "";
        fields.profileDescription.value = profile.description || "";
        fields.userId.value = String(profile.user.id || "");
        fields.firstName.value = profile.user.first_name || "";
        fields.lastName.value = profile.user.last_name || "";
        fields.username.value = profile.user.username || "";
        fields.languageCode.value = profile.user.language_code || "";
        fields.photoUrl.value = profile.user.photo_url || "";
        fields.premium.value = String(Boolean(profile.user.is_premium));
        fields.queryId.value = profile.launchParams.query_id || "";
        fields.authDate.value = String(profile.launchParams.auth_date || "");
        fields.startParam.value = profile.launchParams.start_param || "";
        fields.startapp.value = profile.launchParams.startapp || "";
        fields.hash.value = profile.launchParams.hash || "";
        fields.appVersion.value = profile.appContext.version || "";
        fields.platform.value = profile.appContext.platform || "ios";
        fields.colorScheme.value = profile.appContext.colorScheme || "light";
        fields.expanded.value = String(Boolean(profile.appContext.isExpanded));
        fields.viewportWidth.value = String(profile.appContext.viewportWidth || "");
        fields.viewportHeight.value = String(profile.appContext.viewportHeight || "");
        fields.capRead.value = String(Boolean(profile.capabilities.read));
        fields.capWrite.value = String(Boolean(profile.capabilities.write));

        ids.previewCard.className = "preview-card " + profile.appContext.colorScheme;
        ids.previewCard.style.width = Math.max(280, profile.appContext.viewportWidth) + "px";
        ids.previewCard.style.minHeight = Math.max(220, Math.min(720, profile.appContext.viewportHeight)) + "px";
        ids.previewEyebrow.textContent = "Platform: " + profile.appContext.platform + " • v" + profile.appContext.version;
        ids.previewName.textContent = profile.user.first_name + (profile.user.username ? " (@" + profile.user.username + ")" : "");
        ids.previewMeta.textContent = "Launch: " + (profile.launchParams.start_param || "none") + " • Expanded: " + profile.appContext.isExpanded;
        ids.previewCopy.textContent = "Theme: " + profile.appContext.colorScheme + " • Premium: " + Boolean(profile.user.is_premium);
      }

      function collectPatch() {
        return {
          name: fields.profileName.value,
          description: fields.profileDescription.value,
          user: {
            id: Number(fields.userId.value),
            first_name: fields.firstName.value,
            last_name: fields.lastName.value,
            username: fields.username.value,
            language_code: fields.languageCode.value,
            photo_url: fields.photoUrl.value,
            is_premium: fields.premium.value === "true"
          },
          launchParams: {
            query_id: fields.queryId.value,
            auth_date: Number(fields.authDate.value),
            start_param: fields.startParam.value,
            startapp: fields.startapp.value
          },
          appContext: {
            version: fields.appVersion.value,
            platform: fields.platform.value,
            colorScheme: fields.colorScheme.value,
            isExpanded: fields.expanded.value === "true",
            viewportWidth: Number(fields.viewportWidth.value),
            viewportHeight: Number(fields.viewportHeight.value)
          },
          capabilities: {
            read: fields.capRead.value === "true",
            write: fields.capWrite.value === "true"
          }
        };
      }

      async function loadState() {
        const state = await request("/state");
        renderState(state);
      }

      async function loadProfiles() {
        const payload = await request("/profiles");
        ids.profiles.innerHTML = "";
        for (const profile of payload.profiles) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "pill";
          button.textContent = profile.name;
          button.addEventListener("click", async () => {
            const loaded = await request("/profiles/" + encodeURIComponent(profile.fileName));
            renderState({ eventLog: currentState?.eventLog ?? [], profile: loaded.profile });
            await refreshEvents();
            setStatus("Loaded profile " + loaded.profile.name);
          });
          ids.profiles.appendChild(button);
        }
      }

      async function refreshEvents() {
        const payload = await request("/events/log");
        ids.events.textContent = payload.events.length === 0
          ? "Waiting for events…"
          : payload.events.map((entry) => "[" + entry.at + "] " + entry.name + ": " + JSON.stringify(entry.payload || {})).join("\\n");
      }

      document.getElementById("apply-state").addEventListener("click", async () => {
        const state = await request("/state", {
          method: "POST",
          body: JSON.stringify(collectPatch())
        });
        renderState(state);
        setStatus("Mock state updated.");
      });

      document.getElementById("save-profile").addEventListener("click", async () => {
        const payload = await request("/profiles", {
          method: "POST",
          body: JSON.stringify({ name: fields.profileName.value })
        });
        setStatus("Saved profile " + payload.profile.name);
        await loadProfiles();
      });

      document.getElementById("refresh-profiles").addEventListener("click", loadProfiles);

      document.getElementById("export-profile").addEventListener("click", async () => {
        const payload = await request("/export", { method: "POST" });
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "teleforge-mock-profile.json";
        link.click();
        URL.revokeObjectURL(link.href);
        setStatus("Exported profile JSON.");
      });

      document.getElementById("import-file").addEventListener("change", async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const payload = JSON.parse(text);
        const state = await request("/import", {
          method: "POST",
          body: JSON.stringify({ payload })
        });
        renderState(state);
        await loadProfiles();
        setStatus("Imported profile from JSON.");
      });

      document.querySelectorAll("[data-event]").forEach((button) => {
        button.addEventListener("click", async () => {
          const name = button.getAttribute("data-event");
          await request("/events/trigger", {
            method: "POST",
            body: JSON.stringify({ name, payload: { source: "ui" } })
          });
          await refreshEvents();
          setStatus("Triggered event " + name);
        });
      });

      Promise.all([loadState(), loadProfiles(), refreshEvents()])
        .then(() => setStatus("Mock environment ready."))
        .catch((error) => setStatus(error.message));
    </script>
  </body>
</html>`;
}
