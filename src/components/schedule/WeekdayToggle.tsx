import { cn, DAY_NAMES } from "@/lib/utils";
import type { DayOfWeek } from "@/types";

interface Props {
  value: DayOfWeek[];
  onChange: (days: DayOfWeek[]) => void;
}

const ALL_DAYS: DayOfWeek[] = [1, 2, 3, 4, 5, 6, 7];

export function WeekdayToggle({ value, onChange }: Props) {
  const toggle = (day: DayOfWeek) => {
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day].sort((a, b) => a - b));
    }
  };

  return (
    <div className="flex gap-1">
      {ALL_DAYS.map((day) => {
        const active = value.includes(day);
        return (
          <button
            key={day}
            type="button"
            onClick={() => toggle(day)}
            className={cn(
              "w-9 h-9 rounded-md text-xs font-semibold border transition-colors",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-input hover:bg-accent"
            )}
          >
            {DAY_NAMES[day]}
          </button>
        );
      })}
    </div>
  );
}
