import { useCallback, useEffect, useState } from "react";
import {
  adminPosts,
  adminUsers,
  adminDeletePost,
  adminDeleteUser,
  ApiError,
} from "./api";
import { getToken, setToken, clearToken } from "./tokenStore";

// We inject the desktop-specific CSS right here so we don't have to touch agri-market.css
const DESKTOP_CSS = `
  /* Base Mobile/Tablet Styles */
  .am-admin-root {
    min-height: 100dvh;
    background: #0b141a;
    font-family: "Poppins", system-ui, "Segoe UI", Roboto, sans-serif;
    color: #e9edef;
    display: flex;
    justify-content: center;
    padding: 24px 16px;
  }
  .am-admin-shell { width: 100%; max-width: 760px; }
  .am-admin-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .am-admin-header h1 { font-size: 20px; margin: 0; }
  .am-admin-tabs { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
  .am-admin-tab {
    border: none; background: #202c33; color: #8696a0; font-weight: 500; font-size: 13px;
    padding: 9px 14px; border-radius: 999px; cursor: pointer; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  }
  .am-admin-tab.active { background: #e9edef; color: #fff; }
  
  .am-btn {
    border: none; background: #008069; color: #fff; font-weight: 600; font-size: 14px;
    padding: 11px 18px; border-radius: 12px; cursor: pointer; transition: opacity 0.2s;
  }
  .am-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .am-btn.secondary { background: #0b141a; color: #e9edef; border: 1px solid #2a3942; }
  .am-btn.danger { background: #fdecea; color: #f15c6d; }
  
  .am-admin-card {
    background: #202c33; border-radius: 16px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    padding: 14px 16px; margin-bottom: 10px;
  }
  .am-admin-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .am-admin-row-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
  .am-post-line { font-size: 13.5px; color: #8696a0; margin: 0; }
  .am-mono { font-family: monospace; font-size: 12.5px; color: #8696a0; }
  
  .am-status-pill {
    font-size: 11.5px; font-weight: 600; padding: 4px 10px; border-radius: 999px;
    white-space: nowrap; background: #182229; color: #ffbc38;
  }
  .am-status-pill.closed { background: #2a3942; color: #8696a0; }
  .am-status-pill.matched { background: #005c4b; color: #d9fdd3; }
  
  .am-empty { text-align: center; color: #8696a0; font-size: 13.5px; padding: 28px 10px; }
  .am-error-banner {
    background: #3b1e20; color: #f15c6d; border-radius: 12px; padding: 10px 14px; font-size: 13px; margin-bottom: 14px;
  }
  
  .am-login-card {
    max-width: 360px; margin: 60px auto; background: #202c33; border-radius: 22px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45); padding: 28px 24px; text-align: center;
  }
  .am-login-card h2 { margin: 0 0 6px; font-size: 19px; }
  .am-login-card p { color: #8696a0; font-size: 13px; margin: 0 0 18px; }
  .am-login-card input {
    width: 100%; box-sizing: border-box; border: none; background: #2a3942; color: #e9edef;
    border-radius: 12px; padding: 12px 14px; font-size: 14px; margin-bottom: 12px;
  }

  /* Desktop Overrides (Screens 900px and wider) */
  @media (min-width: 900px) {
    .am-admin-root { padding: 40px; background: #0f171e; }
    .am-admin-shell { max-width: 1200px; margin: 0 auto; }
    .am-admin-header { border-bottom: 1px solid #2a3942; padding-bottom: 20px; margin-bottom: 24px; }
    .am-admin-header h1 { font-size: 28px; letter-spacing: -0.5px; }
    .am-admin-tabs { gap: 12px; margin-bottom: 24px; }
    .am-admin-tab { padding: 12px 24px; font-size: 15px; border-radius: 8px; transition: all 0.2s; }
    .am-admin-tab.active { background: #008069; color: #fff; box-shadow: 0 4px 12px rgba(0, 128, 105, 0.3); }
    
    /* Turn the lists into a professional grid layout */
    .am-admin-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 20px;
      align-items: start;
    }
    
    .am-admin-card {
      background: #202c33; border: 1px solid #2a3942; padding: 20px; border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1); transition: transform 0.2s; margin-bottom: 0;
    }
    .am-admin-card:hover { transform: translateY(-2px); border-color: #3b4a54; }
    .am-admin-card-top strong { font-size: 18px; }
    .am-post-line { font-size: 14px; margin-top: 6px; }
    .am-admin-row-actions { margin-top: 16px; padding-top: 16px; border-top: 1px solid #2a3942; }
    
    /* The print bar at the top spans the whole grid */
    .am-print-bar {
      grid-column: 1 / -1; 
      background: #202c33; 
      border-left: 4px solid #008069;
      display: flex; gap: 8px; flex-wrap: wrap; align-items: center;
      padding: 16px 20px; border-radius: 12px;
      margin-bottom: 10px;
    }
  }
`;

function pickList(data, ...keys) {
  if (Array.isArray(data)) return data;
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

function verifyToken(token) {
  return adminUsers(token);
}

/* -------------------------------------------------------------------------- */
/* Print helpers (Optimized for Desktop Printers)                             */
/* -------------------------------------------------------------------------- */

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("rw-RW", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 15mm; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif; color: #000; margin: 0;
    font-size: 12pt; line-height: 1.5;
  }
  h1 { font-size: 20pt; margin: 0 0 8px; color: #000; }
  .meta { color: #444; font-size: 10pt; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
  .brand { color: #18864B; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #666; padding: 8px 10px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; font-weight: bold; }
  tr { page-break-inside: avoid; }
  .footer { margin-top: 30px; font-size: 9pt; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 10px; }
`;

function printHTML(title, bodyHTML) {
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) {
    alert("Reba niba browser yemera pop-up kugira ngo dushobore gucapa.");
    return;
  }

  const doc = `<!doctype html>
<html lang="rw">
<head>
<meta charset="utf-8" />
<title>${escapeHTML(title)}</title>
<style>${PRINT_STYLES}</style>
</head>
<body onload="window.print(); setTimeout(()=>window.close(), 1000);">
${bodyHTML}
<div class="footer">Zao Deal — Admin Report · Generated: ${escapeHTML(formatDate(new Date().toISOString()))}</div>
</body>
</html>`;

  win.document.open();
  win.document.write(doc);
  win.document.close();
}

function printAllPosts(posts) {
  const rows = posts.map((p) => `
    <tr>
      <td>${escapeHTML(p.product || "—")}</td>
      <td>${escapeHTML(`${p.quantity ?? ""} ${p.unit || "kg"}`.trim())}</td>
      <td>${escapeHTML(p.location || "—")}</td>
      <td>${p.price_per_kg != null ? `${escapeHTML(p.price_per_kg)} Frw/kg` : "—"}</td>
      <td>${escapeHTML(p.name || "—")}</td>
      <td>${escapeHTML(p.whatsapp || "—")}</td>
      <td><b>${escapeHTML((p.status || "new").toUpperCase())}</b></td>
      <td>${escapeHTML(formatDate(p.created_at))}</td>
    </tr>`).join("");

  printHTML(
    "Zao Deal - Posts zose",
    `
      <h1>Zao Deal — <span class="brand">Posts zose</span></h1>
      <div class="meta">Umubare w'ama posts: <strong>${posts.length}</strong></div>
      <table>
        <thead>
          <tr>
            <th>Umusaruro</th><th>Ingano</th><th>Aho biherereye</th><th>Igiciro</th>
            <th>Umuhinzi</th><th>Telefoni</th><th>Status</th><th>Igihe</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `
  );
}

function printSinglePost(post) {
  const rows = [
    ["Umusaruro", post.product || "—"],
    ["Ingano", `${post.quantity ?? ""} ${post.unit || "kg"}`.trim() || "—"],
    ["Aho biherereye", post.location || "—"],
    ["Igiciro usaba", post.price_per_kg != null ? `${post.price_per_kg} Frw/kg` : "—"],
    ["Umuhinzi", post.name || "—"],
    ["Telefoni", post.whatsapp || "—"],
    ["Status", (post.status || "new").toUpperCase()],
    ["Yatanzwe", formatDate(post.created_at)],
    ["Yahinduwe", formatDate(post.updated_at)],
  ].map(([k, v]) => `<tr><th>${escapeHTML(k)}</th><td>${escapeHTML(v)}</td></tr>`).join("");

  printHTML(
    `Zao Deal - ${post.product || "Post"}`,
    `
      <h1>Zao Deal — <span class="brand">Raporo y'umusaruro</span></h1>
      <div class="meta">Post ID: <strong>${escapeHTML(post.id || "—")}</strong></div>
      <table style="max-width: 600px;"><tbody>${rows}</tbody></table>
    `
  );
}

/* -------------------------------------------------------------------------- */
/* Components                                                                 */
/* -------------------------------------------------------------------------- */

function LoginScreen({ onLoggedIn }) {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!value.trim()) return setError("Andika PIN.");

    setChecking(true);
    setError(null);
    try {
      await verifyToken(value.trim());
      setToken(value.trim());
      onLoggedIn();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? "PIN siyo. Ongera ugerageze."
          : err.message || "Ntibishoboka kwinjira."
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="am-admin-root">
      <div className="am-login-card">
        <h2>🔐 Zao Deal Admin</h2>
        <p>Andika PIN kugira ngo ubone dashboard.</p>
        <form onSubmit={submit}>
          <input type="password" inputMode="numeric" placeholder="Admin PIN" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
          {error && <p style={{ color: "#f15c6d", fontSize: 13, marginBottom: 10 }}>{error}</p>}
          <button className="am-btn" type="submit" disabled={checking} style={{ width: "100%" }}>
            {checking ? "Turimo kureba..." : "Injira"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PostsTab() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await adminPosts(getToken());
      setPosts(pickList(data, "posts"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(id, fn) {
    if(!window.confirm("Urakomeza ushaka gusiba iyi post?")) return;
    setBusyId(id);
    try {
      await fn(id, getToken());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="am-empty">Turimo gupakira...</p>;

  return (
    <div className="am-admin-grid">
      {error && <div className="am-error-banner" style={{ gridColumn: "1 / -1" }}>{error}</div>}

      <div className="am-print-bar">
        <strong style={{ fontSize: 16, flex: 1 }}>
          🖨️ Raporo
        </strong>
        <button className="am-btn" disabled={posts.length === 0} onClick={() => printAllPosts(posts)}>
          Chapisha posts zose ({posts.length})
        </button>
      </div>

      {posts.length === 0 ? (
        <p className="am-empty" style={{ gridColumn: "1 / -1" }}>Nta posts ahari.</p>
      ) : (
        posts.map((p) => (
          <div className="am-admin-card" key={p.id}>
            <div className="am-admin-card-top">
              <div>
                <strong>{p.type === "offer" ? "🌾" : "🛒"} {p.product}</strong>
                <p className="am-post-line">{p.quantity} {p.unit || "kg"} · 📍 {p.location}</p>
                {p.type === "offer" && p.price_per_kg != null && (
                  <p className="am-post-line">💰 {p.price_per_kg} Frw/kg</p>
                )}
                <p className="am-post-line">{p.type === "offer" ? "👤" : "🏢"} {p.name || "—"}</p>
                <p className="am-mono">☎ {p.whatsapp || "—"}</p>
              </div>
              <span className={`am-status-pill ${p.status || "new"}`}>{p.status || "new"}</span>
            </div>
            <div className="am-admin-row-actions">
              <button className="am-btn secondary" onClick={() => printSinglePost(p)}>🖨️ Chapisha</button>
              <button className="am-btn danger" disabled={busyId === p.id} onClick={() => act(p.id, adminDeletePost)}>
                Siba
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await adminUsers(getToken());
      setUsers(pickList(data, "users"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id) {
    if(!window.confirm("Urakomeza ushaka gusiba uyu muntu n'ama posts ye yose?")) return;
    setBusyId(id);
    try {
      await adminDeleteUser(id, getToken());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="am-empty">Turimo gupakira...</p>;

  return (
    <div className="am-admin-grid">
      {error && <div className="am-error-banner" style={{ gridColumn: "1 / -1" }}>{error}</div>}
      
      {users.length === 0 ? (
        <p className="am-empty" style={{ gridColumn: "1 / -1" }}>Nta bakoresha bahari.</p>
      ) : (
        users.map((u) => (
          <div className="am-admin-card" key={u.id}>
            <div className="am-admin-card-top">
              <div>
                <strong>{u.name || "—"}</strong>
                <p className="am-post-line">
                  {u.role === "seller" ? "🌾 Umuhinzi" : "🛒 Umuguzi"} · {u.post_count ?? 0} posts
                </p>
                <p className="am-mono">☎ {u.whatsapp || "—"}</p>
              </div>
              <span className={`am-status-pill ${u.blocked ? "closed" : "matched"}`}>
                {u.blocked ? "Blocked" : "Active"}
              </span>
            </div>
            <div className="am-admin-row-actions">
              <button className="am-btn danger" disabled={busyId === u.id} onClick={() => remove(u.id)}>
                Siba
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const TABS = [
  { key: "posts", label: "Raporo", Comp: PostsTab },
  { key: "users", label: "Abashyizeho Umusaruro", Comp: UsersTab },
];

export default function AdminDashboard() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState("posts");

  useEffect(() => {
    const existing = getToken();
    if (existing) {
      verifyToken(existing).then(() => setLoggedIn(true)).catch(() => clearToken()).finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, []);

  if (!ready) return null;
  if (!loggedIn) return <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;

  const Active = TABS.find((t) => t.key === tab)?.Comp || PostsTab;

  return (
    <>
      <style>{DESKTOP_CSS}</style>
      <div className="am-admin-root">
        <div className="am-admin-shell">
          <div className="am-admin-header">
            <h1>🔐 Zao Deal Admin</h1>
            <button className="am-btn secondary" onClick={() => { clearToken(); setLoggedIn(false); }}>
              Sohoka
            </button>
          </div>
          <div className="am-admin-tabs">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`am-admin-tab ${tab === t.key ? "active" : ""}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <Active />
        </div>
      </div>
    </>
  );
}