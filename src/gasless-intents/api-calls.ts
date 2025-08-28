import { BASE_URL, BUNDLE_LIST, BUNDLE_SUBMIT, PREPARE } from "./consts";
import { getUrl, postUrl } from "./../utils";


export async function createBundle(requestBody) {
  const url = `${BASE_URL}${PREPARE}`;
  
  const response = await postUrl(url, requestBody);
  
  return response;
}

export async function submitBundle(requestBody) {
  const url = `${BASE_URL}${BUNDLE_SUBMIT}`;

  const response = await postUrl(url+"?format=json", requestBody);

  return response;
}

export async function bundleList(owner: string) {
  const url = `${BASE_URL}${BUNDLE_LIST}?intentOwner=${owner}`;

  const response = await getUrl(url);

  return response;
}