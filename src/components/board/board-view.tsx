"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import type { BoardDTO, CardDTO, FunnelStats, ListDTO, UserDTO } from "@/lib/dto";
import { moveCardAction } from "@/app/actions/cards";
import { useToast } from "@/components/toast";
import { brl, dueStatus } from "@/lib/format";
import { CardItem } from "./card-item";
import { AddCard } from "./add-card";
import { CloseDialogs, type PendingMove } from "./close-dialogs";

/**
 * Espelho das regras nativas de compliance na experiência (US-32): a lista de
 * destino inválida fica indisponível ANTES do drop. A garantia real continua
 * no servidor — isto é só a primeira camada do enforcement (seção 5.4).
 */
function invalidReason(card: CardDTO, from: ListDTO, to: ListDTO): string | null {
  if (to.id === card.listId) return null;
  if (to.semantics === "done" && card.tasksTotal - card.tasksDone > 0)
    return `${card.tasksTotal - card.tasksDone} tarefa(s) aberta(s)`;
  if (to.stageKey === "proposta" && card.type === "opportunity" && !card.amount)
    return "informe o valor antes";
  if (to.stageKey === "em_andamento" && card.type === "project" && !card.assignee)
    return "defina um responsável";
  if (card.type === "project" && from.stageKey === "backlog" && !card.dueDate)
    return "defina um prazo para sair do Backlog";
  return null;
}

function ListColumn({
  list,
  cards,
  boardKey,
  canMutate,
  showSum,
  dragging,
  reason,
}: {
  list: ListDTO;
  cards: CardDTO[];
  boardKey: string;
  canMutate: boolean;
  showSum: boolean;
  dragging: boolean;
  reason: string | null;
}) {
  const { setNodeRef } = useDroppable({ id: list.id, disabled: reason !== null });
  const sum = cards.reduce((acc, c) => acc + (c.amount ? Number(c.amount) : 0), 0);
  const blocked = dragging && reason !== null;

  return (
    <section
      ref={setNodeRef}
      aria-label={list.name}
      className={clsx(
        "flex h-full w-72 shrink-0 flex-col rounded-2xl bg-white/[0.04] transition",
        blocked && "opacity-40"
      )}
    >
      <header className="flex items-center justify-between px-3 pb-1 pt-3">
        <h2 className="text-sm font-semibold text-gray-200">
          {list.name}
          <span className="ml-2 rounded-full bg-[#141413]/10 px-2 py-0.5 text-xs font-medium text-gray-400">
            {cards.length}
          </span>
        </h2>
        {showSum && sum > 0 ? (
          <span className="text-xs font-medium text-gray-400">{brl(sum)}</span>
        ) : null}
      </header>
      {blocked ? (
        <p className="mx-3 mb-1 rounded-md bg-red-500/15 px-2 py-1 text-xs text-red-300">🚫 {reason}</p>
      ) : null}
      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
          {cards.length === 0 && !dragging ? (
            <p className="rounded-lg border border-dashed border-white/20 px-3 py-4 text-center text-xs text-gray-500">
              Nenhum card em {list.name} — arraste um para cá ou crie o primeiro.
            </p>
          ) : null}
          {cards.map((card) => (
            <CardItem key={card.id} card={card} boardKey={boardKey} disabled={!canMutate} />
          ))}
        </div>
      </SortableContext>
      {canMutate && !list.isTerminal ? (
        <div className="px-2 pb-2">
          <AddCard listId={list.id} isOpportunity={boardKey === "sales"} />
        </div>
      ) : null}
    </section>
  );
}

export function BoardView({
  board,
  initialCards,
  users,
  funnel,
  canMutate,
  currentUserId,
}: {
  board: BoardDTO;
  initialCards: CardDTO[];
  users: UserDTO[];
  funnel: FunnelStats;
  canMutate: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [cards, setCards] = useState(initialCards);
  const [activeCard, setActiveCard] = useState<CardDTO | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => setCards(initialCards), [initialCards]);

  // Atualização do quadro quando outro usuário move um card (US-36, via polling).
  useEffect(() => {
    const interval = setInterval(() => {
      if (!draggingRef.current && !pendingMove) router.refresh();
    }, 15_000);
    return () => clearInterval(interval);
  }, [router, pendingMove]);

  // Filtros combináveis refletidos na URL (US-20).
  const q = searchParams.get("q") ?? "";
  const assigneeFilter = searchParams.get("assignee") ?? "";
  const dueFilter = searchParams.get("due") ?? "";

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`?${params.toString()}`);
  };

  const visible = useMemo(
    () =>
      cards.filter((c) => {
        if (q && !`${c.title} ${c.clientName ?? ""}`.toLowerCase().includes(q.toLowerCase()))
          return false;
        if (assigneeFilter === "me" && c.assignee?.id !== currentUserId) return false;
        if (assigneeFilter && assigneeFilter !== "me" && c.assignee?.id !== assigneeFilter)
          return false;
        const status = dueStatus(c.dueDate);
        if (dueFilter === "late" && status !== "late") return false;
        if (dueFilter === "week" && !(status === "late" || status === "soon")) return false;
        return true;
      }),
    [cards, q, assigneeFilter, dueFilter, currentUserId]
  );

  const byList = useMemo(() => {
    const map = new Map<string, CardDTO[]>();
    board.lists.forEach((l) => map.set(l.id, []));
    visible
      .slice()
      .sort((a, b) => a.position - b.position)
      .forEach((c) => map.get(c.listId)?.push(c));
    return map;
  }, [board.lists, visible]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findCard = (id: string) => cards.find((c) => c.id === id) ?? null;
  const listOf = (id: string) => board.lists.find((l) => l.id === id) ?? null;

  const onDragStart = (event: DragStartEvent) => {
    draggingRef.current = true;
    setActiveCard(findCard(String(event.active.id)));
  };

  const applyMove = (cardId: string, toListId: string, index: number): CardDTO[] => {
    const snapshot = cards;
    setCards((prev) => {
      const card = prev.find((c) => c.id === cardId);
      if (!card) return prev;
      const others = prev.filter((c) => c.id !== cardId);
      const target = others
        .filter((c) => c.listId === toListId)
        .sort((a, b) => a.position - b.position);
      const before = index > 0 ? target[index - 1]?.position ?? 0 : 0;
      const after = target[index]?.position ?? before + 2048;
      return [...others, { ...card, listId: toListId, position: (before + after) / 2 }];
    });
    return snapshot;
  };

  const commitMove = async (
    cardId: string,
    toListId: string,
    index: number,
    snapshot: CardDTO[],
    lossReason?: string
  ) => {
    const result = await moveCardAction({ cardId, toListId, index, lossReason });
    if (!result.ok) {
      setCards(snapshot); // rollback (US-08)
      toast(result.error, "error");
      return;
    }
    router.refresh();
  };

  const onDragEnd = (event: DragEndEvent) => {
    draggingRef.current = false;
    setActiveCard(null);
    const { active, over } = event;
    if (!over) return;

    const card = findCard(String(active.id));
    if (!card) return;

    const overCard = findCard(String(over.id));
    const toListId = overCard ? overCard.listId : String(over.id);
    const toList = listOf(toListId);
    const fromList = listOf(card.listId);
    if (!toList || !fromList) return;

    const targetCards = (byList.get(toListId) ?? []).filter((c) => c.id !== card.id);
    const index = overCard
      ? Math.max(0, targetCards.findIndex((c) => c.id === overCard.id))
      : targetCards.length;

    const reason = invalidReason(card, fromList, toList);
    if (reason) {
      toast(`Movimento bloqueado: ${reason}.`, "error");
      return;
    }

    // Confirmações de encerramento (US-14) antes de qualquer persistência.
    if (toList.semantics === "won" && card.listId !== toList.id) {
      setPendingMove({ kind: "won", card, toListId, index });
      return;
    }
    if (toList.semantics === "lost" && card.listId !== toList.id && !card.lossReason) {
      setPendingMove({ kind: "lost", card, toListId, index });
      return;
    }

    const snapshot = applyMove(card.id, toListId, index);
    void commitMove(card.id, toListId, index, snapshot);
  };

  const announcements = {
    onDragStart: () => `Card selecionado. Use as setas para mover e espaço para soltar.`,
    onDragOver: () => ``,
    onDragEnd: () => `Card solto.`,
    onDragCancel: () => `Movimentação cancelada.`,
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#141413] px-4 py-2">
        <h1 className="text-xl font-light text-white">{board.name}</h1>
        {funnel ? (
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-300">
            <span>
              Em negociação: <strong>{brl(funnel.openTotal)}</strong>
            </span>
            <span>
              Fechado no mês: <strong className="text-emerald-300">{brl(funnel.wonThisMonth)}</strong>
            </span>
            {funnel.conversion !== null ? (
              <span>
                Conversão: <strong>{funnel.conversion}%</strong>
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => setFilter("q", e.target.value)}
            placeholder="Buscar…"
            aria-label="Buscar cards"
            className="w-40 rounded-lg border border-white/15 px-3 py-1.5 text-sm focus:border-cyan-400 focus:outline-none"
          />
          <select
            value={assigneeFilter}
            onChange={(e) => setFilter("assignee", e.target.value)}
            aria-label="Filtrar por responsável"
            className="rounded-lg border border-white/15 px-2 py-1.5 text-sm"
          >
            <option value="">Todos</option>
            <option value="me">Meus cards</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            value={dueFilter}
            onChange={(e) => setFilter("due", e.target.value)}
            aria-label="Filtrar por prazo"
            className="rounded-lg border border-white/15 px-2 py-1.5 text-sm"
          >
            <option value="">Qualquer prazo</option>
            <option value="late">Atrasados</option>
            <option value="week">Vence em breve</option>
          </select>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          draggingRef.current = false;
          setActiveCard(null);
        }}
        accessibility={{ announcements }}
      >
        <div className="flex flex-1 gap-3 overflow-x-auto p-4">
          {board.lists.map((list) => (
            <ListColumn
              key={list.id}
              list={list}
              cards={byList.get(list.id) ?? []}
              boardKey={board.key}
              canMutate={canMutate}
              showSum={board.key === "sales"}
              dragging={activeCard !== null}
              reason={
                activeCard
                  ? invalidReason(activeCard, listOf(activeCard.listId)!, list)
                  : null
              }
            />
          ))}
        </div>
        <DragOverlay>
          {activeCard ? (
            <div className="w-72 rotate-2">
              <CardItem card={activeCard} boardKey={board.key} disabled />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CloseDialogs
        pending={pendingMove}
        onCancel={() => setPendingMove(null)}
        onConfirm={(lossReason) => {
          if (!pendingMove) return;
          const { card, toListId, index } = pendingMove;
          setPendingMove(null);
          const snapshot = applyMove(card.id, toListId, index);
          void commitMove(card.id, toListId, index, snapshot, lossReason);
        }}
      />
    </div>
  );
}
