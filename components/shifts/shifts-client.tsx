import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

interface ShiftItem {
  id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  notes: string;
  staff: {
    full_name: string;
    role: string;
  } | null;
}

interface DateShifts {
  date: string;
  shifts: ShiftItem[];
}

interface ShiftsClientProps {
  restaurantName: string;
  shiftsByDate: DateShifts[];
}

export function ShiftsClient({ restaurantName, shiftsByDate }: ShiftsClientProps) {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">Shift Schedule</h1>
      <p className="text-muted-foreground mb-6">{restaurantName}</p>

      {shiftsByDate.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No shifts scheduled</p>
          </CardContent>
        </Card>
      ) : (
        shiftsByDate.map(({ date, shifts }) => (
          <Card key={date} className="mb-4">
            <CardHeader>
              <CardTitle>{formatDate(date)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {shifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="border rounded-lg p-3 bg-muted/50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-lg">
                        {shift.start_time} - {shift.end_time}
                      </span>
                    </div>
                    {shift.staff ? (
                      <div className="text-sm">
                        <p className="font-medium">{shift.staff.full_name}</p>
                        <p className="text-muted-foreground capitalize">
                          {shift.staff.role}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Unassigned</p>
                    )}
                    {shift.notes && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {shift.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}