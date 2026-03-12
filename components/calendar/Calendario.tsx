import { Card } from "@heroui/card";

import { CalendarHeader } from "./components/calendar-header";
import { CalendarControls } from "./components/calendar-controls";
import { CalendarView } from "./components/calendar-view";

export default function Calendario() {
  return (
    <Card className="h-full overflow-hidden lg:p-2 w-full">
      <div className="lg:border-white lg:rounded-md overflow-hidden flex flex-col items-center justify-start bg-container h-full w-full bg-transparent">
        <div className="w-full">
          <CalendarHeader />
          <CalendarControls />
        </div>
        <div className="flex-1 overflow-hidden w-full">
          <CalendarView />
        </div>
      </div>
    </Card>
  );
}
