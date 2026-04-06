type TrackPayload = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
    fbq?: (
      command: "track" | "trackCustom" | "init",
      eventName: string,
      params?: Record<string, unknown>,
      options?: Record<string, unknown>
    ) => void;
    karrotPixel?: {
      init: (pixelId: string) => void;
      track: (eventName: string, params?: Record<string, unknown>) => void;
    };
  }
}

function cleanPayload(payload: TrackPayload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
}

export function claritySet(key: string, value: string | number | boolean) {
  if (typeof window === "undefined") return;
  try {
    window.clarity?.("set", key, String(value));
  } catch (e) {
    console.error("claritySet error", e);
  }
}

export function clarityEvent(eventName: string) {
  if (typeof window === "undefined") return;
  try {
    window.clarity?.("event", eventName);
  } catch (e) {
    console.error("clarityEvent error", e);
  }
}

export function trackLandingView(payload: TrackPayload = {}) {
  const data = cleanPayload(payload);

  if (data.landing_key) claritySet("landing_key", String(data.landing_key));
  if (data.hospital_name) claritySet("hospital_name", String(data.hospital_name));
  if (data.utm_source) claritySet("utm_source", String(data.utm_source));
  if (data.utm_medium) claritySet("utm_medium", String(data.utm_medium));
  if (data.utm_campaign) claritySet("utm_campaign", String(data.utm_campaign));
  if (data.utm_term) claritySet("utm_term", String(data.utm_term));
  if (data.utm_content) claritySet("utm_content", String(data.utm_content));

  clarityEvent("landing_view");
}

export function trackScrollDepth(depth: 25 | 50 | 75 | 100, payload: TrackPayload = {}) {
  const data = cleanPayload(payload);

  if (data.landing_key) claritySet("landing_key", String(data.landing_key));
  claritySet("scroll_depth", depth);
  clarityEvent(`scroll_${depth}`);
}

export function trackCTA(location: string, payload: TrackPayload = {}) {
  const data = cleanPayload(payload);

  if (data.landing_key) claritySet("landing_key", String(data.landing_key));
  claritySet("cta_location", location);
  if (data.utm_source) claritySet("utm_source", String(data.utm_source));
  if (data.utm_medium) claritySet("utm_medium", String(data.utm_medium));
  if (data.utm_campaign) claritySet("utm_campaign", String(data.utm_campaign));
  if (data.utm_content) claritySet("utm_content", String(data.utm_content));

  clarityEvent("cta_click");
  clarityEvent(`cta_click_${location}`);
}

export function trackFormStart(payload: TrackPayload = {}) {
  const data = cleanPayload(payload);

  if (data.landing_key) claritySet("landing_key", String(data.landing_key));
  if (data.utm_source) claritySet("utm_source", String(data.utm_source));
  if (data.utm_medium) claritySet("utm_medium", String(data.utm_medium));
  if (data.utm_campaign) claritySet("utm_campaign", String(data.utm_campaign));
  if (data.utm_content) claritySet("utm_content", String(data.utm_content));

  clarityEvent("form_start");
}

export function trackFormSubmit(payload: TrackPayload = {}) {
  const data = cleanPayload(payload);

  if (data.landing_key) claritySet("landing_key", String(data.landing_key));
  if (data.utm_source) claritySet("utm_source", String(data.utm_source));
  if (data.utm_medium) claritySet("utm_medium", String(data.utm_medium));
  if (data.utm_campaign) claritySet("utm_campaign", String(data.utm_campaign));
  if (data.utm_content) claritySet("utm_content", String(data.utm_content));

  clarityEvent("lead_submit");
}

export function trackFormSuccess(payload: TrackPayload = {}) {
  const data = cleanPayload(payload);

  if (data.landing_key) claritySet("landing_key", String(data.landing_key));
  if (data.hospital_name) claritySet("hospital_name", String(data.hospital_name));
  if (data.utm_source) claritySet("utm_source", String(data.utm_source));
  if (data.utm_medium) claritySet("utm_medium", String(data.utm_medium));
  if (data.utm_campaign) claritySet("utm_campaign", String(data.utm_campaign));
  if (data.utm_content) claritySet("utm_content", String(data.utm_content));

  clarityEvent("lead_success");

  window.fbq?.("track", "Lead", cleanPayload(payload));
  window.karrotPixel?.track?.("Lead", cleanPayload(payload));
}

export function trackDuplicateLead(payload: TrackPayload = {}) {
  const data = cleanPayload(payload);

  if (data.landing_key) claritySet("landing_key", String(data.landing_key));
  if (data.utm_source) claritySet("utm_source", String(data.utm_source));
  if (data.utm_campaign) claritySet("utm_campaign", String(data.utm_campaign));

  clarityEvent("lead_duplicate");
}