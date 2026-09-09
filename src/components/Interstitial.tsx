"use client";

import Button from "./Button";

type Props = { eyebrow: string; headline: string; body: string; cta: string; onContinue: () => void };

export default function Interstitial({ eyebrow, headline, body, cta, onContinue }: Props) {
  return (
    <div className="flex flex-1 flex-col justify-center py-12">
      <p className="t-eyebrow text-blue-hi">{eyebrow}</p>
      <h2 className="t-title mt-4 max-w-[15ch] text-ink">{headline}</h2>
      <p className="t-body mt-6 max-w-[48ch] text-ink-2">{body}</p>

      <div className="mt-10 max-w-md">
        <Button onClick={onContinue}>{cta}</Button>
      </div>
    </div>
  );
}
