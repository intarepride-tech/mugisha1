// ---------------------------------------------------------------------------
// Agri Market API client
//
// Every network call the app makes goes through this one file. It is written
// to match the real worker.js contract exactly (not a guess):
//
//   - quantity and pricePerKg are numbers in the DB (REAL columns), so we
//     parse the free-text chat answer ("800 kg", "700 Frw") into a number +
//     unit / a number before sending.
//   - list/search responses use snake_case columns straight from D1
//     (price_per_kg, media_url, media_type, matched_post_id, deal_started).
//   - GET /api/search takes type=buyer|farmer|seller, NOT type=offer|need —
//     the Worker itself flips the direction (buyer -> offers, farmer ->
//     needs), so this file just translates our internal offer/need tab into
//     that vocabulary.
//   - POST /api/posts/:id/start-deal returns { whatsappUrl }.
//   - There is no /api/admin/dashboard route — admin login is validated
//     with a real admin call (adminUsers), and overview stats are computed
//     client-side from posts/users/reports.
//   - Admin close-deal and block/unblock are PATCH, not POST.
// ---------------------------------------------------------------------------

const DEFAULT_API_BASE = "https://mugisha.intarepride.workers.dev";

// Override in a local .env file with VITE_API_BASE=... if you ever point
// the frontend at a different Worker (e.g. a staging deploy).
export const API_BASE = (
  import.meta.env.VITE_API_BASE || DEFAULT_API_BASE
).replace(/\/+$/, "");

const ENDPOINTS = {
  offer: "/api/posts/offer",
  need: "/api/posts/need",
  posts: "/api/posts",
  postById: (id) => `/api/posts/${id}`,
  search: "/api/search",
  mediaUpload: "/api/media/upload",
  startDeal: (id) => `/api/posts/${id}/start-deal`,
};

const ADMIN_ENDPOINTS = {
  posts: "/api/admin/posts",
  users: "/api/admin/users",
  reports: "/api/admin/reports",
  deletePost: (id) => `/api/admin/posts/${id}`,
  deleteUser: (id) => `/api/admin/users/${id}`,
  setUserBlocked: (id) => `/api/admin/users/${id}/block`, // PATCH { blocked }
  matchPosts: "/api/admin/match", // POST { offerId, needId }
  closePost: (id) => `/api/admin/posts/${id}/close`, // PATCH
  closeReport: (id) => `/api/admin/reports/${id}/close`, // PATCH
};

// The Worker's /api/search direction is the opposite of what you'd guess:
// you pass who's *searching* (buyer or farmer/seller), and it returns the
// other side's posts. Our UI thinks in "offer tab" / "need tab", so map it.
const SEARCH_VIEWER_TYPE = { offer: "buyer", need: "farmer" };

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

async function request(path, { method = "GET", body, headers, token, isForm } = {}) {
  const finalHeaders = { ...(headers || {}) };
  if (token) finalHeaders.Authorization = `Bearer ${token}`;
  if (!isForm && body !== undefined) finalHeaders["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: finalHeaders,
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Ntibishoboka guhuza na seriveri. Reba interineti yawe.", 0, null);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok || data?.ok === false) {
    const message = data?.error || data?.message || `Habaye ikosa (${res.status})`;
    throw new ApiError(message, res.status, data);
  }

  return data;
}

// ---- number parsing for free-text chat answers ------------------------------

// "800 kg" -> { quantity: 800, unit: "kg" }; "800" -> { quantity: 800, unit: "kg" }
export function parseQuantity(raw) {
  const str = String(raw || "").trim();
  const m = str.match(/^([\d]+(?:[.,]\d+)?)\s*(.*)$/);
  if (!m) return { quantity: null, unit: "kg" };
  const quantity = parseFloat(m[1].replace(",", "."));
  const unit = (m[2] || "").trim() || "kg";
  return { quantity: Number.isFinite(quantity) ? quantity : null, unit };
}

// "700 Frw" -> 700; "700" -> 700
export function parsePrice(raw) {
  const str = String(raw || "").trim();
  const m = str.match(/([\d]+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// ---- Public: posts ---------------------------------------------------------

// `a` is the chat's answers object, keyed by question.key (see AgriMarket.jsx)
export function buildOfferPayload(a) {
  const { quantity, unit } = parseQuantity(a.quantity);
  return {
    name: a.name?.trim(),
    whatsapp: a.whatsapp?.trim(),
    product: a.product?.trim(),
    quantity,
    unit,
    location: a.location?.trim(),
    pricePerKg: parsePrice(a.pricePerKg),
    mediaUrl: a.media || null,
    mediaType: a.mediaType || null,
  };
}

export function buildNeedPayload(a) {
  const { quantity, unit } = parseQuantity(a.quantity);
  return {
    businessName: a.businessName?.trim(),
    whatsapp: a.whatsapp?.trim(),
    product: a.product?.trim(),
    quantity,
    unit,
    location: a.location?.trim(),
  };
}

export function createOffer(answers) {
  return request(ENDPOINTS.offer, { method: "POST", body: buildOfferPayload(answers) });
}

export function createNeed(answers) {
  return request(ENDPOINTS.need, { method: "POST", body: buildNeedPayload(answers) });
}

export async function getPosts(type) {
  const data = await request(`${ENDPOINTS.posts}?type=${encodeURIComponent(type)}`);
  return data?.posts || [];
}

export async function getPost(id) {
  const data = await request(ENDPOINTS.postById(id));
  return data?.post || null;
}

export async function searchPosts(q, tabType) {
  const viewerType = SEARCH_VIEWER_TYPE[tabType] || tabType;
  const data = await request(
    `${ENDPOINTS.search}?q=${encodeURIComponent(q)}&type=${encodeURIComponent(viewerType)}`
  );
  return data?.results || data?.posts || [];
}

export async function startDeal(id) {
  const data = await request(ENDPOINTS.startDeal(id), { method: "POST" });
  return data?.whatsappUrl || data?.whatsappLink || data?.link || data?.url || null;
}

// ---- Public: media ----------------------------------------------------------

// Resolves { url, mediaType } — url can be null if the Worker's
// R2_PUBLIC_URL secret isn't configured (upload still succeeds, but there's
// nothing publicly linkable to show).
export async function uploadMedia(file, onProgress) {
  const form = new FormData();
  form.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${ENDPOINTS.mediaUpload}`);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // ignore
      }
      if (xhr.status >= 200 && xhr.status < 300 && data) {
        const url = data.url || data.mediaUrl || data.fileUrl || null;
        if (url) {
          resolve({ url, mediaType: data.mediaType || file.type || null });
        } else {
          reject(
            new ApiError(
              "Ifoto/video yoherejwe, ariko Worker ntabwo ifite R2_PUBLIC_URL yashyizweho kugira ngo itange link rusange.",
              xhr.status,
              data
            )
          );
        }
      } else {
        reject(new ApiError(data?.error || "Upload ntiyagenze neza.", xhr.status, data));
      }
    };
    xhr.onerror = () => reject(new ApiError("Ntibishoboka koherereza dosiye.", 0, null));
    xhr.send(form);
  });
}

// ---- Admin ------------------------------------------------------------------

export function adminPosts(token) {
  return request(ADMIN_ENDPOINTS.posts, { token });
}

export function adminUsers(token) {
  return request(ADMIN_ENDPOINTS.users, { token });
}

export function adminReports(token) {
  return request(ADMIN_ENDPOINTS.reports, { token });
}

export function adminDeletePost(id, token) {
  return request(ADMIN_ENDPOINTS.deletePost(id), { method: "DELETE", token });
}

export function adminDeleteUser(id, token) {
  return request(ADMIN_ENDPOINTS.deleteUser(id), { method: "DELETE", token });
}

export function adminSetUserBlocked(id, blocked, token) {
  return request(ADMIN_ENDPOINTS.setUserBlocked(id), {
    method: "PATCH",
    token,
    body: { blocked },
  });
}

export function adminMatchPosts(offerId, needId, token) {
  return request(ADMIN_ENDPOINTS.matchPosts, {
    method: "POST",
    token,
    body: { offerId, needId },
  });
}

export function adminCloseDeal(id, token) {
  return request(ADMIN_ENDPOINTS.closePost(id), { method: "PATCH", token });
}

export function adminCloseReport(id, token) {
  return request(ADMIN_ENDPOINTS.closeReport(id), { method: "PATCH", token });
}

export { ApiError };