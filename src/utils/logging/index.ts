import { BundleProposeResponse } from "@gasless-intents/types";

export function logActionTypes(bundle: BundleProposeResponse): void {
  const types = [
    ...(bundle.intents ?? []).flatMap((i) => i.requiredActions.map((a) => `intent:${a.type}`)),
    ...(bundle.preHooks ?? []).flatMap((h) => h.requiredActions.map((a) => `preHook:${a.type}`)),
    ...(bundle.postHooks ?? []).flatMap((h) => h.requiredActions.map((a) => `postHook:${a.type}`)),
  ];
  console.log("Required action types:", types);
}
