"use client";
import { useSyncExternalStore } from "react";

const subscribeHydration = () => () => {};
const client = () => true;
const server = () => false;
export function useHydrated() {
  return useSyncExternalStore(subscribeHydration, client, server);
}
const query = "(hover: hover) and (pointer: fine)";
const subscribePointer = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const pointerSnapshot = () => window.matchMedia(query).matches;
export function useFinePointer() {
  return useSyncExternalStore(subscribePointer, pointerSnapshot, server);
}
