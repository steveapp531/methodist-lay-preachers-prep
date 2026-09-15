/**
 * API client.
 *
 * Holds the access token in memory only — never localStorage, so a cross-site
 * script cannot read it. Session continuity comes from the httpOnly refresh
 * cookie: on a 401 the client silently refreshes once and replays the request,
 * and concurrent 401s share a single refresh rather than stampeding.
 */

const BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://methodist-lay-preachers-prep.onrender.com/api' : '/api');

let accessToken = null;
let refreshPromise = null;
const listeners = new Set();

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

/** Notified when the session ends so the app can send the user to sign in. */
export function onSessionExpired(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announceExpiry() {
  accessToken = null;
  listeners.forEach((listener) => listener());
}

export class ApiError extends Error {
  constructor(message, { status, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True for failures a retry might fix, so the UI can offer "Try again". */
  get isRetryable() {
    return this.status === 0 || this.status >= 500 || this.status === 429;
  }
}

async function parse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError('The server sent a response we could not read.', { status: response.status });
  }
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
        if (!response.ok) return null;
        const body = await parse(response);
        const token = body?.data?.accessToken;
        if (token) accessToken = token;
        return body?.data ?? null;
      } catch {
        return null;
      } finally {
        // Release after the microtask so racing callers all see this result.
        setTimeout(() => {
          refreshPromise = null;
        }, 0);
      }
    })();
  }
  return refreshPromise;
}

async function request(path, { method = 'GET', body, params, signal, retryOn401 = true, headers = {} } = {}) {
  const url = new URL(`${BASE_URL}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, v));
      else url.searchParams.set(key, value);
    });
  }

  const init = {
    method,
    credentials: 'include',
    signal,
    headers: { Accept: 'application/json', ...headers },
  };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  if (accessToken) init.headers.Authorization = `Bearer ${accessToken}`;

  let response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('We could not reach the server. Check your connection and try again.', { status: 0 });
  }

  if (response.status === 401 && retryOn401 && !path.startsWith('/auth/refresh')) {
    const refreshed = await refreshSession();
    if (refreshed?.accessToken) {
      return request(path, { method, body, params, signal, headers, retryOn401: false });
    }
    announceExpiry();
  }

  if (response.status === 204) return null;

  const payload = await parse(response);

  if (!response.ok) {
    const error = payload?.error || {};
    throw new ApiError(error.message || 'Something went wrong. Please try again.', {
      status: response.status,
      code: error.code,
      details: error.details,
    });
  }

  return payload?.meta ? { ...payload.data, _meta: payload.meta } : payload?.data;
}

export const api = {
  get: (path, options) => request(path, { ...options, method: 'GET' }),
  post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
  patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
  put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
  delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  refreshSession,
};

/* ------------------------------------------------------------- endpoints --- */

export const authApi = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  updateProfile: (payload) => api.patch('/auth/me', payload),
  changePassword: (payload) => api.post('/auth/change-password', payload),
  forgotPassword: (payload) => api.post('/auth/forgot-password', payload),
  resetPassword: (payload) => api.post('/auth/reset-password', payload),
};

export const contentApi = {
  exams: () => api.get('/exams'),
  exam: (id) => api.get(`/exams/${id}`),
  subjects: (params) => api.get('/subjects', { params }),
  subject: (id) => api.get(`/subjects/${id}`),
  topic: (id) => api.get(`/topics/${id}`),
  updateTopicProgress: (id, payload) => api.patch(`/topics/${id}/progress`, payload),
  questions: (params) => api.get('/questions', { params }),
  question: (id) => api.get(`/questions/${id}`),
  scriptures: (params) => api.get('/scriptures', { params }),
  scripture: (reference) => api.get(`/scriptures/${encodeURIComponent(reference)}`),
  search: (params) => api.get('/search', { params }),
};

export const quizApi = {
  create: (payload) => api.post('/quizzes', payload),
  get: (id) => api.get(`/quizzes/${id}`),
  list: (params) => api.get('/quizzes', { params }),
  complete: (id) => api.post(`/quizzes/${id}/complete`),
  answer: (questionId, payload) => api.post(`/questions/${questionId}/attempt`, payload),
  mistakes: (params) => api.get('/mistakes', { params }),
};

export const mockApi = {
  list: (params) => api.get('/mock-exams', { params }),
  start: (mockExamId) => api.post('/mock-exams', { mockExam: mockExamId }),
  attempt: (id) => api.get(`/exam-attempts/${id}`),
  save: (id, updates) => api.patch(`/exam-attempts/${id}`, { updates }),
  submit: (id, updates) => api.post(`/exam-attempts/${id}/submit`, updates ? { updates } : {}),
  review: (id) => api.get(`/exam-attempts/${id}/review`),
  history: (params) => api.get('/exam-attempts', { params }),
};

export const progressApi = {
  dashboard: () => api.get('/dashboard'),
  progress: () => api.get('/progress'),
};

export const libraryApi = {
  bookmarks: (params) => api.get('/bookmarks', { params }),
  createBookmark: (payload) => api.post('/bookmarks', payload),
  deleteBookmark: (id) => api.delete(`/bookmarks/${id}`),
  toggleQuestionBookmark: (questionId) => api.post(`/questions/${questionId}/bookmark`),
  notes: (params) => api.get('/notes', { params }),
  createNote: (payload) => api.post('/notes', payload),
  updateNote: (id, payload) => api.patch(`/notes/${id}`, payload),
  deleteNote: (id) => api.delete(`/notes/${id}`),
  flashcards: (params) => api.get('/flashcards', { params }),
  reviewFlashcard: (id, outcome) => api.post(`/flashcards/${id}/review`, { outcome }),
};

export const adminApi = {
  overview: (params) => api.get('/admin/overview', { params }),
  exams: () => api.get('/admin/exams'),
  users: (params) => api.get('/admin/users', { params }),
  user: (id) => api.get(`/admin/users/${id}`),
  updateUser: (id, payload) => api.patch(`/admin/users/${id}`, payload),
  questions: (params) => api.get('/admin/questions', { params }),
  question: (id) => api.get(`/admin/questions/${id}`),
  createQuestion: (payload) => api.post('/admin/questions', payload),
  updateQuestion: (id, payload) => api.patch(`/admin/questions/${id}`, payload),
  setQuestionStatus: (id, status) => api.patch(`/admin/questions/${id}/status`, { status }),
  deleteQuestion: (id) => api.delete(`/admin/questions/${id}`),
  mockExams: (params) => api.get('/admin/mock-exams', { params }),
  createMockExam: (payload) => api.post('/admin/mock-exams', payload),
  updateMockExam: (id, payload) => api.patch(`/admin/mock-exams/${id}`, payload),
  deleteMockExam: (id) => api.delete(`/admin/mock-exams/${id}`),
  import: (payload) => api.post('/admin/import/questions', payload),
  activity: (params) => api.get('/admin/activity', { params }),
};
