import {BASE_URL, DEV_URL, ENDPOINTS} from "./consts";
import { getUrl, postUrl } from "./../utils";


export async function createBundle(requestBody) {
  const url = `${BASE_URL}${ENDPOINTS.BUNDLES}`;
  
  const response = await postUrl(url, requestBody);
  
  return response;
}

export async function createBundleDevStage(requestBody) {
    const url = `${DEV_URL}${ENDPOINTS.BUNDLES}`;

    const response = await postUrl(url, requestBody);

    return response;
}

export async function submitBundle(requestBody) {
  const url = `${BASE_URL}${ENDPOINTS.SUBMIT_BUNDLE}`;

  const response = await postUrl(url+"?format=json", requestBody);

  return response;
}

export async function submitBundleDevStage(requestBody) {
    const url = `${DEV_URL}${ENDPOINTS.SUBMIT_BUNDLE}`;

    const response = await postUrl(url+"?format=json", requestBody);

    return response;
}

export async function bundleList(owner: string) {
  const url = `${BASE_URL}${ENDPOINTS.BUNDLES}?intentOwner=${owner}`;

  const response = await getUrl(url);

  return response;
}