# RECON-X — Browser Extension Companion

The **RECON-X Database Security Companion** is an installable browser extension (Chrome, Edge, Brave, Arc, Opera) designed to sit alongside your database tools, web query consoles (Supabase, Neon, AWS CloudShell, BigQuery), or local web dev interfaces.

It connects directly to your local **RECON-X Database Security Proxy** (`http://localhost:8000`), keeping the proxy enforcement layer separate while providing an ultra-compact developer-tool status panel.

---

## 🚀 How to Install (Load Unpacked)

### Google Chrome / Chromium / Brave:
1. Open Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top right corner.
3. Click the **Load unpacked** button.
4. Select the `extension` directory inside your RECON-X workspace:
   ```
   C:\Users\SUVI\OneDrive\Desktop\RECON_X\extension
   ```
5. Pin the **RECON-X** extension icon in your browser toolbar.

### Microsoft Edge:
1. Open Edge and navigate to `edge://extensions/`.
2. Enable **Developer mode** in the left sidebar.
3. Click **Load unpacked** and choose the `extension` folder.

---

## 🛠 Features in the Compact Extension Panel

- **Live Database Connection Status**: Real-time health status, latency, and active protected database sector.
- **Protection Toggle**: Instantly activate or pause fail-closed proxy gating.
- **Current Query Risk**: Real-time 0–100 risk score and clear explainability reasons for detected threats.
- **Enforcement Decisions**: Immediate visualization of `ALLOW`, `WARN`, `RESTRICT` (Differential Privacy Laplace noise), or `BLOCK`.
- **Query Actions & Scenarios**: Input SQL queries with one-click attack scenario presets (Canary Trap, Differencing Reconstruction, Singling-Out, DP Noise).
- **Recent Security Events**: Compact stream of the latest 3–5 detected events.
- **Expandable History & Settings**: Inspect session query sequences and toggle security policies without clutter.

---

## ⚙️ Extension Settings & Host Config

By default, the extension talks to the local proxy at:
```
http://localhost:8000
```
If your RECON-X proxy runs on a custom port or remote host, expand **Security Settings** inside the panel and update the **Proxy Host** field.
