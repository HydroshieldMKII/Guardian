import { render } from "@testing-library/react";
import { useRef } from "react";
import { useSessionDeepLink } from "./useSessionDeepLink";
import type { SessionHistoryEntry } from "@/lib/session-history";

const entry = (id: number): SessionHistoryEntry => ({
  id,
  sessionKey: `s-${id}`,
  userId: "u-1",
  startedAt: "",
});

interface HarnessProps {
  sessions: SessionHistoryEntry[];
  rendered?: number[];
  attached?: boolean;
  loadMore?: () => void;
}

function Harness({
  sessions,
  rendered = sessions.map((session) => session.id),
  attached = true,
  loadMore = jest.fn(),
}: HarnessProps) {
  const listRef = useRef<HTMLDivElement>(null);
  useSessionDeepLink({
    listRef,
    sessionId: 2,
    isOpen: true,
    sessions,
    firstLoad: false,
    hasMore: true,
    loadingMore: false,
    loadMore,
  });

  const items = rendered.map((id) => <div key={id} data-session-id={id} />);
  return attached ? <div ref={listRef}>{items}</div> : <div>{items}</div>;
}

const scrollIntoView = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  Element.prototype.scrollIntoView = scrollIntoView;
});

describe("useSessionDeepLink", () => {
  it("waits for the list to be attached", () => {
    const loadMore = jest.fn();
    render(<Harness sessions={[]} attached={false} loadMore={loadMore} />);

    expect(loadMore).not.toHaveBeenCalled();
  });

  it("keeps paging towards the session up to a limit", () => {
    const loadMore = jest.fn();
    const { rerender } = render(<Harness sessions={[]} loadMore={loadMore} />);

    for (let page = 3; page <= 7; page += 1) {
      rerender(<Harness sessions={[entry(page)]} loadMore={loadMore} />);
    }

    expect(loadMore).toHaveBeenCalledTimes(4);
  });

  it("waits until the session is on screen", () => {
    render(<Harness sessions={[entry(2)]} rendered={[]} />);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls to a session only once", () => {
    const { rerender } = render(<Harness sessions={[entry(2)]} />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);

    rerender(<Harness sessions={[entry(2), entry(3)]} />);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
