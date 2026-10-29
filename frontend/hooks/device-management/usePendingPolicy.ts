import { useEffect, useRef, useState } from "react";

type Policy = boolean | null;

export function usePendingPolicy(storedPolicy: Policy, saving: boolean) {
  const [pending, setPending] = useState<{ value: Policy } | null>(null);
  const wasSaving = useRef(false);

  useEffect(() => {
    if (wasSaving.current && !saving) {
      setPending(null);
    }
    wasSaving.current = saving;
  }, [saving]);

  useEffect(() => {
    setPending((current) =>
      current && !Object.is(current.value, storedPolicy) ? current : null,
    );
  }, [storedPolicy]);

  const value = pending ? pending.value : storedPolicy;

  const choose = (next: Policy, save: (value: Policy) => void) => {
    if (Object.is(next, value)) return;
    setPending({ value: next });
    save(next);
  };

  return { value, choose };
}
