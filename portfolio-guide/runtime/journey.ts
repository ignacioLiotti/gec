import { useSyncExternalStore } from "react";

const key = "sintesis-guide:journey";
const changeEvent = "guide-journey-change";
type Journey = {
  active: boolean;
  sourceOpened: boolean;
  rowsSaved: boolean;
  reportOpened: boolean;
  exported: boolean;
};
const initial: Journey = {
  active: false,
  sourceOpened: false,
  rowsSaved: false,
  reportOpened: false,
  exported: false,
};
const snapshot = () => sessionStorage.getItem(key) || "";
function parse(value: string): Journey {
  try {
    return { ...initial, ...JSON.parse(value) };
  } catch {
    return initial;
  }
}
function subscribe(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (
      event.storageArea === sessionStorage &&
      (event.key === key || event.key === null)
    )
      callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(changeEvent, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(changeEvent, callback);
  };
}
export function useJourney() {
  return parse(useSyncExternalStore(subscribe, snapshot, () => ""));
}
export function updateJourney(patch: Partial<Journey>) {
  const previous = snapshot();
  const next = JSON.stringify({ ...parse(previous), ...patch });
  if (previous === next) return;
  sessionStorage.setItem(key, next);
  window.dispatchEvent(new Event(changeEvent));
}
export function resetJourney(active = false) {
  updateJourney({ ...initial, active });
}
