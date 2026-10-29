import { useCallback, useEffect, useRef } from "react";

const HISTORY_STEPS_TO_LEAVE = -2;
const HISTORY_STEPS_WITHOUT_HOLD = -1;
const HELD_ENTRY_MARKER = "guardianLeaveGuard";

const isHeldEntry = (): boolean => {
  const state: unknown = window.history.state;
  return (
    typeof state === "object" && state !== null && HELD_ENTRY_MARKER in state
  );
};

export function useBrowserLeaveGuard(
  active: boolean,
  onBackAttempt: () => void,
) {
  const onBackAttemptRef = useRef(onBackAttempt);
  const releaseRef = useRef<() => void>(() => undefined);
  const holdingRef = useRef(false);

  useEffect(() => {
    onBackAttemptRef.current = onBackAttempt;
  }, [onBackAttempt]);

  useEffect(() => {
    if (!active) return;

    const holdPosition = () => {
      const state: unknown = window.history.state;
      window.history.pushState(
        {
          ...(typeof state === "object" ? state : {}),
          [HELD_ENTRY_MARKER]: true,
        },
        "",
        window.location.href,
      );
      holdingRef.current = true;
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    const handlePopState = () => {
      holdPosition();
      onBackAttemptRef.current();
    };

    const release = () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
    };

    holdPosition();
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    releaseRef.current = release;

    return () => {
      release();
      releaseRef.current = () => undefined;
    };
  }, [active]);

  useEffect(() => {
    if (active || !holdingRef.current) return;
    holdingRef.current = false;
    if (isHeldEntry()) {
      window.history.back();
    }
  }, [active]);

  const leaveHistory = useCallback(() => {
    releaseRef.current();
    const steps = holdingRef.current
      ? HISTORY_STEPS_TO_LEAVE
      : HISTORY_STEPS_WITHOUT_HOLD;
    holdingRef.current = false;
    window.history.go(steps);
  }, []);

  return { leaveHistory };
}
