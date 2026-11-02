import { useState } from "react";
import type { ReactNode } from "react";
import { loadRecords, saveRecords } from "../../lib/radar-records";
import type { RadarRecords } from "../../lib/radar-records";
import { RadarContext } from "./radar-context";

export function RadarProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<RadarRecords>(() => loadRecords());
  const update = (recipe: (current: RadarRecords) => RadarRecords) => {
    setRecords((current) => {
      const next = recipe(current);
      saveRecords(next);
      return next;
    });
  };
  return (
    <RadarContext.Provider value={{ records, update }}>
      {children}
    </RadarContext.Provider>
  );
}
