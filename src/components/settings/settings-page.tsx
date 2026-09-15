"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  changeUserRoleAction,
  resetPermissionsAction,
  savePermissionMatrixAction,
} from "@/app/actions/settings";
import { ROLE_LABELS, type Capability, type PermissionMatrix } from "@/core/permissions";
import { relativeTime } from "@/lib/format";
import { useToast } from "@/components/toast";
import { AddMember } from "./add-member";

type Role = keyof typeof ROLE_LABELS;
type EditableRole = "sales" | "member" | "manager";

type CapabilityDTO = { key: Capability; group: string; label: string; help: string };
type UserDTO = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  mustChangePassword: boolean;
};
type AuditDTO = {
  id: string;
  actorName: string;
  kind: string;
  target: string;
  before: string | null;
  after: string | null;
  createdAt: string;
};

type Draft = Record<EditableRole, Record<Capability, boolean>>;

const TABS = [
  { key: "permissions", label: "Permissões por papel" },
  { key: "users", label: "Usuários" },
  { key: "audit", label: "Histórico" },
] as const;

export function SettingsPage({
  capabilities,
  roles,
  matrix,
  defaults,
  users,
  audits,
  currentUserId,
}: {
  capabilities: CapabilityDTO[];
  roles: EditableRole[];
  matrix: PermissionMatrix;
  defaults: PermissionMatrix;
  users: UserDTO[];
  audits: AuditDTO[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("permissions");

  const initial = useMemo<Draft>(
    () =>
      Object.fromEntries(roles.map((r) => [r, { ...matrix[r] }])) as Draft,
    [roles, matrix]
  );
  const [draft, setDraft] = useState<Draft>(initial);

  const dirty = roles.some((r) =>
    capabilities.some((c) => draft[r][c.key] !== matrix[r][c.key])
  );

  const groups = useMemo(() => {
    const map = new Map<string, CapabilityDTO[]>();
    for (const c of capabilities) {
      const list = map.get(c.group) ?? [];
      list.push(c);
      map.set(c.group, list);
    }
    return [...map.entries()];
  }, [capabilities]);

  const toggle = (role: EditableRole, cap: Capability) =>
    setDraft((d) => ({ ...d, [role]: { ...d[role], [cap]: !d[role][cap] } }));

  const refresh = () => startTransition(() => router.refresh());

  const save = () => {
    startTransition(async () => {
      const res = await savePermissionMatrixAction({ matrix: draft });
      if (!res.ok) return toast(res.error, "error");
      const changed = res.data?.changed ?? 0;
      toast(
        changed === 0
          ? "Nada mudou."
          : `${changed} permiss${changed === 1 ? "ão aplicada" : "ões aplicadas"}. Vale para todos na próxima ação.`,
        "success"
      );
      router.refresh();
    });
  };

  const reset = () => {
    startTransition(async () => {
      const res = await resetPermissionsAction();
      if (!res.ok) return toast(res.error, "error");
      toast("Matriz restaurada para o padrão do briefing.", "success");
      router.refresh();
    });
  };

  const changeRole = (user: UserDTO, role: Role) => {
    startTransition(async () => {
      const res = await changeUserRoleAction({ userId: user.id, role });
      if (!res.ok) return toast(res.error, "error");
      toast(`${user.name} agora é ${ROLE_LABELS[role]}.`, "success");
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-light tracking-tight text-white">Configurações</h1>
      <p className="max-w-3xl text-sm text-gray-400">
        Defina o que cada papel pode fazer. As regras valem no <strong>servidor</strong> — desmarcar
        aqui não apenas esconde o botão: a ação passa a ser recusada com 403, venha da interface ou
        de uma chamada direta.
      </p>

      <div className="mt-6 flex gap-1 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={clsx(
              "-mb-px rounded-t-lg border-b-2 px-4 py-2 text-sm font-medium transition",
              tab === t.key
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-gray-400 hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "permissions" && (
        <section className="mt-6">
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#141413]">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  <th className="px-4 py-3 font-medium text-gray-400">Ação</th>
                  {roles.map((r) => (
                    <th key={r} className="px-3 py-3 text-center font-medium text-gray-300">
                      {ROLE_LABELS[r]}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-center font-medium text-gray-400">
                    Administrador
                    <span className="block text-[11px] font-normal text-gray-500">
                      sempre permitido
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map(([group, caps]) => (
                  <Fragment key={group}>
                    <tr className="bg-white/[0.03]">
                      <td
                        colSpan={roles.length + 2}
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-cyan-400"
                      >
                        {group}
                      </td>
                    </tr>
                    {caps.map((cap) => (
                      <tr key={cap.key} className="border-b border-white/5 last:border-0">
                        <td className="px-4 py-3">
                          <p className="text-gray-200">{cap.label}</p>
                          <p className="text-xs text-gray-500">{cap.help}</p>
                        </td>
                        {roles.map((role) => {
                          const on = draft[role][cap.key];
                          const custom = on !== defaults[role][cap.key];
                          return (
                            <td key={role} className="px-3 py-3 text-center">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={on}
                                aria-label={`${cap.label} — ${ROLE_LABELS[role]}`}
                                onClick={() => toggle(role, cap.key)}
                                disabled={pending}
                                className={clsx(
                                  "relative inline-flex h-6 w-11 items-center rounded-full border transition disabled:opacity-50",
                                  on
                                    ? "border-cyan-400/40 bg-cyan-500"
                                    : "border-white/15 bg-white/10",
                                  custom && "ring-2 ring-amber-400/60 ring-offset-2 ring-offset-[#141413]"
                                )}
                                title={custom ? "Diferente do padrão do briefing" : undefined}
                              >
                                <span
                                  className={clsx(
                                    "inline-block h-4 w-4 rounded-full bg-black transition",
                                    on ? "translate-x-6" : "translate-x-1"
                                  )}
                                />
                              </button>
                            </td>
                          );
                        })}
                        <td
                          className="px-3 py-3 text-center"
                          title="Permissão concedida e fixa: o administrador mantém todas as capacidades. Se esta coluna fosse editável, seria possível remover o próprio acesso a esta tela."
                        >
                          <span
                            aria-label="Sempre permitido"
                            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-cyan-400/25 text-cyan-400/70"
                          >
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Contorno âmbar marca o que está diferente do padrão do briefing. O ✓ do administrador
            não é restrição: ele tem todas as capacidades e a coluna é fixa de propósito — se fosse
            editável, daria para remover o próprio acesso a esta tela e não haveria volta pela
            interface.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={!dirty || pending}
              className="rounded-full bg-cyan-500 px-5 py-2 text-sm font-semibold text-black transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? "Salvando…" : "Salvar permissões"}
            </button>
            <button
              type="button"
              onClick={() => setDraft(initial)}
              disabled={!dirty || pending}
              className="rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-gray-300 transition hover:bg-white/10 disabled:opacity-40"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="ml-auto rounded-full px-3 py-2 text-sm text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              Restaurar padrão do briefing
            </button>
          </div>
        </section>
      )}

      {tab === "users" && (
        <section className="mt-6 space-y-3">
          <AddMember />
          {users.map((user) => (
            <div
              key={user.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#141413] p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-white">
                  {user.name}
                  {user.id === currentUserId && (
                    <span className="ml-2 rounded-full border border-white/15 px-2 py-0.5 text-xs text-gray-400">
                      você
                    </span>
                  )}
                  {user.mustChangePassword && (
                    <span
                      title="Ainda não fez o primeiro acesso para trocar a senha temporária."
                      className="ml-2 rounded-full border border-amber-400/30 px-2 py-0.5 text-xs text-amber-300"
                    >
                      aguardando primeiro acesso
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-gray-400">{user.email}</p>
              </div>
              <select
                value={user.role}
                disabled={pending || user.id === currentUserId}
                onChange={(e) => changeRole(user, e.target.value as Role)}
                className="rounded-lg border border-white/15 bg-[#141413] px-3 py-2 text-sm text-gray-200 focus:border-cyan-400 focus:outline-none disabled:opacity-40"
              >
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <p className="text-xs text-gray-500">
            Você não altera o próprio papel, e o sistema recusa rebaixar o último administrador.
            Quem tem o papel trocado recebe uma notificação. A pessoa também pode criar a própria conta
            em /cadastro — nesse caso entra como Executor.
          </p>
        </section>
      )}

      {tab === "audit" && (
        <section className="mt-6">
          {audits.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-[#141413] p-6 text-sm text-gray-400">
              Nenhuma alteração de permissão até agora.
            </p>
          ) : (
            <ul className="space-y-2">
              {audits.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-xl border border-white/10 bg-[#141413] px-4 py-3 text-sm"
                >
                  <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-gray-400">
                    {a.kind === "role" ? "papel" : a.kind === "user" ? "cadastro" : "permissão"}
                  </span>
                  <strong className="text-gray-200">{a.target}</strong>
                  <span className="text-gray-400">
                    {a.before ? <>{a.before} → </> : "cadastrado como "}
                    <strong className="text-cyan-400">{a.after}</strong>
                  </span>
                  <span className="ml-auto text-xs text-gray-500">
                    {a.actorName} · {relativeTime(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={refresh}
            className="mt-4 text-sm text-cyan-400 hover:underline"
          >
            Atualizar
          </button>
        </section>
      )}
    </div>
  );
}
