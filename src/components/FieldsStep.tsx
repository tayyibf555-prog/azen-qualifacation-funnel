"use client";

import { useState } from "react";
import * as motionReact from "motion/react";
import type { Field } from "@/lib/questions";
import { spring } from "@/lib/motion";
import Button from "./Button";

const { motion, AnimatePresence } = motionReact;

type Props = {
  fields: Field[];
  values: Record<string, string>;
  cta: string;
  busy?: boolean;
  onSubmit: (values: Record<string, string>) => void;
};

function validate(field: Field, raw: string): string | null {
  const value = raw.trim();

  if (field.required && !value) return `${field.label} is needed to continue`;
  if (!value) return null;

  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
    return "That email doesn't look right";
  }

  if (field.type === "tel" && value.replace(/[^\d]/g, "").length < 9) {
    return "That number looks too short";
  }

  return null;
}

export default function FieldsStep({ fields, values, cta, busy, onSubmit }: Props) {
  const [local, setLocal] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, values[f.id] ?? ""])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focused, setFocused] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const found: Record<string, string> = {};
    for (const field of fields) {
      const error = validate(field, local[field.id] ?? "");
      if (error) found[field.id] = error;
    }

    setErrors(found);
    if (Object.keys(found).length > 0) return;

    onSubmit(Object.fromEntries(fields.map((f) => [f.id, (local[f.id] ?? "").trim()])));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-9 space-y-5">
      {fields.map((field) => {
        const error = errors[field.id];
        const active = focused === field.id;

        return (
          <div key={field.id}>
            <label htmlFor={field.id} className="t-eyebrow mb-2.5 block text-ink-3">
              {field.label}
              {!field.required ? <span className="ml-2 normal-case tracking-normal">optional</span> : null}
            </label>

            <motion.div
              animate={{ scale: active ? 1.008 : 1 }}
              transition={spring.press}
              className={[
                "rounded-[16px] border transition-colors duration-200",
                error ? "border-blue-2" : active ? "border-blue bg-surface-hi" : "border-hairline bg-surface",
              ].join(" ")}
            >
              <input
                id={field.id}
                name={field.id}
                type={field.type === "url" ? "text" : field.type}
                inputMode={field.inputMode}
                autoComplete={field.autoComplete}
                placeholder={field.placeholder}
                value={local[field.id] ?? ""}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${field.id}-error` : undefined}
                onFocus={() => setFocused(field.id)}
                onBlur={() => {
                  setFocused(null);
                  // Inline validation: tell them at the field, not at submit.
                  const found = validate(field, local[field.id] ?? "");
                  if (found && (local[field.id] ?? "").trim()) {
                    setErrors((prev) => ({ ...prev, [field.id]: found }));
                  }
                }}
                onChange={(e) => {
                  setLocal((prev) => ({ ...prev, [field.id]: e.target.value }));
                  if (error) setErrors((prev) => ({ ...prev, [field.id]: "" }));
                }}
                className="w-full bg-transparent px-5 py-[17px] text-[16.5px] tracking-[-0.012em] text-ink placeholder:text-ink-3/55 focus:outline-none"
              />
            </motion.div>

            <AnimatePresence>
              {error ? (
                <motion.p
                  id={`${field.id}-error`}
                  role="alert"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={spring.quick}
                  className="overflow-hidden pt-2 text-[13px] text-blue-hi"
                >
                  {error}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>
        );
      })}

      <div className="pt-3">
        <Button type="submit" disabled={busy}>
          {busy ? "One moment…" : cta}
        </Button>
      </div>
    </form>
  );
}
