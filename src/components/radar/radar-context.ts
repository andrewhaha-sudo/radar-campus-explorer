import { createContext, useContext } from "react";
import type { RadarRecords } from "../../lib/radar-records";

export interface RadarContextValue {
  records: RadarRecords;
  update: (recipe: (current: RadarRecords) => RadarRecords) => void;
}

export const RadarContext = createContext<RadarContextValue | null>(null);

export function useRadar() {
  const value = useContext(RadarContext);
  if (!value) throw new Error("RADAR records are unavailable.");
  return value;
}
