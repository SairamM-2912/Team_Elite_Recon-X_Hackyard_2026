// RECON-X Chrome/Edge Extension Popup Controller

let API_BASE = "http://localhost:8000";

const ExtApp = {
  state: {
    status: null,
    scenarios: [],
    recentEvents: [],
    history: []
  },

  async init() {
    // Load configured API base if present
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['reconApiBase'], (res) => {
        if (res.reconApiBase) {
          API_BASE = res.reconApiBase;
          const hostInput = document.getElementById('proxy-host-input');
          if (hostInput) hostInput.value = API_BASE;
        }
        this.bindEvents();
        this.refreshAll();
      });
    } else {
      this.bindEvents();
      this.refreshAll();
    }
  },

  bindEvents() {
    document.getElementById('btn-analyze')?.addEventListener('click', () => this.analyzeQuery());
    document.getElementById('btn-run')?.addEventListener('click', () => this.runQuery());
    document.getElementById('protection-switch')?.addEventListener('click', () => this.toggleProtection());
    document.getElementById('db-selector')?.addEventListener('change', (e) => this.onDatabaseChange(e.target.value));
    document.getElementById('policy-select')?.addEventListener('change', (e) => this.onPolicyChange(e.target.value));
    document.getElementById('user-select')?.addEventListener('change', (e) => this.onUserChange(e.target.value));
    document.getElementById('btn-clear-history')?.addEventListener('click', (e) => this.clearHistory(e));
    document.getElementById('btn-verify-audit')?.addEventListener('click', (e) => this.verifyAudit(e));
    
    document.getElementById('history-toggle')?.addEventListener('click', () => this.toggleAccordion('history-body'));
    document.getElementById('settings-toggle')?.addEventListener('click', () => this.toggleAccordion('settings-body'));

    document.getElementById('proxy-host-input')?.addEventListener('change', (e) => {
      API_BASE = e.target.value.trim().replace(/\/$/, "");
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ reconApiBase: API_BASE });
      }
      this.refreshAll();
      this.showToast(`Updated Proxy Host: ${API_BASE}`);
    });
  },

  async refreshAll() {
    await this.fetchStatus();
    await this.loadScenarios();
    await this.loadEvents();
    await this.loadHistory();
  },

  async fetchStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/proxy/status`);
      if (res.ok) {
        this.state.status = await res.json();
        this.updateHeaderAndMeta();
      } else {
        this.setDisconnectedState();
      }
    } catch (e) {
      this.setDisconnectedState();
    }
  },

  setDisconnectedState() {
    const pill = document.getElementById('conn-status-pill');
    const text = document.getElementById('conn-status-text');
    if (pill) {
      pill.className = 'header-status-pill stopped';
      pill.style.backgroundColor = 'var(--blocked-bg)';
      pill.style.color = 'var(--blocked)';
      pill.style.borderColor = 'var(--blocked-border)';
    }
    if (text) text.innerText = 'Disconnected';
  },

  updateHeaderAndMeta() {
    const s = this.state.status;
    if (!s) return;

    const pill = document.getElementById('conn-status-pill');
    const text = document.getElementById('conn-status-text');
    if (pill && text) {
      pill.className = `header-status-pill ${s.proxy_running ? '' : 'stopped'}`;
      text.innerText = s.proxy_running ? 'Connected' : 'Paused';
    }

    const sw = document.getElementById('protection-switch');
    const swText = document.getElementById('protection-text');
    if (sw && swText) {
      sw.className = `switch-pill ${s.proxy_running ? 'active' : 'inactive'}`;
      swText.innerText = s.proxy_running ? 'Active' : 'Inactive';
    }

    const lat = document.getElementById('latency-text');
    if (lat && s.active_connection) {
      lat.innerText = `${s.active_connection.latency_ms} ms`;
    }

    const dbSel = document.getElementById('db-selector');
    if (dbSel && s.active_connection) {
      dbSel.value = s.active_connection.id;
    }

    const polSel = document.getElementById('policy-select');
    if (polSel && s.active_policy) {
      polSel.value = s.active_policy.id;
    }

    const userSel = document.getElementById('user-select');
    if (userSel && s.authenticated_user) {
      userSel.value = s.authenticated_user.username;
    }
  },

  async loadScenarios() {
    try {
      const res = await fetch(`${API_BASE}/api/proxy/scenarios`);
      if (res.ok) {
        this.state.scenarios = await res.json();
        this.renderScenarios();
        const input = document.getElementById('sql-input');
        if (input && !input.value && this.state.scenarios.length > 0) {
          input.value = this.state.scenarios[0].query;
        }
      }
    } catch (e) {}
  },

  renderScenarios() {
    const container = document.getElementById('scenarios-container');
    if (!container) return;

    const labels = {
      scenario_normal: 'Compliant',
      scenario_canary: 'Canary Trap',
      scenario_differencing_1: 'Diff Step 1',
      scenario_differencing_2: 'Diff Step 2',
      scenario_narrowing: 'Singling-Out',
      scenario_dp_restrict: 'DP Noise'
    };

    container.innerHTML = (this.state.scenarios || []).map(sc => `
      <div class="scenario-chip" data-id="${sc.id}" title="${escapeHtml(sc.title)}: ${escapeHtml(sc.description)}">
        <span style="color:${sc.expected_decision === 'BLOCK' ? 'var(--blocked)' : sc.expected_decision === 'RESTRICT' ? 'var(--restricted)' : 'var(--success)'}; font-weight:700;">•</span>
        ${labels[sc.id] || sc.title}
      </div>
    `).join('');

    container.querySelectorAll('.scenario-chip').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        this.applyScenario(id);
      });
    });
  },

  applyScenario(id) {
    const sc = this.state.scenarios.find(s => s.id === id);
    if (!sc) return;

    const input = document.getElementById('sql-input');
    if (input) input.value = sc.query;

    if (sc.sector && this.state.status?.active_connection?.id !== sc.sector) {
      this.onDatabaseChange(sc.sector, false);
    }
    this.showToast(`Loaded: ${sc.title}`);
  },

  async analyzeQuery() {
    const input = document.getElementById('sql-input');
    const query = input ? input.value.trim() : '';
    if (!query) {
      this.showToast('Please enter a SQL query');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/proxy/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query })
      });

      if (res.ok) {
        const data = await res.json();
        this.renderRiskCard(data.decision);
      }
    } catch (e) {
      this.showToast('Analysis request failed');
    }
  },

  async runQuery() {
    const input = document.getElementById('sql-input');
    const query = input ? input.value.trim() : '';
    if (!query) {
      this.showToast('Please enter a SQL query');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/proxy/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query })
      });

      const data = await res.json();
      this.renderRiskCard(data);
      this.renderResultBox(data);
      await this.loadEvents();
      await this.loadHistory();
      await this.fetchStatus();
    } catch (e) {
      this.showToast('Execution request failed');
    }
  },

  renderRiskCard(d) {
    const card = document.getElementById('risk-card');
    const scoreEl = document.getElementById('risk-score');
    const badge = document.getElementById('decision-badge');
    const reasonEl = document.getElementById('risk-reason');
    if (!card || !scoreEl || !badge || !reasonEl) return;

    const decision = d.decision || 'ALLOW';
    const score = d.risk_score !== undefined ? d.risk_score : 0;
    const reasons = d.reasons || [];

    card.className = `risk-card ${decision}`;
    badge.className = `decision-pill ${decision}`;
    badge.innerText = decision;

    let scoreColor = 'var(--success)';
    if (decision === 'BLOCK') scoreColor = 'var(--blocked)';
    else if (decision === 'RESTRICT') scoreColor = 'var(--restricted)';
    else if (decision === 'WARN') scoreColor = 'var(--warning)';

    scoreEl.style.color = scoreColor;
    scoreEl.innerText = `${score} / 100`;
    reasonEl.innerText = reasons[0] || d.remediation || 'Query conforms to security policy.';
  },

  renderResultBox(res) {
    const box = document.getElementById('result-box');
    if (!box) return;

    box.style.display = 'block';

    if (res.blocked) {
      box.className = 'result-box blocked';
      box.innerHTML = `
        <strong>Enforcement Gate: BLOCKED (0 Rows Disclosed)</strong>
        <div style="font-size:10px; margin-top:2px;">
          ${escapeHtml(res.message || 'Execution prohibited by policy.')}
        </div>
      `;
    } else if (res.success) {
      box.className = 'result-box';
      const rowCount = res.row_count || 0;
      const dp = res.differential_privacy;
      box.innerHTML = `
        <div style="display:flex; justify-content:space-between; font-weight:700; margin-bottom:4px;">
          <span>Results: ${rowCount} rows (${res.execution_latency_ms} ms)</span>
          ${dp ? `<span style="color:var(--restricted);">Laplace Noise (ε=${dp.epsilon})</span>` : ''}
        </div>
        ${res.rows && res.rows.length > 0 ? `
          <div style="font-family:var(--font-mono); font-size:10px; white-space:pre-wrap;">${escapeHtml(JSON.stringify(res.rows[0], null, 2))}</div>
        ` : '<div style="color:var(--secondary-text);">Empty result set.</div>'}
      `;
    }
  },

  async loadEvents() {
    try {
      const res = await fetch(`${API_BASE}/api/events?limit=4`);
      if (res.ok) {
        const data = await res.json();
        this.state.recentEvents = data.events || [];
        this.renderEvents();
      }
    } catch (e) {}
  },

  renderEvents() {
    const list = document.getElementById('events-list');
    const countEl = document.getElementById('events-count');
    if (!list) return;

    const events = this.state.recentEvents || [];
    if (countEl) countEl.innerText = `${events.length} events`;

    if (events.length === 0) {
      list.innerHTML = `<div style="text-align:center; padding:6px 0; color:var(--secondary-text); font-size:10px;">No events recorded.</div>`;
      return;
    }

    list.innerHTML = events.map(e => `
      <div class="event-row">
        <span class="decision-pill ${e.decision}" style="font-size:9px; padding:1px 4px;">${e.decision}</span>
        <div style="flex:1; overflow:hidden;">
          <div style="display:flex; justify-content:space-between; font-weight:600; font-size:10px;">
            <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${escapeHtml(e.event_type.replace(/_/g, ' '))}</span>
            <span style="font-size:9px; color:var(--secondary-text);">${e.timestamp.split(' ')[1] || e.timestamp}</span>
          </div>
          <div class="event-query">${escapeHtml(e.query)}</div>
        </div>
      </div>
    `).join('');
  },

  async loadHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/history`);
      if (res.ok) {
        const data = await res.json();
        this.state.history = data.history || [];
        this.renderHistory();
      }
    } catch (e) {}
  },

  renderHistory() {
    const list = document.getElementById('history-list');
    if (!list) return;

    if (this.state.history.length === 0) {
      list.innerHTML = `<div style="color:var(--secondary-text); font-size:10px;">No queries in active session.</div>`;
      return;
    }

    list.innerHTML = this.state.history.slice(0, 5).map((h) => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:2px 4px; border:1px solid #F1F5F9; border-radius:3px;">
        <div style="font-family:var(--font-mono); font-size:9.5px; color:var(--primary-text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:230px;">
          ${escapeHtml(h.query)}
        </div>
        <span class="decision-pill ${h.decision}" style="font-size:8.5px; padding:1px 4px;">${h.decision}</span>
      </div>
    `).join('');
  },

  async toggleProtection() {
    if (!this.state.status) return;
    const nextState = !this.state.status.proxy_running;

    try {
      const res = await fetch(`${API_BASE}/api/proxy/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ running: nextState })
      });
      if (res.ok) {
        await this.fetchStatus();
        this.showToast(`Protection ${nextState ? 'Active' : 'Paused'}`);
      }
    } catch (e) {}
  },

  async onDatabaseChange(dbId, showNotification = true) {
    try {
      const res = await fetch(`${API_BASE}/api/connections/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: dbId })
      });
      if (res.ok) {
        await this.fetchStatus();
        if (showNotification) this.showToast(`Connected: ${dbId}`);
      }
    } catch (e) {}
  },

  async onPolicyChange(policyId) {
    try {
      const res = await fetch(`${API_BASE}/api/policies/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy_id: policyId })
      });
      if (res.ok) {
        await this.fetchStatus();
        this.showToast(`Applied Policy: ${policyId}`);
      }
    } catch (e) {}
  },

  async onUserChange(username) {
    try {
      const res = await fetch(`${API_BASE}/api/auth/switch-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username })
      });
      if (res.ok) {
        await this.fetchStatus();
        this.showToast(`Switched Role: ${username}`);
      }
    } catch (e) {}
  },

  async clearHistory(e) {
    if (e) e.preventDefault();
    try {
      await fetch(`${API_BASE}/api/history/clear`, { method: 'DELETE' });
      this.state.history = [];
      this.renderHistory();
      this.showToast('History cleared');
    } catch (err) {}
  },

  async verifyAudit(e) {
    if (e) e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/audit/verify`);
      if (res.ok) {
        const d = await res.json();
        this.showToast(d.valid ? `SHA-256 Valid (${d.count} records)` : 'Chain mismatch');
      }
    } catch (err) {}
  },

  toggleAccordion(bodyId) {
    const el = document.getElementById(bodyId);
    if (!el) return;
    const isOpen = el.classList.contains('open');
    el.classList.toggle('open', !isOpen);
    
    const arrow = document.getElementById(bodyId.replace('-body', '-arrow'));
    if (arrow) arrow.innerText = isOpen ? '▾' : '▴';
  },

  showToast(msg) {
    const t = document.getElementById('micro-toast');
    if (!t) return;
    t.innerText = msg;
    t.style.display = 'block';
    setTimeout(() => {
      t.style.display = 'none';
    }, 2400);
  }
};

window.addEventListener('DOMContentLoaded', () => {
  ExtApp.init();
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
