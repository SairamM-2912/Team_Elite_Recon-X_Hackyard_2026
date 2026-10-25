/**
 * RECON-X Enterprise Database Security Platform
 * Professional Application Controller
 */

const App = {
  state: {
    status: null,
    scenarios: [],
    recentEvents: [],
    history: [],
    connections: [],
    policies: [],
    users: [],
    auditLogs: [],
    analytics: null,
    datasets: [],
    pgStatus: null,
    currentView: 'overview',
    apiBase: ''
  },

  async init(apiBase = '') {
    this.state.apiBase = apiBase;
    await this.fetchStatus();
    await this.loadScenarios();
    await this.loadEvents();
    await this.loadHistory();
    await this.loadConnections();
    await this.loadDatasets();
    await this.loadPolicies();
    await this.loadUsers();
    await this.loadAuditLogs();
    await this.loadAnalytics();
    await this.checkPgStatus();
    this.initScrollSpy();
  },

  // ---------------------------------------------------------------------------
  // Single-Page Scrolling & Navigation
  // ---------------------------------------------------------------------------
  scrollToSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (!el) return;

    this.closeSidebar();

    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.updateSidebarActive(sectionId);
  },

  updateSidebarActive(sectionId) {
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
      const target = link.getAttribute('data-section') || link.getAttribute('onclick');
      if (target && (target.includes(sectionId) || target === sectionId)) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    const titles = {
      'section-overview': 'Database Security Overview',
      'section-monitoring': 'Query Monitoring & Threat Intelligence',
      'section-connections': 'Database Connections & Datasets',
      'section-audit': 'Audit Logs & Security Events',
      'section-policies': 'Security Policies & Governance',
      'section-history': 'History & Risk Analytics',
      'section-workspace': 'SQL Workspace & Inspection Engine'
    };
    const bc = document.getElementById('topbar-breadcrumb');
    if (bc && titles[sectionId]) bc.textContent = titles[sectionId];
  },

  navigateTo(viewId) {
    this.state.currentView = viewId;

    const sectionMap = {
      overview: { section: 'section-overview' },
      inspector: { section: 'section-workspace' },
      workspace: { section: 'section-workspace' },
      threats: { section: 'section-monitoring' },
      monitoring: { section: 'section-monitoring' },
      history: { section: 'section-history' },
      analytics: { section: 'section-history' },
      reports: { section: 'section-history' },
      events: { section: 'section-audit', tabGroup: 'audit-tabs', tab: 'tab-events-full' },
      audit: { section: 'section-audit', tabGroup: 'audit-tabs', tab: 'tab-audit-ledger' },
      connections: { section: 'section-connections', tabGroup: 'connections-tabs', tab: 'tab-connections-list' },
      datasets: { section: 'section-connections', tabGroup: 'connections-tabs', tab: 'tab-datasets-explorer' },
      pg: { section: 'section-connections', tabGroup: 'connections-tabs', tab: 'tab-pg-connection' },
      policies: { section: 'section-policies', tabGroup: 'policies-tabs', tab: 'tab-policies-list' },
      access: { section: 'section-policies', tabGroup: 'policies-tabs', tab: 'tab-rbac-users' },
      settings: { section: 'section-policies', tabGroup: 'policies-tabs', tab: 'tab-platform-settings' }
    };

    const mapping = sectionMap[viewId] || { section: `section-${viewId}` };
    if (mapping.tabGroup && mapping.tab) {
      this.switchTab(mapping.tabGroup, mapping.tab);
    }
    this.scrollToSection(mapping.section);

    if (viewId === 'overview') this.fetchStatus();
    if (viewId === 'events' || viewId === 'threats') this.loadEvents();
    if (viewId === 'history') this.loadHistory();
    if (viewId === 'analytics') this.loadAnalytics();
    if (viewId === 'audit') this.loadAuditLogs();
    if (viewId === 'connections') this.loadConnections();
    if (viewId === 'datasets') this.loadDatasets();
  },

  switchTab(tabGroupId, tabId) {
    const container = document.getElementById(tabGroupId);
    if (!container) return;

    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    container.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });
  },

  toggleCollapse(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) panel.classList.toggle('open');
  },

  toggleSidebar() {
    const sb = document.getElementById('app-sidebar');
    const bd = document.getElementById('sidebar-backdrop');
    if (sb) sb.classList.toggle('open');
    if (bd) bd.classList.toggle('active');
  },

  closeSidebar() {
    const sb = document.getElementById('app-sidebar');
    const bd = document.getElementById('sidebar-backdrop');
    if (sb) sb.classList.remove('open');
    if (bd) bd.classList.remove('active');
  },

  initScrollSpy() {
    const sections = document.querySelectorAll('.dashboard-section[id]');
    if (!sections.length || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.updateSidebarActive(entry.target.id);
        }
      });
    }, {
      root: null,
      rootMargin: '-20% 0px -55% 0px',
      threshold: 0
    });

    sections.forEach(sec => observer.observe(sec));
  },

  // ---------------------------------------------------------------------------
  // Status & Telemetry
  // ---------------------------------------------------------------------------
  async fetchStatus() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/proxy/status`);
      if (res.ok) {
        const s = await res.json();
        this.state.status = s;
        this.renderStatus(s);
      }
    } catch (e) {
      console.warn('Status fetch failed:', e);
      this.showToast('Unable to connect to security proxy');
    }
  },

  renderStatus(s) {
    // Topbar connection badge
    const badge = document.getElementById('topbar-connection-badge');
    const nameEl = document.getElementById('topbar-connection-name');
    const latEl = document.getElementById('topbar-connection-latency');
    const togLabel = document.getElementById('topbar-toggle-label');

    if (nameEl && s.active_connection) {
      nameEl.textContent = `${s.active_connection.name}`;
    }
    if (latEl && s.active_connection) {
      latEl.textContent = `${s.active_connection.latency_ms}ms`;
    }
    if (badge) {
      badge.className = `connection-indicator-badge ${s.proxy_running ? '' : 'paused'}`;
    }
    if (togLabel) {
      togLabel.textContent = s.proxy_running ? 'Active Gating' : 'Gating Paused';
    }

    // Topbar User info
    if (s.authenticated_user) {
      const u = s.authenticated_user;
      const avatar = document.getElementById('topbar-user-avatar');
      const uname = document.getElementById('topbar-user-name');
      const urole = document.getElementById('topbar-user-role');
      if (avatar) avatar.textContent = u.username.substring(0, 2).toUpperCase();
      if (uname) uname.textContent = u.username;
      if (urole) urole.textContent = u.role.replace('_', ' ');
    }

    // Update Overview KPIs
    const blockedCount = s.blocked_count || 0;
    const totalEvents = s.events_count || 0;
    const auditCount = s.audit_logs_count || 0;

    const elInspected = document.getElementById('kpi-inspected');
    const elThreats = document.getElementById('kpi-threats');
    const elBlocked = document.getElementById('kpi-blocked');
    const elHighRisk = document.getElementById('kpi-highrisk');
    const elAvgScore = document.getElementById('kpi-avgscore');
    const elDbStatus = document.getElementById('kpi-dbstatus');
    const elDbEngine = document.getElementById('kpi-dbengine');

    if (elInspected) elInspected.textContent = auditCount;
    if (elThreats) elThreats.textContent = totalEvents;
    if (elBlocked) elBlocked.textContent = blockedCount;
    if (elHighRisk) elHighRisk.textContent = blockedCount; // Queries resulting in critical severity
    if (elAvgScore) elAvgScore.textContent = auditCount > 0 ? '24' : '0';
    if (elDbStatus && s.active_connection) elDbStatus.textContent = s.active_connection.status || 'Active';
    if (elDbEngine && s.active_connection) elDbEngine.textContent = s.active_connection.engine;

    // Badges
    const sbEvents = document.getElementById('sidebar-events-count');
    const sbThreats = document.getElementById('sidebar-threats-badge');
    if (sbEvents) sbEvents.textContent = totalEvents;
    if (sbThreats) sbThreats.textContent = blockedCount;

    // Threat view counts
    const tDiff = document.getElementById('threat-stat-differencing');
    const tNarr = document.getElementById('threat-stat-narrowing');
    const tCan = document.getElementById('threat-stat-canary');
    if (tDiff) tDiff.textContent = `${this.state.recentEvents.filter(e => e.event_type?.includes('DIFFERENCING')).length} incidents`;
    if (tNarr) tNarr.textContent = `${this.state.recentEvents.filter(e => e.event_type?.includes('NARROWING')).length} incidents`;
    if (tCan) tCan.textContent = `${this.state.recentEvents.filter(e => e.event_type?.includes('CANARY') || e.decision === 'BLOCK').length} incidents`;
  },

  async toggleProtectionState() {
    if (!this.state.status) return;
    const nextState = !this.state.status.proxy_running;
    try {
      const res = await fetch(`${this.state.apiBase}/api/proxy/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ running: nextState })
      });
      if (res.ok) {
        await this.fetchStatus();
        this.showToast(`Protection Gating ${nextState ? 'Active' : 'Paused'}`);
      }
    } catch (e) {
      this.showToast('Failed to toggle proxy state');
    }
  },

  // ---------------------------------------------------------------------------
  // SQL Inspector & Scenarios
  // ---------------------------------------------------------------------------
  async loadScenarios() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/proxy/scenarios`);
      if (res.ok) {
        this.state.scenarios = await res.json();
        this.renderScenarios();
        if (this.state.scenarios.length > 0) {
          const input = document.getElementById('inspector-sql-input');
          if (input && !input.value) {
            input.value = this.state.scenarios[0].query;
          }
        }
      }
    } catch (e) {
      console.warn('Scenarios load error:', e);
    }
  },

  renderScenarios() {
    const c = document.getElementById('inspector-presets-container');
    if (!c) return;

    c.innerHTML = (this.state.scenarios || []).map(sc => `
      <div class="preset-chip" onclick="App.applyScenario('${sc.id}')">
        <strong>${sc.category}:</strong> ${sc.title}
      </div>
    `).join('');
  },

  applyScenario(id) {
    const sc = this.state.scenarios.find(s => s.id === id);
    if (!sc) return;
    const input = document.getElementById('inspector-sql-input');
    if (input) input.value = sc.query;

    const dbSelect = document.getElementById('inspector-db-select');
    if (dbSelect && sc.sector) {
      dbSelect.value = sc.sector;
      this.onDatabaseChange(sc.sector, false);
    }
    this.showToast(`Preset Loaded: ${sc.title}`);
  },

  clearInspector() {
    const input = document.getElementById('inspector-sql-input');
    if (input) input.value = '';
    const resBox = document.getElementById('inspector-results-box');
    if (resBox) resBox.style.display = 'none';
  },

  async inspectQueryOnly() {
    const input = document.getElementById('inspector-sql-input');
    const query = input?.value.trim();
    if (!query) return this.showToast('Please enter a SQL query');

    const btn = document.getElementById('btn-inspect-only');
    if (btn) btn.disabled = true;

    try {
      const res = await fetch(`${this.state.apiBase}/api/proxy/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (res.ok) {
        const data = await res.json();
        this.renderInspectionIntelligence(data);
        this.showToast('Inspection completed (Execution Gated)');
      } else {
        const err = await res.json();
        this.showToast(err.detail || 'Inspection failed');
      }
    } catch (e) {
      this.showToast('Inspection request failed');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async executeProxyQuery() {
    const input = document.getElementById('inspector-sql-input');
    const query = input?.value.trim();
    if (!query) return this.showToast('Please enter a SQL query');

    const session_id = document.getElementById('inspector-session-id')?.value || 'default_session';
    const btn = document.getElementById('btn-execute-proxy');
    if (btn) btn.disabled = true;

    try {
      const res = await fetch(`${this.state.apiBase}/api/proxy/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, session_id })
      });
      const data = await res.json();
      this.renderInspectionIntelligence(data);
      this.renderExecutionOutput(data);
      await this.loadEvents();
      await this.loadHistory();
      await this.fetchStatus();
    } catch (e) {
      this.showToast('Execution request failed');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  renderInspectionIntelligence(d) {
    const decision = d.decision?.decision || d.decision || 'ALLOW';
    const score = d.risk_score !== undefined ? d.risk_score : (d.decision?.risk_score || 0);
    const reasons = d.reasons || d.decision?.reasons || [];
    const latency = d.analysis_latency_ms || d.execution_latency_ms || 1.1;

    // Badges & Score
    const badge = document.getElementById('analysis-decision-badge');
    const scoreEl = document.getElementById('analysis-score-text');
    const meter = document.getElementById('analysis-meter-fill');

    if (badge) {
      badge.className = `decision-badge ${decision}`;
      badge.textContent = decision;
    }
    if (scoreEl) scoreEl.textContent = `${score} / 100`;

    // Meter Width & Color
    if (meter) {
      meter.style.width = `${Math.max(4, score)}%`;
      meter.className = 'risk-meter-fill ' + (
        score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low'
      );
    }

    // Factors & Explanations List
    const fList = document.getElementById('analysis-factors-list');
    if (fList) {
      if (reasons.length === 0) {
        fList.innerHTML = `<div class="factor-item">Query conforms with active policies. No security violations triggered.</div>`;
      } else {
        fList.innerHTML = reasons.map(r => `
          <div class="factor-item ${decision === 'BLOCK' ? 'critical' : ''}">
            <strong>&bull;</strong> ${escapeHtml(r)}
          </div>
        `).join('');
      }
    }

    // Telemetry
    const tLat = document.getElementById('telemetry-latency');
    const tPol = document.getElementById('telemetry-policy');
    const tUsr = document.getElementById('telemetry-user');
    if (tLat) tLat.textContent = `${latency} ms`;
    if (tPol) tPol.textContent = this.state.status?.active_policy?.name || 'Balanced Privacy';
    if (tUsr) tUsr.textContent = this.state.status?.authenticated_user?.username || 'sec_admin';
  },

  renderExecutionOutput(res) {
    const box = document.getElementById('inspector-results-box');
    const content = document.getElementById('inspector-results-content');
    if (!box || !content) return;

    box.style.display = 'block';

    if (res.blocked) {
      content.innerHTML = `
        <div style="background-color:var(--danger-red-bg); border:1px solid var(--danger-red-border); color:var(--danger-muted-red); padding:14px; border-radius:var(--radius-sm);">
          <strong style="display:block; margin-bottom:4px;">Execution Prevented by Policy Gate (BLOCK)</strong>
          <p style="font-size:12px;">${escapeHtml(res.message || 'Zero records released. Downstream database access was strictly isolated.')}</p>
        </div>
      `;
    } else if (res.success && res.rows) {
      const dp = res.differential_privacy;
      const count = res.row_count || res.rows.length;
      let tableHtml = '';

      if (res.columns && res.columns.length > 0 && res.rows.length > 0) {
        tableHtml = `
          <div class="table-responsive" style="margin-top:10px; max-height:240px; overflow-y:auto;">
            <table class="custom-table">
              <thead><tr>${res.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
              <tbody>
                ${res.rows.slice(0, 10).map(r => `<tr>${res.columns.map(c => `<td>${escapeHtml(String(r[c] ?? ''))}</td>`).join('')}</tr>`).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      content.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; margin-bottom:8px;">
          <span>Retrieved: <strong>${count} records</strong> (${res.execution_latency_ms}ms)</span>
          ${dp ? `<span class="decision-badge RESTRICT">Laplace Perturbation (&epsilon;=${dp.epsilon})</span>` : ''}
        </div>
        ${tableHtml || '<div style="color:var(--text-secondary); font-size:12px;">Query executed successfully with 0 rows returned.</div>'}
      `;
    } else {
      content.innerHTML = `<div style="color:var(--danger-muted-red); font-size:12px;">Error: ${escapeHtml(res.error || 'Execution failed')}</div>`;
    }
  },

  // ---------------------------------------------------------------------------
  // Security Events & Investigation Drawer
  // ---------------------------------------------------------------------------
  async loadEvents() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/events?limit=50`);
      if (res.ok) {
        const d = await res.json();
        this.state.recentEvents = d.events || [];
        this.renderOverviewEventsTable();
        this.renderFullEventsTable();
        this.renderThreatsTable();
      }
    } catch (e) {
      console.warn('Events load error:', e);
    }
  },

  renderOverviewEventsTable() {
    const tbody = document.getElementById('overview-events-tbody');
    if (!tbody) return;

    if (this.state.recentEvents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:20px;">No events recorded. Run queries via SQL Inspector to generate security telemetry.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.state.recentEvents.slice(0, 6).map(e => `
      <tr onclick="App.openEventDrawer('${e.id}')">
        <td style="font-family:var(--font-mono); font-size:11px;">${e.timestamp}</td>
        <td><strong style="color:var(--forest-deep);">${e.id}</strong></td>
        <td>${escapeHtml(e.database || 'healthcare')}</td>
        <td>${escapeHtml(e.event_type.replace(/_/g, ' '))}</td>
        <td><span class="risk-pill ${e.risk_score >= 75 ? 'critical' : e.risk_score >= 50 ? 'high' : 'low'}">${e.risk_score}</span></td>
        <td><span class="decision-badge ${e.decision}">${e.decision}</span></td>
        <td><a style="color:var(--sage-dark); font-weight:600; text-decoration:none;">Inspect &rarr;</a></td>
      </tr>
    `).join('');
  },

  renderFullEventsTable() {
    const tbody = document.getElementById('events-full-tbody');
    if (!tbody) return;

    if (this.state.recentEvents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--text-muted); padding:20px;">No security events recorded.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.state.recentEvents.map(e => `
      <tr onclick="App.openEventDrawer('${e.id}')">
        <td><strong>${e.id}</strong></td>
        <td style="font-family:var(--font-mono); font-size:11px;">${e.timestamp}</td>
        <td>${escapeHtml(e.event_type.replace(/_/g, ' '))}</td>
        <td><span class="risk-pill ${e.severity === 'CRITICAL' ? 'critical' : 'moderate'}">${e.severity}</span></td>
        <td><span class="decision-badge ${e.decision}">${e.decision}</span></td>
        <td><span class="risk-pill ${e.risk_score >= 75 ? 'critical' : 'low'}">${e.risk_score}</span></td>
        <td style="font-family:var(--font-mono); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(e.query)}</td>
      </tr>
    `).join('');
  },

  renderThreatsTable() {
    const tbody = document.getElementById('threats-tbody');
    if (!tbody) return;

    const threatEvents = this.state.recentEvents.filter(e => e.decision !== 'ALLOW');
    if (threatEvents.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">No active threat incidents detected.</td></tr>`;
      return;
    }

    tbody.innerHTML = threatEvents.map(e => `
      <tr onclick="App.openEventDrawer('${e.id}')">
        <td><strong>${e.id}</strong></td>
        <td>${escapeHtml(e.event_type.replace(/_/g, ' '))}</td>
        <td><span class="risk-pill ${e.severity === 'CRITICAL' ? 'critical' : 'high'}">${e.severity}</span></td>
        <td>${escapeHtml(e.database || 'healthcare')}</td>
        <td style="max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml((e.reasons || [])[0] || 'Inference attack vector')}</td>
        <td><span class="decision-badge ${e.decision}">${e.decision}</span></td>
      </tr>
    `).join('');
  },

  openEventDrawer(eventId) {
    const e = this.state.recentEvents.find(x => x.id === eventId);
    if (!e) return;

    const drawer = document.getElementById('detail-drawer');
    const body = document.getElementById('drawer-body');
    const title = document.getElementById('drawer-title');

    if (title) title.textContent = `Security Investigation: ${e.id}`;
    if (body) {
      body.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-ivory); border-radius:var(--radius-sm);">
          <div>
            <span style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">Enforcement Decision:</span>
            <div style="margin-top:2px;"><span class="decision-badge ${e.decision}">${e.decision}</span></div>
          </div>
          <div>
            <span style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">Severity:</span>
            <div style="font-size:13px; font-weight:700; color:var(--forest-deep);">${e.severity}</div>
          </div>
          <div>
            <span style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">Risk Score:</span>
            <div style="font-size:16px; font-weight:700; font-family:var(--font-mono);">${e.risk_score} / 100</div>
          </div>
        </div>

        <div>
          <label style="font-size:11.5px; font-weight:700; color:var(--forest-deep); display:block; margin-bottom:4px;">Intercepted SQL Statement:</label>
          <pre style="background:#FAF9F6; border:1px solid var(--border-subtle); padding:12px; border-radius:var(--radius-sm); font-family:var(--font-mono); font-size:11.5px; white-space:pre-wrap; word-break:break-all;">${escapeHtml(e.query)}</pre>
        </div>

        <div>
          <label style="font-size:11.5px; font-weight:700; color:var(--forest-deep); display:block; margin-bottom:4px;">Threat Reasoning &amp; Factors:</label>
          <div class="factors-list">
            ${(e.reasons || []).map(r => `<div class="factor-item critical"><strong>&bull;</strong> ${escapeHtml(r)}</div>`).join('')}
          </div>
        </div>

        <div style="font-size:11.5px; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px; padding-top:10px; border-top:1px solid var(--border-subtle);">
          <div>Principal User: <strong style="color:var(--text-primary);">${escapeHtml(e.user || 'sec_admin')} (${e.role || 'admin'})</strong></div>
          <div>Target Database: <strong style="color:var(--text-primary);">${escapeHtml(e.database || 'healthcare')}</strong></div>
          <div>Timestamp (UTC): <strong style="color:var(--text-primary);">${e.timestamp}</strong></div>
        </div>
      `;
    }

    if (drawer) drawer.classList.add('active');
  },

  closeDrawer() {
    const drawer = document.getElementById('detail-drawer');
    if (drawer) drawer.classList.remove('active');
  },

  async clearEvents() {
    try {
      await fetch(`${this.state.apiBase}/api/events/clear`, { method: 'DELETE' });
      this.state.recentEvents = [];
      this.renderOverviewEventsTable();
      this.renderFullEventsTable();
      this.renderThreatsTable();
      await this.fetchStatus();
      this.showToast('Security events cleared');
    } catch (e) {
      this.showToast('Failed to clear events');
    }
  },

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------
  async loadHistory() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/history`);
      if (res.ok) {
        const d = await res.json();
        this.state.history = d.history || [];
        this.renderHistoryTable();
      }
    } catch (e) {
      console.warn('History load error:', e);
    }
  },

  renderHistoryTable() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;

    if (this.state.history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">No queries executed in current session sequence.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.state.history.map((h, i) => `
      <tr>
        <td><strong>#${this.state.history.length - i}</strong></td>
        <td style="font-family:var(--font-mono); font-size:11px;">${h.timestamp ? new Date(h.timestamp * 1000).toLocaleTimeString() : 'Recent'}</td>
        <td style="font-family:var(--font-mono); font-size:11.5px; max-width:350px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(h.query)}</td>
        <td><span class="decision-badge ${h.decision}">${h.decision}</span></td>
        <td>${h.estimated_rows !== undefined ? `${h.estimated_rows} rows` : 'N/A'}</td>
        <td><a style="color:var(--sage-dark); font-weight:600; cursor:pointer;" onclick="App.reinspectHistoryQuery('${escapeHtml(h.query).replace(/'/g, "\\'")}')">Inspect</a></td>
      </tr>
    `).join('');
  },

  reinspectHistoryQuery(sql) {
    this.navigateTo('inspector');
    const input = document.getElementById('inspector-sql-input');
    if (input) input.value = sql;
    this.showToast('Query loaded into inspector');
  },

  async clearHistory() {
    try {
      await fetch(`${this.state.apiBase}/api/history/clear`, { method: 'DELETE' });
      this.state.history = [];
      this.renderHistoryTable();
      this.showToast('Session query sequence reset');
    } catch (e) {
      this.showToast('Failed to clear history');
    }
  },

  // ---------------------------------------------------------------------------
  // Governance: Connections, Policies, Users, Audit
  // ---------------------------------------------------------------------------
  async loadConnections() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/connections`);
      if (res.ok) {
        const d = await res.json();
        this.state.connections = d.connections || [];
        this.renderConnectionsTable(d.active_connection_id);
      }
    } catch (e) {
      console.warn('Connections load error:', e);
    }
  },

  renderConnectionsTable(activeId) {
    const tbody = document.getElementById('connections-tbody');
    if (!tbody) return;

    tbody.innerHTML = this.state.connections.map(c => `
      <tr>
        <td><code style="font-family:var(--font-mono); font-size:11px;">${c.id}</code></td>
        <td><strong>${escapeHtml(c.name)}</strong></td>
        <td>${escapeHtml(c.engine)}</td>
        <td>${escapeHtml(c.sector)}</td>
        <td><span class="decision-badge ALLOW">${c.status}</span></td>
        <td>${c.tls_enabled ? 'TLS 1.3' : 'Local'}</td>
        <td>
          ${c.id === activeId 
            ? '<span style="color:var(--forest-deep); font-weight:700;">&bull; Active Connection</span>' 
            : `<button class="btn btn-secondary btn-subtle" onclick="App.onDatabaseChange('${c.id}')">Switch Target</button>`
          }
        </td>
      </tr>
    `).join('');
  },

  async onDatabaseChange(dbId, notify = true) {
    try {
      const res = await fetch(`${this.state.apiBase}/api/connections/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: dbId })
      });
      if (res.ok) {
        await this.fetchStatus();
        await this.loadConnections();
        if (notify) this.showToast(`Switched active database to ${dbId}`);
      }
    } catch (e) {
      this.showToast('Failed to switch database');
    }
  },

  async loadPolicies() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/policies`);
      if (res.ok) {
        const d = await res.json();
        this.state.policies = d.policies || [];
        this.renderPoliciesTable(d.active_policy_id);
      }
    } catch (e) {
      console.warn('Policies load error:', e);
    }
  },

  renderPoliciesTable(activePolicyId) {
    const tbody = document.getElementById('policies-tbody');
    if (!tbody) return;

    tbody.innerHTML = this.state.policies.map(p => `
      <tr>
        <td><code>${p.id}</code></td>
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>k &ge; ${p.min_cell_size}</td>
        <td>${p.differencing_threshold * 100}% delta</td>
        <td>&epsilon; &le; ${p.epsilon_budget_max}</td>
        <td>${p.id === activePolicyId ? '<span class="decision-badge ALLOW">Active</span>' : '<span style="color:var(--text-muted);">Available</span>'}</td>
        <td>
          ${p.id === activePolicyId 
            ? '<span style="font-weight:700; color:var(--forest-deep);">&bull; Enforced</span>' 
            : `<button class="btn btn-secondary btn-subtle" onclick="App.onPolicyChange('${p.id}')">Apply</button>`
          }
        </td>
      </tr>
    `).join('');
  },

  async onPolicyChange(policyId) {
    try {
      const res = await fetch(`${this.state.apiBase}/api/policies/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy_id: policyId })
      });
      if (res.ok) {
        await this.fetchStatus();
        await this.loadPolicies();
        this.showToast(`Security Policy Applied: ${policyId}`);
      }
    } catch (e) {
      this.showToast('Policy switch failed');
    }
  },

  async loadUsers() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/auth/users`);
      if (res.ok) {
        const d = await res.json();
        this.state.users = d.users || [];
        this.renderUsersTable();
      }
    } catch (e) {
      console.warn('Users load error:', e);
    }
  },

  renderUsersTable() {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    const currentUsername = this.state.status?.authenticated_user?.username || 'sec_admin';

    tbody.innerHTML = this.state.users.map(u => `
      <tr>
        <td><strong>${u.username}</strong></td>
        <td>${escapeHtml(u.name)}</td>
        <td><span class="decision-badge ALLOW">${u.role}</span></td>
        <td>${escapeHtml(u.department)}</td>
        <td><code style="font-size:11px;">${(u.clearance_levels || []).join(', ')}</code></td>
        <td>
          ${u.username === currentUsername 
            ? '<span style="font-weight:700; color:var(--forest-deep);">&bull; Logged In</span>'
            : `<button class="btn btn-secondary btn-subtle" onclick="App.switchUserPersona('${u.username}')">Assume Role</button>`
          }
        </td>
      </tr>
    `).join('');
  },

  async switchUserPersona(username) {
    try {
      const res = await fetch(`${this.state.apiBase}/api/auth/switch-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (res.ok) {
        await this.fetchStatus();
        this.renderUsersTable();
        this.showToast(`Assumed Persona: ${username}`);
      }
    } catch (e) {
      this.showToast('Failed to switch user');
    }
  },

  openUserSwitcherModal() {
    this.navigateTo('access');
  },

  async loadAuditLogs() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/audit?limit=25`);
      if (res.ok) {
        const d = await res.json();
        this.state.auditLogs = d.logs || [];
        this.renderAuditTable();
      }
    } catch (e) {
      console.warn('Audit logs load error:', e);
    }
  },

  renderAuditTable() {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;

    if (this.state.auditLogs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">No audit records.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.state.auditLogs.map(l => `
      <tr>
        <td><strong>#${l.index}</strong></td>
        <td style="font-family:var(--font-mono); font-size:11px;">${l.timestamp}</td>
        <td>${escapeHtml(l.user)}</td>
        <td>${escapeHtml(l.event_type)}</td>
        <td><span class="decision-badge ${l.decision}">${l.decision}</span></td>
        <td><code style="font-family:var(--font-mono); font-size:10px; color:var(--forest-deep);">${(l.hash || '').substring(0, 24)}...</code></td>
      </tr>
    `).join('');
  },

  async verifyAuditLedger() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/audit/verify`);
      if (res.ok) {
        const d = await res.json();
        if (d.valid) {
          this.showToast(`Verification PASSED: SHA-256 chain intact across ${d.count} records.`);
        } else {
          this.showToast(`WARNING: Hash mismatch at index #${d.broken_index}!`);
        }
      }
    } catch (e) {
      this.showToast('Cryptographic audit verification failed');
    }
  },

  async loadAnalytics() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/analytics/investigation`);
      if (res.ok) {
        const d = await res.json();
        this.state.analytics = d;
        this.renderAnalytics(d);
      }
    } catch (e) {
      console.warn('Analytics load error:', e);
    }
  },

  renderAnalytics(d) {
    // Decision breakdown bars
    const cBox = document.getElementById('analytics-decisions-chart');
    if (cBox && d.decision_breakdown) {
      const total = Object.values(d.decision_breakdown).reduce((a, b) => a + b, 0) || 1;
      cBox.innerHTML = Object.entries(d.decision_breakdown).map(([k, count]) => {
        const pct = Math.round((count / total) * 100);
        return `
          <div>
            <div style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:3px;">
              <span><strong>${k}</strong></span>
              <span>${count} (${pct}%)</span>
            </div>
            <div class="risk-meter-bar-track">
              <div class="risk-meter-fill ${k === 'BLOCK' ? 'critical' : k === 'WARN' ? 'moderate' : 'low'}" style="width:${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }

    // DP budget
    const dpFill = document.getElementById('dp-budget-fill');
    const dpSpent = document.getElementById('dp-spent-label');
    if (dpFill && d.summary) {
      dpFill.style.width = `${d.summary.dp_budget_percent}%`;
    }
    if (dpSpent && d.summary) {
      dpSpent.textContent = `${d.summary.dp_budget_spent} \u03B5`;
    }
  },

  // ---------------------------------------------------------------------------
  // Dataset Schema Explorer & Preview
  // ---------------------------------------------------------------------------
  async loadDatasets() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/datasets`);
      if (res.ok) {
        const d = await res.json();
        this.state.datasets = d.datasets || [];
        this.renderDatasets(this.state.datasets);
      }
    } catch (e) {
      console.warn('Datasets load error:', e);
    }
  },

  renderDatasets(datasets) {
    const container = document.getElementById('datasets-container');
    if (!container) return;

    if (!datasets || datasets.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); grid-column:1/-1;">No dataset sectors available.</div>`;
      return;
    }

    container.innerHTML = datasets.map(ds => `
      <div class="dataset-card">
        <div class="dataset-card-header">
          <div>
            <div class="section-badge" style="margin-bottom:4px;">${escapeHtml(ds.compliance)}</div>
            <h4 style="font-size:14px; font-weight:700; color:var(--forest-deep);">${escapeHtml(ds.sector)}</h4>
            <p style="font-size:11.5px; color:var(--text-secondary); margin-top:2px;">${escapeHtml(ds.description)}</p>
          </div>
          <span class="decision-badge ALLOW">${ds.id.toUpperCase()}</span>
        </div>

        <div style="font-size:11px; padding:6px 10px; background:var(--surface-sage-subtle); border-radius:var(--radius-xs); border:1px solid var(--border-subtle); color:var(--forest-deep);">
          <strong>Honeytoken Decoy:</strong> ${escapeHtml(ds.canary_record || 'Active')}
        </div>

        <div class="dataset-table-list">
          ${(ds.tables || []).map(tbl => `
            <div class="dataset-table-item">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-family:var(--font-mono); font-weight:700; font-size:12px; color:var(--forest-deep);">
                  &bull; ${escapeHtml(tbl.table_name)}
                </span>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="font-size:11px; color:var(--text-secondary);">${tbl.row_count} rows</span>
                  <button class="btn btn-secondary btn-subtle" style="font-size:10.5px; padding:2px 8px;" onclick="App.previewTable('${ds.id}', '${tbl.table_name}')">
                    Preview &rarr;
                  </button>
                </div>
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:2px;">
                ${(tbl.columns || []).map(col => `
                  <span class="col-tag ${col.sensitivity}" title="${col.type} - Sensitivity: ${col.sensitivity}">
                    ${escapeHtml(col.name)}
                  </span>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  },

  async previewTable(sector, table) {
    try {
      const res = await fetch(`${this.state.apiBase}/api/datasets/${sector}/preview/${table}`);
      if (res.ok) {
        const d = await res.json();
        this.openDatasetPreviewModal(d);
      } else {
        this.showToast('Unable to load table preview');
      }
    } catch (e) {
      this.showToast('Failed to preview dataset table');
    }
  },

  openDatasetPreviewModal(data) {
    const modal = document.getElementById('dataset-preview-modal');
    const title = document.getElementById('dataset-preview-title');
    const body = document.getElementById('dataset-preview-body');
    if (!modal || !body) return;

    if (title) title.textContent = `Table Preview: ${data.sector} / ${data.table} (Top 10 Records)`;

    const cols = data.columns || [];
    const rows = data.rows || [];

    body.innerHTML = `
      <div class="table-responsive" style="max-height:360px; overflow-y:auto;">
        <table class="custom-table">
          <thead><tr>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map(r => `<tr>${cols.map(c => `<td>${escapeHtml(String(r[c] ?? ''))}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;

    modal.classList.add('active');
  },

  closeDatasetPreviewModal() {
    const modal = document.getElementById('dataset-preview-modal');
    if (modal) modal.classList.remove('active');
  },

  // ---------------------------------------------------------------------------
  // PostgreSQL Integration
  // ---------------------------------------------------------------------------
  async checkPgStatus() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/pg/status`);
      if (res.ok) {
        const d = await res.json();
        this.state.pgStatus = d;
        const statEl = document.getElementById('pg-status-summary');
        if (statEl) {
          statEl.innerHTML = `
            <div>Target Host: <strong>${d.host}:${d.port}</strong></div>
            <div>Database: <strong>${d.db}</strong></div>
            <div>Service User: <strong>${d.user}</strong></div>
            <div>PostgreSQL State: <strong style="color:${d.configured ? 'var(--sage-dark)' : 'var(--amber-warning)'};">${d.configured ? 'Active Credentials' : 'Local / Simulated'}</strong></div>
          `;
        }
      }
    } catch (e) {
      console.warn('PG status error:', e);
    }
  },

  async testPgConnection() {
    const resBox = document.getElementById('pg-test-result');
    if (resBox) resBox.innerHTML = '<span style="color:var(--text-secondary);">Testing connection...</span>';
    try {
      const res = await fetch(`${this.state.apiBase}/api/pg/test`, { method: 'POST' });
      const d = await res.json();
      if (resBox) {
        if (d.healthy) {
          resBox.innerHTML = `<span style="color:var(--sage-dark); font-weight:700;">&check; Healthy (${d.latency_ms}ms) &bull; Connected to ${d.db}</span>`;
        } else {
          resBox.innerHTML = `<span style="color:var(--amber-warning); font-weight:600;">&bull; Offline / Simulated (${escapeHtml(d.error || 'Database unreachable')})</span>`;
        }
      }
    } catch (e) {
      if (resBox) resBox.innerHTML = '<span style="color:var(--danger-muted-red);">Test request failed</span>';
    }
  },

  async inspectPgQueryOnly() {
    const sql = document.getElementById('pg-sql-input')?.value.trim();
    if (!sql) return this.showToast('Please enter a SQL query');

    const btn = document.getElementById('btn-pg-inspect');
    if (btn) btn.disabled = true;
    try {
      const res = await fetch(`${this.state.apiBase}/api/pg/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      });
      if (!res.ok) return this.showToast('PostgreSQL analysis failed');
      const data = await res.json();
      this.renderInspectionIntelligence(data);
      this.showToast(data.query_is_approved
        ? 'PostgreSQL analysis completed (no database query executed)'
        : 'PostgreSQL query is outside the approved demo profile');
    } catch (e) {
      this.showToast('PostgreSQL analysis request failed');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async runPgQuery() {
    const input = document.getElementById('pg-sql-input');
    const sql = input?.value.trim();
    if (!sql) return this.showToast('Please enter a SQL query');

    const resultsBox = document.getElementById('pg-query-results');
    if (resultsBox) resultsBox.innerHTML = '<div style="font-size:12px; color:var(--text-secondary);">Executing query through security gate...</div>';

    try {
      const res = await fetch(`${this.state.apiBase}/api/pg/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql })
      });
      const d = await res.json();
      if (resultsBox) {
        if (d.blocked) {
          resultsBox.innerHTML = `
            <div style="background-color:var(--danger-red-bg); border:1px solid var(--danger-red-border); color:var(--danger-muted-red); padding:10px; border-radius:var(--radius-sm); font-size:12px;">
              <strong>Policy Gate BLOCK:</strong> ${escapeHtml(d.message || 'Execution prohibited by inference engine.')}
            </div>
          `;
        } else if (d.executed) {
          resultsBox.innerHTML = `
            <div style="background-color:var(--success-green-bg); border:1px solid var(--success-green-border); color:var(--success-green); padding:10px; border-radius:var(--radius-sm); font-size:12px;">
              <strong>Executed:</strong> Retrieved ${d.row_count} rows in ${d.execution_ms}ms (Decision: ${d.decision})
            </div>
          `;
        } else {
          resultsBox.innerHTML = `
            <div style="background-color:var(--amber-warning-bg); border:1px solid var(--amber-warning-border); color:var(--amber-warning); padding:10px; border-radius:var(--radius-sm); font-size:12px;">
              <strong>Notice:</strong> ${escapeHtml(d.message || d.remediation || 'Query could not be executed.')}
            </div>
          `;
        }
      }
    } catch (e) {
      if (resultsBox) resultsBox.innerHTML = '<div style="font-size:12px; color:var(--danger-muted-red);">Query request failed</div>';
    }
  },

  filterEvents(searchTerm) {
    const term = (searchTerm || '').toLowerCase();
    const rows = document.querySelectorAll('#events-full-tbody tr');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(term) ? '' : 'none';
    });
  },

  // ---------------------------------------------------------------------------
  // Utility Toast Notification
  // ---------------------------------------------------------------------------
  showToast(msg) {
    const hub = document.getElementById('toast-hub');
    if (!hub) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>&bull;</span> <span>${escapeHtml(msg)}</span>`;
    hub.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.2s';
      setTimeout(() => toast.remove(), 200);
    }, 2800);
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.addEventListener('DOMContentLoaded', () => {
  App.init();
});
