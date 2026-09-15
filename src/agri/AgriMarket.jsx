import { useEffect, useRef, useState, useCallback } from "react";
import "./agri-market.css";
import {
  createOffer,
  createNeed,
  getPosts,
  getPost,
  searchPosts,
  startDeal,
  uploadMedia,
  parseQuantity,
  parsePrice,
  ApiError,
} from "./api";

// The Worker stores quantity and pricePerKg as numbers, so a free-text
// answer like "800 kg" or "700 Frw" has to parse out to a positive number
// before we let the chat move on — otherwise the final POST would 400.
function validateQuantity(value) {
  const { quantity } = parseQuantity(value);
  if (quantity === null || quantity <= 0) {
    return "Andika umubare w'ingano, urugero: 800 kg";
  }
  return null;
}

function validatePrice(value) {
  const price = parsePrice(value);
  if (price === null || price < 0) {
    return "Andika igiciro nk'umubare, urugero: 700";
  }
  return null;
}

const FARMER_QUESTIONS = [
  { text: "🌾 Niyihe myaka ugurisha?", key: "product", placeholder: "urugero: Ibitunguru" },
  {
    text: "Ingano y'Ibyo ufite?",
    key: "quantity",
    placeholder: "urugero: 800 kg",
    validate: validateQuantity,
  },
  { text: "Ubarizwa he?", key: "location", placeholder: "urugero: Bugesera" },
  {
    text: "Ugurisha angahe ku Kilo (1kg)?",
    key: "pricePerKg",
    placeholder: "urugero: 700 Frw",
    validate: validatePrice,
  },
  { text: "📸 Shyiraho ifoto cyangwa video y'umusaruro (niba ihari)", key: "media", media: true },
  { text: "Amazina yanyu?", key: "name", placeholder: "Amazina yawe" },
  { text: "Numero ya WhatsApp?", key: "whatsapp", placeholder: "07XX XXX XXX" },
];

const BUYER_QUESTIONS = [
  {
    text: "🛒 Izina ry'ibyo ukeneye ku bikomoka ku buhinzi ni irihe?",
    key: "product",
    placeholder: "urugero: Ibitunguru",
  },
  { text: "Aho ubarizwa ni hehe?", key: "location", placeholder: "urugero: Kigali" },
  {
    text: "Ingano y'ibyo ukeneye ni ingahe?",
    key: "quantity",
    placeholder: "urugero: 500 kg",
    validate: validateQuantity,
  },
  { text: "Amazina y'Ikigo/Business?", key: "businessName", placeholder: "urugero: ABC Foods Ltd" },
  { text: "Numero ya WhatsApp?", key: "whatsapp", placeholder: "07XX XXX XXX" },
];

const STATUS_LABEL = {
  waiting: "⏳ Deal irategerejwe",
  matched: "🟢 Hari uwabonetse",
  closed: "✅ Deal yarangiye",
};

function isImage(url) {
  return /\.(png|jpe?g|gif|webp|heic)$/i.test(url || "");
}

function StatusPill({ status }) {
  const s = status || "waiting";
  return <span className={`am-status-pill ${s}`}>{STATUS_LABEL[s] || STATUS_LABEL.waiting}</span>;
}

function PostCard({ post }) {
  const isOffer = post.type === "offer";
  const unit = post.unit || "kg";
  return (
    <div className="am-post-card">
      <p className="am-post-title">
        {isOffer ? "🌾 Mfite/Ngurisha Imyaka" : "🛒 Ngura Imyaka (Ibikomoka ku Buhinzi)"}
      </p>
      <p className="am-post-line" style={{ fontWeight: 600, color: "var(--am-text)" }}>
        {post.product}
      </p>
      <p className="am-post-line">
        {post.quantity} {unit}
      </p>
      <p className="am-post-line">📍 {post.location}</p>
      {isOffer ? (
        post.price_per_kg != null && (
          <p className="am-post-line">💰 {post.price_per_kg} Frw / 1kg</p>
        )
      ) : (
        // For a "need" post, users.name was set to the business name at creation time.
        post.name && <p className="am-post-line">🏢 {post.name}</p>
      )}
      <div className="am-post-meta">
        <StatusPill status={post.status} />
      </div>
    </div>
  );
}

function Landing({ onStart }) {
  const [tab, setTab] = useState("offer");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [error, setError] = useState(null);

  // Guards against out-of-order responses (e.g. React StrictMode's double
  // mount effect, or a fast tab switch firing two overlapping requests) —
  // only the most recently *started* request is allowed to update state.
  const requestIdRef = useRef(0);

  const load = useCallback(async (type, q) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = q ? await searchPosts(q, type) : await getPosts(type);
      if (requestIdRef.current !== requestId) return; // a newer request has since started
      setPosts(data);
    } catch (err) {
      if (requestIdRef.current !== requestId) return;
      setError(err instanceof ApiError ? err.message : "Ntibishoboka gushaka amakuru.");
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial/tab-change fetch, not a render loop
    load(tab, query.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function onSearchSubmit(e) {
    e.preventDefault();
    load(tab, query.trim());
  }

  return (
    <div className="am-root">
      <div className="am-shell">
        <header className="am-hero">
          <div className="am-hero-eyebrow">🌾 Agri Market</div>
          <h1>Isoko ry'abahinzi n'abaguzi</h1>
          <p>Abahinzi bafite umusaruro. Abaguzi bawukeneye. Turabahuza.</p>
        </header>

        <div className="am-body">
          <div className="am-choice-row">
            <button className="am-choice-card" onClick={() => onStart("farmer")}>
              <span className="am-choice-icon offer">🌾</span>
              <span>
                <p className="am-choice-title">Mfite/Ngurisha Imyaka</p>
                <p className="am-choice-sub">Shyira umusaruro ufite ku isoko</p>
              </span>
            </button>

            <button className="am-choice-card" onClick={() => onStart("buyer")}>
              <span className="am-choice-icon need">🛒</span>
              <span>
                <p className="am-choice-title">Ngura Imyaka</p>
                <p className="am-choice-sub">Shyiraho ibyo ukeneye ku isoko</p>
              </span>
            </button>
          </div>

          <div className="am-feed-tabs">
            <button
              className={`am-feed-tab ${tab === "offer" ? "active" : ""}`}
              onClick={() => setTab("offer")}
            >
              🌾 Ibiraho kugurishwa
            </button>
            <button
              className={`am-feed-tab ${tab === "need" ? "active" : ""}`}
              onClick={() => setTab("need")}
            >
              🛒 Ibikenewe
            </button>
          </div>

          <form className="am-search-row" onSubmit={onSearchSubmit}>
            <input
              className="am-search-input"
              placeholder={tab === "offer" ? "Shakisha umusaruro..." : "Shakisha icyo ukeneye..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="am-search-btn" aria-label="Shakisha">
              🔍
            </button>
          </form>

          {error ? (
            <div className="am-error-banner">{error}</div>
          ) : loading ? (
            <p className="am-empty">Turimo gushakisha...</p>
          ) : posts.length === 0 ? (
            <p className="am-empty">⏳ Nta post irashyirwaho muri iyi ngingo.</p>
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} />)
          )}

          <div className="am-footer-link">
            <a href="?admin=1">Admin</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypingRow() {
  return (
    <div className="am-bubble-row assistant">
      <span className="am-avatar">🤖</span>
      <div className="am-bubble assistant">
        <span className="am-typing">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}

function MessageRow({ msg }) {
  const isUser = msg.from === "user";
  return (
    <div className={`am-bubble-row ${isUser ? "user" : "assistant"}`}>
      {!isUser && <span className="am-avatar">🤖</span>}
      <div className={`am-bubble ${isUser ? "user" : "assistant"}`}>
        {msg.mediaUrl ? (
          <>
            {msg.text && <div>{msg.text}</div>}
            {(msg.mediaKind ? msg.mediaKind === "image" : isImage(msg.mediaUrl)) ? (
              <img src={msg.mediaUrl} alt="Ifoto y'umusaruro" />
            ) : (
              <video src={msg.mediaUrl} controls />
            )}
          </>
        ) : (
          msg.text
        )}
      </div>
    </div>
  );
}

let msgId = 0;
function nextId() {
  msgId += 1;
  return msgId;
}

function ChatFlow({ mode, onExit }) {
  const questions = mode === "farmer" ? FARMER_QUESTIONS : BUYER_QUESTIONS;
  const isFarmer = mode === "farmer";

  const [messages, setMessages] = useState([]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [typing, setTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadPct, setUploadPct] = useState(null);
  const [error, setError] = useState(null);
  const [post, setPost] = useState(null); // { id, status }
  const [dealLink, setDealLink] = useState(null);

  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const startedRef = useRef(false);
  const pollRef = useRef(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, []);

  const pushAssistant = useCallback(
    (text, delay = 550) =>
      new Promise((resolve) => {
        setTyping(true);
        scrollToEnd();
        setTimeout(() => {
          setTyping(false);
          setMessages((m) => [...m, { id: nextId(), from: "assistant", text }]);
          scrollToEnd();
          resolve();
        }, delay);
      }),
    [scrollToEnd]
  );

  const pushUser = useCallback(
    (text, mediaUrl, mediaKind) => {
      setMessages((m) => [...m, { id: nextId(), from: "user", text, mediaUrl, mediaKind }]);
      scrollToEnd();
    },
    [scrollToEnd]
  );

  // Ask the first question once, on entering the flow.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    pushAssistant(questions[0].text, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => scrollToEnd(), [messages, typing, scrollToEnd]);

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
    },
    []
  );

  async function submitPost(finalAnswers) {
    setSubmitting(true);
    setError(null);
    await pushAssistant(
      isFarmer ? "Turimo gushyira umusaruro wawe ku isoko..." : "Turimo gushyiraho ibyo ukeneye...",
      450
    );
    try {
      const res = isFarmer ? await createOffer(finalAnswers) : await createNeed(finalAnswers);
      const created = res?.post || res;
      const id = created?.id ?? null;
      const status = created?.status || "waiting";
      setPost({ id, status });
      await pushAssistant(
        isFarmer
          ? "🌾 Umusaruro wawe washyizwe ku isoko! Tuzakumenyesha nyuma yo kubona umuguzi."
          : "🛒 Ibyo ukeneye byashyizweho! Tuzakumenyesha nyuma yo kubona uwugurisha.",
        350
      );
      if (id) startPolling(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Habaye ikibazo. Ongera ugerageze.");
      await pushAssistant("😕 Habaye ikibazo mu kohereza. Kanda hepfo kongera ugerageze.", 300);
    } finally {
      setSubmitting(false);
    }
  }

  function startPolling(id) {
    if (pollRef.current) clearInterval(pollRef.current);

    const checkOnce = async () => {
      try {
        const fresh = await getPost(id);
        if (!fresh) return;
        setPost((prev) => {
          if (!prev || prev.status === fresh.status) return prev;
          return { ...prev, status: fresh.status };
        });
        if (fresh.status !== "waiting" && pollRef.current) {
          clearInterval(pollRef.current);
        }
      } catch {
        // Silent — we'll just try again on the next tick.
      }
    };

    checkOnce(); // don't make the user wait a full interval to find out they already matched
    pollRef.current = setInterval(checkOnce, 6000);
  }

  function advance(rawValue, opts = {}) {
    const q = questions[step];
    const value = opts.mediaUrl !== undefined ? opts.mediaUrl : rawValue;

    if (q.validate) {
      const problem = q.validate(value);
      if (problem) {
        pushAssistant(problem, 350);
        return; // stay on the same step and let them try again
      }
    }

    const finalAnswers = { ...answers, [q.key]: value };
    if (opts.mediaType) finalAnswers.mediaType = opts.mediaType;
    setAnswers(finalAnswers);

    if (step < questions.length - 1) {
      const next = step + 1;
      setStep(next);
      pushAssistant(questions[next].text);
    } else {
      submitPost(finalAnswers);
    }
  }

  function onTextSubmit(e) {
    e.preventDefault();
    const value = inputValue.trim();
    if (!value || submitting) return;
    pushUser(value);
    setInputValue("");
    advance(value);
  }

  async function onFilePicked(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const localPreview = URL.createObjectURL(file);
    pushUser(null, localPreview, file.type.startsWith("video/") ? "video" : "image");
    setUploadPct(0);
    try {
      const { url, mediaType } = await uploadMedia(file, setUploadPct);
      setUploadPct(null);
      advance(null, { mediaUrl: url, mediaType });
    } catch (err) {
      setUploadPct(null);
      // Show the *real* error instead of a generic message — this is the
      // only way to tell "no internet", "file too big", and "Worker has no
      // R2 bucket configured" apart from the chat UI.
      const detail = err instanceof ApiError ? err.message : "Upload ntiyagenze neza.";
      setError(detail);
      await pushAssistant(`😕 Ifoto/video ntiyoherejwe neza: ${detail}`);
    }
  }

  function skipMedia() {
    pushUser("Nta ifoto cyangwa video");
    advance(null, { mediaUrl: null });
  }

  async function onDealClick() {
    if (!post?.id) return;
    try {
      const link = await startDeal(post.id);
      setDealLink(link);
      if (link) window.open(link, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ntibishoboka gutangira deal.");
    }
  }

  function confirmExit() {
    if (messages.length > 1 && !post) {
      if (!window.confirm("Uzava mu kiganiro? Ibisubizo wanditse ntibizabikwa.")) return;
    }
    onExit();
  }

  const currentQuestion = questions[step];
  const isMediaStep = currentQuestion?.media && !post;
  const isLastStep = step === questions.length - 1;

  return (
    <div className="am-root">
      <div className="am-shell">
        <div className="am-chat">
          <div className="am-chat-header">
            <button className="am-back-btn" onClick={confirmExit} aria-label="Subira inyuma">
              ←
            </button>
            <div>
              <p className="am-chat-title">
                {isFarmer ? "🌾 Umucuruzi w'Imyaka / Umuhinzi" : "🛒 Ngura Imyaka"}
              </p>
              {!post && (
                <p className="am-chat-progress">
                  Intambwe {Math.min(step + 1, questions.length)} / {questions.length}
                </p>
              )}
            </div>
          </div>

          <div className="am-messages">
            {messages.map((m) => (
              <MessageRow key={m.id} msg={m} />
            ))}
            {typing && <TypingRow />}
            {uploadPct !== null && (
              <p className="am-upload-progress" style={{ textAlign: "right", paddingRight: 6 }}>
                Kohereza... {uploadPct}%
              </p>
            )}
            <div ref={endRef} />
          </div>

          {error && !post && (
            <div className="am-error-banner">
              {error}{" "}
              <button
                className="am-skip-btn"
                style={{ marginLeft: 8 }}
                onClick={() => submitPost(answers)}
              >
                Ongera ugerageze
              </button>
            </div>
          )}

          {post && (
            <>
              <PostSummaryCard mode={mode} answers={answers} />
              <MatchArea
                mode={mode}
                post={post}
                dealLink={dealLink}
                onDeal={onDealClick}
                onDone={onExit}
              />
            </>
          )}

          {!post && (
            <>
              {isMediaStep ? (
                <>
                  <div className="am-skip-row">
                    <button className="am-skip-btn" onClick={skipMedia}>
                      Nta foto/video, komeza →
                    </button>
                  </div>
                  <div className="am-input-bar">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      hidden
                      onChange={onFilePicked}
                    />
                    <button
                      className="am-icon-btn"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Ohereza ifoto cyangwa video"
                    >
                      📎
                    </button>
                    <span style={{ color: "var(--am-text-soft)", fontSize: 13 }}>
                      Kanda hano kugira ngo ushyireho ifoto cyangwa video
                    </span>
                  </div>
                </>
              ) : (
                <form className="am-input-bar" onSubmit={onTextSubmit}>
                  <input
                    type="text"
                    autoFocus
                    placeholder={currentQuestion?.placeholder || "Andika igisubizo..."}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={submitting}
                  />
                  <button
                    type="submit"
                    className="am-send-btn"
                    disabled={submitting || !inputValue.trim()}
                    aria-label="Ohereza"
                  >
                    {submitting ? "…" : isLastStep ? "✓" : "➤"}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// The "receipt card" shown once the post has actually been created — pulls
// straight from the chat's own `answers` state, so it always matches what
// was really submitted (no separate re-fetch needed to render it).
function PostSummaryCard({ mode, answers }) {
  const isFarmer = mode === "farmer";
  const { quantity, unit } = parseQuantity(answers.quantity);
  const price = isFarmer ? parsePrice(answers.pricePerKg) : null;
  const mediaUrl = answers.media || null;
  const mediaKind = (answers.mediaType || "").startsWith("video/") ? "video" : "image";

  return (
    <div className="am-summary-wrap">
      <div className="am-summary-card">
        <div className={`am-summary-media${mediaUrl ? "" : " placeholder"}`}>
          {mediaUrl ? (
            mediaKind === "video" ? (
              <video src={mediaUrl} controls />
            ) : (
              <img src={mediaUrl} alt={answers.product || "Umusaruro"} />
            )
          ) : (
            <span>{isFarmer ? "🌾" : "🛒"}</span>
          )}
        </div>
        <span className="am-summary-badge">
          {isFarmer ? "🌾 Umusaruro washyizwe ku isoko" : "🛒 Ibyo ukeneye byashyizweho"}
        </span>
        <div className="am-summary-body">
          <p className="am-summary-title">{answers.product || "—"}</p>
          <div className="am-summary-grid">
            <div className="am-summary-item">
              <span className="am-summary-label">Ingano</span>
              <span className="am-summary-value">
                {quantity != null ? `${quantity} ${unit}` : "—"}
              </span>
            </div>
            <div className="am-summary-item">
              <span className="am-summary-label">Aho biherereye</span>
              <span className="am-summary-value">{answers.location || "—"}</span>
            </div>
            {isFarmer ? (
              <div className="am-summary-item">
                <span className="am-summary-label">Igiciro / 1kg</span>
                <span className="am-summary-value">{price != null ? `${price} Frw` : "—"}</span>
              </div>
            ) : (
              <div className="am-summary-item">
                <span className="am-summary-label">Ikigo/Business</span>
                <span className="am-summary-value">{answers.businessName || "—"}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchArea({ mode, post, dealLink, onDeal, onDone }) {
  const isFarmer = mode === "farmer";
  const status = post.status || "waiting";

  if (status === "closed") {
    return (
      <div className="am-status-card">
        ✅ Deal yarangiye. Murakoze gukoresha Agri Market!
        <div style={{ marginTop: 10 }}>
          <button className="am-skip-btn" onClick={onDone}>
            Subira ku isoko
          </button>
        </div>
      </div>
    );
  }

  if (status === "matched") {
    return (
      <div className="am-match-card">
        <div className="am-match-badge">
          <span className="am-dot" />
          {isFarmer ? "🟢 Umuguzi yabonetse" : "🟢 Uwugurisha yabonetse"}
        </div>
        <button className="am-deal-btn" onClick={onDeal}>
          🤝 Tangira Deal
        </button>
        {dealLink && (
          <p className="am-post-line" style={{ marginTop: 10 }}>
            Niba WhatsApp itafunguye ubwayo,{" "}
            <a href={dealLink} target="_blank" rel="noopener noreferrer">
              kanda hano
            </a>
            .
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="am-status-card">
      ⏳ Deal irategerejwe. Tugusanga hakiboneka {isFarmer ? "umuguzi" : "uwugurisha"} ubereye.
      <div style={{ marginTop: 10 }}>
        <button className="am-skip-btn" onClick={onDone}>
          Subira ku isoko
        </button>
      </div>
    </div>
  );
}

export default function AgriMarket() {
  const [mode, setMode] = useState(null);

  if (!mode) return <Landing onStart={setMode} />;
  return <ChatFlow mode={mode} onExit={() => setMode(null)} />;
}