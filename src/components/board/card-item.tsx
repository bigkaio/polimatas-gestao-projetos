"use client";

import Link from "next/link";
import clsx from "clsx";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CardDTO } from "@/lib/dto";
import { brl, dateBR, dueStatus, initials } from "@/lib/format";

export function CardItem({
  card,
  boardKey,
  disabled,
}: {
  card: CardDTO;
  boardKey: string;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled,
  });

  const due = dueStatus(card.dueDate);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={clsx(
        "rounded-xl border border-slate-200 bg-white p-3 shadow-sm",
        !disabled && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <Link
        href={`/board/${boardKey}/card/${card.id}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="block"
      >
        <p className="text-sm font-medium leading-snug text-slate-900 hover:text-indigo-700">
          {card.title}
        </p>
      </Link>

      {card.clientName ? (
        <p className="mt-1 text-xs text-slate-500">{card.clientName}</p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {card.dueDate ? (
          <span
            className={clsx(
              "rounded-md px-1.5 py-0.5 font-medium",
              due === "late" && "bg-red-100 text-red-700",
              due === "soon" && "bg-amber-100 text-amber-700",
              due === "ok" && "bg-slate-100 text-slate-600"
            )}
          >
            {dateBR(card.dueDate)}
          </span>
        ) : null}
        {card.amount ? (
          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
            {brl(card.amount)}
          </span>
        ) : null}
        {card.tasksTotal > 0 ? (
          <span
            className={clsx(
              "rounded-md px-1.5 py-0.5 font-medium",
              card.tasksDone === card.tasksTotal
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            )}
          >
            ☑ {card.tasksDone}/{card.tasksTotal}
          </span>
        ) : null}
        {card.sourceCardId ? (
          <span title="Gerado automaticamente a partir de uma venda" className="text-indigo-500">
            ⚡ venda
          </span>
        ) : null}
        {card.assignee ? (
          <span
            title={card.assignee.name}
            className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700"
          >
            {initials(card.assignee.name)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
