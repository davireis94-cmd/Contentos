"use client";

import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalendarPiece } from "./calendar-shell";

const STATUS_DOT: Record<string, string> = {
  idea: "bg-gray-400",
  scripted: "bg-blue-400",
  editing: "bg-amber-400",
  scheduled: "bg-purple-400",
  published: "bg-green-500",
};

const FORMAT_LABELS: Record<string, string> = {
  carousel: "Carrossel",
  reel: "Reels",
  story: "Stories",
  single: "Single",
};

interface MonthlyViewProps {
  pieces: CalendarPiece[];
}

export function MonthlyView({ pieces }: MonthlyViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  function piecesForDay(day: Date) {
    return pieces.filter(
      (p) => p.scheduledFor && isSameDay(new Date(p.scheduledFor), day)
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold capitalize">
          {format(currentDate, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setCurrentDate((d) => addMonths(d, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setCurrentDate(new Date())}
          >
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setCurrentDate((d) => addMonths(d, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
          <div key={d} className="py-1.5 text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px rounded-lg bg-border overflow-hidden border">
        {days.map((day) => {
          const dayPieces = piecesForDay(day);
          const inMonth = isSameMonth(day, currentDate);
          const today = isToday(day);

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-24 bg-card p-1.5 flex flex-col gap-1",
                !inMonth && "bg-muted/30"
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center self-end rounded-full text-xs",
                  today && "bg-foreground text-background font-medium",
                  !inMonth && "text-muted-foreground/40"
                )}
              >
                {format(day, "d")}
              </span>

              {dayPieces.slice(0, 3).map((piece) => (
                <div
                  key={piece.id}
                  className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent cursor-pointer"
                  title={piece.title}
                >
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      STATUS_DOT[piece.status] ?? "bg-muted-foreground"
                    )}
                  />
                  <span className="truncate text-[10px] leading-tight">
                    {piece.title}
                  </span>
                </div>
              ))}

              {dayPieces.length > 3 && (
                <span className="text-[10px] text-muted-foreground px-1">
                  +{dayPieces.length - 3} mais
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 pt-1">
        {Object.entries(STATUS_DOT).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", color)} />
            <span className="text-xs text-muted-foreground capitalize">
              {{
                idea: "Ideia",
                scripted: "Roteirizado",
                editing: "Em edição",
                scheduled: "Agendado",
                published: "Publicado",
              }[status] ?? status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
