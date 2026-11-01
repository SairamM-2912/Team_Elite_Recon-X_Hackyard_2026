/**
 * RECON-X Enterprise Database Security Platform
 * Professional Application Controller
 */

const App = {
  state: {
    status: null,
    scenarios: [],
    recentEvents: [],
    eventLoadError: false,
    history: [],
    historySessionId: null,
    historyLoadError: false,
    policies: [],
    access: null,
    auditLogs: [],
    analytics: null,
    datasets: [],
    pgStatus: null,
    pgQueryRequestId: 0,
    currentView: 'overview',
    navigationTarget: null,
    navigationScrollTimer: null,
    apiBase: ''
  },

  async init(apiBase = '') {
    this.state.apiBase = apiBase;
    this.initSqlEditor();
    await this.refreshPostgresData();
    this.initScrollSpy();
  },

  initSqlEditor() {
    const input = document.getElementById('pg-sql-input');
    const highlight = document.getElementById('sql-editor-highlight');
    if (!input || !highlight) return;
    const update = () => {
      this.updateSqlHighlight(input, highlight);
      highlight.scrollTop = input.scrollTop;
      highlight.scrollLeft = input.scrollLeft;
    };
    input.addEventListener('input', update);
    input.addEventListener('scroll', update);
    update();
  },

  updateSqlHighlight(input, highlight) {
    const sql = input.value;
    const tokenPattern = /(--[^\r\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|\b(?:SELECT|COUNT|FROM|WHERE|AND|OR|NOT|AS|DISTINCT|GROUP|BY|ORDER|LIMIT|OFFSET|HAVING|JOIN|INNER|LEFT|RIGHT|ON|IS|NULL|IN|LIKE|BETWEEN|CASE|WHEN|THEN|ELSE|END|ASC|DESC|TRUE|FALSE)\b|\b\d+(?:\.\d+)?\b)/gi;
    let cursor = 0;
    let html = '';
    for (const match of sql.matchAll(tokenPattern)) {
      const token = match[0];
      html += escapeHtml(sql.slice(cursor, match.index));
      const type = token.startsWith('--') || token.startsWith('/*')
        ? 'comment'
        : token.startsWith("'") || token.startsWith('"')
          ? 'string'
          : /^\d/.test(token)
            ? 'number'
            : 'keyword';
      html += `<span class="sql-token-${type}">${escapeHtml(token)}</span>`;
      cursor = match.index + token.length;
    }
    html += escapeHtml(sql.slice(cursor));
    highlight.innerHTML = `${html || '&nbsp;'}${sql.endsWith('\n') ? '<br>' : ''}`;
  },

  // ---------------------------------------------------------------------------
  // Single-Page Scrolling & Navigation
  // ---------------------------------------------------------------------------
  scrollToSection(sectionId) {
    const el = document.getElementById(sectionId);
    if (!el) return;

    this.closeSidebar();

    this.state.navigationTarget = sectionId;
    clearTimeout(this.state.navigationScrollTimer);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.state.navigationScrollTimer = setTimeout(() => this.finishScrollNavigation(), 180);
    this.updateSidebarActive(sectionId);
  },

  finishScrollNavigation() {
    const sectionId = this.state.navigationTarget;
    if (!sectionId) return;

    clearTimeout(this.state.navigationScrollTimer);
    this.state.navigationTarget = null;
    this.state.navigationScrollTimer = null;
    this.updateSidebarActive(sectionId);
  },

  updateSidebarActive(sectionId) {
    const defaultViews = {
      'section-overview': 'overview',
      'section-monitoring': 'monitoring',
      'section-connections': 'connections',
      'section-audit': 'events',
      'section-policies': 'policies',
      'section-history': 'history',
      'section-workspace': 'workspace',
      'section-timeline': 'timeline',
      'section-sessions': 'sessions'
    };
    const preserveSubView = (
      sectionId === 'section-policies' && ['settings', 'access'].includes(this.state.currentView)
    ) || (
      sectionId === 'section-audit' && this.state.currentView === 'audit'
    ) || (
      sectionId === 'section-connections' && ['datasets', 'pg'].includes(this.state.currentView)
    );
    if (defaultViews[sectionId] && !preserveSubView) {
      this.state.currentView = defaultViews[sectionId];
    }

    document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
      const target = link.getAttribute('data-section') || link.getAttribute('onclick');
      const navView = link.getAttribute('data-nav-view');
      const active = navView
        ? navView === this.state.currentView
        : target && (target.includes(sectionId) || target === sectionId);
      link.classList.toggle('active', Boolean(active));
    });

    const titles = {
      'section-overview': 'Overview',
      'section-monitoring': 'Query Alerts',
      'section-connections': 'Database and Tables',
      'section-audit': this.state.currentView === 'audit' ? 'Audit Log' : 'Security Events',
      'section-policies': this.state.currentView === 'settings' ? 'Settings' : 'Policy Center',
      'section-history': 'Query History',
      'section-workspace': 'Query Lab',
      'section-timeline': 'Attack Timeline',
      'section-sessions': 'Sessions'
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
      timeline: { section: 'section-timeline' },
      sessions: { section: 'section-sessions' },
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
    if (viewId === 'events' || viewId === 'threats' || viewId === 'timeline') this.loadEvents();
    if (viewId === 'history' || viewId === 'sessions') this.loadHistory();
    if (viewId === 'analytics') this.loadAnalytics();
    if (viewId === 'audit') this.loadAuditLogs();
    if (viewId === 'connections') this.loadConnections();
    if (viewId === 'datasets') this.loadDatasets();
    if (viewId === 'policies') this.loadPolicies();
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
    window.addEventListener('scroll', () => {
      if (!this.state.navigationTarget) return;
      clearTimeout(this.state.navigationScrollTimer);
      this.state.navigationScrollTimer = setTimeout(() => this.finishScrollNavigation(), 180);
    }, { passive: true });
    if (!sections.length || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries) => {
      if (this.state.navigationTarget) return;
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
      } else {
        throw new Error('Proxy status unavailable');
      }
    } catch (e) {
      console.warn('Status fetch failed:', e);
      this.state.status = null;
      this.showToast('Could not connect to the server.');
    }
  },

  renderStatus(s) {
    // Topbar connection badge
    const badge = document.getElementById('topbar-connection-badge');
    const nameEl = document.getElementById('topbar-connection-name');
    const latEl = document.getElementById('topbar-connection-latency');
    const togLabel = document.getElementById('topbar-toggle-label');
    const gateState = document.getElementById('gate-state');
    const systemState = document.getElementById('topbar-system-status');
    const systemLabel = document.getElementById('topbar-system-status-label');
    const overviewState = document.getElementById('overview-protection-state');

    if (nameEl) nameEl.textContent = this.state.pgStatus?.db || 'PostgreSQL';
    if (latEl) latEl.textContent = this.state.pgStatus?.healthy
      ? `${this.state.pgStatus.latency_ms}ms`
      : '';
    if (badge) {
      badge.className = `connection-indicator-badge ${this.state.pgStatus?.healthy ? '' : 'disconnected'}`;
    }
    if (togLabel) {
      togLabel.textContent = s.proxy_running ? 'Pause Protection' : 'Resume Protection';
    }
    const proxyToggle = document.getElementById('topbar-proxy-toggle');
    if (proxyToggle) {
      proxyToggle.title = s.proxy_running ? 'Pause protection' : 'Resume protection';
    }
    if (systemLabel) {
      systemLabel.textContent = s.proxy_running ? 'Protection Active' : 'Protection Paused';
    }
    if (systemState) {
      systemState.className = `system-status-badge ${s.proxy_running ? 'is-active' : 'is-paused'}`;
    }
    if (overviewState) {
      overviewState.textContent = s.proxy_running ? 'Active' : 'Paused';
      overviewState.className = `status-indicator ${s.proxy_running ? 'is-active' : 'is-paused'}`;
    }
    if (gateState) {
      gateState.textContent = s.proxy_running ? 'Active' : 'Paused';
      gateState.className = `decision-badge ${s.proxy_running ? 'ALLOW' : 'BLOCK'}`;
    }

    // Update Overview KPIs
    const blockedCount = s.blocked_count || 0;
    const totalEvents = s.events_count || 0;
    const elThreats = document.getElementById('kpi-threats');
    const elHighRisk = document.getElementById('kpi-highrisk');
    const elAvgScore = document.getElementById('kpi-avgscore');
    const elDbStatus = document.getElementById('kpi-dbstatus');
    const elDbEngine = document.getElementById('kpi-dbengine');

    if (elThreats) elThreats.textContent = totalEvents;
    if (elHighRisk) elHighRisk.textContent = this.state.auditLogs.length
      ? this.state.auditLogs.filter(log => Number(log.risk_score) >= 60).length
      : 'No records';
    const riskScores = this.state.auditLogs
      .map(log => Number(log.risk_score))
      .filter(score => Number.isFinite(score));
    if (elAvgScore) elAvgScore.textContent = riskScores.length
      ? (riskScores.reduce((sum, score) => sum + score, 0) / riskScores.length).toFixed(1)
      : 'No records';
    if (elDbStatus) elDbStatus.textContent = this.state.pgStatus?.healthy
      ? 'Connected'
      : 'Not connected';
    if (elDbEngine) elDbEngine.textContent = this.state.pgStatus?.db
      ? `PostgreSQL · ${this.state.pgStatus.db}`
      : 'PostgreSQL';

    // Badges
    const sbEvents = document.getElementById('sidebar-events-count');
    const sbThreats = document.getElementById('sidebar-threats-badge');
    if (sbEvents) sbEvents.textContent = totalEvents;
    if (sbThreats) sbThreats.textContent = blockedCount;

    // Threat view counts
    const tDiff = document.getElementById('threat-stat-differencing');
    const tNarr = document.getElementById('threat-stat-narrowing');
    const tCan = document.getElementById('threat-stat-canary');
    if (tDiff) tDiff.textContent = this.countThreatEvents('differencing_attack', 'DIFFERENCING');
    if (tNarr) tNarr.textContent = this.countThreatEvents('population_narrowing', 'NARROWING');
    if (tCan) tCan.textContent = this.countThreatEvents('canary_tripwire', 'CANARY');
  },

  countThreatEvents(factor, eventType) {
    return this.state.recentEvents.filter(event =>
      event.factors?.[factor] === true || event.event_type?.includes(eventType)
    ).length + ' alerts';
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
        this.showToast(`Protection ${nextState ? 'turned on' : 'paused'}.`);
      }
    } catch (e) {
      this.showToast('Could not change the protection setting.');
    }
  },

  renderInspectionIntelligence(d) {
    const decision = d.decision?.decision || d.decision || 'Unavailable';
    const score = d.risk_score !== undefined ? d.risk_score : (d.decision?.risk_score ?? null);
    const reasons = d.reasons || d.decision?.reasons || [];
    const latency = d.analysis_latency_ms ?? d.execution_latency_ms ?? null;
    const factors = d.factors || d.decision?.factors || {};
    const population = factors.estimated_population_size ?? factors.population_size ?? d.population_size;
    const relatedMatch = d.differencing_match ?? d.decision?.differencing_match ?? factors.differencing_match;
    const relatedDetected = (
      relatedMatch !== null && relatedMatch !== undefined
    ) || factors.differencing_attack === true || factors.progressive_filtering === true;
    const relatedChecksReported = typeof factors.differencing_attack === 'boolean'
      || typeof factors.progressive_filtering === 'boolean';

    // Badges & Score
    const badge = document.getElementById('analysis-decision-badge');
    const scoreEl = document.getElementById('analysis-score-text');
    const meter = document.getElementById('analysis-meter-fill');

    if (badge) {
      badge.className = `decision-badge ${decision}`;
      badge.textContent = decision;
    }
    if (scoreEl) scoreEl.textContent = score === null ? '—' : `${score} / 100`;

    // Meter Width & Color
    if (meter) {
      meter.style.width = score === null ? '0%' : `${Math.max(0, Math.min(100, score))}%`;
      meter.className = 'risk-meter-fill ' + (
        score >= 75 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'low'
      );
    }

    // Factors & Explanations List
    const fList = document.getElementById('analysis-factors-list');
    if (fList) {
      if (reasons.length === 0) {
        fList.innerHTML = '<div class="factor-item">No reasons were given.</div>';
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
    if (tLat) tLat.textContent = latency === null ? 'Unavailable' : `${latency} ms`;
    if (tPol) tPol.textContent = this.state.status?.active_policy?.name || 'Unavailable';
    const populationEl = document.getElementById('query-population-size');
    const relatedEl = document.getElementById('query-related-info');
    if (populationEl) {
      populationEl.textContent = typeof population === 'number' && Number.isFinite(population)
        ? String(population)
        : 'Not reported';
    }
    if (relatedEl) {
      relatedEl.textContent = relatedDetected
        ? 'Pattern detected'
        : relatedChecksReported
          ? 'No pattern detected'
          : 'Not reported';
    }
  },

  resetInspectionIntelligence() {
    const badge = document.getElementById('analysis-decision-badge');
    const score = document.getElementById('analysis-score-text');
    const meter = document.getElementById('analysis-meter-fill');
    const factors = document.getElementById('analysis-factors-list');
    const latency = document.getElementById('telemetry-latency');
    const policy = document.getElementById('telemetry-policy');
    const population = document.getElementById('query-population-size');
    const related = document.getElementById('query-related-info');

    if (badge) {
      badge.className = 'decision-badge';
      badge.textContent = 'Pending';
    }
    if (score) score.textContent = 'Pending';
    if (meter) {
      meter.style.width = '0%';
      meter.className = 'risk-meter-fill low';
    }
    if (factors) factors.innerHTML = '<div class="factor-item">Waiting for the current query analysis.</div>';
    if (latency) latency.textContent = 'Pending';
    if (policy) policy.textContent = 'Unavailable';
    if (population) population.textContent = 'Not reported';
    if (related) related.textContent = 'Not reported';
  },

  // ---------------------------------------------------------------------------
  // Security Events & Investigation Drawer
  // ---------------------------------------------------------------------------
  async loadEvents() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/events?limit=50`);
      if (!res.ok) throw new Error('Security events are not available');
      const d = await res.json();
      this.state.recentEvents = Array.isArray(d.events) ? d.events : [];
      this.state.eventLoadError = false;
      this.renderOverviewEventsTable();
      this.renderFullEventsTable();
      this.renderThreatsTable();
      this.renderAttackTimeline();
      this.renderRiskActivityChart();
      const alertCount = this.state.recentEvents.filter(event => event.decision !== 'ALLOW').length;
      const alertCountEl = document.getElementById('topbar-alert-count');
      if (alertCountEl) alertCountEl.textContent = alertCount;
      if (this.state.status) this.renderStatus(this.state.status);
    } catch (e) {
      console.warn('Events load error:', e);
      this.state.recentEvents = [];
      this.state.eventLoadError = true;
      this.renderOverviewEventsTable();
      this.renderFullEventsTable();
      this.renderThreatsTable();
      this.renderAttackTimeline();
      this.renderRiskActivityChart();
      const alertCountEl = document.getElementById('topbar-alert-count');
      if (alertCountEl) alertCountEl.textContent = '—';
      if (this.state.status) this.renderStatus(this.state.status);
    }
  },

  renderAttackTimeline() {
    const container = document.getElementById('attack-timeline');
    if (!container) return;
    if (this.state.eventLoadError) {
      container.innerHTML = '<div class="pg-query-state error" role="alert">Could not load security events.</div>';
      return;
    }
    if (this.state.recentEvents.length === 0) {
      container.innerHTML = '<div class="pg-query-state" role="status">No security events have been reported.</div>';
      return;
    }

    const factorLabels = {
      canary_tripwire: 'Canary alert',
      differencing_attack: 'Related query pattern',
      progressive_filtering: 'Progressive filters',
      population_narrowing: 'Small group',
      role_privilege_mismatch: 'Role mismatch'
    };
    const chronologicalEvents = this.state.recentEvents.slice().reverse();
    container.innerHTML = chronologicalEvents.map(event => {
      const decision = String(event.decision || 'Unavailable');
      const state = decision === 'ALLOW' ? 'allow' : decision === 'WARN' || decision === 'RESTRICT' ? 'warn' : 'block';
      const riskScore = typeof event.risk_score === 'number' && Number.isFinite(event.risk_score)
        ? `${event.risk_score} / 100`
        : 'Not reported';
      const factors = Object.entries(event.factors || {})
        .filter(([, active]) => active === true)
        .map(([name]) => factorLabels[name] || name.replace(/_/g, ' '));
      const reasons = Array.isArray(event.reasons) ? event.reasons : [];
      return `
        <button class="timeline-item ${state}" type="button" role="listitem" data-event-id="${escapeHtml(String(event.id || ''))}">
          <span class="timeline-marker" aria-hidden="true"></span>
          <span class="timeline-content">
            <span class="timeline-topline">
              <span class="timeline-event-name">${escapeHtml((event.event_type || 'Security event').replace(/_/g, ' '))}</span>
              <span class="decision-badge ${['ALLOW', 'WARN', 'RESTRICT', 'BLOCK'].includes(decision) ? decision : ''}">${escapeHtml(decision)}</span>
            </span>
            <span class="timeline-meta">
              <span>${escapeHtml(String(event.id || 'Event ID unavailable'))}</span>
              <span>${escapeHtml(event.timestamp || 'Time not reported')}</span>
              <span>${escapeHtml(event.user || 'User not reported')}</span>
              <span>Risk ${escapeHtml(riskScore)}</span>
            </span>
            ${factors.length ? `<span class="timeline-tags">${factors.map(factor => `<span class="timeline-tag">${escapeHtml(factor)}</span>`).join('')}</span>` : ''}
            ${reasons.length ? `<span class="timeline-reasons">${reasons.map(reason => `<span>${escapeHtml(reason)}</span>`).join('')}</span>` : ''}
          </span>
        </button>
      `;
    }).join('');
    container.querySelectorAll('.timeline-item').forEach(item => {
      item.addEventListener('click', () => this.openEventDrawer(item.dataset.eventId));
    });
  },

  renderRiskActivityChart() {
    const container = document.getElementById('risk-activity-chart');
    if (!container) return;
    if (this.state.eventLoadError) {
      container.innerHTML = '<div class="pg-query-state error" role="alert">Could not load risk activity.</div>';
      return;
    }

    const events = this.state.recentEvents
      .filter(event => typeof event.risk_score === 'number' && Number.isFinite(event.risk_score))
      .slice()
      .reverse();
    if (events.length === 0) {
      container.innerHTML = '<div class="pg-query-state" role="status">No risk scores have been reported yet.</div>';
      return;
    }

    const width = 760;
    const height = 220;
    const left = 44;
    const right = 18;
    const top = 14;
    const bottom = 30;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;
    const points = events.map((event, index) => {
      const x = events.length === 1 ? left + plotWidth / 2 : left + (index / (events.length - 1)) * plotWidth;
      const score = Math.max(0, Math.min(100, event.risk_score));
      const y = top + ((100 - score) / 100) * plotHeight;
      return { event, x, y };
    });
    const line = points.map(point => `${point.x},${point.y}`).join(' ');
    const grid = [0, 50, 100].map(score => {
      const y = top + ((100 - score) / 100) * plotHeight;
      return `<g class="chart-grid-line"><line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}"></line><text x="0" y="${y + 4}">${score}</text></g>`;
    }).join('');
    const circles = points.map(({ event, x, y }) => `
      <circle class="chart-point" cx="${x}" cy="${y}" r="4">
        <title>${escapeHtml(String(event.id || 'Event'))}: risk ${escapeHtml(String(event.risk_score))} at ${escapeHtml(event.timestamp || 'time not reported')}</title>
      </circle>
    `).join('');
    container.innerHTML = `
      <svg class="risk-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Risk scores from ${points.length} server-reported events">
        ${grid}
        <polyline class="chart-risk-line" points="${line}"></polyline>
        ${circles}
        <text class="chart-axis-caption" x="${left}" y="${height - 5}">Earlier events</text>
        <text class="chart-axis-caption" x="${width - right}" y="${height - 5}" text-anchor="end">Recent events</text>
      </svg>
    `;
  },

  renderOverviewEventsTable() {
    const tbody = document.getElementById('overview-events-tbody');
    if (!tbody) return;

    if (this.state.recentEvents.length === 0) {
      const message = this.state.eventLoadError ? 'Could not load events.' : 'No events yet. Run a query to see activity here.';
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty-state">${message}</td></tr>`;
      return;
    }

    tbody.innerHTML = this.state.recentEvents.slice(0, 6).map(e => `
      <tr onclick="App.openEventDrawer('${e.id}')">
        <td style="font-family:var(--font-mono); font-size:11px;">${e.timestamp}</td>
        <td><strong style="color:var(--forest-deep);">${e.id}</strong></td>
        <td>${escapeHtml(e.database || 'Not recorded')}</td>
        <td>${escapeHtml((e.event_type || 'Not recorded').replace(/_/g, ' '))}</td>
        <td><span class="risk-pill ${e.risk_score >= 75 ? 'critical' : e.risk_score >= 50 ? 'high' : 'low'}">${escapeHtml(String(e.risk_score ?? 'Unavailable'))}</span></td>
        <td><span class="decision-badge ${escapeHtml(e.decision || '')}">${escapeHtml(e.decision || 'Unavailable')}</span></td>
        <td><a style="color:var(--sage-dark); font-weight:600; text-decoration:none;">View &rarr;</a></td>
      </tr>
    `).join('');
  },

  renderFullEventsTable() {
    const tbody = document.getElementById('events-full-tbody');
    if (!tbody) return;

    if (this.state.recentEvents.length === 0) {
      const message = this.state.eventLoadError ? 'Could not load events.' : 'No events yet.';
      tbody.innerHTML = `<tr><td colspan="7" class="table-empty-state">${message}</td></tr>`;
      return;
    }

    tbody.innerHTML = this.state.recentEvents.map(e => `
      <tr data-decision="${escapeHtml(e.decision || '')}" data-severity="${escapeHtml(e.severity || '')}" onclick="App.openEventDrawer('${e.id}')">
        <td><strong>${e.id}</strong></td>
        <td style="font-family:var(--font-mono); font-size:11px;">${e.timestamp}</td>
        <td>${escapeHtml((e.event_type || 'Not recorded').replace(/_/g, ' '))}</td>
        <td><span class="risk-pill ${e.severity === 'CRITICAL' ? 'critical' : 'moderate'}">${escapeHtml(e.severity || 'Unavailable')}</span></td>
        <td><span class="decision-badge ${escapeHtml(e.decision || '')}">${escapeHtml(e.decision || 'Unavailable')}</span></td>
        <td><span class="risk-pill ${e.risk_score >= 75 ? 'critical' : 'low'}">${escapeHtml(String(e.risk_score ?? 'Unavailable'))}</span></td>
        <td style="font-family:var(--font-mono); max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(e.query || 'Not recorded')}</td>
      </tr>
    `).join('');
    this.filterEvents();
  },

  renderThreatsTable() {
    const tbody = document.getElementById('threats-tbody');
    if (!tbody) return;

    const threatEvents = this.state.recentEvents.filter(e => e.decision !== 'ALLOW');
    if (threatEvents.length === 0) {
      const message = this.state.eventLoadError ? 'Could not load alerts.' : 'No alerts found.';
      tbody.innerHTML = `<tr><td colspan="6" class="table-empty-state">${message}</td></tr>`;
      return;
    }

    tbody.innerHTML = threatEvents.map(e => `
      <tr onclick="App.openEventDrawer('${e.id}')">
        <td><strong>${e.id}</strong></td>
        <td>${escapeHtml((e.event_type || 'Not recorded').replace(/_/g, ' '))}</td>
        <td><span class="risk-pill ${e.severity === 'CRITICAL' ? 'critical' : 'high'}">${escapeHtml(e.severity || 'Unavailable')}</span></td>
        <td>${escapeHtml(e.database || 'Not recorded')}</td>
        <td style="max-width:260px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml((e.reasons || [])[0] || 'No reason provided')}</td>
        <td><span class="decision-badge ${escapeHtml(e.decision || '')}">${escapeHtml(e.decision || 'Unavailable')}</span></td>
      </tr>
    `).join('');
  },

  openEventDrawer(eventId) {
    const e = this.state.recentEvents.find(x => x.id === eventId);
    if (!e) return;

    const drawer = document.getElementById('detail-drawer');
    const body = document.getElementById('drawer-body');
    const title = document.getElementById('drawer-title');

    if (title) title.textContent = `Event Details: ${e.id}`;
    if (body) {
      body.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px; background:var(--bg-ivory); border-radius:var(--radius-sm);">
          <div>
            <span style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">Result:</span>
            <div style="margin-top:2px;"><span class="decision-badge ${escapeHtml(e.decision || '')}">${escapeHtml(e.decision || 'Unavailable')}</span></div>
          </div>
          <div>
            <span style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">Severity:</span>
            <div style="font-size:13px; font-weight:700; color:var(--forest-deep);">${escapeHtml(e.severity || 'Unavailable')}</div>
          </div>
          <div>
            <span style="font-size:11px; color:var(--text-secondary); text-transform:uppercase;">Risk Score:</span>
            <div style="font-size:16px; font-weight:700; font-family:var(--font-mono);">${escapeHtml(String(e.risk_score ?? 'Unavailable'))} / 100</div>
          </div>
        </div>

        <div>
          <label style="font-size:11.5px; font-weight:700; color:var(--forest-deep); display:block; margin-bottom:4px;">Query:</label>
          <pre style="background:#FAF9F6; border:1px solid var(--border-subtle); padding:12px; border-radius:var(--radius-sm); font-family:var(--font-mono); font-size:11.5px; white-space:pre-wrap; word-break:break-all;">${escapeHtml(e.query || 'Not recorded')}</pre>
        </div>

        <div>
          <label style="font-size:11.5px; font-weight:700; color:var(--forest-deep); display:block; margin-bottom:4px;">Why this happened:</label>
          <div class="factors-list">
            ${(e.reasons || []).map(r => `<div class="factor-item critical"><strong>&bull;</strong> ${escapeHtml(r)}</div>`).join('') || '<div class="factor-item">No reason was given.</div>'}
          </div>
        </div>

        <div style="font-size:11.5px; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px; padding-top:10px; border-top:1px solid var(--border-subtle);">
          <div>Event: <strong style="color:var(--text-primary);">${escapeHtml((e.event_type || 'Not reported').replace(/_/g, ' '))}</strong></div>
          <div>User: <strong style="color:var(--text-primary);">${escapeHtml(e.user || 'Not recorded')} (${escapeHtml(e.role || 'Not recorded')})</strong></div>
          <div>Database: <strong style="color:var(--text-primary);">${escapeHtml(e.database || 'Not recorded')}</strong></div>
          <div>Time (UTC): <strong style="color:var(--text-primary);">${escapeHtml(e.timestamp || 'Not recorded')}</strong></div>
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
      this.showToast('Events cleared.');
    } catch (e) {
      this.showToast('Could not clear events.');
    }
  },

  // ---------------------------------------------------------------------------
  // History
  // ---------------------------------------------------------------------------
  async loadHistory() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/history?session_id=pg_default_session`);
      if (!res.ok) throw new Error('Query history is not available');
      const d = await res.json();
      this.state.history = Array.isArray(d.history) ? d.history : [];
      this.state.historySessionId = typeof d.session_id === 'string' ? d.session_id : null;
      this.state.historyLoadError = false;
      this.renderHistoryTable();
      this.renderSessionSummary(d.query_count);
    } catch (e) {
      console.warn('History load error:', e);
      this.state.history = [];
      this.state.historySessionId = null;
      this.state.historyLoadError = true;
      this.renderHistoryTable();
      this.renderSessionSummary(null);
    }
  },

  renderSessionSummary(queryCount) {
    const sessionId = document.getElementById('session-id-value');
    const count = document.getElementById('session-query-count');
    const latestActivity = document.getElementById('session-last-activity');
    const sessionRisk = document.getElementById('session-risk-value');
    if (sessionId) {
      sessionId.textContent = this.state.historyLoadError
        ? 'Unavailable'
        : this.state.historySessionId || 'Not reported';
    }
    if (count) {
      count.textContent = this.state.historyLoadError
        ? 'Unavailable'
        : Number.isSafeInteger(queryCount) ? String(queryCount) : String(this.state.history.length);
    }
    const latestTimestamp = this.state.history[0]?.timestamp;
    if (latestActivity) {
      latestActivity.textContent = this.state.historyLoadError
        ? 'Unavailable'
        : Number.isFinite(latestTimestamp)
          ? new Date(latestTimestamp * 1000).toLocaleString()
          : 'No activity reported';
    }
    if (sessionRisk) {
      sessionRisk.textContent = this.state.historyLoadError ? 'Unavailable' : 'Not reported';
    }
  },

  renderHistoryTable() {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;

    if (this.state.historyLoadError) {
      tbody.innerHTML = '<tr><td colspan="6" class="table-empty-state">Could not load query history.</td></tr>';
      return;
    }
    if (this.state.history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">No queries run in this session.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.state.history.map((h, i) => {
      const query = typeof h.query === 'string' ? h.query : '';
      const canInspect = query.trim().toLowerCase().startsWith('select') && !query.toLowerCase().includes('redacted');
      return `
        <tr>
          <td><strong>#${this.state.history.length - i}</strong></td>
          <td style="font-family:var(--font-mono); font-size:11px;">${h.timestamp ? new Date(h.timestamp * 1000).toLocaleTimeString() : 'Not recorded'}</td>
          <td style="font-family:var(--font-mono); font-size:11.5px; max-width:350px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(query || 'Unavailable')}</td>
          <td><span class="decision-badge ${escapeHtml(h.decision || '')}">${escapeHtml(h.decision || 'Unavailable')}</span></td>
          <td>${h.estimated_rows !== undefined && h.estimated_rows !== null ? `${h.estimated_rows} rows` : 'Unavailable'}</td>
          <td>${canInspect
            ? `<a style="color:var(--sage-dark); font-weight:600; cursor:pointer;" onclick="App.reinspectHistoryQuery('${escapeHtml(query).replace(/'/g, "\\'")}')">Load query</a>`
            : '<span style="color:var(--text-muted);">Query unavailable</span>'}</td>
        </tr>
      `;
    }).join('');
  },

  reinspectHistoryQuery(sql) {
    this.navigateTo('inspector');
    const input = document.getElementById('pg-sql-input');
    if (input) {
      input.value = sql;
      const highlight = document.getElementById('sql-editor-highlight');
      if (highlight) this.updateSqlHighlight(input, highlight);
    }
    this.showToast(input ? 'Query loaded into PostgreSQL terminal' : 'PostgreSQL terminal is unavailable');
  },

  async clearHistory() {
    try {
      await fetch(`${this.state.apiBase}/api/history/clear?session_id=pg_default_session`, { method: 'DELETE' });
      this.state.history = [];
      this.renderHistoryTable();
      this.showToast('Query history cleared.');
    } catch (e) {
      this.showToast('Could not clear query history.');
    }
  },

  // ---------------------------------------------------------------------------
  // Governance: Connections, Policies, Users, Audit
  // ---------------------------------------------------------------------------
  async loadConnections() {
    await this.checkPgStatus();
  },

  async loadPolicies() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/policies`);
      if (!res.ok) throw new Error('Policy data unavailable');
      const d = await res.json();
      this.state.policies = d.policies || [];
      this.renderPoliciesTable(d.active_policy_id);
    } catch (e) {
      console.warn('Policies load error:', e);
      this.state.policies = [];
      this.renderPoliciesTable(null);
    }
  },

  async loadCurrentUser() {
    const panel = document.getElementById('access-current-user');
    if (panel)     panel.textContent = 'Loading your access details...';
    try {
      const res = await fetch(`${this.state.apiBase}/api/auth/me`);
      if (!res.ok) throw new Error('Access details unavailable');
      this.state.access = await res.json();
      this.renderCurrentUser();
    } catch (e) {
      console.warn('Access details load error:', e);
      this.state.access = null;
      this.renderCurrentUser();
    }
  },

  renderCurrentUser() {
    const panel = document.getElementById('access-current-user');
    if (!panel) return;
    const user = this.state.access?.user;
    const permissions = this.state.access?.permissions;
    const avatar = document.getElementById('topbar-user-avatar');
    const username = document.getElementById('topbar-user-name');
    const role = document.getElementById('topbar-user-role');
    if (!user) {
      panel.innerHTML = '<div class="pg-query-state">Your user and access details are not available.</div>';
      if (avatar) avatar.textContent = '—';
      if (username) username.textContent = 'User unavailable';
      if (role) role.textContent = 'Access not loaded';
      return;
    }
    if (avatar) avatar.textContent = String(user.username || '—').slice(0, 2).toUpperCase();
    if (username) username.textContent = user.username || 'User unavailable';
    if (role) role.textContent = user.role ? user.role.replace(/_/g, ' ') : 'Role not reported';
    panel.innerHTML = `
      <div><strong>User:</strong> ${escapeHtml(user.username || 'Unavailable')}</div>
      <div><strong>Role:</strong> ${escapeHtml(user.role || 'Unavailable')}</div>
      <div><strong>Permissions:</strong> ${Array.isArray(permissions) && permissions.length
        ? permissions.map(permission => `<span class="col-tag">${escapeHtml(permission)}</span>`).join(' ')
        : 'Not reported'}</div>
    `;
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
        <td>${p.id === activePolicyId ? '<span class="decision-badge ALLOW">In use</span>' : '<span style="color:var(--text-muted);">Ready</span>'}</td>
        <td>
          ${p.id === activePolicyId
            ? '<span style="font-weight:700; color:var(--forest-deep);">&bull; In use</span>'
            : `<button class="btn btn-secondary btn-subtle" onclick="App.onPolicyChange('${p.id}')">Use this rule</button>`
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
        this.showToast(`Rule ${policyId} is now in use.`);
      }
    } catch (e) {
      this.showToast('Could not change the safety rule.');
    }
  },

  async loadAuditLogs() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/audit?limit=500`);
      if (res.ok) {
        const d = await res.json();
        this.state.auditLogs = d.logs || [];
        this.renderAuditTable();
        if (this.state.status) this.renderStatus(this.state.status);
      } else {
        this.state.auditLogs = [];
        this.renderAuditTable();
      }
    } catch (e) {
      console.warn('Audit logs load error:', e);
      this.state.auditLogs = [];
      this.renderAuditTable();
      if (this.state.status) this.renderStatus(this.state.status);
    }
  },

  renderAuditTable() {
    const tbody = document.getElementById('audit-tbody');
    if (!tbody) return;

    if (this.state.auditLogs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:20px;">No audit records yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = this.state.auditLogs.map(l => `
      <tr>
        <td><strong>#${escapeHtml(String(l.id ?? 'Unavailable'))}</strong></td>
        <td style="font-family:var(--font-mono); font-size:11px;">${escapeHtml(l.timestamp || 'Not recorded')}</td>
        <td>${escapeHtml(l.user || 'Not recorded')}</td>
        <td>${escapeHtml(l.event_type || 'Not recorded')}</td>
        <td><span class="decision-badge ${escapeHtml(l.decision || '')}">${escapeHtml(l.decision || 'Unavailable')}</span></td>
        <td><code style="font-family:var(--font-mono); font-size:10px; color:var(--forest-deep);">${escapeHtml((l.record_hash || 'Unavailable').substring(0, 24))}</code></td>
      </tr>
    `).join('');
  },

  async verifyAuditLedger() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/audit/verify`);
      if (res.ok) {
        const d = await res.json();
        if (d.valid) {
          this.showToast(`Audit log check passed. ${d.count} records checked.`);
        } else {
          this.showToast(`Audit log check failed at record #${d.broken_index}.`);
        }
      }
    } catch (e) {
      this.showToast('Could not check the audit log.');
    }
  },

  async loadAnalytics() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/analytics/investigation`);
      if (!res.ok) throw new Error('Analytics unavailable');
      const d = await res.json();
      this.state.analytics = d;
      this.renderAnalytics(d);
    } catch (e) {
      console.warn('Analytics load error:', e);
      this.state.analytics = null;
      this.renderAnalytics({});
    }
  },

  renderAnalytics(d) {
    const breakdown = d.decision_breakdown && typeof d.decision_breakdown === 'object'
      ? d.decision_breakdown
      : null;
    const hasCount = value => typeof value === 'number' && Number.isFinite(value);
    const countFor = key => breakdown && hasCount(breakdown[key]) ? breakdown[key] : null;
    const allowed = countFor('ALLOW');
    const warned = countFor('WARN');
    const restricted = countFor('RESTRICT');
    const blocked = countFor('BLOCK');
    const suspicious = warned !== null && restricted !== null ? warned + restricted : null;
    const summary = d.summary && typeof d.summary === 'object' ? d.summary : null;
    const reportedTotal = summary && hasCount(summary.total_queries_analyzed)
      ? summary.total_queries_analyzed
      : null;
    const allDecisionsReported = [allowed, warned, restricted, blocked].every(value => value !== null);
    const total = reportedTotal !== null
      ? reportedTotal
      : allDecisionsReported
        ? allowed + warned + restricted + blocked
        : null;
    const kpiValues = {
      'kpi-inspected': total,
      'kpi-allowed': allowed,
      'kpi-suspicious': suspicious,
      'kpi-blocked': blocked
    };
    Object.entries(kpiValues).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value === null ? 'Unavailable' : String(value);
    });

    // Decision breakdown bars
    const cBox = document.getElementById('analytics-decisions-chart');
    if (cBox && breakdown && Object.values(breakdown).every(hasCount)) {
      const decisionTotal = Object.values(breakdown).reduce((sum, count) => sum + count, 0);
      cBox.innerHTML = decisionTotal > 0 ? Object.entries(breakdown).map(([k, count]) => {
        const pct = Math.round((count / decisionTotal) * 100);
        return `
          <div class="decision-breakdown-row">
            <div style="display:flex; justify-content:space-between; font-size:11.5px; margin-bottom:3px;">
              <span><strong>${k}</strong></span>
              <span>${count} (${pct}%)</span>
            </div>
            <div class="risk-meter-bar-track">
              <div class="risk-meter-fill ${k === 'BLOCK' ? 'critical' : k === 'WARN' ? 'moderate' : 'low'}" style="width:${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('') : '<div class="pg-query-state">No query decisions have been recorded.</div>';
    } else if (cBox) {
      cBox.innerHTML = '<div class="pg-query-state">Reports are not available.</div>';
    }

    // DP budget
    const dpFill = document.getElementById('dp-budget-fill');
    const dpSpent = document.getElementById('dp-spent-label');
    const dpMax = document.getElementById('dp-max-label');
    if (dpFill && summary && hasCount(summary.dp_budget_percent)) {
      dpFill.style.width = `${Math.max(0, Math.min(100, summary.dp_budget_percent))}%`;
    } else if (dpFill) {
      dpFill.style.width = '0%';
    }
    if (dpSpent && summary && hasCount(summary.dp_budget_spent)) {
      dpSpent.textContent = `${summary.dp_budget_spent} \u03B5`;
    } else if (dpSpent) {
      dpSpent.textContent = 'Unavailable';
    }
    if (dpMax && summary && hasCount(summary.dp_budget_max)) {
      dpMax.textContent = `${summary.dp_budget_max} \u03B5`;
    } else if (dpMax) {
      dpMax.textContent = 'Unavailable';
    }
  },

  // ---------------------------------------------------------------------------
  // Dataset Schema Explorer & Preview
  // ---------------------------------------------------------------------------
  async loadDatasets() {
    const container = document.getElementById('datasets-container');
    if (container) container.innerHTML = '<div class="pg-query-state" role="status">Loading table counts...</div>';
    if (!this.state.pgStatus?.healthy) {
      this.state.datasets = [];
      this.renderDatasets([]);
      return;
    }
    try {
      const schemaResponse = await fetch(`${this.state.apiBase}/api/pg/schema`);
      if (!schemaResponse.ok) throw new Error('Table details are not available');
      const schema = await schemaResponse.json();
      const countColumns = {
        customers: 'customer_id',
        employees: 'employee_id',
        transactions: 'transaction_id',
        audit_demo: 'log_id'
      };
      const tables = await Promise.all((schema.tables || []).map(async table => {
        const keyColumn = countColumns[table.table];
        if (!keyColumn || !(table.columns || []).some(column => column.name === keyColumn)) {
          return { ...table, row_count: null };
        }
        try {
          const response = await fetch(`${this.state.apiBase}/api/pg/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sql: `SELECT COUNT(${keyColumn}) FROM ${table.schema}.${table.table}`,
              session_id: 'default_session'
            })
          });
          if (!response.ok) return { ...table, row_count: null };
          const result = await response.json();
          const count = result.executed === true && result.decision === 'ALLOW'
            ? Number(result.rows?.[0]?.[0])
            : NaN;
          return { ...table, row_count: Number.isSafeInteger(count) ? count : null };
        } catch {
          return { ...table, row_count: null };
        }
      }));
      this.state.datasets = tables;
      this.renderDatasets(tables);
    } catch (e) {
      console.warn('Datasets load error:', e);
      this.state.datasets = [];
      this.renderDatasets([]);
    }
  },

  renderDatasets(datasets) {
    const container = document.getElementById('datasets-container');
    if (!container) return;

    if (!datasets || datasets.length === 0) {
      container.innerHTML = `<div class="pg-query-state" role="status">No tables are available. Check the database connection and account access.</div>`;
      return;
    }

    container.innerHTML = datasets.map(ds => `
      <div class="dataset-card">
        <div class="dataset-card-header">
          <div>
            <div class="section-badge" style="margin-bottom:4px;">PostgreSQL · ${escapeHtml(ds.schema)}</div>
            <h4 style="font-size:14px; font-weight:700; color:var(--forest-deep);">${escapeHtml(ds.table)}</h4>
            <p style="font-size:11.5px; color:var(--text-secondary); margin-top:2px;">Rows: ${ds.row_count === null ? 'Not available' : escapeHtml(String(ds.row_count))}</p>
          </div>
          <span class="decision-badge ALLOW">Database</span>
        </div>

        <div class="dataset-table-list">
          <div class="dataset-table-item">
            <div style="font-size:11px; color:var(--text-secondary); margin-bottom:6px;">Columns this account can see:</div>
            <div style="display:flex; flex-wrap:wrap; gap:2px;">
              ${(ds.columns || []).map(col => `<span class="col-tag">${escapeHtml(col.name)}</span>`).join('')}
            </div>
            <div style="font-size:11px; color:var(--text-muted); margin-top:8px;">This account cannot view the table records.</div>
          </div>
        </div>
      </div>
    `).join('');
  },

  // ---------------------------------------------------------------------------
  // PostgreSQL Integration
  // ---------------------------------------------------------------------------
  async checkPgStatus() {
    try {
      const res = await fetch(`${this.state.apiBase}/api/pg/status`);
      if (!res.ok) throw new Error('Database status is not available');
      const d = await res.json();
      this.state.pgStatus = { db: d.db, healthy: false };
      const statusLine = document.getElementById('pg-status-summary');
      if (statusLine) {
        statusLine.innerHTML = `<div>Database: <strong>${escapeHtml(d.db || 'Unavailable')}</strong></div><div>Connection: <strong>Checking...</strong></div>`;
      }
      await this.testPgConnection();
      return this.state.pgStatus?.healthy === true;
    } catch (e) {
      console.warn('PG status error:', e);
      this.state.pgStatus = { healthy: false };
      this.renderPgConnectionState(false);
      return false;
    }
  },

  async refreshPostgresData() {
    const connected = await this.checkPgStatus();
    await Promise.all([
      connected ? this.loadDatasets() : Promise.resolve(this.renderDatasets([])),
      this.fetchStatus(),
      this.loadEvents(),
      this.loadHistory(),
      this.loadPolicies(),
      this.loadCurrentUser(),
      this.loadAuditLogs(),
      this.loadAnalytics()
    ]);
  },

  renderPgConnectionState(healthy, latency = null) {
    const stateText = healthy ? 'Connected' : 'Not connected';
    const summary = document.getElementById('pg-connection-summary');
    const statusSummary = document.getElementById('pg-status-summary');
    const testResult = document.getElementById('pg-test-result');
    const database = this.state.pgStatus?.db;
    const latencyText = Number.isFinite(latency) ? ` · ${latency} ms` : '';
    const safeDatabase = database ? escapeHtml(database) : 'Unavailable';

    if (summary) {
      summary.innerHTML = `Database: <strong>${safeDatabase}</strong><br>Connection: <strong>${stateText}${latencyText}</strong>`;
      summary.className = `pg-query-state${healthy ? '' : ' error'}`;
    }
    if (statusSummary) {
      statusSummary.innerHTML = `<div>Database: <strong>${safeDatabase}</strong></div><div>Connection: <strong>${stateText}${latencyText}</strong></div>`;
    }
    const nameEl = document.getElementById('topbar-connection-name');
    if (nameEl) {
      nameEl.textContent = `${stateText} · ${database || 'PostgreSQL'}`;
    }
    const badge = document.getElementById('topbar-connection-badge');
    if (badge) badge.className = `connection-indicator-badge ${healthy ? '' : 'disconnected'}`;
    if (testResult) {
      testResult.textContent = healthy ? `Connected${latencyText}` : 'Not connected';
      testResult.style.color = healthy ? 'var(--sage-dark)' : 'var(--danger-muted-red)';
    }
  },

  async testPgConnection() {
    const resBox = document.getElementById('pg-test-result');
    if (resBox) {
      resBox.textContent = 'Checking connection...';
      resBox.style.color = 'var(--text-secondary)';
    }
    try {
      const res = await fetch(`${this.state.apiBase}/api/pg/test`, { method: 'POST' });
      if (!res.ok) throw new Error('Database connection check failed');
      const d = await res.json();
      this.state.pgStatus = {
        ...this.state.pgStatus,
        db: d.db || this.state.pgStatus?.db,
        healthy: d.healthy === true,
        latency_ms: d.latency_ms
      };
      this.renderPgConnectionState(d.healthy === true, d.latency_ms);
      return d.healthy === true;
    } catch {
      this.state.pgStatus = { ...this.state.pgStatus, healthy: false };
      this.renderPgConnectionState(false);
      return false;
    }
  },

  async inspectPgQueryOnly() {
    const sql = document.getElementById('pg-sql-input')?.value.trim();
    const btn = document.getElementById('btn-pg-inspect');
    const resultsBox = document.getElementById('pg-query-results');
    const requestId = ++this.state.pgQueryRequestId;
    if (!sql) {
      if (resultsBox) resultsBox.innerHTML = '<div class="pg-query-state">Enter a query to check it. Nothing was run.</div>';
      this.resetInspectionIntelligence();
      return this.showToast('Enter a query first.');
    }
    if (btn) btn.disabled = true;
    this.resetInspectionIntelligence();
    if (resultsBox) resultsBox.innerHTML = '<div class="pg-query-state" role="status">Checking the query. It will not run.</div>';
    try {
      const res = await fetch(`${this.state.apiBase}/api/pg/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, session_id: 'default_session' })
      });
      if (!res.ok) throw new Error('Query check failed');
      const data = await res.json();
      if (requestId !== this.state.pgQueryRequestId) return;
      this.renderInspectionIntelligence(data);
      if (resultsBox) resultsBox.innerHTML = '<div class="pg-query-state">Query checked only. It was not run.</div>';
      this.showToast(data.query_is_approved
        ? 'Query check complete. Nothing was run.'
        : 'This query is not allowed. It was not run.');
    } catch {
      if (requestId === this.state.pgQueryRequestId && resultsBox) {
        this.renderPgQueryNotExecuted({
          decision: 'Unavailable',
          reasons: ['Could not reach the server to check this query.'],
          error: true
        }, resultsBox);
      }
      this.showToast('Could not check the query.');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async runPgQuery() {
    const input = document.getElementById('pg-sql-input');
    const sql = input?.value.trim();
    const resultsBox = document.getElementById('pg-query-results');
    const button = document.getElementById('btn-pg-query');
    const requestId = ++this.state.pgQueryRequestId;
    if (!sql) {
      if (resultsBox) resultsBox.innerHTML = '<div class="pg-query-state">Query not run. Enter a query first.</div>';
      this.resetInspectionIntelligence();
      return this.showToast('Enter a query first.');
    }
    if (button) button.disabled = true;
    this.resetInspectionIntelligence();
    if (resultsBox) {
      resultsBox.innerHTML = '<div class="pg-query-state" role="status">Checking and running the query...</div>';
    }

    try {
      const res = await fetch(`${this.state.apiBase}/api/pg/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, session_id: 'default_session' })
      });
      if (!res.ok) throw new Error('Query request failed');
      const data = await res.json();
      if (requestId !== this.state.pgQueryRequestId) return;
      if (data.executed === true && data.success === true) {
        if (!Array.isArray(data.columns) || !Array.isArray(data.rows)) {
          throw new Error('The server returned an invalid result');
        }
        this.renderPgQueryResults(data, resultsBox);
      } else {
        this.renderPgQueryNotExecuted(data, resultsBox);
      }
      await Promise.all([
        this.loadEvents(),
        this.loadHistory(),
        this.fetchStatus(),
        this.loadAuditLogs(),
        this.loadAnalytics()
      ]);
    } catch {
      if (requestId === this.state.pgQueryRequestId) {
        this.renderPgQueryNotExecuted({
          decision: 'Unavailable',
          reasons: ['Could not reach the server to run this query.'],
          error: true
        }, resultsBox);
      }
    } finally {
      if (requestId === this.state.pgQueryRequestId && button) button.disabled = false;
    }
  },

  renderPgQueryResults(data, resultsBox) {
    if (!resultsBox) return;
    this.renderInspectionIntelligence(data);
    const columns = data.columns;
    const rows = data.rows;
    const decision = String(data.decision || 'UNKNOWN');
    const decisionClass = ['ALLOW', 'WARN', 'RESTRICT', 'BLOCK'].includes(decision)
      ? decision
      : '';
    const rowCount = Number.isFinite(data.row_count) ? data.row_count : rows.length;
    const latency = Number.isFinite(data.execution_latency_ms)
      ? `${data.execution_latency_ms} ms`
      : 'Unavailable';
    const reasons = Array.isArray(data.reasons) ? data.reasons : [];
    const table = rows.length && columns.length
      ? `
        <div class="pg-query-table-wrap">
          <table class="custom-table">
            <thead><tr>${columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
            <tbody>${rows.map(row => `
              <tr>${columns.map((_, index) => `<td>${escapeHtml(String(row[index] ?? ''))}</td>`).join('')}</tr>
            `).join('')}</tbody>
          </table>
        </div>
      `
      : '<div class="pg-query-state">The query ran, but returned no rows.</div>';

    resultsBox.innerHTML = `
      <div class="pg-query-summary">
        <div class="pg-query-metric"><span class="pg-query-metric-label">Decision</span><span class="decision-badge ${decisionClass}">${escapeHtml(decision)}</span></div>
        <div class="pg-query-metric"><span class="pg-query-metric-label">Risk score</span><span class="pg-query-metric-value">${escapeHtml(String(data.risk_score ?? 'Not available'))}</span></div>
        <div class="pg-query-metric"><span class="pg-query-metric-label">Result</span><span class="pg-query-metric-value">Query ran</span></div>
        <div class="pg-query-metric"><span class="pg-query-metric-label">Rows</span><span class="pg-query-metric-value">${escapeHtml(String(rowCount))}</span></div>
        <div class="pg-query-metric"><span class="pg-query-metric-label">Time taken</span><span class="pg-query-metric-value">${escapeHtml(latency)}</span></div>
      </div>
      ${reasons.length ? `<div class="pg-query-reasons"><strong>Notes</strong><ul>${reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul></div>` : ''}
      ${data.truncated ? '<div class="pg-query-state">Only the first 50 rows are shown.</div>' : ''}
      ${table}
    `;
  },

  renderPgQueryNotExecuted(data, resultsBox) {
    if (!resultsBox) return;
    this.renderInspectionIntelligence(data);
    const decision = String(data.decision || 'UNKNOWN');
    const decisionClass = ['ALLOW', 'WARN', 'RESTRICT', 'BLOCK'].includes(decision)
      ? decision
      : '';
    const reasons = Array.isArray(data.reasons) && data.reasons.length
      ? data.reasons
      : [data.blocked
        ? 'The safety check did not allow this query.'
        : 'The query could not be completed.'];
    const isApiError = Boolean(data.error);

    resultsBox.innerHTML = `
      <div class="pg-query-summary">
        <div class="pg-query-metric"><span class="pg-query-metric-label">Decision</span><span class="decision-badge ${decisionClass}">${escapeHtml(decision)}</span></div>
        <div class="pg-query-metric"><span class="pg-query-metric-label">Risk score</span><span class="pg-query-metric-value">${escapeHtml(String(data.risk_score ?? 'Not available'))}</span></div>
        <div class="pg-query-metric"><span class="pg-query-metric-label">Result</span><span class="pg-query-metric-value">Query not run</span></div>
        <div class="pg-query-metric"><span class="pg-query-metric-label">Rows</span><span class="pg-query-metric-value">0</span></div>
      </div>
      <div class="pg-query-state ${isApiError ? 'error' : 'blocked'}" role="${isApiError ? 'alert' : 'status'}">
        ${isApiError ? 'The query could not be completed.' : escapeHtml(data.message || data.remediation || 'The query was not run.')}
      </div>
      <div class="pg-query-reasons"><strong>Why</strong><ul>${reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul></div>
    `;
  },

  filterEvents(searchTerm) {
    const searchInput = document.getElementById('events-filter-input');
    const decisionFilter = document.getElementById('events-decision-filter')?.value || '';
    const severityFilter = document.getElementById('events-severity-filter')?.value || '';
    const term = String(searchTerm ?? searchInput?.value ?? '').trim().toLowerCase();
    const rows = document.querySelectorAll('#events-full-tbody tr');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      const decisionMatches = !decisionFilter || row.dataset.decision === decisionFilter;
      const severityMatches = !severityFilter || row.dataset.severity === severityFilter;
      row.style.display = text.includes(term) && decisionMatches && severityMatches ? '' : 'none';
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
