import type { Answers } from "./scoring";

const KEY = "azen.funnel.v1";
const LEAD_ID_KEY = "azen.leadId";

export type Persisted = {
  answers: Answers;
  stepId: string;
  savedAt: string;
};

export function loadProgress(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Persisted;
    // Stale sessions are worse than none: an owner returning a week later
    // should get a clean start, not half-remembered answers.
    if (Date.now() - new Date(parsed.savedAt).getTime() > 1000 * 60 * 60 * 24) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveProgress(answers: Answers, stepId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ answers, stepId, savedAt: new Date().toISOString() }));
  } catch {
    /* quota or private mode */
  }
}

export function clearProgress() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * One id per person per funnel run, minted before the first save and reused for
 * every later push. It is what lets a partial row in the sheet be updated in
 * place instead of turning one abandoner into six duplicate rows.
 */
export function getLeadId(): string {
  if (typeof window === "undefined") return "";

  try {
    const existing = sessionStorage.getItem(LEAD_ID_KEY);
    if (existing) return existing;
  } catch {
    /* storage unavailable */
  }

  const minted = `azen_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    sessionStorage.setItem(LEAD_ID_KEY, minted);
  } catch {
    /* ignore */
  }
  return minted;
}

export function clearLeadId() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(LEAD_ID_KEY);
  } catch {
    /* ignore */
  }
}
