"use client";

import { useState } from "react";
import type { VisitDateAvailability } from "../../src/features/visits/types";
import { VisitCalendar } from "./VisitCalendar";
import { VisitRequestPanel } from "./VisitRequestPanel";

export function VisitBookingClient({
  requesterName,
}: {
  requesterName: string;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [availability, setAvailability] = useState<VisitDateAvailability[]>([]);

  return (
    <div className={selectedDate ? "visit-layout has-panel" : "visit-layout"}>
      <div>
        <VisitCalendar
          selectedDate={selectedDate}
          onSelect={setSelectedDate}
          onAvailabilityChange={setAvailability}
          refreshKey={refreshKey}
        />
      </div>

      {selectedDate && (
        <VisitRequestPanel
          key={selectedDate}
          visitDate={selectedDate}
          requesterName={requesterName}
          dateAvailable={availability.some((day) => day.date === selectedDate && day.available)}
          onClose={() => setSelectedDate(null)}
          onDateUnavailable={() => {
            setAvailability([]);
            setRefreshKey((value) => value + 1);
          }}
          onSuccess={() => {
            setRefreshKey((value) => value + 1);
            setSelectedDate(null);
          }}
        />
      )}
    </div>
  );
}
