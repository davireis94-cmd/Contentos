"use client";

import { useState } from "react";
import {
  addMonths,
  differenceInDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isToday,
  startOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { updatePieceDate } from "@/app/(dashboard)/calendar/actions";
import type { CalendarPiece } from "./calendar-shell";

const STATUS_COLORS: Record<string, string> = {
  idea: "bg-gray-400",
  scripted: "bg-blue-500",
  editing: "bg-amber-500",
  scheduled: "bg-purple-500",
  published: "bg-green-500",
};

const FORMAT_LABELS: Record<string, string> = {
  carousel: "Carrossel",
  reel: "Reels",
  story: "Stories",
  single: "Single",
};

const DAY_WIDTH = 32; // px per day cell

interface GanttRowProps {
  piece: CalendarPiece;
  days: Date[];
  monthStart: Date;
  onDateChange: (pieceId: string, date: string | null) => void;
}

function GanttRow({ piece, days, monthStart, onDateChange }: GanttRowProps) {
  const scheduledDate = piece.scheduledFor ? new Date(piece.scheduledFor) : null;
  const scheduledIndex = scheduledDate
    ? differenceInDays(scheduledDate, monthStart)
    : null;
  const inRange =
    scheduledIndex !== null &&
    scheduledIndex >= 0 &&
    scheduledIndex < days.length;

  return (
    <div className="group flex items-center border-b last:border-b-0 hover:bg-muted/30">
      {/* Left: piece info */}
      <div className="flex w-56 shrink-0 items-center gap-2 border-r px-3 py-2">
        <div
          className={cn(
            "size-2 shrink-0 rounded-full",
            STATUS_COLORS[piece.status] ?? "bg-muted-foreground"
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{piece.title}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-[10px] text-muted-foreground">
              {FORMAT_LABELS[piece.format] ?? piece.format}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground truncate">{piece.brandName}</span>
          </div>
        </div>
      </div>

      {/* Right: Gantt bars */}
      <div className="relative flex items-center" style={{ width: days.length * DAY_WIDTH }}>
        {/* Day grid lines */}
        {days.map((day, i) => (
          <div
            key={i}
            className={cn(
              "absolute top-0 h-full border-r border-border/50",
              isToday(day) && "bg-blue-50/60 dark:bg-blue-950/20"
            )}
            style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
          />
        ))}

        {/* Bar */}
        {inRange && scheduledIndex !== null && (
          <div
            className={cn(
              "absolute flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow-sm cursor-pointer transition-transform hover:scale-105",
              STATUS_COLORS[piece.status] ?? "bg-muted-foreground"
            )}
            style={{
              left: scheduledIndex * DAY_WIDTH + 4,
              height: 20,
              minWidth: DAY_WIDTH - 8,
            }}
            title={`${piece.title} — ${format(new Date(piece.scheduledFor!), "dd/MM", { locale: ptBR })}`}
          >
            {format(new Date(piece.scheduledFor!), "dd", { locale: ptBR })}
          </div>
        )}

        {/* Date input (shows on hover for pieces without date) */}
        {!inRange && (
          <div className="absolute right-2 hidden group-hover:flex items-center gap-1">
            <Calendar className="size-3 text-muted-foreground" />
            <input
              type="date"
              className="h-5 rounded border bg-background px-1 text-[10px]"
              onChange={(e) => {
                onDateChange(piece.id, e.target.value || null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface GanttViewProps {
  pieces: CalendarPiece[];
}

export function GanttView({ pieces }: GanttViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [items, setItems] = useState(pieces);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  function handleDateChange(pieceId: string, date: string | null) {
    setItems((prev) =>
      prev.map((p) =>
        p.id === pieceId
          ? { ...p, scheduledFor: date, status: date ? "scheduled" : p.status }
          : p
      )
    );
    updatePieceDate(pieceId, date);
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

      <div className="overflow-x-auto rounded-lg border">
        {/* Header row */}
        <div className="flex border-b bg-muted/30">
          <div className="w-56 shrink-0 border-r px-3 py-2 text-xs font-medium text-muted-foreground">
            Conteúdo
          </div>
          <div className="flex">
            {days.map((day, i) => (
              <div
                key={i}
                className={cn(
                  "flex flex-col items-center justify-center border-r border-border/50 py-2",
                  isToday(day) && "bg-blue-50 dark:bg-blue-950/30 font-semibold"
                )}
                style={{ width: DAY_WIDTH }}
              >
                <span className="text-[9px] text-muted-foreground uppercase">
                  {format(day, "EEE", { locale: ptBR }).slice(0, 3)}
                </span>
                <span
                  className={cn(
                    "text-[11px]",
                    isToday(day) ? "text-blue-600 font-bold" : "text-foreground"
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Rows */}
        {items.length === 0 ? (
          <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
            Nenhum conteúdo. Agende via Kanban ou criando uma ideia.
          </div>
        ) : (
          items.map((piece) => (
            <GanttRow
              key={piece.id}
              piece={piece}
              days={days}
              monthStart={monthStart}
              onDateChange={handleDateChange}
            />
          ))
        )}
      </div>
    </div>
  );
}
