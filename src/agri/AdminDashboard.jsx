import { useCallback, useEffect, useState } from "react";
import "./agri-market.css";
import {
  adminPosts,
  adminUsers,
  adminReports,
  adminDeletePost,
  adminDeleteUser,
  ApiError,
} from "./api";
import { getToken, setToken, clearToken } from "./tokenStore";

function pickList(data, ...keys) {
  if (Array.isArray(data)) return data;
  for (const k of keys) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

// There's no /api/admin/dashboard route on the Worker, so we validate the
// token with a real admin call instead.
function verifyToken(token) {
  return adminUsers(token);
}

/* -------------------------------------------------------------------------- */
/* Print helpers                                                              */
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
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
}

const PRINT_STYLES = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif;
    color: #111;
    margin: 0;
    font-size: 12px;
  }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2 { font-size: 14px; margin: 18px 0 6px; }
  .meta { color: #555; font-size: 11px; margin-bottom: 14px; }
  .brand { color: #18864B; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th, td {
    border: 1px solid #d0d5da;
    padding: 6px 7px;
    text-align: left;
    vertical-align: top;
    font-size: 11px;
  }
  th { background: #f0f4f7; font-weight: 700; }
  tr { page-break-inside: avoid; }
  .kv { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .kv th { width: 34%; background: #f0f4f7; }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 8px; border: 1px solid #c8d0d8; font-size: 10.5px; }
  .footer { margin-top: 18px; font-size: 10px; color: #666; text-align: center; }
  @media print {
    .no-print { display: none !important; }
  }
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
<body>
${bodyHTML}
<div class="footer">Zao Deal — Admin Report · ${escapeHTML(formatDate(new Date().toISOString()))}</div>
</body>
</html>`;

  win.document.open();
  win.document.write(doc);
  win.document.close();

  win.focus();
  // Give the browser a tick to lay out, then print.
  setTimeout(() => {
    try {
      win.print();
    } catch {
      /* ignore */
    }
  }, 250);

  win.addEventListener("afterprint", () => {
    try {
      win.close();
    } catch {
      /* ignore */
    }
  });
}

function printAllPosts(posts) {
  const rows = posts
    .map(
      (p) => `
        <tr>
          <td>${escapeHTML(p.product || "—")}</td>
          <td>${escapeHTML(`${p.quantity ?? ""} ${p.unit || "kg"}`.trim())}</td>
          <td>${escapeHTML(p.location || "—")}</td>
          <td>${p.price_per_kg != null ? `${escapeHTML(p.price_per_kg)} Frw/kg` : "—"}</td>
          <td>${escapeHTML(p.name || "—")}</td>
          <td>${escapeHTML(p.whatsapp || "—")}</td>
          <td><span class="badge">${escapeHTML(p.status || "new")}</span></td>
          <td>${escapeHTML(formatDate(p.created_at))}</td>
        </tr>`
    )
    .join("");

  printHTML(
    "Zao Deal — Posts zose",
    `
      <h1>Zao Deal — <span class="brand">Posts zose</span></h1>
      <div class="meta">
        Umubare w'ama posts: <strong>${posts.length}</strong>
      </div>
      <table>
        <thead>
          <tr>
            <th>Umusaruro</th>
            <th>Ingano</th>
            <th>Aho biherereye</th>
            <th>Igiciro</th>
            <th>Umuhinzi</th>
            <th>Telefoni</th>
            <th>Status</th>
            <th>Igihe</th>
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
    [
      "Igiciro usaba",
      post.price_per_kg != null ? `${post.price_per_kg} Frw/kg` : "—",
    ],
    ["Umuhinzi", post.name || "—"],
    ["Telefoni", post.whatsapp || "—"],
    ["Status", post.status || "new"],
    ["Yatanzwe", formatDate(post.created_at)],
    ["Yahinduwe", formatDate(post.updated_at)],
  ]
    .map(
      ([k, v]) => `
        <tr>
          <th>${escapeHTML(k)}</th>
          <td>${escapeHTML(v)}</td>
        </tr>`
    )
    .join("");

  printHTML(
    `Zao Deal — ${post.product || "Post"}`,
    `
      <h1>Zao Deal — <span class="brand">Raporo y'umusaruro</span></h1>
      <div class="meta">
        Post ID: <strong>${escapeHTML(post.id || "—")}</strong>
      </div>
      <table class="kv">
        <tbody>${rows}</tbody>
      </table>
    `
  );
}

/* -------------------------------------------------------------------------- */
/* Login                                                                      */
/* -------------------------------------------------------------------------- */

function LoginScreen({ onLoggedIn }) {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();

    if (!value.trim()) {
      setError("Andika PIN.");
      return;
    }

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
          <input
            type="password"
            inputMode="numeric"
            placeholder="Admin PIN"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />

          {error && (
            <p
              style={{
                color: "var(--am-danger)",
                fontSize: 13,
                marginBottom: 10,
              }}
            >
              {error}
            </p>
          )}

          <button
            className="am-btn"
            type="submit"
            disabled={checking}
            style={{ width: "100%" }}
          >
            {checking ? "Turimo kureba..." : "Injira"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

function OverviewTab() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([adminPosts(getToken()), adminUsers(getToken()), adminReports(getToken())])
      .then(([postsData, usersData, reportsData]) => {
        const posts = pickList(postsData, "posts");
        const users = pickList(usersData, "users");
        const reports = pickList(reportsData, "reports");
        setStats({
          totalPosts: posts.length,
          newPosts: posts.filter((p) => p.status === "new").length,
          reviewing: posts.filter((p) => p.status === "reviewing").length,
          contacted: posts.filter((p) => p.status === "contacted").length,
          negotiating: posts.filter((p) => p.status === "negotiating").length,
          bought: posts.filter((p) => p.status === "bought").length,
          closed: posts.filter((p) => p.status === "closed").length,
          totalUsers: users.length,
          blockedUsers: users.filter((u) => u.blocked).length,
          openReports: reports.filter((r) => r.status === "open").length,
        });
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div className="am-error-banner">{error}</div>;
  if (!stats) return <p className="am-empty">Turimo gupakira...</p>;

  const LABELS = {
    totalPosts: "Posts zose",
    newPosts: "🆕 Nshya",
    reviewing: "🔎 Zisuzumwa",
    contacted: "📞 Zavugwanye",
    negotiating: "🤝 Ziganirwaho",
    bought: "✅ Zaguwe",
    closed: "🔒 Zarangiye",
    totalUsers: "Abakoresha",
    blockedUsers: "Bafunzwe",
    openReports: "Raporo zifunguye",
  };

  return (
    <div className="am-stat-row">
      {Object.entries(stats).map(([k, v]) => (
        <div className="am-stat-card" key={k}>
          <div className="am-stat-value">{v}</div>
          <div className="am-stat-label">{LABELS[k] || k}</div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Posts                                                                      */
/* -------------------------------------------------------------------------- */

function PostsTab() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminPosts(getToken());
      setPosts(pickList(data, "posts"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch, not a render loop
    load();
  }, [load]);

  async function act(id, fn) {
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
    <>
      {error && <div className="am-error-banner">{error}</div>}

      <div className="am-admin-card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <strong style={{ fontSize: 13.5, flex: 1 }}>
          🖨️ Raporo
        </strong>
        <button
          className="am-btn"
          disabled={posts.length === 0}
          onClick={() => printAllPosts(posts)}
        >
          Chapisha posts zose ({posts.length})
        </button>
      </div>

      {posts.length === 0 ? (
        <p className="am-empty">Nta posts ahari.</p>
      ) : (
        posts.map((p) => (
          <div className="am-admin-card" key={p.id}>
            <div className="am-admin-card-top">
              <div>
                <strong>
                  {p.type === "offer" ? "🌾" : "🛒"} {p.product}
                </strong>
                <p className="am-post-line">
                  {p.quantity} {p.unit || "kg"} · 📍 {p.location}
                </p>
                {p.type === "offer" && p.price_per_kg != null && (
                  <p className="am-post-line">💰 {p.price_per_kg} Frw/kg</p>
                )}
                <p className="am-post-line">{p.type === "offer" ? "👤" : "🏢"} {p.name || "—"}</p>
                <p className="am-mono">☎ {p.whatsapp || "—"}</p>
              </div>
              <span className={`am-status-pill ${p.status || "new"}`}>{p.status || "new"}</span>
            </div>
            <div className="am-admin-row-actions">
              <button
                className="am-btn secondary"
                onClick={() => printSinglePost(p)}
              >
                🖨️ Chapisha
              </button>
              <button
                className="am-btn danger"
                disabled={busyId === p.id}
                onClick={() => act(p.id, adminDeletePost)}
              >
                Siba
              </button>
            </div>
          </div>
        ))
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Users                                                                      */
/* -------------------------------------------------------------------------- */

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminUsers(getToken());
      setUsers(pickList(data, "users"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch, not a render loop
    load();
  }, [load]);

  async function remove(id) {
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
    <>
      {error && <div className="am-error-banner">{error}</div>}
      {users.length === 0 ? (
        <p className="am-empty">Nta bakoresha bahari.</p>
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
              <button
                className="am-btn danger"
                disabled={busyId === u.id}
                onClick={() => remove(u.id)}
              >
                Siba
              </button>
            </div>
          </div>
        ))
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                    */
/* -------------------------------------------------------------------------- */

function ReportsTab() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminReports(getToken());
      setReports(pickList(data, "reports"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch, not a render loop
    load();
  }, [load]);

  if (loading) return <p className="am-empty">Turimo gupakira...</p>;
  if (error) return <div className="am-error-banner">{error}</div>;

  return reports.length === 0 ? (
    <p className="am-empty">Nta raporo zihari ubu.</p>
  ) : (
    reports.map((r) => (
      <div className="am-admin-card" key={r.id}>
        <div className="am-admin-card-top">
          <div>
            <strong>
              {r.report_type === "seller_supply" ? "🌾" : "📄"} {r.product}
            </strong>
            <p className="am-post-line">
              {r.quantity} {r.unit || "kg"} · 📍 {r.location}
            </p>
            <p className="am-post-line">{r.message}</p>
          </div>
          <span className={`am-status-pill ${r.status === "open" ? "waiting" : "closed"}`}>
            {r.status}
          </span>
        </div>
      </div>
    ))
  );
}

/* -------------------------------------------------------------------------- */
/* Shell                                                                      */
/* -------------------------------------------------------------------------- */

const TABS = [
  { key: "overview", label: "Incamake", Comp: OverviewTab },
  { key: "posts", label: "Posts", Comp: PostsTab },
  { key: "users", label: "Abakoresha", Comp: UsersTab },
  { key: "reports", label: "Raporo", Comp: ReportsTab },
];

export default function AdminDashboard() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    const existing = getToken();
    if (existing) {
      verifyToken(existing)
        .then(() => setLoggedIn(true))
        .catch(() => clearToken())
        .finally(() => setReady(true));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- no token to verify, so mark ready synchronously
      setReady(true);
    }
  }, []);

  if (!ready) return null;
  if (!loggedIn) return <LoginScreen onLoggedIn={() => setLoggedIn(true)} />;

  const Active = TABS.find((t) => t.key === tab)?.Comp || OverviewTab;

  return (
    <div className="am-admin-root">
      <div className="am-admin-shell">
        <div className="am-admin-header">
          <h1>🔐 Zao Deal — Admin</h1>
          <button
            className="am-btn secondary"
            onClick={() => {
              clearToken();
              setLoggedIn(false);
            }}
          >
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
  );
}