import { useCallback, useEffect, useRef } from "react";

export const HISTORY_STEPS_TO_LEAVE = -2;

export function useBrowserLeaveGuard(
  active: boolean,
  onBackAttempt: () => void,
) {
  const onBackAttemptRef = useRef(onBackAttempt);
  const releaseRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    onBackAttemptRef.current = onBackAttempt;
  }, [onBackAttempt]);

  useEffect(() => {
    if (!active) return;

    const holdPosition = () =>
      window.history.pushState(window.history.state, "", window.location.href);

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

  const leaveHistory = useCallback(() => {
    releaseRef.current();
    window.history.go(HISTORY_STEPS_TO_LEAVE);
  }, []);

  return { leaveHistory };
}
