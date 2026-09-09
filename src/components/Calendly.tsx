"use client";

import { useEffect, useRef } from "react";

type Props = {
  url: string;
  prefill: { name?: string; email?: string };
  onScheduled: () => void;
};

export default function Calendly({ url, prefill, onScheduled }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (typeof event.origin !== "string" || !event.origin.includes("calendly.com")) return;
      const data = event.data as { event?: string } | undefined;
      if (data?.event === "calendly.event_scheduled") onScheduled();
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onScheduled]);

  useEffect(() => {
    if (mounted.current || !host.current) return;
    mounted.current = true;

    const target = new URL(url);
    if (prefill.name) target.searchParams.set("name", prefill.name);
    if (prefill.email) target.searchParams.set("email", prefill.email);
    target.searchParams.set("hide_gdpr_banner", "1");
    // Calendly's chrome, dressed in the azen.io palette.
    target.searchParams.set("background_color", "0f1011");
    target.searchParams.set("text_color", "f5f5f7");
    target.searchParams.set("primary_color", "0071e3");

    const iframe = document.createElement("iframe");
    iframe.src = target.toString();
    iframe.title = "Book a call with Azen";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.loading = "lazy";

    host.current.appendChild(iframe);
  }, [url, prefill.name, prefill.email]);

  return (
    <div
      ref={host}
      className="h-[720px] w-full overflow-hidden rounded-[22px] border border-hairline bg-surface sm:h-[700px]"
    />
  );
}
