import type { PlexSession } from "@/types";
import {
  navigationActions,
  removeAccessAction,
  streamTargets,
} from "./stream-actions";

const session = (
  user?: PlexSession["User"],
  player?: Partial<NonNullable<PlexSession["Player"]>>,
): PlexSession => ({
  sessionKey: "s-1",
  User: user,
  Player: player && {
    title: "TV",
    platform: "Roku",
    product: "Plex for Roku",
    state: "playing",
    ...player,
  },
});

const anonymous = session(undefined, { machineIdentifier: "m-1" });
const identified = session(
  { id: "u-1", title: "viewer" },
  {
    machineIdentifier: "m-1",
  },
);

describe("streamTargets", () => {
  it("needs a user before it can name the device", () => {
    expect(streamTargets(anonymous)).toEqual({
      userId: undefined,
      deviceIdentifier: undefined,
    });
    expect(streamTargets(identified)).toEqual({
      userId: "u-1",
      deviceIdentifier: "m-1",
    });
  });
});

describe("navigationActions", () => {
  it("navigates nowhere without identifiers", () => {
    const onNavigateToUser = jest.fn();
    const onNavigateToDevice = jest.fn();

    navigationActions(anonymous, {
      onNavigateToUser,
      onNavigateToDevice,
    }).forEach((action) => action.onSelect());

    expect(onNavigateToUser).not.toHaveBeenCalled();
    expect(onNavigateToDevice).not.toHaveBeenCalled();
  });

  it("navigates to the user and the device", () => {
    const onNavigateToUser = jest.fn();
    const onNavigateToDevice = jest.fn();

    navigationActions(identified, {
      onNavigateToUser,
      onNavigateToDevice,
    }).forEach((action) => action.onSelect());

    expect(onNavigateToUser).toHaveBeenCalledWith("u-1");
    expect(onNavigateToDevice).toHaveBeenCalledWith("u-1", "m-1");
  });
});

describe("removeAccessAction", () => {
  it("is blocked while revoking", () => {
    expect(removeAccessAction(identified, true, jest.fn())?.disabled).toBe(
      true,
    );
    expect(removeAccessAction(identified, false, jest.fn())?.disabled).toBe(
      false,
    );
  });
});
