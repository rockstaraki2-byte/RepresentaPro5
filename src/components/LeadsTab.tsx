import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarClock,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Cliente, EmpresaRepresentacao, Lead, LeadEtapa, Representada, Usuario } from '../types';
import { formatarCNPJ, formatarData, getLocalIsoCalendarDate, isValidIsoCalendarDate } from '../utils';

interface LeadsTabProps {
  leads: Lead[];
  clientes: Cliente[];
  representadas: Representada[];
  empresas: EmpresaRepresentacao[];
  currentUser: Usuario | null;
  activeEmpresaId: string;
  isSystemAdmin: boolean;
  canEdit: boolean;
  canConvert: boolean;
  onAdd: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onConvert: (lead: Lead, cliente: Cliente) => void | Promise<void>;
}

type LeadForm = {
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  uf: string;
  telefone: string;
  email: string;
  contato: string;
  origem: string;
  etapa: Exclude<LeadEtapa, 'Convertido'>;
  representadaId: string;
  proximaAcao: string;
  dataProximaAcao: string;
  observacoes: string;
  motivoPerda: string;
  empresaRepresentacaoId: string;
};

const LEAD_STAGES: LeadEtapa[] = ['Novo', 'Contatado', 'Em negociação', 'Perdido', 'Convertido'];
const EDITABLE_STAGES: Array<Exclude<LeadEtapa, 'Convertido'>> = ['Novo', 'Contatado', 'Em negociação', 'Perdido'];

const EMPTY_FORM: LeadForm = {
  nomeFantasia: '', razaoSocial: '', cnpj: '', endereco: '', cidade: '', uf: '', telefone: '', email: '', contato: '',
  origem: '', etapa: 'Novo', representadaId: '', proximaAcao: '', dataProximaAcao: '', observacoes: '', motivoPerda: '',
  empresaRepresentacaoId: '',
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeDocument(value?: string): string {
  return (value || '').replace(/\D/g, '');
}

function stageStyle(stage: LeadEtapa): string {
  if (stage === 'Novo') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (stage === 'Contatado') return 'bg-violet-50 text-violet-700 border-violet-200';
  if (stage === 'Em negociação') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (stage === 'Convertido') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

export default function LeadsTab({
  leads,
  clientes,
  representadas,
  empresas,
  currentUser,
  activeEmpresaId,
  isSystemAdmin,
  canEdit,
  canConvert,
  onAdd,
  onEdit,
  onConvert,
}: LeadsTabProps) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<LeadEtapa | 'Todos'>('Todos');
  const [form, setForm] = useState<LeadForm>(EMPTY_FORM);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);

  const displayedLeads = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
    return leads
      .filter((lead) => stageFilter === 'Todos' || lead.etapa === stageFilter)
      .filter((lead) => {
        if (!normalizedSearch) return true;
        return [lead.nomeFantasia, lead.razaoSocial, lead.cnpj, lead.contato, lead.cidade, lead.uf, lead.origem]
          .some((value) => (value || '').toLocaleLowerCase('pt-BR').includes(normalizedSearch));
      })
      .sort((a, b) => {
        const aDate = a.dataProximaAcao || '9999-12-31';
        const bDate = b.dataProximaAcao || '9999-12-31';
        return aDate.localeCompare(bDate) || b.atualizadoEm.localeCompare(a.atualizadoEm);
      });
  }, [leads, search, stageFilter]);

  const openNewLead = () => {
    const defaultTenant = activeEmpresaId === 'all' ? '' : (currentUser?.empresaRepresentacaoId || activeEmpresaId);
    setEditingLead(null);
    setForm({ ...EMPTY_FORM, empresaRepresentacaoId: defaultTenant });
    setFormError('');
    setShowForm(true);
  };

  const openEditLead = (lead: Lead) => {
    setEditingLead(lead);
    setForm({
      nomeFantasia: lead.nomeFantasia || '',
      razaoSocial: lead.razaoSocial || '',
      cnpj: lead.cnpj || '',
      endereco: lead.endereco || '',
      cidade: lead.cidade || '',
      uf: lead.uf || '',
      telefone: lead.telefone || '',
      email: lead.email || '',
      contato: lead.contato || '',
      origem: lead.origem || '',
      etapa: lead.etapa === 'Convertido' ? 'Novo' : lead.etapa,
      representadaId: lead.representadaId || '',
      proximaAcao: lead.proximaAcao || '',
      dataProximaAcao: lead.dataProximaAcao || '',
      observacoes: lead.observacoes || '',
      motivoPerda: lead.motivoPerda || '',
      empresaRepresentacaoId: lead.empresaRepresentacaoId,
    });
    setFormError('');
    setShowForm(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    const tenantId = editingLead?.empresaRepresentacaoId || form.empresaRepresentacaoId;
    if (!currentUser?.id) {
      setFormError('Não foi possível identificar o usuário responsável. Entre novamente no sistema.');
      return;
    }
    if (!tenantId || tenantId === 'all') {
      setFormError('Selecione uma empresa específica antes de cadastrar o lead.');
      return;
    }
    if (!form.nomeFantasia.trim()) {
      setFormError('Informe o nome da empresa ou do prospect.');
      return;
    }
    if (form.dataProximaAcao && !isValidIsoCalendarDate(form.dataProximaAcao)) {
      setFormError('A data da próxima ação não existe no calendário. Informe uma data válida.');
      return;
    }
    const cleanCnpj = normalizeDocument(form.cnpj);
    if (cleanCnpj && cleanCnpj.length !== 14) {
      setFormError('Se informado, o CNPJ deve conter 14 dígitos.');
      return;
    }
    if (form.etapa === 'Perdido' && !form.motivoPerda.trim()) {
      setFormError('Informe o motivo da perda para concluir esta etapa.');
      return;
    }

    const duplicateLead = cleanCnpj && leads.some((item) => item.id !== editingLead?.id
      && item.empresaRepresentacaoId === tenantId
      && normalizeDocument(item.cnpj) === cleanCnpj
      && (!form.representadaId || item.representadaId === form.representadaId));
    if (duplicateLead) {
      setFormError('Já existe um lead com este CNPJ nesta empresa e representada. Confira a carteira antes de continuar.');
      return;
    }

    const now = new Date().toISOString();
    const lead: Lead = {
      id: editingLead?.id || makeId('lead'),
      nomeFantasia: form.nomeFantasia.trim(),
      razaoSocial: form.razaoSocial.trim(),
      cnpj: cleanCnpj ? formatarCNPJ(cleanCnpj) : '',
      endereco: form.endereco.trim(),
      cidade: form.cidade.trim(),
      uf: form.uf.trim().toUpperCase(),
      telefone: form.telefone.trim(),
      email: form.email.trim().toLowerCase(),
      contato: form.contato.trim(),
      origem: form.origem.trim(),
      etapa: editingLead?.etapa === 'Convertido' ? 'Convertido' : form.etapa,
      representadaId: form.representadaId,
      responsavelUserId: editingLead?.responsavelUserId || currentUser.id,
      proximaAcao: form.proximaAcao.trim(),
      dataProximaAcao: form.dataProximaAcao || undefined,
      observacoes: form.observacoes.trim(),
      motivoPerda: form.etapa === 'Perdido' ? form.motivoPerda.trim() : '',
      clienteConvertidoId: editingLead?.clienteConvertidoId,
      convertidoEm: editingLead?.convertidoEm,
      criadoPorUserId: editingLead?.criadoPorUserId || currentUser.id,
      criadoEm: editingLead?.criadoEm || now,
      atualizadoEm: now,
      empresaRepresentacaoId: tenantId,
    };

    if (editingLead) onEdit(lead);
    else onAdd(lead);
    setShowForm(false);
  };

  const handleConvert = async (lead: Lead) => {
    if (!currentUser?.id || !canConvert || convertingLeadId === lead.id) return;
    if (lead.etapa === 'Convertido' || lead.etapa === 'Perdido') return;
    const document = normalizeDocument(lead.cnpj);
    const linkedCustomer = clientes.find((cliente) => cliente.id === lead.id
      && cliente.leadOrigemId === lead.id
      && cliente.empresaRepresentacaoId === lead.empresaRepresentacaoId);
    if (document && clientes.some((cliente) => cliente.id !== linkedCustomer?.id
      && cliente.empresaRepresentacaoId === lead.empresaRepresentacaoId
      && normalizeDocument(cliente.cnpj) === document)) {
      alert('Já existe um cliente com este CNPJ nesta empresa. Revise o cadastro antes de converter este lead.');
      return;
    }
    if (!confirm(`Converter "${lead.nomeFantasia}" em cliente? O sistema criará o cadastro na carteira e manterá o histórico deste lead.`)) return;

    const now = new Date().toISOString();
    const cliente: Cliente = {
      id: linkedCustomer?.id || lead.id,
      tipoPessoa: 'PJ',
      nomeFantasia: lead.nomeFantasia,
      razaoSocial: lead.razaoSocial || lead.nomeFantasia,
      cnpj: lead.cnpj || '',
      endereco: lead.endereco || '',
      cidade: lead.cidade || '',
      uf: lead.uf || '',
      telefone: lead.telefone || '',
      email: lead.email || '',
      contato: lead.contato || '',
      tipoFaturamento: 'Nota Fiscal',
      empresaRepresentacaoId: lead.empresaRepresentacaoId,
      leadOrigemId: lead.id,
    };
    const convertedLead: Lead = {
      ...lead,
      etapa: 'Convertido',
      clienteConvertidoId: cliente.id,
      convertidoEm: now,
      atualizadoEm: now,
    };
    setConvertingLeadId(lead.id);
    try {
      await onConvert(convertedLead, cliente);
    } catch {
      alert('Não foi possível concluir a conversão. O lead foi preservado; tente novamente.');
    } finally {
      setConvertingLeadId(null);
    }
  };

  const today = getLocalIsoCalendarDate();
  const representadasDoTenant = representadas.filter((item) => item.empresaRepresentacaoId === form.empresaRepresentacaoId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-[#0B3259]"><Briefcase className="h-5 w-5" /></div>
          <div>
            <h2 className="font-bold text-slate-800">CRM de Prospecção</h2>
            <p className="text-xs text-slate-500">Organize oportunidades e acompanhe o próximo contato.</p>
          </div>
        </div>
        {canEdit && (
          <button onClick={openNewLead} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B3259] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#092847]">
            <Plus className="h-4 w-4" /> Novo lead
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {LEAD_STAGES.map((stage) => (
          <button key={stage} onClick={() => setStageFilter(stageFilter === stage ? 'Todos' : stage)} className={`rounded-xl border bg-white px-3 py-3 text-left transition ${stageFilter === stage ? 'border-[#0B3259] ring-2 ring-[#0B3259]/10' : 'border-slate-200 hover:border-slate-300'}`}>
            <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">{stage}</span>
            <strong className="mt-1 block text-xl text-slate-800">{leads.filter((lead) => lead.etapa === stage).length}</strong>
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por empresa, CNPJ, contato ou cidade" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#0B3259] focus:ring-2 focus:ring-[#0B3259]/10" />
        </label>
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <span className="text-xs font-semibold text-slate-500">Etapa</span>
          <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value as LeadEtapa | 'Todos')} className="bg-transparent py-2 text-sm font-semibold text-slate-700 outline-none">
            <option value="Todos">Todas</option>
            {LEAD_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
          </select>
        </label>
      </div>

      {displayedLeads.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <Briefcase className="mx-auto h-8 w-8 text-slate-300" />
          <h3 className="mt-3 font-bold text-slate-700">Nenhum lead encontrado</h3>
          <p className="mt-1 text-sm text-slate-500">Cadastre uma oportunidade e defina a próxima ação para começar o acompanhamento.</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {displayedLeads.map((lead) => {
            const represented = representadas.find((item) => item.id === lead.representadaId);
            const due = lead.dataProximaAcao || '';
            const overdue = due && due < today && !['Convertido', 'Perdido'].includes(lead.etapa);
            const conversionPending = lead.etapa !== 'Convertido' && clientes.some((cliente) =>
              cliente.id === lead.id && cliente.leadOrigemId === lead.id
                && cliente.empresaRepresentacaoId === lead.empresaRepresentacaoId);
            return (
              <article key={lead.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-slate-800">{lead.nomeFantasia}</h3>
                    {lead.razaoSocial && lead.razaoSocial !== lead.nomeFantasia && <p className="mt-0.5 truncate text-xs text-slate-500">{lead.razaoSocial}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${stageStyle(lead.etapa)}`}>{lead.etapa}</span>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                  {lead.cnpj && <div className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />{formatarCNPJ(lead.cnpj)}</div>}
                  {lead.contato && <div className="flex items-center gap-2"><span className="font-bold text-slate-400">Contato</span><span className="truncate">{lead.contato}</span></div>}
                  {lead.telefone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />{lead.telefone}</div>}
                  {(lead.cidade || lead.uf) && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />{[lead.cidade, lead.uf].filter(Boolean).join(' / ')}</div>}
                  {represented && <div className="flex items-center gap-2 sm:col-span-2"><span className="font-bold text-slate-400">Representada</span><span className="truncate">{represented.nomeFantasia}</span></div>}
                </div>
                {lead.proximaAcao && (
                  <div className={`mt-3 rounded-xl border px-3 py-2.5 ${overdue ? 'border-rose-200 bg-rose-50' : 'border-slate-100 bg-slate-50'}`}>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700"><CalendarClock className={`h-3.5 w-3.5 ${overdue ? 'text-rose-600' : 'text-slate-400'}`} />{lead.proximaAcao}</div>
                    {due && <p className={`mt-1 pl-5 text-[11px] ${overdue ? 'font-bold text-rose-700' : 'text-slate-500'}`}>{overdue ? 'Atrasada · ' : ''}{formatarData(due)}</p>}
                  </div>
                )}
                {lead.etapa === 'Perdido' && lead.motivoPerda && <p className="mt-2 text-xs text-slate-500"><strong>Motivo da perda:</strong> {lead.motivoPerda}</p>}
                {conversionPending && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">O cliente já foi salvo. Retome a conversão para concluir o processo.</p>}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <span className="text-[10px] text-slate-400">{lead.responsavelUserId === currentUser?.id ? 'Responsável: você' : 'Responsável: equipe'}</span>
                  {(canEdit || canConvert) && (
                    <div className="flex items-center gap-2">
                      {canConvert && lead.etapa !== 'Convertido' && lead.etapa !== 'Perdido' && (
                        <button type="button" disabled={convertingLeadId === lead.id} onClick={() => void handleConvert(lead)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60">
                          {convertingLeadId === lead.id ? 'Convertendo…' : conversionPending ? 'Retomar conversão' : 'Converter em cliente'}
                          {convertingLeadId !== lead.id && <ArrowRight className="h-3.5 w-3.5" />}
                        </button>
                      )}
                      {canEdit && lead.etapa !== 'Convertido' && !conversionPending && (
                        <button onClick={() => openEditLead(lead)} aria-label={`Editar lead ${lead.nomeFantasia}`} className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-50">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="lead-form-title" className="my-3 flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:my-6">
            <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3 sm:px-6">
              <div>
                <h2 id="lead-form-title" className="font-bold text-slate-800">{editingLead ? 'Editar oportunidade' : 'Novo lead'}</h2>
                <p className="mt-0.5 text-xs text-slate-500">Os dados ficam vinculados à empresa e à representada selecionadas.</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} aria-label="Fechar formulário" className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-200"><X className="h-4 w-4" /></button>
            </header>
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
              <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
                {formError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div>}
                {isSystemAdmin && activeEmpresaId === 'all' && !editingLead && (
                  <label className="block space-y-1 text-xs font-semibold text-slate-600">
                    Empresa *
                    <select required value={form.empresaRepresentacaoId} onChange={(event) => setForm((previous) => ({ ...previous, empresaRepresentacaoId: event.target.value, representadaId: '' }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]">
                      <option value="">Selecione uma empresa</option>
                      {empresas.map((company) => <option key={company.id} value={company.id}>{company.nomeFantasia}</option>)}
                    </select>
                  </label>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">Empresa / prospect *
                    <input required maxLength={200} value={form.nomeFantasia} onChange={(event) => setForm((previous) => ({ ...previous, nomeFantasia: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">Razão social
                    <input maxLength={250} value={form.razaoSocial} onChange={(event) => setForm((previous) => ({ ...previous, razaoSocial: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">CNPJ
                    <input inputMode="numeric" maxLength={18} value={form.cnpj} onChange={(event) => setForm((previous) => ({ ...previous, cnpj: event.target.value }))} placeholder="00.000.000/0000-00" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">Pessoa de contato
                    <input maxLength={150} value={form.contato} onChange={(event) => setForm((previous) => ({ ...previous, contato: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">Telefone
                    <input type="tel" maxLength={40} value={form.telefone} onChange={(event) => setForm((previous) => ({ ...previous, telefone: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">E-mail
                    <input type="email" maxLength={254} value={form.email} onChange={(event) => setForm((previous) => ({ ...previous, email: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">Cidade
                    <input maxLength={120} value={form.cidade} onChange={(event) => setForm((previous) => ({ ...previous, cidade: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">UF
                    <input maxLength={2} value={form.uf} onChange={(event) => setForm((previous) => ({ ...previous, uf: event.target.value.toUpperCase() }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal uppercase text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">Endereço
                    <input maxLength={250} value={form.endereco} onChange={(event) => setForm((previous) => ({ ...previous, endereco: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">Representada de interesse
                    <select value={form.representadaId} onChange={(event) => setForm((previous) => ({ ...previous, representadaId: event.target.value }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]">
                      <option value="">Ainda não definida</option>
                      {representadasDoTenant.map((item) => <option key={item.id} value={item.id}>{item.nomeFantasia}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">Origem
                    <input maxLength={80} value={form.origem} onChange={(event) => setForm((previous) => ({ ...previous, origem: event.target.value }))} placeholder="Indicação, evento, prospecção..." className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">Etapa
                    <select value={editingLead?.etapa === 'Convertido' ? 'Convertido' : form.etapa} disabled={editingLead?.etapa === 'Convertido'} onChange={(event) => setForm((previous) => ({ ...previous, etapa: event.target.value as LeadForm['etapa'], motivoPerda: event.target.value === 'Perdido' ? previous.motivoPerda : '' }))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259] disabled:bg-slate-100">
                      {editingLead?.etapa === 'Convertido' && <option value="Convertido">Convertido</option>}
                      {EDITABLE_STAGES.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">Próxima ação
                    <input maxLength={160} value={form.proximaAcao} onChange={(event) => setForm((previous) => ({ ...previous, proximaAcao: event.target.value }))} placeholder="Ligar, enviar catálogo, agendar visita..." className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>
                  <label className="space-y-1 text-xs font-semibold text-slate-600">Data do acompanhamento
                    <input type="date" value={form.dataProximaAcao} onChange={(event) => setForm((previous) => ({ ...previous, dataProximaAcao: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>
                  {form.etapa === 'Perdido' && <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">Motivo da perda *
                    <input required maxLength={300} value={form.motivoPerda} onChange={(event) => setForm((previous) => ({ ...previous, motivoPerda: event.target.value }))} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>}
                  <label className="space-y-1 text-xs font-semibold text-slate-600 sm:col-span-2">Observações
                    <textarea maxLength={1500} rows={3} value={form.observacoes} onChange={(event) => setForm((previous) => ({ ...previous, observacoes: event.target.value }))} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-normal text-slate-800 outline-none focus:border-[#0B3259]" />
                  </label>
                </div>
              </div>
              <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-100 bg-white px-4 py-3 sm:px-6">
                <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="rounded-xl bg-[#0B3259] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#092847]">{editingLead ? 'Salvar alterações' : 'Cadastrar lead'}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
