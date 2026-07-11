'use client';

import { useEffect, useState, useCallback } from 'react';

// Small wrapper around fetch that always returns { ok, data, error } and
// never throws, so every call site can handle failure the same way
// (including the network being down entirely, which fetch itself would throw on).
async function apiRequest(url, options) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      // Non-JSON or empty response body - fine for some endpoints.
    }

    if (!res.ok) {
      return { ok: false, error: data?.error || `Request failed (${res.status}).`, data };
    }

    return { ok: true, data };
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
  }
}

export default function ShadowRewardsPortal() {
  const [isMounted, setIsMounted] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [splashLeaving, setSplashLeaving] = useState(false);

  const [view, setView] = useState('user-portal');
  const [activeTab, setActiveTab] = useState('generate');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // --- redemption form state ---
  const [code, setCode] = useState('');
  const [discordUser, setDiscordUser] = useState('');
  const [redeemStatus, setRedeemStatus] = useState('idle'); // idle | loading | success
  const [redeemError, setRedeemError] = useState('');

  // --- staff login state ---
  const [staffUser, setStaffUser] = useState('');
  const [staffPass, setStaffPass] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // --- staff dashboard state ---
  const [codesList, setCodesList] = useState([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [codesError, setCodesError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [latestCode, setLatestCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const leaveTimer = setTimeout(() => setSplashLeaving(true), 1900);
    const hideTimer = setTimeout(() => setShowSplash(false), 2300);

    // Restore staff session if the cookie is still valid, so a refresh
    // doesn't kick a logged-in staff member back to the login screen.
    (async () => {
      const { ok, data } = await apiRequest('/api/staff/session');
      if (ok && data?.loggedIn) {
        setIsLoggedIn(true);
        setView('staff-dashboard');
      }
      setCheckingSession(false);
    })();

    return () => {
      clearTimeout(leaveTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  const fetchCodes = useCallback(async () => {
    setCodesLoading(true);
    setCodesError('');

    const { ok, data, error } = await apiRequest('/api/staff/codes');

    if (!ok) {
      if (error && error.toLowerCase().includes('session')) {
        setIsLoggedIn(false);
        setView('staff-login');
        setLoginError('Your session expired. Please log in again.');
      } else {
        setCodesError(error || 'Could not load codes.');
      }
      setCodesLoading(false);
      return;
    }

    setCodesList(data?.codes || []);
    setCodesLoading(false);
  }, []);

  useEffect(() => {
    if (isLoggedIn && view === 'staff-dashboard' && activeTab === 'codes') {
      fetchCodes();
    }
  }, [isLoggedIn, view, activeTab, fetchCodes]);

  const handleRedeemSubmit = async (e) => {
    e.preventDefault();
    setRedeemError('');

    const cleanCode = code.trim();
    const cleanUser = discordUser.trim();

    if (!cleanCode || !cleanUser) {
      setRedeemError('Please fill in both fields.');
      return;
    }

    setRedeemStatus('loading');

    const { ok, error } = await apiRequest('/api/redeem', {
      method: 'POST',
      body: JSON.stringify({ code: cleanCode, discordUsername: cleanUser }),
    });

    if (!ok) {
      setRedeemError(error || 'Submission failed. Please try again.');
      setRedeemStatus('idle');
      return;
    }

    setRedeemStatus('success');
    setCode('');
    setDiscordUser('');
  };

  const handleStaffLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    const { ok, error } = await apiRequest('/api/staff/login', {
      method: 'POST',
      body: JSON.stringify({ username: staffUser, password: staffPass }),
    });

    setLoginLoading(false);

    if (!ok) {
      setLoginError(error || 'Invalid credentials.');
      return;
    }

    setIsLoggedIn(true);
    setView('staff-dashboard');
    setActiveTab('generate');
    setStaffUser('');
    setStaffPass('');
    setLatestCode(null);
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    await apiRequest('/api/staff/logout', { method: 'POST' });
    setLogoutLoading(false);
    setIsLoggedIn(false);
    setView('user-portal');
    setLatestCode(null);
    setCodesList([]);
  };

  const handleGenerateCode = async () => {
    setGenerating(true);
    setGenerateError('');

    const { ok, data, error } = await apiRequest('/api/staff/generate-code', { method: 'POST' });

    if (!ok) {
      if (error && error.toLowerCase().includes('session')) {
        setIsLoggedIn(false);
        setView('staff-login');
        setLoginError('Your session expired. Please log in again.');
      } else {
        setGenerateError(error || 'Could not generate a code.');
      }
      setGenerating(false);
      return;
    }

    setLatestCode(data.code);
    setCopied(false);
    setGenerating(false);
  };

  const handleCopyCode = async () => {
    if (!latestCode) return;
    try {
      await navigator.clipboard.writeText(latestCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API can fail (permissions, insecure context) - not worth alarming the user over.
      setCopied(false);
    }
  };

  if (!isMounted) return null;

  // 1. WELCOME / SPLASH SCREEN
  if (showSplash) {
    return (
      <div className={`splash-wrapper ${splashLeaving ? 'splash-leaving' : ''}`}>
        <div className="splash-content">
          <div className="splash-word">Shadow</div>
          <div className="splash-rule" />
          <div className="splash-sub">REWARDS</div>
        </div>
      </div>
    );
  }

  // 2. MAIN APPLICATION
  return (
    <div className="wrapper page-transition">
      <div className="nav-bar">
        <div className="nav-brand">Shadow</div>
        <div className="nav-actions">
          {view === 'user-portal' && (
            <button className="nav-link" onClick={() => setView('staff-login')}>
              Staff Portal
            </button>
          )}
          {view === 'staff-login' && (
            <button className="nav-link" onClick={() => setView('user-portal')}>
              Back to redemption
            </button>
          )}
          {isLoggedIn && (
            <button className="nav-link nav-link-danger" onClick={handleLogout} disabled={logoutLoading}>
              {logoutLoading ? 'Signing out…' : 'Log out'}
            </button>
          )}
        </div>
      </div>

      <div className="container animate-panel-entry">
        {view === 'user-portal' &&
          (redeemStatus !== 'success' ? (
            <>
              <div className="eyebrow">Reward redemption</div>
              <h1 className="heading">Redeem your code</h1>
              <p className="subtitle">
                Enter the code you received and your Discord username. Once verified, your reward will be
                sent to you by DM.
              </p>

              <form onSubmit={handleRedeemSubmit} noValidate>
                <div className="form-group">
                  <label htmlFor="code">Redemption code</label>
                  <input
                    id="code"
                    type="text"
                    className="input-code"
                    placeholder="SHDW-XXXX-XXXX"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    autoComplete="off"
                    disabled={redeemStatus === 'loading'}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="discord">Discord username</label>
                  <input
                    id="discord"
                    type="text"
                    placeholder="yourname"
                    value={discordUser}
                    onChange={(e) => setDiscordUser(e.target.value)}
                    autoComplete="off"
                    disabled={redeemStatus === 'loading'}
                  />
                </div>

                {redeemError && <p className="error-msg">{redeemError}</p>}

                <button type="submit" className="btn" disabled={redeemStatus === 'loading'}>
                  {redeemStatus === 'loading' ? 'Submitting…' : 'Redeem reward'}
                </button>
              </form>
            </>
          ) : (
            <div className="animate-scale-up">
              <div className="success-icon">✓</div>
              <div className="heading">Code redeemed</div>
              <p className="subtitle" style={{ marginBottom: '1.5rem' }}>
                Your redemption has been recorded.
              </p>
              <div className="notice-box">
                <strong>What happens next</strong>
                <br />
                Staff will review your redemption and send your reward directly to your Discord DMs.
                Please make sure your DMs are open.
              </div>
              <button className="btn secondary" onClick={() => setRedeemStatus('idle')}>
                Redeem another code
              </button>
            </div>
          ))}

        {view === 'staff-login' && (
          <div>
            <div className="eyebrow">Internal access</div>
            <h1 className="heading">Staff sign in</h1>
            <p className="subtitle">Authorized personnel only.</p>

            {checkingSession ? (
              <p className="subtitle">Checking session…</p>
            ) : (
              <form onSubmit={handleStaffLogin} noValidate>
                <div className="form-group">
                  <label htmlFor="staff-user">Username</label>
                  <input
                    id="staff-user"
                    type="text"
                    value={staffUser}
                    onChange={(e) => setStaffUser(e.target.value)}
                    autoComplete="username"
                    disabled={loginLoading}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="staff-pass">Password</label>
                  <input
                    id="staff-pass"
                    type="password"
                    value={staffPass}
                    onChange={(e) => setStaffPass(e.target.value)}
                    autoComplete="current-password"
                    disabled={loginLoading}
                  />
                </div>
                {loginError && <p className="error-msg">{loginError}</p>}
                <button type="submit" className="btn" disabled={loginLoading}>
                  {loginLoading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            )}
          </div>
        )}

        {view === 'staff-dashboard' && isLoggedIn && (
          <div className="dashboard-layout">
            <div className="tabs-header">
              <button
                className={`tab-btn ${activeTab === 'generate' ? 'active' : ''}`}
                onClick={() => setActiveTab('generate')}
              >
                Generate code
              </button>
              <button
                className={`tab-btn ${activeTab === 'codes' ? 'active' : ''}`}
                onClick={() => setActiveTab('codes')}
              >
                All codes
              </button>
            </div>

            {activeTab === 'generate' && (
              <div className="tab-content animate-fade-in">
                <p className="subtitle" style={{ marginBottom: '1.5rem' }}>
                  Generate a one-time code and hand it to the user. It becomes redeemed the moment they
                  submit it, so keep track of who you give it to.
                </p>

                <button className="btn" onClick={handleGenerateCode} disabled={generating}>
                  {generating ? 'Generating…' : 'Generate new code'}
                </button>

                {generateError && <p className="error-msg" style={{ marginTop: '1rem' }}>{generateError}</p>}

                {latestCode && (
                  <div className="code-result">
                    <div className="code-result-label">New code</div>
                    <div className="code-result-value">{latestCode}</div>
                    <button className="btn secondary copy-btn" onClick={handleCopyCode}>
                      {copied ? 'Copied' : 'Copy code'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'codes' && (
              <div className="tab-content animate-fade-in">
                <div className="list-meta">
                  <span>{codesList.length} total</span>
                  <button className="refresh-btn" onClick={fetchCodes} disabled={codesLoading}>
                    {codesLoading ? 'Syncing…' : '⟳ Refresh'}
                  </button>
                </div>

                {codesError && <p className="error-msg">{codesError}</p>}

                <div className="codes-table-wrapper">
                  {!codesLoading && codesList.length === 0 && !codesError ? (
                    <p className="empty-message">No codes generated yet.</p>
                  ) : (
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Status</th>
                          <th>Redeemed by</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {codesList.map((c, index) => (
                          <tr
                            key={c.id || index}
                            className="table-row-animate"
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <td className="code-cell">{c.code}</td>
                            <td>
                              <span className={`status-pill ${c.status === 'redeemed' ? 'status-redeemed' : 'status-unused'}`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="username-cell">
                              {c.redeemed_by ? `@${c.redeemed_by}` : '—'}
                            </td>
                            <td className="date-cell">
                              {new Date(c.redeemed_at || c.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
