"use client";

import { useActionState, useMemo } from "react";
import { updateProfile, type ProfileFormState } from "@/server/actions/profile";

interface Initial {
  displayName: string;
  username: string;
  bio: string;
  targetTestDate: string;
  targetScore: string;
  timezone: string;
  emailOnReply: boolean;
  emailOnAccepted: boolean;
}

export function ProfileForm({ initial }: { initial: Initial }) {
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(updateProfile, {});
  const zones = useMemo(() => {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    return list.includes(initial.timezone) ? list : [initial.timezone, ...list];
  }, [initial.timezone]);

  return (
    <form action={action} className="mt-8 space-y-5 font-sans">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Display name</span>
          <input name="displayName" className="input" defaultValue={initial.displayName} maxLength={60} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Username</span>
          <input name="username" className="input" defaultValue={initial.username} required pattern="[a-zA-Z0-9_]{3,24}" />
          <span className="mt-1 block text-xs text-muted">Shown on your forum posts.</span>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Test date</span>
          <input name="targetTestDate" type="date" className="input" defaultValue={initial.targetTestDate} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Target score</span>
          <input name="targetScore" type="number" min={472} max={528} className="input" defaultValue={initial.targetScore} placeholder="e.g. 515" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Time zone</span>
        <select name="timezone" className="input" defaultValue={initial.timezone}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-muted">Used for your daily study streak.</span>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Bio</span>
        <textarea name="bio" rows={3} className="input" defaultValue={initial.bio} maxLength={1000} />
      </label>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold">Email me when</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="emailOnReply" defaultChecked={initial.emailOnReply} /> someone replies to my forum question
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="emailOnAccepted" defaultChecked={initial.emailOnAccepted} /> my answer is accepted
        </label>
      </fieldset>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <p role="status" className="text-sm">
          {state.error ? <span className="text-[var(--c-trap)]">{state.error}</span> : state.ok ? <span className="text-[var(--c-ok)]">Saved.</span> : null}
        </p>
      </div>
    </form>
  );
}
