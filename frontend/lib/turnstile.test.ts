import {
  TURNSTILE_SCRIPT_ID,
  TURNSTILE_SCRIPT_URL,
  turnstileScript,
} from "./turnstile";

afterEach(() => {
  document.getElementById(TURNSTILE_SCRIPT_ID)?.remove();
});

describe("turnstileScript", () => {
  it("adds the Turnstile script once", () => {
    const script = turnstileScript();

    expect(script.src).toBe(TURNSTILE_SCRIPT_URL);
    expect(script.async).toBe(true);
    expect(script.defer).toBe(true);
    expect(document.head).toContainElement(script);
    expect(turnstileScript()).toBe(script);
    expect(document.querySelectorAll(`#${TURNSTILE_SCRIPT_ID}`)).toHaveLength(
      1,
    );
  });
});
