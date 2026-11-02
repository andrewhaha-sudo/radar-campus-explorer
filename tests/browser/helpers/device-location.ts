import type { Page } from "@playwright/test";
import {
  testCalibration,
  geoAt,
} from "../../fixtures/location-calibration.mjs";

export { testCalibration, geoAt };
export async function installDeviceLocation(page: Page, calibrated = true) {
  await page.addInitScript(
    ({ calibration, calibrated }) => {
      if (calibrated)
        localStorage.setItem(
          "campus-explorer-map-calibration-v1",
          JSON.stringify(calibration),
        );
      let id = 0;
      const watchers = new Map<
        number,
        { success: PositionCallback; failure: PositionErrorCallback }
      >();
      const removed: PositionCallback[] = [];
      const state = {
        calls: [] as PositionOptions[],
        cleared: [] as number[],
        emit(value: GeolocationPosition) {
          for (const callback of watchers.values()) callback.success(value);
        },
        fail(code: number) {
          for (const callback of [...watchers.values()])
            callback.failure({ code } as GeolocationPositionError);
        },
        late(value: GeolocationPosition) {
          for (const callback of removed) callback(value);
        },
        active() {
          return watchers.size;
        },
      };
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          watchPosition(
            success: PositionCallback,
            failure: PositionErrorCallback,
            options: PositionOptions,
          ) {
            state.calls.push(options);
            watchers.set(++id, { success, failure });
            return id;
          },
          clearWatch(watchId: number) {
            const callback = watchers.get(watchId);
            if (callback) removed.push(callback.success);
            watchers.delete(watchId);
            state.cleared.push(watchId);
          },
        },
      });
      (window as any).__gps = state;
    },
    { calibration: testCalibration, calibrated },
  );
}
export async function sendLocation(
  page: Page,
  x: number,
  y: number,
  extra: {
    accuracy?: number;
    heading?: number | null;
    speed?: number | null;
    late?: boolean;
  } = {},
) {
  await page.evaluate(
    ({ point, extra }) => {
      const payload = {
        coords: {
          ...point,
          accuracy: extra.accuracy ?? 5,
          heading: extra.heading ?? null,
          speed: extra.speed ?? null,
          altitude: null,
          altitudeAccuracy: null,
        },
        timestamp: Date.now(),
      };
      (window as any).__gps[extra.late ? "late" : "emit"](payload);
    },
    { point: geoAt(x, y), extra },
  );
}
export async function actorPosition(page: Page) {
  return page.locator(".campus-student").evaluate((element) => {
    const transform = (element as SVGGraphicsElement).transform.baseVal.getItem(
      0,
    ).matrix;
    return { x: transform.e, y: transform.f };
  });
}
