import { getHeaders } from "./env";


export async function getUrl(url: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch URL: ${response.statusText}. ${errorText}`);
  }
  return response.json();
}

// Like getUrl, but returns the HTTP status instead of throwing on non-2xx — for
// callers that must read error bodies (e.g. cancel-tx -> 400 ORDER_ALREADY_FULFILLED).
export async function getUrlWithStatus(url: string): Promise<{ status: number; body: any }> {
  const response = await fetch(url, { method: "GET", headers: getHeaders() });
  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    return { status: response.status, body: text };
  }
}

export async function postUrl(url: string, body: any) {
  const response = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to post URL: ${response.statusText}. ${errorText}`);
  }
  return response.json();
}