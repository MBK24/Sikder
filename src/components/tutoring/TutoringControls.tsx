"use client";

import { useActionState, useEffect, useRef } from "react";
import { TzOffsetInput } from "@/components/ui/LocalTime";
import { sendTutoringMessage, updateTutoringStatus, updateTutorProfile, type TutoringFormState } from "@/server/actions/tutoring";

function Err({ s }: { s: TutoringFormState }) {
  return s.error ? <p role="alert" className="text-sm text-[var(--c-trap)]">{s.error}</p> : null;
}

export function MessageForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<TutoringFormState, FormData>(sendTutoringMessage.bind(null, requestId), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="space-y-2">
      <label htmlFor="msg" className="sr-only">
        Message
      </label>
      <textarea id="msg" name="body" rows={3} required maxLength={4000} className="input" placeholder="Write a message…" />
      <Err s={state} />
      <button className="btn btn-primary" disabled={pending}>
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}

export function StatusControls({ requestId, isTutor, status }: { requestId: string; isTutor: boolean; status: string }) {
  const [state, action, pending] = useActionState<TutoringFormState, FormData>(updateTutoringStatus.bind(null, requestId), {});
  if (["DECLINED", "CANCELED", "COMPLETED"].includes(status)) return null;
  if (!isTutor) {
    return (
      <form action={action}>
        <input type="hidden" name="status" value="CANCELED" />
        <button className="btn btn-ghost text-sm" disabled={pending}>
          Cancel request
        </button>
        <Err s={state} />
      </form>
    );
  }
  return (
    <div className="space-y-4">
      {status === "PENDING" ? (
        <div className="flex gap-2">
          <form action={action}>
            <input type="hidden" name="status" value="ACCEPTED" />
            <button className="btn btn-primary" disabled={pending}>
              Accept
            </button>
          </form>
          <form action={action}>
            <input type="hidden" name="status" value="DECLINED" />
            <button className="btn btn-ghost" disabled={pending}>
              Decline
            </button>
          </form>
        </div>
      ) : null}
      {status === "ACCEPTED" || status === "SCHEDULED" ? (
        <form action={action} className="grid gap-3 rounded-md border border-[var(--c-border)] p-4 sm:grid-cols-3">
          <input type="hidden" name="status" value="SCHEDULED" />
          <TzOffsetInput />
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Date & time</span>
            <input type="datetime-local" name="scheduledFor" className="input" required />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Minutes</span>
            <input type="number" name="durationMin" min={15} max={240} defaultValue={60} className="input" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold">Meeting link</span>
            <input type="url" name="meetingLink" className="input" placeholder="https://…" />
          </label>
          <div className="sm:col-span-3">
            <button className="btn btn-primary" disabled={pending}>
              {status === "SCHEDULED" ? "Reschedule" : "Schedule session"}
            </button>
          </div>
        </form>
      ) : null}
      {status === "SCHEDULED" ? (
        <form action={action}>
          <input type="hidden" name="status" value="COMPLETED" />
          <button className="btn btn-ghost text-sm" disabled={pending}>
            Mark as completed
          </button>
        </form>
      ) : null}
      <Err s={state} />
    </div>
  );
}

export function TutorProfileForm({ initial }: { initial: { headline: string; availability: string; accepting: boolean; subjects: string[] } }) {
  const [state, action, pending] = useActionState<TutoringFormState, FormData>(updateTutorProfile, {});
  return (
    <form action={action} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Headline</span>
        <input name="tutorHeadline" className="input" maxLength={140} defaultValue={initial.headline} placeholder="e.g. 522 scorer, 4 years tutoring CARS and B/B" />
      </label>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">Sections you tutor</legend>
        <div className="flex flex-wrap gap-2">
          {[
            ["CP", "Chem/Phys"],
            ["CARS", "CARS"],
            ["BB", "Bio/Biochem"],
            ["PS", "Psych/Soc"],
          ].map(([v, l]) => (
            <label key={v} className="chip">
              <input type="checkbox" name="tutorSubjects" value={v} defaultChecked={initial.subjects.includes(v)} />
              {l}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Availability</span>
        <input name="tutorAvailability" className="input" maxLength={500} defaultValue={initial.availability} placeholder="e.g. Weekday evenings ET" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="acceptingRequests" defaultChecked={initial.accepting} /> Accepting new session requests
      </label>
      <Err s={state} />
      {state.ok ? <p className="text-sm text-[var(--c-ok)]">Saved.</p> : null}
      <button className="btn btn-primary" disabled={pending}>
        Save
      </button>
    </form>
  );
}
