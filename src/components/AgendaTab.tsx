import React, { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  ListTodo,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { AgendaItem, AgendaStatus, AgendaTipo, Cliente, EmpresaRepresentacao, Lead, Usuario } from '../types';
import { getLocalDateTimeInputValue, isoDateTimeToLocalInput, localDateTimeToIso, isValidLocalDateTime } from '../utils';

interface AgendaTabProps {
  items: AgendaItem[];
  clientes: Cliente[];
  leads: Lead[];
  empresas: EmpresaRepresentacao[];
  currentUser: Usuario | null;
  usuarios: Usuario[];
  activeEmpresaId: string;
  isSystemAdmin: boolean;
  canEdit: boolean;
  onSave: (item: AgendaItem) => void;
  onDelete: (id: string) => void;
}

type AgendaFiltro = 'Todos' | 'Hoje' | 'Próximos' | 'Atrasados' | 'Concluídos';

interface AgendaForm {
  tipo: AgendaTipo;
  titulo: string;
  dataHora: string;
  descricao: string;
  vinculo: string;
  empresaRepresentacaoId: string;
}

const EMPTY_FORM: AgendaForm = {
  tipo: 'Tarefa',
  titulo: '',
  dataHora: '',
  descricao: '',
  vinculo: '',
  empresaRepresentacaoId: '',
};

function makeAgendaId(): string {
  return `agenda-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data inválida';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function localDateKey(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function relationLabel(item: AgendaItem, clientes: Cliente[], leads: Lead[]): string | null {
  if (item.leadId) {
    const lead = leads.find((candidate) => candidate.id === item.leadId);
    return lead?.nomeFantasia || `Prospect ${item.leadId}`;
  }
  if (item.clienteId) {
    const client = clientes.find((candidate) => candidate.id === item.clienteId);
    return client?.nomeFantasia || `Cliente ${item.clienteId}`;
  }
  return null;
}

export default function AgendaTab({
  items,
  clientes,
  leads,
  empresas,
  currentUser,
  usuarios,
  activeEmpresaId,
  isSystemAdmin,
  canEdit,
  onSave,
  onDelete,
}: AgendaTabProps) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<AgendaFiltro>('Todos');
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<AgendaItem | null>(null);
  const [form, setForm] = useState<AgendaForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const selectedTenantId = isSystemAdmin
    ? (activeEmpresaId === 'all' ? form.empresaRepresentacaoId : activeEmpresaId)
    : (currentUser?.empresaRepresentacaoId || '');
  const tenantClients = useMemo(
    () => clientes.filter((client) => client.empresaRepresentacaoId === selectedTenantId),
    [clientes, selectedTenantId],
  );
  const tenantLeads = useMemo(
    () => leads.filter((lead) => lead.empresaRepresentacaoId === selectedTenantId),
    [leads, selectedTenantId],
  );
  const userNames = useMemo(() => {
    const names = new Map<string, string>();
    usuarios.forEach((user) => {
      names.set(user.id, user.nome);
      if (user.legacyId) names.set(user.legacyId, user.nome);
    });
    return names;
  }, [usuarios]);

  const today = localDateKey(new Date(now));
  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    return items
      .filter((item) => {
        const timestamp = new Date(item.dataHora).getTime();
        const isToday = localDateKey(new Date(item.dataHora)) === today;
        if (filter === 'Hoje' && !isToday) return false;
        if (filter === 'Próximos' && (item.status !== 'Pendente' || timestamp < now)) return false;
        if (filter === 'Atrasados' && (item.status !== 'Pendente' || timestamp >= now)) return false;
        if (filter === 'Concluídos' && item.status !== 'Concluída') return false;
        if (normalizedSearch) {
          const linkedName = relationLabel(item, clientes, leads) || '';
          return [item.titulo, item.descricao, linkedName, item.tipo]
            .some((value) => (value || '').toLocaleLowerCase('pt-BR').includes(normalizedSearch));
        }
        return true;
      })
      .sort((a, b) => new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime());
  }, [items, search, filter, clientes, leads, today, now]);

  const todayCount = items.filter((item) => item.status === 'Pendente' && localDateKey(new Date(item.dataHora)) === today).length;
  const overdueCount = items.filter((item) => item.status === 'Pendente' && new Date(item.dataHora).getTime() < now).length;
  const completedCount = items.filter((item) => item.status === 'Concluída').length;

  const canManageItem = (item: AgendaItem) => {
    if (!canEdit || !currentUser) return false;
    if (isSystemAdmin || currentUser.role === 'Administrador') return true;
    return item.responsavelUserId === currentUser.id || item.responsavelUserId === currentUser.legacyId;
  };

  const openNewForm = (tipo: AgendaTipo) => {
    const initialTenant = isSystemAdmin && activeEmpresaId === 'all' ? '' : activeEmpresaId;
    const defaultDate = new Date();
    defaultDate.setHours(defaultDate.getHours() + 1, 0, 0, 0);
    setEditingItem(null);
    setForm({
      ...EMPTY_FORM,
      tipo,
      titulo: tipo === 'Visita' ? 'Visita comercial' : '',
      dataHora: getLocalDateTimeInputValue(defaultDate),
      empresaRepresentacaoId: initialTenant,
    });
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (item: AgendaItem) => {
    setEditingItem(item);
    setForm({
      tipo: item.tipo,
      titulo: item.titulo,
      dataHora: isoDateTimeToLocalInput(item.dataHora),
      descricao: item.descricao || '',
      vinculo: item.leadId ? `lead:${item.leadId}` : item.clienteId ? `cliente:${item.clienteId}` : '',
      empresaRepresentacaoId: item.empresaRepresentacaoId,
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    if (!currentUser?.id) {
      setFormError('Não foi possível identificar o usuário responsável. Entre novamente no sistema.');
      return;
    }
    if (!canEdit) {
      setFormError('Seu usuário não tem permissão para criar ou editar compromissos.');
      return;
    }
    if (!selectedTenantId || selectedTenantId === 'all') {
      setFormError('Selecione uma empresa específica para salvar este compromisso.');
      return;
    }
    if (!form.titulo.trim()) {
      setFormError('Informe o título da visita ou tarefa.');
      return;
    }
    if (form.titulo.trim().length > 160) {
      setFormError('O título deve ter no máximo 160 caracteres.');
      return;
    }
    if (!isValidLocalDateTime(form.dataHora)) {
      setFormError('Informe uma data e hora válidas.');
      return;
    }

    const [linkType, linkedId] = form.vinculo.split(':', 2);
    const leadId = linkType === 'lead' && linkedId ? linkedId : undefined;
    const clienteId = linkType === 'cliente' && linkedId ? linkedId : undefined;
    const preservesLeadLink = Boolean(editingItem?.leadId === leadId
      && editingItem.empresaRepresentacaoId === selectedTenantId);
    const preservesClientLink = Boolean(editingItem?.clienteId === clienteId
      && editingItem.empresaRepresentacaoId === selectedTenantId);
    if (leadId && !preservesLeadLink && !tenantLeads.some((lead) => lead.id === leadId)) {
      setFormError('O prospect selecionado não pertence à empresa da agenda.');
      return;
    }
    if (clienteId && !preservesClientLink && !tenantClients.some((client) => client.id === clienteId)) {
      setFormError('O cliente selecionado não pertence à empresa da agenda.');
      return;
    }

    const currentTime = new Date().toISOString();
    const item: AgendaItem = {
      id: editingItem?.id || makeAgendaId(),
      empresaRepresentacaoId: editingItem?.empresaRepresentacaoId || selectedTenantId,
      tipo: form.tipo,
      titulo: form.titulo.trim(),
      dataHora: localDateTimeToIso(form.dataHora),
      descricao: form.descricao.trim() || undefined,
      leadId,
      clienteId,
      status: editingItem?.status || 'Pendente',
      responsavelUserId: editingItem?.responsavelUserId || currentUser.id,
      criadoPorUserId: editingItem?.criadoPorUserId || currentUser.id,
      criadoEm: editingItem?.criadoEm || currentTime,
      atualizadoEm: currentTime,
      concluidoEm: editingItem?.status === 'Concluída' ? editingItem.concluidoEm : undefined,
    };

    onSave(item);
    setShowForm(false);
    setEditingItem(null);
  };

  const toggleCompletion = (item: AgendaItem) => {
    const nextStatus: AgendaStatus = item.status === 'Concluída' ? 'Pendente' : 'Concluída';
    const currentTime = new Date().toISOString();
    onSave({
      ...item,
      status: nextStatus,
      atualizadoEm: currentTime,
      concluidoEm: nextStatus === 'Concluída' ? currentTime : undefined,
    });
  };

  const handleDelete = (item: AgendaItem) => {
    if (!confirm(`Excluir "${item.titulo}" da agenda?`)) return;
    onDelete(item.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-[#0B3259]"><CalendarDays className="h-5 w-5" /></div>
          <div>
            <h2 className="font-bold text-slate-800">Agenda de visitas e tarefas</h2>
            <p className="text-xs text-slate-500">Organize os próximos contatos com clientes e prospects.</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openNewForm('Visita')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B3259] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#092847]">
              <Plus className="h-4 w-4" /> Nova visita
            </button>
            <button type="button" onClick={() => openNewForm('Tarefa')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
              <ListTodo className="h-4 w-4" /> Nova tarefa
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <button type="button" onClick={() => setFilter(filter === 'Hoje' ? 'Todos' : 'Hoje')} className={`rounded-xl border bg-white px-3 py-3 text-left transition ${filter === 'Hoje' ? 'border-[#0B3259] ring-2 ring-[#0B3259]/10' : 'border-slate-200 hover:border-slate-300'}`}>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Hoje</span>
          <strong className="mt-1 block text-xl text-slate-800">{todayCount}</strong>
        </button>
        <button type="button" onClick={() => setFilter(filter === 'Atrasados' ? 'Todos' : 'Atrasados')} className={`rounded-xl border bg-white px-3 py-3 text-left transition ${filter === 'Atrasados' ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200 hover:border-slate-300'}`}>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Atrasados</span>
          <strong className={`mt-1 block text-xl ${overdueCount ? 'text-rose-700' : 'text-slate-800'}`}>{overdueCount}</strong>
        </button>
        <button type="button" onClick={() => setFilter(filter === 'Concluídos' ? 'Todos' : 'Concluídos')} className={`rounded-xl border bg-white px-3 py-3 text-left transition ${filter === 'Concluídos' ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300'}`}>
          <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">Concluídos</span>
          <strong className="mt-1 block text-xl text-slate-800">{completedCount}</strong>
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar na agenda" aria-label="Buscar na agenda" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#0B3259] focus:ring-2 focus:ring-[#0B3259]/10" />
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <span className="text-xs font-semibold text-slate-500">Exibir</span>
          <select aria-label="Filtrar agenda" value={filter} onChange={(event) => setFilter(event.target.value as AgendaFiltro)} className="bg-transparent py-2 text-sm font-semibold text-slate-700 outline-none">
            <option value="Todos">Todos</option>
            <option value="Hoje">Hoje</option>
            <option value="Próximos">Próximos</option>
            <option value="Atrasados">Atrasados</option>
            <option value="Concluídos">Concluídos</option>
          </select>
        </label>
      </div>

      {visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-slate-300" />
          <h3 className="mt-3 font-bold text-slate-700">Nenhum compromisso encontrado</h3>
          <p className="mt-1 text-sm text-slate-500">Cadastre uma visita ou tarefa para começar a organizar seus próximos contatos.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleItems.map((item) => {
            const timestamp = new Date(item.dataHora).getTime();
            const overdue = item.status === 'Pendente' && timestamp < now;
            const linkedName = relationLabel(item, clientes, leads);
            const canManage = canManageItem(item);
            return (
              <article key={item.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${overdue ? 'border-rose-200' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${item.tipo === 'Visita' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>
                        {item.tipo === 'Visita' ? <MapPin className="h-3 w-3" /> : <ListTodo className="h-3 w-3" />}
                        {item.tipo}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.status === 'Concluída' ? 'bg-emerald-50 text-emerald-700' : overdue ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
                        {overdue ? 'Atrasada' : item.status}
                      </span>
                    </div>
                    <h3 className={`font-bold text-slate-800 ${item.status === 'Concluída' ? 'line-through decoration-slate-400' : ''}`}>{item.titulo}</h3>
                  </div>
                  <span className="shrink-0 rounded-lg bg-slate-50 p-2 text-slate-500"><Clock3 className="h-4 w-4" /></span>
                </div>
                <p className={`mt-3 text-sm font-semibold ${overdue ? 'text-rose-700' : 'text-slate-700'}`}>{formatDateTime(item.dataHora)}</p>
                {linkedName && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                    {item.leadId ? <Briefcase className="h-3.5 w-3.5 shrink-0 text-slate-400" /> : <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    <span className="truncate">{linkedName}</span>
                  </p>
                )}
                {item.descricao && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-600">{item.descricao}</p>}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="text-[10px] text-slate-400">{item.responsavelUserId === currentUser?.id || item.responsavelUserId === currentUser?.legacyId ? 'Responsável: você' : `Responsável: ${userNames.get(item.responsavelUserId) || 'equipe'}`}</span>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => toggleCompletion(item)} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${item.status === 'Concluída' ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                        {item.status === 'Concluída' ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                        {item.status === 'Concluída' ? 'Reabrir' : 'Concluir'}
                      </button>
                      <button type="button" onClick={() => openEditForm(item)} aria-label={`Editar ${item.titulo}`} className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => handleDelete(item)} aria-label={`Excluir ${item.titulo}`} className="rounded-lg border border-slate-200 p-2 text-rose-600 transition hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                  {!canManage && item.status === 'Concluída' && <CircleCheck className="h-4 w-4 text-emerald-600" />}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="agenda-form-title" className="my-3 flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:my-6">
            <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
              <div>
                <h2 id="agenda-form-title" className="font-bold text-slate-800">{editingItem ? 'Editar compromisso' : `Nova ${form.tipo.toLocaleLowerCase('pt-BR')}`}</h2>
                <p className="mt-0.5 text-xs text-slate-500">O compromisso ficará vinculado à empresa e ao seu usuário.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Fechar formulário" className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200"><X className="h-4 w-4" /></button>
            </header>
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
              <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
                {formError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div>}

                {isSystemAdmin && activeEmpresaId === 'all' && (
                  <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                    Empresa <span className="text-rose-600">*</span>
                    <select required value={form.empresaRepresentacaoId} disabled={Boolean(editingItem)} onChange={(event) => setForm((previous) => ({ ...previous, empresaRepresentacaoId: event.target.value, vinculo: '' }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259] disabled:bg-slate-100">
                      <option value="">Selecione uma empresa</option>
                      {empresas.map((company) => <option key={company.id} value={company.id}>{company.nomeFantasia}</option>)}
                    </select>
                  </label>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                    Tipo <span className="text-rose-600">*</span>
                    <select required value={form.tipo} onChange={(event) => setForm((previous) => ({ ...previous, tipo: event.target.value as AgendaTipo }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]">
                      <option value="Visita">Visita</option>
                      <option value="Tarefa">Tarefa</option>
                    </select>
                  </label>
                  <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                    Data e hora <span className="text-rose-600">*</span>
                    <input required type="datetime-local" value={form.dataHora} onChange={(event) => setForm((previous) => ({ ...previous, dataHora: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>
                </div>

                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Título <span className="text-rose-600">*</span>
                  <input required maxLength={160} value={form.titulo} onChange={(event) => setForm((previous) => ({ ...previous, titulo: event.target.value }))} placeholder={form.tipo === 'Visita' ? 'Ex.: Visita à Loja Central' : 'Ex.: Enviar proposta comercial'} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                </label>

                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Vincular a cliente ou prospect
                  <select value={form.vinculo} onChange={(event) => setForm((previous) => ({ ...previous, vinculo: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]">
                    <option value="">Sem vínculo</option>
                    {tenantLeads.length > 0 && <optgroup label="Prospects">{tenantLeads.map((lead) => <option key={`lead:${lead.id}`} value={`lead:${lead.id}`}>{lead.nomeFantasia}</option>)}</optgroup>}
                    {tenantClients.length > 0 && <optgroup label="Clientes">{tenantClients.map((client) => <option key={`cliente:${client.id}`} value={`cliente:${client.id}`}>{client.nomeFantasia}</option>)}</optgroup>}
                    {form.vinculo && !tenantLeads.some((lead) => form.vinculo === `lead:${lead.id}`) && !tenantClients.some((client) => form.vinculo === `cliente:${client.id}`) && <option value={form.vinculo}>Vínculo existente</option>}
                  </select>
                  {tenantLeads.length === 0 && tenantClients.length === 0 && <span className="block text-xs font-normal text-slate-500">Os vínculos aparecem quando o usuário tem acesso à carteira de clientes ou ao CRM.</span>}
                </label>

                <label className="block space-y-1.5 text-sm font-semibold text-slate-700">
                  Observações
                  <textarea rows={4} maxLength={1500} value={form.descricao} onChange={(event) => setForm((previous) => ({ ...previous, descricao: event.target.value }))} placeholder="Pauta, endereço ou detalhes importantes" className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  <span className="block text-right text-[11px] font-normal text-slate-400">{form.descricao.length}/1500</span>
                </label>
              </div>
              <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3 sm:px-6">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="rounded-xl bg-[#0B3259] px-5 py-2 text-sm font-bold text-white transition hover:bg-[#092847]">{editingItem ? 'Salvar alterações' : 'Adicionar à agenda'}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
