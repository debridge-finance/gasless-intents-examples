import { getHeaders } from ".";

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