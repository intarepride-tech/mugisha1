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

        <p style={{ marginTop: 14 }}>
          <a
            href="?"
            style={{
              fontSize: 12,
              color: "var(--am-text-soft)",
            }}
          >
            ← Subira ku isoko
          </a>
        </p>
      </div>
    </div>
  );
}

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
                {/* users.name holds the farmer's own name for offers, and the
                    business name for needs — same column, different meaning. */}
                <p className="am-post-line">{p.type === "offer" ? "👤" : "🏢"} {p.name || "—"}</p>
                <p className="am-mono">☎ {p.whatsapp || "—"}</p>
              </div>
              <span className={`am-status-pill ${p.status || "new"}`}>{p.status || "new"}</span>
            </div>
            <div className="am-admin-row-actions">
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