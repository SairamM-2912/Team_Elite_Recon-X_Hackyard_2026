// RECON-X UI View Components

const Components = {

  // 1. Overview / Primary Security Proxy Workspace
  renderOverview(state) {
    const status = state.proxyStatus || {};
    const activeConn = status.active_connection || { name: 'Loading...', sector: 'Healthcare', status: 'ONLINE', latency_ms: 1.2 };
    const activePolicy = status.active_policy || { name: 'Balanced Privacy' };
    const user = status.authenticated_user || { username: 'sec_admin', role: 'admin' };
    const isRunning = status.proxy_running;

    return `
      <!-- Connection Status Strip -->
      <div class="status-strip">
        <div class="status-strip-item">
          <span class="strip-label">Proxy Engine</span>
          <div class="strip-value">
            <span class="status-pill ${isRunning ? 'running' : 'stopped'}">
              <span class="status-dot"></span>
              ${isRunning ? 'RUNNING' : 'STOPPED'}
            </span>
            <button class="btn btn-sm btn-toggle-proxy ${isRunning ? 'running' : 'stopped'}" onclick="App.toggleProxy()">
              ${isRunning ? 'Stop Proxy' : 'Start Proxy'}
            </button>
          </div>
        </div>

        <div class="strip-divider"></div>

        <div class="status-strip-item">
          <span class="strip-label">Protected Target</span>
          <div class="strip-value">
            ${getIcon('database')}
            <strong>${escapeHtml(activeConn.name)}</strong>
            <span style="font-size:10.5px; color:var(--secondary-text)">(${activeConn.engine})</span>
            ${activeConn.is_simulation ? '<span class="status-pill" style="background:#FEF3C7;color:#B45309;font-size:10px;">Simulation</span>' : ''}
          </div>
        </div>

        <div class="strip-divider"></div>

        <div class="status-strip-item">
          <span class="strip-label">Health & TLS</span>
          <div class="strip-value">
            <span style="color:var(--success); font-weight:600;">${activeConn.latency_ms} ms</span>
            <span style="color:var(--secondary-text); font-size:11px;">• TLS 1.3 Active</span>
          </div>
        </div>

        <div class="strip-divider"></div>

        <div class="status-strip-item">
          <span class="strip-label">Security Policy</span>
          <div class="strip-value">
            ${getIcon('shield')}
            <span>${escapeHtml(activePolicy.name)}</span>
          </div>
        </div>

        <div class="strip-divider"></div>

        <div class="status-strip-item" style="margin-left:auto;">
          <span class="strip-label">Authenticated Identity</span>
          <div class="strip-value">
            <span style="font-weight:700;">${escapeHtml(user.username)}</span>
            <span class="decision-badge" style="background:#EFF6FF;color:#2563EB;border-color:#BFDBFE;font-size:10px;">${escapeHtml(user.role)}</span>
          </div>
        </div>
      </div>

      <!-- Main Dual-Panel Workspace -->
      <div class="grid-proxy-layout">
        <!-- Left Column: Query Inspection & Safe Runner -->
        <div style="display:flex; flex-direction:column; gap:12px;">
          
          <div class="card">
            <div class="card-header">
              <span class="card-title">
                ${getIcon('search')} Query Inspector & Interceptor
              </span>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-secondary btn-sm" onclick="App.clearQuery()">Clear</button>
              </div>
            </div>
            
            <div class="card-body">
              <!-- Attack & Compliant Scenario Shortcuts -->
              <div style="margin-bottom:8px;">
                <div style="font-size:11px; font-weight:600; color:var(--secondary-text); margin-bottom:4px; text-transform:uppercase; letter-spacing:0.4px;">
                  Quick Attack & Compliance Scenarios:
                </div>
                <div class="scenario-strip" id="scenario-strip">
                  ${(state.scenarios || []).map(sc => `
                    <div class="scenario-pill" onclick="App.loadScenario('${sc.id}')" title="${escapeHtml(sc.description)}">
                      <span class="decision-badge ${sc.expected_decision}" style="font-size:9.5px; padding:1px 4px;">${sc.expected_decision}</span>
                      <span>${escapeHtml(sc.title)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- SQL Editor Input -->
              <div style="margin-bottom:10px;">
                <textarea id="sql-input" class="sql-editor" rows="3" placeholder="Enter SQL query to inspect (e.g., SELECT * FROM patients WHERE ssn = '345-21-9876')...">${escapeHtml(state.currentQuery || '')}</textarea>
              </div>

              <!-- Action Bar -->
              <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <button class="btn btn-secondary" onclick="App.analyseQuery()" id="btn-analyse">
                    ${getIcon('search')} Analyse Query
                  </button>
                  <button class="btn btn-primary" onclick="App.runQuery()" id="btn-run">
                    ${getIcon('play')} Run Query
                  </button>
                </div>
                <div style="font-size:11px; color:var(--secondary-text);">
                  Inspection runs locally before query execution. Blocked queries never reach the database.
                </div>
              </div>
            </div>
          </div>

          <!-- Query Decision & Risk Explanation Section -->
          ${state.lastAnalysis ? Components.renderDecisionPanel(state.lastAnalysis) : ''}

          <!-- Execution Results Panel -->
          ${state.lastExecution ? Components.renderExecutionResults(state.lastExecution) : ''}
        </div>

        <!-- Right Column: Recent Security Events -->
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div class="card">
            <div class="card-header">
              <span class="card-title">
                ${getIcon('alertTriangle')} Recent Security Events
              </span>
              <button class="btn btn-secondary btn-sm" onclick="App.navigate('events')">View All</button>
            </div>
            <div class="card-body" style="padding:8px 10px;">
              ${(state.recentEvents && state.recentEvents.length > 0) ? `
                <div style="display:flex; flex-direction:column; gap:8px;">
                  ${state.recentEvents.slice(0, 6).map(evt => `
                    <div style="border:1px solid var(--border); border-radius:var(--radius-sm); padding:6px 8px; background:#FFFFFF;">
                      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:2px;">
                        <span class="decision-badge ${evt.decision}">${evt.decision}</span>
                        <span style="font-size:10.5px; color:var(--secondary-text);">${evt.timestamp}</span>
                      </div>
                      <div style="font-size:11.5px; font-weight:600; color:var(--primary-text); margin-bottom:2px;">
                        ${escapeHtml(evt.event_type.replace(/_/g, ' '))}
                      </div>
                      <div class="code-preview" style="font-size:11px; padding:3px 5px; margin-bottom:3px; max-height:40px; overflow:hidden;">
                        ${escapeHtml(evt.query)}
                      </div>
                      <div style="font-size:11px; color:var(--secondary-text);">
                        Risk Score: <strong style="color:${evt.risk_score >= 80 ? 'var(--blocked)' : evt.risk_score > 30 ? 'var(--warning)' : 'var(--success)'};">${evt.risk_score}/100</strong>
                        • User: ${escapeHtml(evt.user)}
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div style="text-align:center; padding:24px 12px; color:var(--secondary-text);">
                  ${getIcon('shield')}
                  <p style="margin-top:6px; font-size:12px;">No security incidents detected. System normal.</p>
                </div>
              `}
            </div>
          </div>

          <!-- Proxy Health Card -->
          <div class="card">
            <div class="card-header">
              <span class="card-title">${getIcon('activity')} Engine Health</span>
            </div>
            <div class="card-body" style="font-size:12px; display:flex; flex-direction:column; gap:6px;">
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--secondary-text);">Fail-Safe Enforcer:</span>
                <strong style="color:var(--success);">Active (Fail-Closed)</strong>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--secondary-text);">Differential Privacy:</span>
                <span>Laplace Mechanism</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--secondary-text);">Canary Honeypots:</span>
                <span style="color:var(--success);">4 Active Sectors</span>
              </div>
              <div style="display:flex; justify-content:space-between;">
                <span style="color:var(--secondary-text);">Differencing Tracker:</span>
                <span>Multi-Query Predicate Delta</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Decision & Risk Explanation Panel
  renderDecisionPanel(data) {
    const decision = data.decision || {};
    const dec = decision.decision || 'ALLOW';
    const score = decision.risk_score || 0;
    const reasons = decision.reasons || [];
    const factors = decision.factors || {};

    let scoreColor = 'var(--success)';
    if (dec === 'BLOCK') scoreColor = 'var(--blocked)';
    else if (dec === 'RESTRICT') scoreColor = 'var(--restricted)';
    else if (dec === 'WARN') scoreColor = 'var(--warning)';

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">${getIcon('shield')} Security Decision & Inference Analysis</span>
          <span class="decision-badge ${dec}">${dec}</span>
        </div>
        <div class="card-body">
          <div class="decision-box ${dec}">
            <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:8px;">
              <div>
                <span style="font-size:11px; font-weight:600; color:var(--secondary-text); text-transform:uppercase;">Enforcement Outcome:</span>
                <div style="display:flex; align-items:center; gap:8px; margin-top:2px;">
                  <span class="decision-badge ${dec}" style="font-size:13px; padding:3px 10px;">${dec}</span>
                  <span style="font-size:12.5px; font-weight:600; color:var(--primary-text);">${escapeHtml(decision.remediation || '')}</span>
                </div>
              </div>
              <div class="risk-score-display">
                <span style="font-size:11px; font-weight:600; color:var(--secondary-text); text-transform:uppercase;">Risk Score:</span>
                <span class="score-num" style="color:${scoreColor};">${score}</span>
                <span class="score-max">/ 100</span>
              </div>
            </div>

            <!-- Identified Risk Factors -->
            <div style="margin-top:10px;">
              <span style="font-size:11px; font-weight:600; color:var(--secondary-text); text-transform:uppercase;">Security Engine Findings:</span>
              <ul class="reasons-list">
                ${reasons.map(r => `
                  <li class="reason-item">
                    <span style="color:${scoreColor};">${getIcon(dec === 'BLOCK' ? 'alertTriangle' : dec === 'ALLOW' ? 'check' : 'alertCircle')}</span>
                    <span>${escapeHtml(r)}</span>
                  </li>
                `).join('')}
              </ul>
            </div>

            <!-- Factor Tags -->
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:10px;">
              ${factors.differencing_attack ? '<span class="status-pill" style="background:#FEE2E2;color:#DC2626;">Differencing Attack</span>' : ''}
              ${factors.canary_tripwire ? '<span class="status-pill" style="background:#FEE2E2;color:#DC2626;">Canary Tripwire</span>' : ''}
              ${factors.population_narrowing ? '<span class="status-pill" style="background:#FEF3C7;color:#B45309;">Small Cell Isolation</span>' : ''}
              ${factors.progressive_filtering ? '<span class="status-pill" style="background:#FEF3C7;color:#B45309;">Progressive Narrowing</span>' : ''}
              ${(factors.sensitive_columns_accessed && factors.sensitive_columns_accessed.length > 0) ? `
                <span class="status-pill" style="background:#EFF6FF;color:#2563EB;">Sensitive Columns: ${factors.sensitive_columns_accessed.length}</span>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // Execution Results Panel
  renderExecutionResults(res) {
    if (res.blocked) {
      return `
        <div class="card" style="border-color:var(--blocked-border);">
          <div class="card-header" style="background-color:var(--blocked-bg);">
            <span class="card-title" style="color:var(--blocked);">
              ${getIcon('lock')} Query Execution Blocked
            </span>
            <span class="decision-badge BLOCK">0 Rows Disclosed</span>
          </div>
          <div class="card-body">
            <div style="padding:12px; background:#FFFFFF; border:1px solid var(--blocked-border); border-radius:var(--radius-sm);">
              <div style="font-weight:700; color:var(--blocked); font-size:13px; margin-bottom:4px;">
                ${escapeHtml(res.message || 'Execution Prohibited')}
              </div>
              <p style="color:var(--primary-text); font-size:12px; margin-bottom:8px;">
                The security engine halted this query because it presents high inference risk or trips sensitive policy boundaries. Upstream protected database access was completely prevented.
              </p>
              <div style="font-size:11.5px; color:var(--secondary-text);">
                <strong>Remediation:</strong> ${escapeHtml(res.remediation || 'Reformulate query with aggregate functions or broader cohorts.')}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    if (!res.success) {
      return `
        <div class="card">
          <div class="card-header">
            <span class="card-title" style="color:var(--blocked);">${getIcon('alertTriangle')} Execution Error</span>
          </div>
          <div class="card-body">
            <p style="color:var(--blocked); font-size:12px;">${escapeHtml(res.error || 'Unknown error occurred.')}</p>
          </div>
        </div>
      `;
    }

    const columns = res.columns || [];
    const rows = res.rows || [];
    const dp = res.differential_privacy;

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">
            ${getIcon('table')} Query Results (${res.row_count} rows in ${res.execution_latency_ms} ms)
          </span>
          <div style="display:flex; align-items:center; gap:6px;">
            ${dp ? `<span class="decision-badge RESTRICT" title="Laplace noise added">DP Noise (ε=${dp.epsilon})</span>` : ''}
            <span class="decision-badge ${res.decision}">${res.decision}</span>
          </div>
        </div>
        <div class="card-body" style="padding:10px;">
          ${dp ? `
            <div style="margin-bottom:8px; padding:6px 10px; background:#FFF7ED; border:1px solid #FDBA74; border-radius:var(--radius-sm); font-size:11.5px;">
              <strong>Differential Privacy Mechanism:</strong> Result perturbed with Laplace noise (scale b = ${dp.scale_b}, noise added = ${dp.noise_added}). Exact true microdata protected.
            </div>
          ` : ''}

          <div class="table-container" style="max-height:280px; overflow-y:auto;">
            <table class="recon-table">
              <thead>
                <tr>
                  ${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${rows.length > 0 ? rows.map(r => `
                  <tr>
                    ${columns.map(c => `<td>${escapeHtml(String(r[c] !== undefined ? r[c] : ''))}</td>`).join('')}
                  </tr>
                `).join('') : `
                  <tr><td colspan="${columns.length || 1}" style="text-align:center; color:var(--secondary-text);">No matching records found.</td></tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  // 2. Connections View
  renderConnections(state) {
    const conns = state.connections || [];
    const activeId = state.activeConnectionId;

    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div>
            <h2 style="font-size:15px; font-weight:700;">Database Connections & Safe Upstream Proxy</h2>
            <p style="font-size:12px; color:var(--secondary-text);">
              Configure protected databases and client proxy endpoints. Credentials remain strictly server-side.
            </p>
          </div>
          <button class="btn btn-primary" onclick="App.showAddConnectionModal()">
            ${getIcon('database')} Add Connection
          </button>
        </div>

        <div class="table-container">
          <table class="recon-table">
            <thead>
              <tr>
                <th>Profile Name</th>
                <th>Engine</th>
                <th>Sector</th>
                <th>Status</th>
                <th>Latency</th>
                <th>Credentials</th>
                <th>Active</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${conns.map(c => `
                <tr style="${c.id === activeId ? 'background-color:#F8FAFC; font-weight:600;' : ''}">
                  <td>
                    <strong>${escapeHtml(c.name)}</strong>
                    ${c.is_simulation ? '<span class="status-pill" style="background:#FEF3C7;color:#B45309;font-size:10px;margin-left:4px;">Demo Simulation</span>' : ''}
                  </td>
                  <td>${escapeHtml(c.engine)}</td>
                  <td>${escapeHtml(c.sector)}</td>
                  <td>
                    <span class="status-pill ${c.status === 'ONLINE' ? 'running' : 'stopped'}">
                      <span class="status-dot"></span>
                      ${c.status}
                    </span>
                  </td>
                  <td>${c.latency_ms} ms</td>
                  <td>
                    <span style="color:var(--secondary-text); font-family:var(--font-mono); font-size:11px;">
                      •••••••••••• (Server Vault)
                    </span>
                  </td>
                  <td>
                    ${c.id === activeId ? `
                      <span class="decision-badge ALLOW" style="font-size:10px;">CONNECTED</span>
                    ` : `
                      <button class="btn btn-secondary btn-sm" onclick="App.selectConnection('${c.id}')">Select</button>
                    `}
                  </td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="App.testConnectionHealth('${c.id}')">
                      ${getIcon('activity')} Test
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="card" style="margin-top:8px;">
          <div class="card-header">
            <span class="card-title">${getIcon('info')} Connection Security Policy</span>
          </div>
          <div class="card-body" style="font-size:12px; color:var(--secondary-text);">
            All database client connections are proxied through RECON-X's local TLS socket. Incoming SQL queries are parsed, normalized, and validated against policy boundaries before being released to the upstream DBMS.
          </div>
        </div>
      </div>
    `;
  },

  // 3. Query Inspector View
  renderQueryInspector(state) {
    const analysis = state.lastAnalysis;
    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <h2 style="font-size:15px; font-weight:700;">Deep SQL Query Inspector & AST Breakdown</h2>
          <p style="font-size:12px; color:var(--secondary-text);">
            Examine query normalisation, table references, sensitive column mapping, and inference vulnerability score.
          </p>
        </div>

        <div class="card">
          <div class="card-header">
            <span class="card-title">${getIcon('search')} Inspect Query Expression</span>
          </div>
          <div class="card-body">
            <textarea id="deep-sql-input" class="sql-editor" rows="3">${escapeHtml(state.currentQuery || "SELECT customer_name, balance FROM accounts WHERE balance > 50000;")}</textarea>
            <div style="margin-top:8px; display:flex; gap:8px;">
              <button class="btn btn-primary" onclick="App.analyseQueryFromInspector()">
                ${getIcon('search')} Run Deep Inspection
              </button>
            </div>
          </div>
        </div>

        ${analysis ? `
          <div class="card">
            <div class="card-header">
              <span class="card-title">${getIcon('fileText')} AST Breakdown & Normalised Tokens</span>
              <span class="decision-badge ${analysis.decision.decision}">${analysis.decision.decision}</span>
            </div>
            <div class="card-body">
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:12px;">
                <div style="border:1px solid var(--border); padding:8px; border-radius:var(--radius-sm);">
                  <span class="strip-label">Statement Type</span>
                  <div style="font-size:13px; font-weight:700;">${analysis.parsed.statement_type}</div>
                </div>
                <div style="border:1px solid var(--border); padding:8px; border-radius:var(--radius-sm);">
                  <span class="strip-label">Referenced Tables</span>
                  <div style="font-size:13px; font-weight:600;">${analysis.parsed.tables.join(', ') || 'None'}</div>
                </div>
                <div style="border:1px solid var(--border); padding:8px; border-radius:var(--radius-sm);">
                  <span class="strip-label">Aggregates</span>
                  <div style="font-size:13px; font-weight:600;">
                    ${analysis.parsed.aggregates.map(a => `${a.func}(${a.arg})`).join(', ') || 'None'}
                  </div>
                </div>
                <div style="border:1px solid var(--border); padding:8px; border-radius:var(--radius-sm);">
                  <span class="strip-label">Analysis Latency</span>
                  <div style="font-size:13px; font-weight:600; color:var(--success);">${analysis.analysis_latency_ms} ms</div>
                </div>
              </div>

              <div style="margin-bottom:12px;">
                <span class="strip-label">Normalised Query:</span>
                <div class="code-preview">${escapeHtml(analysis.parsed.normalized_query)}</div>
              </div>

              <div style="margin-bottom:12px;">
                <span class="strip-label">Sensitive Column Detections:</span>
                ${analysis.parsed.sensitive_columns.length > 0 ? `
                  <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:4px;">
                    ${analysis.parsed.sensitive_columns.map(sc => `
                      <span class="decision-badge ${sc.level === 'CRITICAL' ? 'BLOCK' : 'WARN'}">
                        ${escapeHtml(sc.column)} • ${sc.level} (${escapeHtml(sc.type)})
                      </span>
                    `).join('')}
                  </div>
                ` : '<p style="color:var(--secondary-text); font-size:12px; margin-top:2px;">No sensitive columns detected.</p>'}
              </div>

              ${Components.renderDecisionPanel(analysis)}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  },

  // 4. Security Events View
  renderSecurityEvents(state) {
    const events = state.allEvents || [];
    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div>
            <h2 style="font-size:15px; font-weight:700;">Security Events & Alert Stream</h2>
            <p style="font-size:12px; color:var(--secondary-text);">
              Live log of blocked requests, differencing attempts, canary trips, and policy interventions.
            </p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="App.clearSecurityEvents()">Clear Events</button>
        </div>

        <div class="table-container">
          <table class="recon-table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Timestamp</th>
                <th>Severity</th>
                <th>Decision</th>
                <th>Risk</th>
                <th>User / Role</th>
                <th>Target DB</th>
                <th>Query</th>
                <th>Reasons</th>
              </tr>
            </thead>
            <tbody>
              ${events.length > 0 ? events.map(e => `
                <tr>
                  <td><strong>${e.id}</strong></td>
                  <td style="white-space:nowrap; font-size:11px;">${e.timestamp}</td>
                  <td>
                    <span class="decision-badge ${e.severity === 'CRITICAL' ? 'BLOCK' : e.severity === 'HIGH' ? 'RESTRICT' : 'WARN'}">
                      ${e.severity}
                    </span>
                  </td>
                  <td><span class="decision-badge ${e.decision}">${e.decision}</span></td>
                  <td><strong style="color:${e.risk_score >= 80 ? 'var(--blocked)' : e.risk_score > 30 ? 'var(--warning)' : 'var(--success)'};">${e.risk_score}</strong></td>
                  <td>${escapeHtml(e.user)} <span style="color:var(--secondary-text); font-size:10.5px;">(${e.role})</span></td>
                  <td>${escapeHtml(e.database)}</td>
                  <td><div class="code-preview" style="max-width:240px; max-height:40px; overflow:hidden;">${escapeHtml(e.query)}</div></td>
                  <td style="font-size:11.5px; max-width:220px;">${escapeHtml((e.reasons || [])[0] || 'Policy enforcement')}</td>
                </tr>
              `).join('') : `
                <tr><td colspan="9" style="text-align:center; padding:24px; color:var(--secondary-text);">No security events recorded.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // 5. Query History View
  renderQueryHistory(state) {
    const history = state.queryHistory || [];
    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div>
            <h2 style="font-size:15px; font-weight:700;">Query History & Session Sequence</h2>
            <p style="font-size:12px; color:var(--secondary-text);">
              Inspect sequential query progression, predicate accumulation, and differencing patterns across sessions.
            </p>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="App.clearQueryHistory()">Clear Session</button>
        </div>

        <div class="table-container">
          <table class="recon-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Decision</th>
                <th>Query</th>
                <th>Tables</th>
                <th>Predicates</th>
                <th>Aggregates</th>
                <th>Est. Cohort</th>
              </tr>
            </thead>
            <tbody>
              ${history.length > 0 ? history.map((h, i) => `
                <tr>
                  <td>${history.length - i}</td>
                  <td><span class="decision-badge ${h.decision}">${h.decision}</span></td>
                  <td><div class="code-preview" style="max-width:320px;">${escapeHtml(h.query)}</div></td>
                  <td>${escapeHtml(h.tables.join(', ') || '-')}</td>
                  <td>${escapeHtml(h.predicates.join(' AND ') || 'None')}</td>
                  <td>${escapeHtml(h.aggregates.map(a => `${a.func}(${a.arg})`).join(', ') || '-')}</td>
                  <td>${h.estimated_rows !== null && h.estimated_rows !== undefined ? h.estimated_rows : 'N/A'}</td>
                </tr>
              `).join('') : `
                <tr><td colspan="7" style="text-align:center; padding:24px; color:var(--secondary-text);">No queries in active session history.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // 6. Policies View
  renderPolicies(state) {
    const policies = state.policies || [];
    const activeId = state.activePolicyId;

    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <h2 style="font-size:15px; font-weight:700;">Inference Defense & Security Policies</h2>
          <p style="font-size:12px; color:var(--secondary-text);">
            Define minimum cohort cell thresholds, differential privacy epsilon budgets, and canary tripwire actions.
          </p>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:12px;">
          ${policies.map(p => `
            <div class="card" style="${p.id === activeId ? 'border-color:var(--primary-blue); box-shadow:0 0 0 2px rgba(37, 99, 235, 0.15);' : ''}">
              <div class="card-header">
                <span class="card-title">
                  ${getIcon('shield')} ${escapeHtml(p.name)}
                </span>
                ${p.id === activeId ? '<span class="decision-badge ALLOW" style="font-size:10px;">ACTIVE</span>' : ''}
              </div>
              <div class="card-body" style="display:flex; flex-direction:column; gap:8px; font-size:12px;">
                <p style="color:var(--secondary-text);">${escapeHtml(p.description)}</p>
                
                <div style="display:flex; justify-content:space-between; border-top:1px solid #F1F5F9; padding-top:6px;">
                  <span style="color:var(--secondary-text);">Min Cohort Cell Size (k):</span>
                  <strong>≥ ${p.min_cell_size} records</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:var(--secondary-text);">Differencing Threshold:</span>
                  <strong>${p.differencing_threshold * 100}% variance</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:var(--secondary-text);">Differential Privacy:</span>
                  <strong>${p.differential_privacy_required ? 'Required (ε=' + p.default_epsilon + ')' : 'Conditional'}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:var(--secondary-text);">Max Session ε Budget:</span>
                  <strong>${p.epsilon_budget_max}</strong>
                </div>
                <div style="display:flex; justify-content:space-between;">
                  <span style="color:var(--secondary-text);">Canary Data Protection:</span>
                  <strong style="color:var(--blocked);">Auto-Block IP</strong>
                </div>

                <div style="margin-top:6px;">
                  ${p.id === activeId ? `
                    <button class="btn btn-secondary btn-sm" style="width:100%;" disabled>Currently Applied</button>
                  ` : `
                    <button class="btn btn-primary btn-sm" style="width:100%;" onclick="App.selectPolicy('${p.id}')">Apply Policy</button>
                  `}
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  // 7. Audit Logs View
  renderAuditLogs(state) {
    const logs = state.auditLogs || [];
    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <div>
            <h2 style="font-size:15px; font-weight:700;">Cryptographic Audit Logs (Tamper-Evident)</h2>
            <p style="font-size:12px; color:var(--secondary-text);">
              Immutable append-only ledger with SHA-256 chain links for compliance verification.
            </p>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary btn-sm" onclick="App.verifyAuditChain()">
              ${getIcon('check')} Verify Integrity
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.exportAuditLogs('json')">
              ${getIcon('download')} JSON
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.exportAuditLogs('csv')">
              ${getIcon('download')} CSV
            </button>
          </div>
        </div>

        <div class="table-container">
          <table class="recon-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Timestamp (UTC)</th>
                <th>User / Role</th>
                <th>Event Type</th>
                <th>Decision</th>
                <th>Executed</th>
                <th>Query</th>
                <th>SHA-256 Record Hash</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td><strong>#${l.id}</strong></td>
                  <td style="white-space:nowrap; font-size:11px;">${l.timestamp}</td>
                  <td>${escapeHtml(l.user)} <span style="color:var(--secondary-text); font-size:10px;">(${l.role})</span></td>
                  <td><span style="font-size:11px; font-weight:600;">${escapeHtml(l.event_type)}</span></td>
                  <td><span class="decision-badge ${l.decision}">${l.decision}</span></td>
                  <td>${l.executed ? '<span style="color:var(--success); font-weight:600;">YES</span>' : '<span style="color:var(--blocked); font-weight:600;">NO</span>'}</td>
                  <td><div class="code-preview" style="max-width:200px; max-height:36px; overflow:hidden;">${escapeHtml(l.query)}</div></td>
                  <td><span style="font-family:var(--font-mono); font-size:10px; color:var(--secondary-text);">${l.record_hash ? l.record_hash.substring(0, 16) + '...' : '-'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  // 8. Settings View
  renderSettings(state) {
    const user = state.proxyStatus?.authenticated_user || { username: 'sec_admin', role: 'admin' };
    const users = state.availableUsers || [];

    return `
      <div style="display:flex; flex-direction:column; gap:12px; max-width:760px;">
        <div>
          <h2 style="font-size:15px; font-weight:700;">Proxy Settings & RBAC Management</h2>
          <p style="font-size:12px; color:var(--secondary-text);">
            Configure identity roles, proxy listening interface, and fail-safe policy modes.
          </p>
        </div>

        <!-- RBAC Role Switcher Card -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">${getIcon('user')} Active User Role Switcher</span>
          </div>
          <div class="card-body">
            <p style="font-size:12px; color:var(--secondary-text); margin-bottom:10px;">
              Test how different organization roles experience security decisions, microdata restrictions, and execution permissions.
            </p>
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:8px;">
              ${users.map(u => `
                <div style="border:1px solid ${u.username === user.username ? 'var(--primary-blue)' : 'var(--border)'}; border-radius:var(--radius-sm); padding:8px; background:${u.username === user.username ? 'var(--active-nav-bg)' : '#FFFFFF'};">
                  <div style="font-weight:700; font-size:12.5px;">${escapeHtml(u.username)}</div>
                  <div style="font-size:11px; color:var(--primary-blue); font-weight:600; text-transform:uppercase;">${escapeHtml(u.role)}</div>
                  <div style="font-size:10.5px; color:var(--secondary-text); margin-top:2px;">${escapeHtml(u.department)}</div>
                  <div style="margin-top:6px;">
                    ${u.username === user.username ? `
                      <span class="decision-badge ALLOW" style="font-size:9.5px;">ACTIVE</span>
                    ` : `
                      <button class="btn btn-secondary btn-sm" onclick="App.switchUser('${u.username}')">Switch Identity</button>
                    `}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- System Architecture Card -->
        <div class="card">
          <div class="card-header">
            <span class="card-title">${getIcon('settings')} Engine Configuration</span>
          </div>
          <div class="card-body" style="font-size:12px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--secondary-text);">Proxy Interface:</span>
              <strong>127.0.0.1:8000 (Local HTTP/Proxy)</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--secondary-text);">Enforcement Strategy:</span>
              <strong>Fail-Closed (Zero-Trust Gating)</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--secondary-text);">Audit Ledger:</span>
              <strong>SHA-256 Chained Memory / Persistent Database</strong>
            </div>
            <div style="display:flex; justify-content:space-between;">
              <span style="color:var(--secondary-text);">Theme:</span>
              <strong>Mandatory Light Mode (Strict Palette)</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  // 9. Secondary Datasets & Schema Explorer
  renderDatasets(state) {
    const datasets = state.datasets || [];
    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <h2 style="font-size:15px; font-weight:700;">Protected Datasets & Schema Explorer</h2>
          <p style="font-size:12px; color:var(--secondary-text);">
            Explore protected relational tables across Healthcare, Banking, Corporate HR, and Retail sectors.
          </p>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:12px;">
          ${datasets.map(d => `
            <div class="card">
              <div class="card-header">
                <span class="card-title">${getIcon('database')} ${escapeHtml(d.sector)}</span>
                <span class="decision-badge ALLOW" style="font-size:9.5px;">${escapeHtml(d.compliance)}</span>
              </div>
              <div class="card-body" style="font-size:12px; display:flex; flex-direction:column; gap:8px;">
                <p style="color:var(--secondary-text);">${escapeHtml(d.description)}</p>
                <div style="padding:6px 8px; background:#FEF2F2; border:1px solid #FCA5A5; border-radius:var(--radius-sm); font-size:11px;">
                  <strong style="color:var(--blocked);">Honeytoken Canary Trap:</strong> ${escapeHtml(d.canary_record)}
                </div>

                <div style="margin-top:6px;">
                  <span class="strip-label">Tables & Columns:</span>
                  <div style="display:flex; flex-direction:column; gap:6px; margin-top:4px;">
                    ${d.tables.map(t => `
                      <div style="border:1px solid var(--border); border-radius:var(--radius-sm); padding:6px 8px;">
                        <div style="display:flex; justify-content:space-between; font-weight:700;">
                          <span>${escapeHtml(t.table_name)}</span>
                          <span style="font-size:11px; color:var(--secondary-text);">${t.row_count} rows</span>
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
                          ${t.columns.map(c => `
                            <span style="font-size:10.5px; padding:1px 5px; border-radius:3px; background:${c.sensitivity === 'CRITICAL' ? '#FEE2E2' : c.sensitivity === 'HIGH' ? '#FEF3C7' : '#F1F5F9'}; color:${c.sensitivity === 'CRITICAL' ? '#DC2626' : c.sensitivity === 'HIGH' ? '#B45309' : 'inherit'};">
                              ${escapeHtml(c.name)}
                            </span>
                          `).join('')}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  },

  // 10. Secondary Analytics & Investigation
  renderAnalytics(state) {
    const analytics = state.analytics || { summary: {}, decision_breakdown: {}, attack_vectors: {}, risk_distribution: {} };
    const s = analytics.summary || {};
    const dec = analytics.decision_breakdown || {};
    const att = analytics.attack_vectors || {};
    const risk = analytics.risk_distribution || {};

    return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div>
          <h2 style="font-size:15px; font-weight:700;">Secondary Investigation & Threat Analytics</h2>
          <p style="font-size:12px; color:var(--secondary-text);">
            Deep-dive forensic telemetry, inference attack distributions, and differential privacy loss telemetry.
          </p>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
          <div class="card" style="padding:10px;">
            <span class="strip-label">Queries Inspected</span>
            <div style="font-size:22px; font-weight:800; color:var(--primary-text);">${s.total_queries_analyzed || 0}</div>
          </div>
          <div class="card" style="padding:10px;">
            <span class="strip-label">Attacks Blocked</span>
            <div style="font-size:22px; font-weight:800; color:var(--blocked);">${s.blocked_attacks || 0}</div>
          </div>
          <div class="card" style="padding:10px;">
            <span class="strip-label">Security Alerts</span>
            <div style="font-size:22px; font-weight:800; color:var(--warning);">${s.total_security_events || 0}</div>
          </div>
          <div class="card" style="padding:10px;">
            <span class="strip-label">Privacy Budget Spent</span>
            <div style="font-size:22px; font-weight:800; color:var(--primary-blue);">${s.dp_budget_spent || 0} / ${s.dp_budget_max || 5} ε</div>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
          <div class="card">
            <div class="card-header">
              <span class="card-title">${getIcon('barChart')} Enforcement Decisions</span>
            </div>
            <div class="card-body">
              ${Object.entries(dec).map(([k, v]) => `
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; font-size:12px;">
                  <span class="decision-badge ${k}">${k}</span>
                  <strong>${v} requests</strong>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <span class="card-title">${getIcon('alertTriangle')} Identified Attack Vectors</span>
            </div>
            <div class="card-body">
              ${Object.entries(att).map(([k, v]) => `
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px; font-size:12px;">
                  <span>${escapeHtml(k)}</span>
                  <strong style="color:${v > 0 ? 'var(--blocked)' : 'inherit'};">${v}</strong>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `;
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
