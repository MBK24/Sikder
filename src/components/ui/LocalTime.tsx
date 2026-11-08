"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Renders a timestamp in the viewer's own time zone (UTC on the server, then the local zone after hydration). */
export function LocalTime({ iso }: { iso: string }) {
  const local = useSyncExternalStore(
    noop,
    () =>
      new Date(iso).toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }),
    () => new Date(iso).toUTCString(),
  );
  return <time dateTime={iso}>{local}</time>;
}

export function TzOffsetInput() {
  const offset = useSyncExternalStore(noop, () => String(new Date().getTimezoneOffset()), () => "0");
  return <input type="hidden" name="tzOffset" value={offset} />;
}
