export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    const customUrl = localStorage.getItem("LOGICBITS_CUSTOM_API_URL");
    if (customUrl && customUrl.trim()) {
      return customUrl.trim().replace(/\/$/, "");
    }
  }

  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8000";
    }
  }

  return "http://localhost:8000";
}

export function setCustomApiUrl(url: string) {
  if (typeof window !== "undefined") {
    if (!url.trim()) {
      localStorage.removeItem("LOGICBITS_CUSTOM_API_URL");
    } else {
      localStorage.setItem("LOGICBITS_CUSTOM_API_URL", url.trim());
    }
  }
}
