"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import {
  changeUserRoleAction,
  deactivateUserAction,
  deleteUserAction,
  reactivateUserAction,
  resetUserPermissionsAction,
  saveUserPermissionsAction,
} from "@/app/actions/settings";
import { ROLE_LABELS, type Capability, type PermissionMatrix } from "@/core/permissions";
import { relativeTime } from "@/lib/format";
import { useToast } from "@/components/toast";
import { AddMember } from "./add-member";

type Role = keyof typeof ROLE_LABELS;

type CapabilityDTO = { key: Capability; group: string; label: string; help: string };

export type UserDTO = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  mustChangePassword: boolean;
  active: boolean;
  erasable: boolean;
  /** O que vale hoje para esta pessoa. */
  effective: Record<string, boolean>;
  /** Capacidades personalizadas — as demais seguem o modelo da função. */
  customized: string[];
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

const TABS = [
  { key: "users", label: "Pessoas e permissões" },
  { key: "audit", label: "Histórico" },
] as const;

/** Linha de uma capacidade: liga, desliga ou volta ao modelo da função. */
function CapabilityRow({
  cap,
  value,
  custom,
  padrao,
  disabled,
  onChange,
}: {
  cap: CapabilityDTO;
  value: boolean;
  custom: boolean;
  padrao: boolean;
  disabled: boolean;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-white/5 py-2 first:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-200">
          {cap.label}
          {custom ? (
            <span className="ml-2 rounded-full border border-amber-400/40 px-2 py-0.5 text-[11px] text-amber-300">
              personalizado
            </span>
          ) : (
            <span className="ml-2 text-[11px] text-gray-600">modelo da função</span>
          )}
        </p>
        <p className="text-xs text-gray-500">{cap.help}</p>
      </div>
      {custom ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(null)}
          className="text-xs text-gray-500 hover:text-cyan-400 disabled:opacity-40"
          title={`Voltar ao padrão da função (${padrao ? "permitido" : "negado"})`}
        >
          voltar ao padrão
        </button>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={cap.label}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={clsx(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition disabled:opacity-40",
          value ? "border-cyan-400/40 bg-cyan-500" : "border-white/15 bg-white/10"
        )}
      >
        <span
          className={clsx(
            "inline-block h-4 w-4 rounded-full bg-black transition",
            value ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </div>
  );
}

export function SettingsPage({
  capabilities,
  defaults,
  users,
  audits,
  currentUserId,
}: {
  capabilities: CapabilityDTO[];
  defaults: PermissionMatrix;
  users: UserDTO[];
  audits: AuditDTO[];
  currentUserId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("users");
  const [aberto, setAberto] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const map = new Map<string, CapabilityDTO[]>();
    for (const c of capabilities) {
      const list = map.get(c.group) ?? [];
      list.push(c);
      map.set(c.group, list);
    }
    return [...map.entries()];
  }, [capabilities]);

  const salvar = (user: UserDTO, capability: Capability, valor: boolean | null) =>
    startTransition(async () => {
      const res = await saveUserPermissionsAction({
        userId: user.id,
        overrides: { [capability]: valor },
      });
      if (!res.ok) return toast(res.error, "error");
      router.refresh();
    });

  const restaurar = (user: UserDTO) =>
    startTransition(async () => {
      const res = await resetUserPermissionsAction({ userId: user.id });
      if (!res.ok) return toast(res.error, "error");
      toast(`${user.name} voltou ao modelo de ${ROLE_LABELS[user.role]}.`, "success");
      router.refresh();
    });

  const desativar = (user: UserDTO) =>
    startTransition(async () => {
      const res = await deactivateUserAction({ userId: user.id });
      if (!res.ok) return toast(res.error, "error");
      toast(`${user.name} foi desativado e perdeu o acesso.`, "success");
      router.refresh();
    });

  const reativar = (user: UserDTO) =>
    startTransition(async () => {
      const res = await reactivateUserAction({ userId: user.id });
      if (!res.ok) return toast(res.error, "error");
      toast(`${user.name} voltou a ter acesso.`, "success");
      router.refresh();
    });

  const excluir = (user: UserDTO) =>
    startTransition(async () => {
      const res = await deleteUserAction({ userId: user.id });
      if (!res.ok) return toast(res.error, "error");
      setConfirmando(null);
      toast(`${user.name} foi excluído.`, "success");
      router.refresh();
    });

  const trocarFuncao = (user: UserDTO, role: Role) =>
    startTransition(async () => {
      const res = await changeUserRoleAction({ userId: user.id, role });
      if (!res.ok) return toast(res.error, "error");
      toast(`${user.name} agora é ${ROLE_LABELS[role]}.`, "success");
      router.refresh();
    });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-light tracking-tight text-white">Configurações</h1>
      <p className="max-w-3xl text-sm text-gray-400">
        As permissões são <strong>de cada pessoa</strong>. A função serve de modelo: o que você não
        personalizar segue o padrão dela. Tudo vale no <strong>servidor</strong> — desligar aqui não
        esconde o botão, recusa a ação.
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

      {tab === "users" && (
        <section className="mt-6 space-y-3">
          <AddMember />
          {users.map((user) => {
            const eu = user.id === currentUserId;
            const expandido = aberto === user.id;
            const personalizadas = user.customized.length;
            return (
              <div key={user.id} className="rounded-2xl border border-white/10 bg-[#141413] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">
                      {user.name}
                      {eu && (
                        <span className="ml-2 rounded-full border border-white/15 px-2 py-0.5 text-xs text-gray-400">
                          você
                        </span>
                      )}
                      {!user.active && (
                        <span className="ml-2 rounded-full border border-white/20 px-2 py-0.5 text-xs text-gray-400">
                          inativo
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
                    <p className="truncate text-sm text-gray-400">
                      {user.email}
                      {personalizadas > 0 ? (
                        <span className="ml-2 text-amber-300/80">
                          · {personalizadas} permissão(ões) personalizada(s)
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <select
                    value={user.role}
                    disabled={pending || eu}
                    onChange={(e) => trocarFuncao(user, e.target.value as Role)}
                    title="Função — define o modelo de permissões da pessoa"
                    className="min-w-0 max-w-[10rem] truncate rounded-lg border border-white/15 bg-[#141413] px-3 py-2 text-sm text-gray-200 focus:border-cyan-400 focus:outline-none disabled:opacity-40"
                  >
                    {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAberto(expandido ? null : user.id)}
                    className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/10"
                  >
                    {expandido ? "Fechar" : "Permissões"}
                  </button>
                  {!eu ? (
                    user.active ? (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => desativar(user)}
                        title="Perde o acesso; cards, comentários e histórico ficam com o nome dela."
                        className="rounded-full px-3 py-1.5 text-sm text-amber-300 hover:bg-amber-400/10 disabled:opacity-40"
                      >
                        Desativar
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => reativar(user)}
                        className="rounded-full px-3 py-1.5 text-sm text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-40"
                      >
                        Reativar
                      </button>
                    )
                  ) : null}
                  {!eu && user.erasable ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setConfirmando(user.id)}
                      title="Esta pessoa não tem nada ligada a ela — dá para apagar de vez."
                      className="rounded-full px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                    >
                      Excluir
                    </button>
                  ) : null}
                </div>

                {confirmando === user.id ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-red-400/30 bg-red-500/5 p-3">
                    <p className="min-w-0 flex-1 text-sm text-red-200">
                      Excluir <strong>{user.name}</strong> de vez? Isso não tem volta.
                    </p>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => excluir(user)}
                      className="rounded-full bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                    >
                      Excluir
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(null)}
                      className="rounded-full px-3 py-1.5 text-sm text-gray-400 hover:bg-white/10"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : null}

                {expandido ? (
                  <div className="mt-4 border-t border-white/10 pt-3">
                    {eu ? (
                      <p className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-xs text-amber-200">
                        Você não altera as próprias permissões. Peça a outra pessoa que gerencia
                        usuários.
                      </p>
                    ) : null}
                    {grupos.map(([grupo, caps]) => (
                      <div key={grupo} className="mb-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
                          {grupo}
                        </p>
                        <div className="mt-1">
                          {caps.map((cap) => (
                            <CapabilityRow
                              key={cap.key}
                              cap={cap}
                              value={user.effective[cap.key] ?? false}
                              custom={user.customized.includes(cap.key)}
                              padrao={defaults[user.role][cap.key]}
                              disabled={pending || eu}
                              onChange={(v) => salvar(user, cap.key, v)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={pending || eu || personalizadas === 0}
                      onClick={() => restaurar(user)}
                      className="rounded-full px-3 py-1.5 text-sm text-gray-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                    >
                      Restaurar o modelo de {ROLE_LABELS[user.role]}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
          <p className="text-xs text-gray-500">
            Ninguém altera as próprias permissões nem desativa a própria conta, e o sistema recusa
            tirar “gerenciar usuários” da última pessoa que tem essa permissão. <strong>Desativar</strong>{" "}
            tira o acesso e preserva o histórico; <strong>Excluir</strong> só aparece para quem não
            tem card, comentário ou tarefa ligados.
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
                    {a.kind === "role" ? "função" : a.kind === "user" ? "cadastro" : "permissão"}
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
        </section>
      )}
    </div>
  );
}
