import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  FileText,
  Loader2,
  MessageSquarePlus,
  Plus,
  RefreshCcw,
  Save,
  Settings,
} from 'lucide-react';
import {
  createOrUpdateCommand,
  createOrUpdateQuickReply,
  deleteCommand,
  deleteQuickReply,
  fetchBotConfig,
  fetchBots,
  fetchSystemStatus,
  updateBotSettings,
} from './api';
import type {
  BotConfigResponse,
  BotSettings,
  BotSummary,
  Command,
  QuickReply,
  SystemStatus,
} from './types';
import { clsx } from 'clsx';

type CommandDraft = Pick<Command, 'id' | 'command' | 'description' | 'response' | 'buttons'>;
type QuickReplyDraft = Pick<QuickReply, 'id' | 'title' | 'keyword' | 'response'>;

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const emptyCommandDraft: CommandDraft = {
  id: undefined,
  command: '',
  description: '',
  response: '',
  buttons: [],
};

const emptyQuickReplyDraft: QuickReplyDraft = {
  id: undefined,
  title: '',
  keyword: '',
  response: '',
};

const fallbackSettings: BotSettings = {
  defaultResponse: '',
  aiPersona: '',
  aiEnabled: false,
  aiModel: 'gpt-4o-mini',
  aiTemperature: 0.2,
  autoKeyboard: false,
  autoCommands: false,
  miniAppUrl: '',
  webhookUrl: '',
};

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium',
        ok ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
      )}
    >
      {ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      {label}
    </span>
  );
}

function SectionCard({
  title,
  icon: Icon,
  actions,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white/80 p-6 shadow-sm ring-1 ring-slate-100">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
            <Icon className="h-5 w-5" />
          </span>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function FormGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-600">
      <span className="text-xs uppercase tracking-[0.15em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function useAsyncState<T>(initial: T | null = null): [AsyncState<T>, {
  start: () => void;
  resolve: (value: T) => void;
  reject: (message: string) => void;
}] {
  const [state, setState] = useState<AsyncState<T>>({
    data: initial,
    loading: false,
    error: null,
  });

  const start = useCallback(() => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
  }, []);

  const resolve = useCallback((value: T) => {
    setState({ data: value, loading: false, error: null });
  }, []);

  const reject = useCallback((message: string) => {
    setState((prev) => ({ ...prev, loading: false, error: message }));
  }, []);

  return [state, { start, resolve, reject }];
}

function App(): JSX.Element {
  const [botsState, botsActions] = useAsyncState<BotSummary[]>([]);
  const { start: startBots, resolve: resolveBots, reject: rejectBots } = botsActions;
  const [statusState, statusActions] = useAsyncState<SystemStatus | null>(null);
  const { start: startStatus, resolve: resolveStatus, reject: rejectStatus } = statusActions;
  const [configState, configActions] = useAsyncState<BotConfigResponse | null>(null);
  const { start: startConfig, resolve: resolveConfig, reject: rejectConfig } = configActions;
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [commandDraft, setCommandDraft] = useState<CommandDraft>(emptyCommandDraft);
  const [quickReplyDraft, setQuickReplyDraft] = useState<QuickReplyDraft>(emptyQuickReplyDraft);
  const [settingsDraft, setSettingsDraft] = useState<BotSettings | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const selectedBot = useMemo(
    () => botsState.data?.find((bot) => bot.id === selectedBotId) ?? null,
    [botsState.data, selectedBotId]
  );

  useEffect(() => {
    const load = async () => {
      startBots();
      startStatus();
      try {
        const [bots, status] = await Promise.all([fetchBots(), fetchSystemStatus()]);
        resolveBots(bots);
        resolveStatus(status);
        if (!selectedBotId) {
          const defaultId = status.environment.defaultBotId || bots[0]?.id || null;
          setSelectedBotId(defaultId);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลได้';
        rejectBots(message);
        rejectStatus(message);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadConfig = async () => {
      if (!selectedBotId) {
        resolveConfig(null);
        setSettingsDraft(null);
        return;
      }
      startConfig();
      try {
        const config = await fetchBotConfig(selectedBotId);
        resolveConfig(config);
        setSettingsDraft(config.settings);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลบอท';
        rejectConfig(message);
      }
    };
    void loadConfig();
  }, [rejectConfig, resolveConfig, selectedBotId, startConfig]);

  const refreshStatus = useCallback(async () => {
    startStatus();
    try {
      const status = await fetchSystemStatus();
      resolveStatus(status);
      setFeedback('อัปเดตสถานะระบบแล้ว');
    } catch (error) {
      rejectStatus(error instanceof Error ? error.message : 'ไม่สามารถตรวจสอบสถานะระบบ');
    }
  }, [rejectStatus, resolveStatus, startStatus]);

  const resetCommandDraft = useCallback(() => setCommandDraft(emptyCommandDraft), []);
  const resetQuickReplyDraft = useCallback(() => setQuickReplyDraft(emptyQuickReplyDraft), []);

  const handleCommandSubmit = useCallback(async () => {
    if (!selectedBotId) return;
    if (!commandDraft.command || !commandDraft.response) {
      setFeedback('กรุณากรอกคำสั่งและข้อความตอบกลับ');
      return;
    }

    try {
      const currentSettings = settingsDraft ?? configState.data?.settings ?? fallbackSettings;
      const updated = await createOrUpdateCommand(selectedBotId, commandDraft);
      resolveConfig({
        ...(configState.data ?? { commands: [], quickReplies: [], settings: currentSettings }),
        commands: updateCollection(configState.data?.commands ?? [], updated),
        quickReplies: configState.data?.quickReplies ?? [],
        settings: currentSettings,
      });
      setFeedback(commandDraft.id ? 'อัปเดตคำสั่งเรียบร้อย' : 'เพิ่มคำสั่งใหม่แล้ว');
      resetCommandDraft();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'ไม่สามารถบันทึกคำสั่ง');
    }
  }, [commandDraft, configState.data, resetCommandDraft, resolveConfig, selectedBotId, settingsDraft]);

  const handleQuickReplySubmit = useCallback(async () => {
    if (!selectedBotId) return;
    if (!quickReplyDraft.title || !quickReplyDraft.keyword || !quickReplyDraft.response) {
      setFeedback('กรุณากรอกข้อมูล Quick Reply ให้ครบถ้วน');
      return;
    }

    try {
      const currentSettings = settingsDraft ?? configState.data?.settings ?? fallbackSettings;
      const updated = await createOrUpdateQuickReply(selectedBotId, quickReplyDraft);
      resolveConfig({
        ...(configState.data ?? { commands: [], quickReplies: [], settings: currentSettings }),
        commands: configState.data?.commands ?? [],
        quickReplies: updateCollection(configState.data?.quickReplies ?? [], updated),
        settings: currentSettings,
      });
      setFeedback(quickReplyDraft.id ? 'อัปเดต Quick Reply เรียบร้อย' : 'เพิ่ม Quick Reply ใหม่แล้ว');
      resetQuickReplyDraft();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'ไม่สามารถบันทึก Quick Reply');
    }
  }, [configState.data, quickReplyDraft, resetQuickReplyDraft, resolveConfig, selectedBotId, settingsDraft]);

  const handleDeleteCommand = useCallback(
    async (commandId: string) => {
      if (!selectedBotId) return;
      try {
        await deleteCommand(selectedBotId, commandId);
        if (configState.data) {
          resolveConfig({
            ...configState.data,
            commands: configState.data.commands.filter((item) => item.id !== commandId),
          });
        }
        setFeedback('ลบคำสั่งแล้ว');
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'ไม่สามารถลบคำสั่ง');
      }
    },
    [configState.data, resolveConfig, selectedBotId]
  );

  const handleDeleteQuickReply = useCallback(
    async (quickReplyId: string) => {
      if (!selectedBotId) return;
      try {
        await deleteQuickReply(selectedBotId, quickReplyId);
        if (configState.data) {
          resolveConfig({
            ...configState.data,
            quickReplies: configState.data.quickReplies.filter((item) => item.id !== quickReplyId),
          });
        }
        setFeedback('ลบ Quick Reply แล้ว');
      } catch (error) {
        setFeedback(error instanceof Error ? error.message : 'ไม่สามารถลบ Quick Reply');
      }
    },
    [configState.data, resolveConfig, selectedBotId]
  );

  const handleSettingsSave = useCallback(async () => {
    if (!selectedBotId || !settingsDraft) return;
    try {
      const saved = await updateBotSettings(selectedBotId, settingsDraft);
      if (configState.data) {
        resolveConfig({ ...configState.data, settings: saved });
      }
      setSettingsDraft(saved);
      setFeedback('บันทึกการตั้งค่าบอทแล้ว');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'ไม่สามารถบันทึกการตั้งค่าบอท');
    }
  }, [configState.data, resolveConfig, selectedBotId, settingsDraft]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <header className="bg-white/80 py-6 shadow-sm ring-1 ring-slate-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-600 text-white shadow-lg">
              <Bot className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Telegram Bot Control Center</h1>
              <p className="text-sm text-slate-500">
                จัดการหลายบอท เชื่อมต่อ Mini App และปรับเวิร์กโฟลว์ AI ได้จากแดชบอร์ดเดียว
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshStatus}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
            >
              <RefreshCcw className="h-4 w-4" />
              ตรวจสอบสถานะระบบ
            </button>
            {feedback && (
              <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                {feedback}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto mt-10 grid max-w-6xl gap-6 px-6 lg:grid-cols-[260px_1fr]">
        <aside className="flex flex-col gap-6">
          <SectionCard title="เลือกบอท" icon={Bot}>
            <div className="space-y-3">
              {botsState.loading && (
                <div className="flex items-center justify-center py-6 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              {botsState.error && (
                <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{botsState.error}</p>
              )}
              {botsState.data?.length ? (
                <ul className="space-y-2">
                  {botsState.data.map((bot) => (
                    <li key={bot.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedBotId(bot.id)}
                        className={clsx(
                          'w-full rounded-2xl border px-4 py-3 text-left text-sm transition',
                          selectedBotId === bot.id
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{bot.name}</span>
                          {selectedBotId === bot.id && <CheckCircle2 className="h-4 w-4" />}
                        </div>
                        {bot.username && (
                          <p className="mt-1 text-xs text-slate-400">@{bot.username}</p>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                !botsState.loading && <p className="text-sm text-slate-500">ยังไม่มีการลงทะเบียนบอท</p>
              )}
            </div>
          </SectionCard>

          <SectionCard title="สถานะระบบ" icon={Settings}>
            {statusState.loading && (
              <div className="flex items-center justify-center py-6 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {statusState.error && (
              <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{statusState.error}</p>
            )}
            {statusState.data && (
              <div className="space-y-4 text-sm text-slate-600">
                <div className="flex flex-wrap gap-2">
                  <StatusPill label={`Supabase ${statusState.data.supabase.connected ? 'พร้อมใช้งาน' : 'ไม่เชื่อมต่อ'}`} ok={statusState.data.supabase.connected} />
                  <StatusPill label={`Local Store ${statusState.data.localStore.ready ? 'พร้อมใช้งาน' : 'มีปัญหา'}`} ok={statusState.data.localStore.ready} />
                  <StatusPill label={`OpenAI ${statusState.data.openai.configured ? 'ตั้งค่าแล้ว' : 'ยังไม่ตั้งค่า'}`} ok={statusState.data.openai.configured} />
                  <StatusPill label={`Telegram ${statusState.data.telegram?.reachable !== false ? 'พร้อม' : 'ผิดพลาด'}`} ok={statusState.data.telegram?.reachable !== false} />
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">สภาพแวดล้อม</p>
                  <ul className="mt-2 space-y-2 text-xs text-slate-500">
                    <li>Domain: {statusState.data.environment.domain || '-'}</li>
                    <li>Mini App ID: {statusState.data.environment.miniAppId || '-'}</li>
                    <li>Webhook Domain: {statusState.data.environment.webhookDomain || '-'}</li>
                    <li>Default Bot: {statusState.data.environment.defaultBotId || '-'}</li>
                  </ul>
                </div>
                {statusState.data.supabase.error && (
                  <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-600">
                    Supabase: {statusState.data.supabase.error}
                  </p>
                )}
                {statusState.data.localStore.error && (
                  <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-600">
                    Local Store: {statusState.data.localStore.error}
                  </p>
                )}
              </div>
            )}
          </SectionCard>
        </aside>

        <div className="space-y-6">
          {!selectedBot && (
            <SectionCard title="เลือกบอทเพื่อจัดการ" icon={AlertCircle}>
              <p className="text-sm text-slate-500">
                เลือกบอทจากแถบด้านซ้ายเพื่อเริ่มจัดการคำสั่ง Quick Reply และการตั้งค่า AI
              </p>
            </SectionCard>
          )}

          {selectedBot && (
            <SectionCard
              title={`คำสั่งสำหรับ ${selectedBot.name}`}
              icon={FileText}
              actions={
                <button
                  type="button"
                  onClick={() => setCommandDraft({ ...emptyCommandDraft })}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Plus className="h-4 w-4" />
                  เพิ่มคำสั่งใหม่
                </button>
              }
            >
              {configState.loading && (
                <div className="flex items-center justify-center py-6 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              {configState.error && (
                <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{configState.error}</p>
              )}
              {configState.data && (
                <div className="space-y-6">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormGroup label={commandDraft.id ? 'แก้ไขคำสั่ง' : 'เพิ่มคำสั่ง'}>
                        <input
                          value={commandDraft.command}
                          onChange={(event) =>
                            setCommandDraft((prev) => ({ ...prev, command: event.target.value }))
                          }
                          placeholder="/command"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                        />
                      </FormGroup>
                      <FormGroup label="คำอธิบาย">
                        <input
                          value={commandDraft.description}
                          onChange={(event) =>
                            setCommandDraft((prev) => ({ ...prev, description: event.target.value }))
                          }
                          placeholder="สรุปการทำงานของคำสั่ง"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                        />
                      </FormGroup>
                    </div>
                    <FormGroup label="ข้อความตอบกลับ">
                      <textarea
                        value={commandDraft.response}
                        onChange={(event) =>
                          setCommandDraft((prev) => ({ ...prev, response: event.target.value }))
                        }
                        placeholder="ใส่ข้อความหรือเทมเพลตตอบกลับ"
                        rows={4}
                        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                      />
                    </FormGroup>
                    <div className="flex flex-wrap gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleCommandSubmit}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
                      >
                        <Save className="h-4 w-4" />
                        บันทึกคำสั่ง
                      </button>
                      {commandDraft.id && (
                        <button
                          type="button"
                          onClick={resetCommandDraft}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          ยกเลิกการแก้ไข
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {configState.data.commands.length === 0 && (
                      <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                        ยังไม่มีคำสั่ง เพิ่มคำสั่งแรกเพื่อเริ่มต้นเวิร์กโฟลว์บอทของคุณ
                      </p>
                    )}
                    <ul className="space-y-3">
                      {configState.data.commands.map((command) => (
                        <li key={command.id} className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{command.command}</p>
                              {command.description && (
                                <p className="text-xs text-slate-400">{command.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setCommandDraft({ ...command })}
                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                              >
                                แก้ไข
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCommand(command.id)}
                                className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50"
                              >
                                ลบ
                              </button>
                            </div>
                          </div>
                          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                            {command.response}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {selectedBot && configState.data && (
            <SectionCard title="Quick Replies" icon={MessageSquarePlus}>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <FormGroup label={quickReplyDraft.id ? 'แก้ไขหัวข้อ' : 'เพิ่มหัวข้อ'}>
                    <input
                      value={quickReplyDraft.title}
                      onChange={(event) =>
                        setQuickReplyDraft((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="หัวข้อข้อความ"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </FormGroup>
                  <FormGroup label="คีย์เวิร์ด">
                    <input
                      value={quickReplyDraft.keyword}
                      onChange={(event) =>
                        setQuickReplyDraft((prev) => ({ ...prev, keyword: event.target.value }))
                      }
                      placeholder="คำค้นหา"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </FormGroup>
                  <FormGroup label="ตอบกลับ">
                    <input
                      value={quickReplyDraft.response}
                      onChange={(event) =>
                        setQuickReplyDraft((prev) => ({ ...prev, response: event.target.value }))
                      }
                      placeholder="ข้อความตอบกลับ"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                  </FormGroup>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleQuickReplySubmit}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
                  >
                    <Save className="h-4 w-4" />
                    บันทึก Quick Reply
                  </button>
                  {quickReplyDraft.id && (
                    <button
                      type="button"
                      onClick={resetQuickReplyDraft}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      ยกเลิกการแก้ไข
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {configState.data.quickReplies.length === 0 && (
                  <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">ยังไม่มี Quick Reply</p>
                )}
                <ul className="space-y-3">
                  {configState.data.quickReplies.map((quickReply) => (
                    <li key={quickReply.id} className="rounded-2xl border border-slate-100 bg-white px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{quickReply.title}</p>
                          <p className="text-xs text-slate-400">คำค้น: {quickReply.keyword}</p>
                          <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                            {quickReply.response}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setQuickReplyDraft({ ...quickReply })}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                          >
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuickReply(quickReply.id)}
                            className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50"
                          >
                            ลบ
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </SectionCard>
          )}

          {selectedBot && settingsDraft && (
            <SectionCard title="การตั้งค่าบอท & AI" icon={Settings}>
              <div className="grid gap-4 md:grid-cols-2">
                <FormGroup label="Default Response">
                  <textarea
                    value={settingsDraft.defaultResponse}
                    onChange={(event) =>
                      setSettingsDraft((prev) => (prev ? { ...prev, defaultResponse: event.target.value } : prev))
                    }
                    rows={3}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    placeholder="ข้อความตอบกลับทั่วไปเมื่อไม่มีคำสั่งตรงกัน"
                  />
                </FormGroup>
                <FormGroup label="AI Persona">
                  <textarea
                    value={settingsDraft.aiPersona}
                    onChange={(event) =>
                      setSettingsDraft((prev) => (prev ? { ...prev, aiPersona: event.target.value } : prev))
                    }
                    rows={3}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    placeholder="คำอธิบายบทบาทสำหรับ AI Agent"
                  />
                </FormGroup>
                <FormGroup label="AI Model">
                  <input
                    value={settingsDraft.aiModel}
                    onChange={(event) =>
                      setSettingsDraft((prev) => (prev ? { ...prev, aiModel: event.target.value } : prev))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    placeholder="เช่น gpt-4o-mini"
                  />
                </FormGroup>
                <FormGroup label="AI Temperature">
                  <input
                    type="number"
                    step="0.1"
                    value={settingsDraft.aiTemperature}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev ? { ...prev, aiTemperature: Number(event.target.value) } : prev
                      )
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    min={0}
                    max={1}
                  />
                </FormGroup>
                <FormGroup label="Mini App URL">
                  <input
                    value={settingsDraft.miniAppUrl}
                    onChange={(event) =>
                      setSettingsDraft((prev) => (prev ? { ...prev, miniAppUrl: event.target.value } : prev))
                    }
                    placeholder="https://bn9.club/miniapp"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                </FormGroup>
                <FormGroup label="Webhook URL">
                  <input
                    value={settingsDraft.webhookUrl}
                    onChange={(event) =>
                      setSettingsDraft((prev) => (prev ? { ...prev, webhookUrl: event.target.value } : prev))
                    }
                    placeholder="https://bn9.club/api/webhook"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                </FormGroup>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={settingsDraft.aiEnabled}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev ? { ...prev, aiEnabled: event.target.checked } : prev
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                  เปิดใช้ AI Assistant เพื่อช่วยตอบข้อความอัตโนมัติ
                </label>
                <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={settingsDraft.autoKeyboard}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev ? { ...prev, autoKeyboard: event.target.checked } : prev
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                  สร้างคีย์บอร์ดอัตโนมัติจากคำสั่ง
                </label>
                <label className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={settingsDraft.autoCommands}
                    onChange={(event) =>
                      setSettingsDraft((prev) =>
                        prev ? { ...prev, autoCommands: event.target.checked } : prev
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500"
                  />
                  ให้ระบบแนะนำคำสั่งใหม่ตามการใช้งาน
                </label>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSettingsSave}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
                >
                  <Save className="h-4 w-4" />
                  บันทึกการตั้งค่า
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsDraft(configState.data?.settings ?? settingsDraft)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  ย้อนกลับเป็นค่าที่บันทึกไว้
                </button>
              </div>
            </SectionCard>
          )}
        </div>
      </main>
    </div>
  );
}

function updateCollection<T extends { id: string }>(items: T[], updated: T): T[] {
  const exists = items.some((item) => item.id === updated.id);
  if (exists) {
    return items.map((item) => (item.id === updated.id ? updated : item));
  }
  return [updated, ...items];
}

export default App;
