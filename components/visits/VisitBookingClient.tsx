"use client";

import { useState } from "react";
import { VisitCalendar } from "./VisitCalendar";
import { VisitRequestPanel } from "./VisitRequestPanel";

export function VisitBookingClient({
  requesterName,
}: {
  requesterName: string;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className={selectedDate ? "visit-layout has-panel" : "visit-layout"}>
      <div>
        <VisitCalendar
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          refreshKey={refreshKey}
        />
      </div>

      {selectedDate && (
        <VisitRequestPanel
          key={selectedDate}
          visitDate={selectedDate}
          requesterName={requesterName}
          onClose={() => setSelectedDate(null)}
          onSuccess={() => {
            setRefreshKey((value) => value + 1);
            setSelectedDate(null);
          }}
        />
      )}
    </div>
  );
}
