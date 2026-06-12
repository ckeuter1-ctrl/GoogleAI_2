import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Mail, 
  User, 
  Briefcase, 
  HelpCircle, 
  CheckCircle, 
  AlertTriangle, 
  Link as LinkIcon, 
  Sparkles, 
  Check, 
  ChevronRight, 
  RefreshCw, 
  Download,
  Settings,
  Database,
  Info,
  Copy,
  ExternalLink
} from 'lucide-react';

// Define the schema of a lead submission
interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string;
  areaToCheck: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  submittedAt: string;
  selectedSymptomsScore: number;
  status: 'checklist_delivered' | 'diagnostics_requested';
}

const SYMPTOMS = [
  { id: 1, text: "Перед встречей с руководством открывают не ERP/BI-систему, а сводный файл Excel." },
  { id: 2, text: "В компании есть конкретный человек, который единственный знает «правильную» версию цифр." },
  { id: 3, text: "Фактические данные собираются только после долгих выгрузок и ручного мапирования аналитик." },
  { id: 4, text: "Один и тот же показатель из разных таблиц трудно быстро объяснить без сверки формул." },
  { id: 5, text: "BI-система показывает красивые графики, но её источники всё равно собираются вручную в Excel." },
  { id: 6, text: "Без мастер-таблицы Excel физически невозможно закрыть месяц и свести баланс." },
  { id: 7, text: "Никто до конца не уверен, что формулы во всех ячейках расчёта финального бюджета верны." },
  { id: 8, text: "При увольнении сотрудника финансовой службы вместе с ним «уходит» понимание логики его таблиц." },
  { id: 9, text: "Сверка данных между отделами занимает несколько рабочих дней вместо одного клика." },
  { id: 10, text: "Версия файла 'Финальный_бюджет_V3_исправленный_2.xlsx' отправляется по почте перед самым советом директоров." }
];

function getBitrixMethodUrl(baseUrl: string, method: string): string {
  let cleanBase = baseUrl.trim();
  const suffixes = [
    '/crm.lead.add.json', '/crm.lead.add',
    '/crm.lead.update.json', '/crm.lead.update',
    '/crm.timeline.comment.add.json', '/crm.timeline.comment.add'
  ];
  for (const suffix of suffixes) {
    if (cleanBase.endsWith(suffix)) {
      cleanBase = cleanBase.substring(0, cleanBase.length - suffix.length);
      break;
    }
  }
  if (!cleanBase.endsWith('/')) {
    cleanBase += '/';
  }
  return `${cleanBase}${method}.json`;
}

export default function App() {
  useEffect(() => {
    document.title = "10 признаков теневой Excel-системы";
  }, []);

  // Webhook Placeholder State
  const [bitrixWebhookUrl, setBitrixWebhookUrl] = useState<string>("PASTE_BITRIX_WEBHOOK_HERE");
  
  // Local Database / Lead list synced to localStorage
  const [leads, setLeads] = useState<Lead[]>([]);
  
  // State for single-lead lifecycle
  const [currentLeadId, setCurrentLeadId] = useState<string | null>(() => {
    return localStorage.getItem("excel_shadow_current_local_lead_id") || null;
  });

  const [bitrixLeadId, setBitrixLeadId] = useState<string | null>(() => {
    return localStorage.getItem("excel_shadow_lead_id") || null;
  });

  const [leadCreated, setLeadCreated] = useState<boolean>(() => {
    return localStorage.getItem("excel_shadow_lead_created") === "true";
  });

  const [lastCrmAction, setLastCrmAction] = useState<'lead_created' | 'checklist_opened' | 'focus_updated' | 'diagnosis_requested' | null>(() => {
    return (localStorage.getItem("excel_shadow_last_action") as any) || null;
  });

  const [leadsCreatedCount, setLeadsCreatedCount] = useState<number>(() => {
    const saved = localStorage.getItem("excel_shadow_leads_created_count");
    return saved ? parseInt(saved, 10) : 0;
  });

  useEffect(() => {
    const savedLeads = localStorage.getItem('excel_lead_magnet_submissions');
    if (savedLeads) {
      try {
        setLeads(JSON.parse(savedLeads));
      } catch (err) {
        console.error("Ошибка при чтении сохраненных лидов", err);
      }
    }
  }, []);

  // Form states restoring on refresh
  const [formData, setFormData] = useState(() => {
    const savedCurrentLeadId = localStorage.getItem("excel_shadow_current_local_lead_id");
    if (savedCurrentLeadId) {
      const savedLeads = localStorage.getItem('excel_lead_magnet_submissions');
      if (savedLeads) {
        try {
          const parsed = JSON.parse(savedLeads) as Lead[];
          const found = parsed.find(l => l.id === savedCurrentLeadId);
          if (found) {
            return {
              name: found.name === 'Не указано' ? '' : found.name,
              email: found.email,
              company: found.company === 'Не указано' ? '' : found.company,
              role: found.role === 'Не указано' ? '' : found.role,
              areaToCheck: found.areaToCheck
            };
          }
        } catch (_) {}
      }
    }
    return {
      name: '',
      email: '',
      company: '',
      role: '',
      areaToCheck: 'Пока просто заберу чек-лист'
    };
  });

  // UTM Parameters loaded from address/search query
  const [utmParams, setUtmParams] = useState({
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_content: ''
  });

  const [isSubmitted, setIsSubmitted] = useState<boolean>(() => {
    return localStorage.getItem("excel_shadow_lead_created") === "true";
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  
  // Interactive checklist status selection
  const [checkedSymptoms, setCheckedSymptoms] = useState<boolean[]>(Array(10).fill(false));
  const [diagnosticsStatus, setDiagnosticsStatus] = useState<'idle' | 'requested' | 'sending'>('idle');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  // Load UTM parameters
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    setUtmParams({
      utm_source: searchParams.get('utm_source') || '',
      utm_medium: searchParams.get('utm_medium') || '',
      utm_campaign: searchParams.get('utm_campaign') || '',
      utm_content: searchParams.get('utm_content') || ''
    });
  }, []);

  const appURL = window.location.origin + window.location.pathname;

  const distributionLinks = [
    {
      channel: 'VC.ru',
      desc: 'Для встраивания в экспертную статью',
      url: `${appURL}?utm_source=vc&utm_medium=article&utm_campaign=excel_shadow`,
      badge: 'vc'
    },
    {
      channel: 'Telegram',
      desc: 'Для посева в каналах или авторского блога',
      url: `${appURL}?utm_source=telegram&utm_medium=channel&utm_campaign=excel_shadow`,
      badge: 'telegram'
    },
    {
      channel: 'LinkedIn',
      desc: 'Для профессиональной сети контактов',
      url: `${appURL}?utm_source=linkedin&utm_medium=post&utm_campaign=excel_shadow`,
      badge: 'linkedin'
    }
  ];

  const activeSymptomCount = checkedSymptoms.filter(Boolean).length;
  
  const getScoreInfo = (count: number) => {
    if (count <= 2) {
      return {
        level: "0-2 признака",
        label: "Низкий риск",
        color: "text-emerald-700 bg-emerald-50 border-emerald-200",
        barColor: "bg-emerald-500",
        desc: "Excel пока используется как вспомогательный инструмент. Зависимость бизнеса от ручных файлов минимальна."
      };
    } else if (count <= 5) {
      return {
        level: "3-5 признаков",
        label: "Умеренный риск",
        color: "text-amber-700 bg-amber-50 border-amber-200",
        barColor: "bg-amber-500",
        desc: "Контур факта уже частично ручной. Часть управленческого процесса зависит от неконтролируемых файлов."
      };
    } else if (count <= 8) {
      return {
        level: "6-8 признаков",
        label: "Теневая система управления",
        color: "text-orange-700 bg-orange-50 border-orange-200",
        barColor: "bg-orange-500",
        desc: "Excel фактически заменил собой полноценную систему управления. Высокая вероятность ошибок в формулах."
      };
    } else {
      return {
        level: "9-10 признаков",
        label: "Критический риск управляемости",
        color: "text-red-700 bg-red-50 border-red-200",
        barColor: "bg-red-500",
        desc: "Компания критически зависит от файлов и их авторов. Большой риск паралича фин. результатов при потере специалистов."
      };
    }
  };

  const currentScoreInfo = getScoreInfo(activeSymptomCount);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      setSubmissionError("Пожалуйста, укажите рабочий email (это обязательное поле).");
      return;
    }

    // Duplicate protection
    const emailLower = formData.email.trim().toLowerCase();
    const existingInLeads = leads.find(l => l.email.trim().toLowerCase() === emailLower);

    if (leadCreated || bitrixLeadId || existingInLeads) {
      console.log("Повторная отправка заблокирована (защита от дублей). Переход на Thank-You.");
      if (existingInLeads) {
        setCurrentLeadId(existingInLeads.id);
        localStorage.setItem("excel_shadow_current_local_lead_id", existingInLeads.id);
        
        const savedLeadId = localStorage.getItem("excel_shadow_lead_id");
        if (savedLeadId) {
          setBitrixLeadId(savedLeadId);
        }
      }
      setIsSubmitted(true);
      return;
    }

    setIsSubmitting(true);
    setSubmissionError(null);

    const leadId = 'lead_' + Date.now();
    const newLead: Lead = {
      id: leadId,
      name: formData.name || 'Не указано',
      email: formData.email,
      company: formData.company || 'Не указано',
      role: formData.role || 'Не указано',
      areaToCheck: formData.areaToCheck,
      utm_source: utmParams.utm_source || 'direct',
      utm_medium: utmParams.utm_medium || 'direct',
      utm_campaign: utmParams.utm_campaign || 'direct',
      utm_content: utmParams.utm_content || 'direct',
      submittedAt: new Date().toLocaleString('ru-RU'),
      selectedSymptomsScore: 0,
      status: 'checklist_delivered'
    };

    // Log the event exactly as requested
    console.group("=== [ЗАЯВКА ОТПРАВЛЕНА] ===");
    console.log("Данные полученной лид-формы:");
    console.log("- Email (Рабочий):", newLead.email);
    console.log("- Имя (Необязательное):", newLead.name);
    console.log("- Компания (Необязательное):", newLead.company);
    console.log("- Должность (Необязательное):", newLead.role);
    console.log("- Интеграционный Webhook Bitrix24:", bitrixWebhookUrl);
    console.log("- Собрано UTM меток:", {
      utm_source: newLead.utm_source,
      utm_medium: newLead.utm_medium,
      utm_campaign: newLead.utm_campaign,
      utm_content: newLead.utm_content
    });
    console.groupEnd();

    // Persist list
    const updatedLeads = [newLead, ...leads];
    setLeads(updatedLeads);
    localStorage.setItem('excel_lead_magnet_submissions', JSON.stringify(updatedLeads));
    setCurrentLeadId(leadId);
    localStorage.setItem("excel_shadow_current_local_lead_id", leadId);

    let finalBitrixLeadId: string | null = null;

    // Call Bitrix Webhook if configured
    if (bitrixWebhookUrl && bitrixWebhookUrl !== "PASTE_BITRIX_WEBHOOK_HERE") {
      try {
        const methodUrl = getBitrixMethodUrl(bitrixWebhookUrl, 'crm.lead.add');
        const body = new FormData();

        body.append("fields[TITLE]", `Лид-магнит: 10 признаков теневой Excel-системы`);
        body.append("fields[NAME]", newLead.name || "Не указано");
        body.append("fields[COMPANY_TITLE]", newLead.company || "");
        body.append("fields[POST]", newLead.role || "");
        body.append("fields[EMAIL][0][VALUE]", newLead.email);
        body.append("fields[EMAIL][0][VALUE_TYPE]", "WORK");

        body.append(
          "fields[COMMENTS]",
          [
            `Источник: лид-магнит 10 признаков теневой Excel-системы`,
            `Что хочет проверить: ${newLead.areaToCheck || "не указано"}`,
            `UTM source: ${newLead.utm_source || ""}`,
            `UTM medium: ${newLead.utm_medium || ""}`,
            `UTM campaign: ${newLead.utm_campaign || ""}`,
            `UTM content: ${newLead.utm_content || ""}`
          ].join("\n")
        );

        body.append("fields[UTM_SOURCE]", newLead.utm_source || "");
        body.append("fields[UTM_MEDIUM]", newLead.utm_medium || "");
        body.append("fields[UTM_CAMPAIGN]", newLead.utm_campaign || "");
        body.append("fields[UTM_CONTENT]", newLead.utm_content || "");

        const response = await fetch(methodUrl, {
          method: "POST",
          body
        });

        const result = await response.json();
        console.log("Bitrix24 response (crm.lead.add):", result);

        if (!response.ok || result.error) {
          throw new Error(result.error_description || "Bitrix24 lead create error");
        }

        if (result.result) {
          finalBitrixLeadId = String(result.result);
        }
      } catch (err) {
        console.warn("Ошибка прямой отправки на вебхук:", err);
      }
    }

    if (finalBitrixLeadId) {
      setBitrixLeadId(finalBitrixLeadId);
      localStorage.setItem("excel_shadow_lead_id", finalBitrixLeadId);
    }

    setLeadCreated(true);
    localStorage.setItem("excel_shadow_lead_created", "true");
    localStorage.setItem("excel_shadow_lead_email", newLead.email);

    setLastCrmAction("lead_created");
    localStorage.setItem("excel_shadow_last_action", "lead_created");

    const newCreatedCount = leadsCreatedCount + 1;
    setLeadsCreatedCount(newCreatedCount);
    localStorage.setItem("excel_shadow_leads_created_count", String(newCreatedCount));

    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      setCheckedSymptoms([true, false, true, false, false, true, false, false, false, false]);
    }, 600);
  };

  // Update check area preference on the thank you page
  const handleAreaSelect = async (area: string) => {
    setFormData(prev => ({ ...prev, areaToCheck: area }));
    setLastCrmAction("focus_updated");
    localStorage.setItem("excel_shadow_last_action", "focus_updated");
    
    if (currentLeadId) {
      const updatedLeads = leads.map(l => {
        if (l.id === currentLeadId) {
          return { ...l, areaToCheck: area };
        }
        return l;
      });
      setLeads(updatedLeads);
      localStorage.setItem('excel_lead_magnet_submissions', JSON.stringify(updatedLeads));
    }

    if (!bitrixLeadId || !bitrixWebhookUrl || bitrixWebhookUrl === "PASTE_BITRIX_WEBHOOK_HERE") {
      console.log(`Focus updated locally to: ${area}. No active Bitrix Integration.`);
      return;
    }

    try {
      const methodUrl = getBitrixMethodUrl(bitrixWebhookUrl, 'crm.timeline.comment.add');
      const body = new FormData();
      body.append("fields[ENTITY_ID]", bitrixLeadId);
      body.append("fields[ENTITY_TYPE]", "lead");
      body.append("fields[COMMENT]", `Пользователь уточнил фокус проверки: ${area}`);

      const response = await fetch(methodUrl, {
        method: "POST",
        body
      });
      const result = await response.json();
      console.log("Bitrix24 comment response (focus updated):", result);

      // Also update the lead comments field
      const updateMethodUrl = getBitrixMethodUrl(bitrixWebhookUrl, 'crm.lead.update');
      const updateBody = new FormData();
      updateBody.append("id", bitrixLeadId);
      updateBody.append("fields[COMMENTS]", `Пользователь уточнил фокус проверки на Thank You экране: ${area}`);
      await fetch(updateMethodUrl, {
        method: "POST",
        body: updateBody
      }).catch((e) => console.warn("Optional lead update error:", e));

    } catch (err) {
      console.warn("Error updating area select in Bitrix:", err);
    }
  };

  const handleOpenChecklist = async () => {
    setLastCrmAction("checklist_opened");
    localStorage.setItem("excel_shadow_last_action", "checklist_opened");

    if (!bitrixLeadId || !bitrixWebhookUrl || bitrixWebhookUrl === "PASTE_BITRIX_WEBHOOK_HERE") {
      console.log("Checklist opened locally. No Bitrix lead ID or webhook configured.");
      return;
    }

    try {
      const methodUrl = getBitrixMethodUrl(bitrixWebhookUrl, 'crm.timeline.comment.add');
      const commentBody = new FormData();
      commentBody.append("fields[ENTITY_ID]", bitrixLeadId);
      commentBody.append("fields[ENTITY_TYPE]", "lead");
      commentBody.append("fields[COMMENT]", "Пользователь открыл/скачал чек-лист");

      const response = await fetch(methodUrl, {
        method: "POST",
        body: commentBody
      });
      const result = await response.json();
      console.log("Bitrix24 timeline comment added (checklist opened):", result);
    } catch (err) {
      console.warn("Ошибка добавления комментария таймлайна в Битрикс:", err);
    }
  };

  const requestDiagnostics = async () => {
    if (diagnosticsStatus === 'requested' || diagnosticsStatus === 'sending') return;
    
    setDiagnosticsStatus('sending');
    setLastCrmAction("diagnosis_requested");
    localStorage.setItem("excel_shadow_last_action", "diagnosis_requested");

    const updatedLeads = leads.map(l => {
      if (l.id === currentLeadId) {
        return { 
          ...l, 
          status: 'diagnostics_requested' as const,
          selectedSymptomsScore: activeSymptomCount
        };
      }
      return l;
    });

    setLeads(updatedLeads);
    localStorage.setItem('excel_lead_magnet_submissions', JSON.stringify(updatedLeads));

    if (!bitrixLeadId || !bitrixWebhookUrl || bitrixWebhookUrl === "PASTE_BITRIX_WEBHOOK_HERE") {
      console.log("Diagnostics requested locally. No active Bitrix Integration.");
      setTimeout(() => {
        setDiagnosticsStatus('requested');
      }, 500);
      return;
    }

    try {
      // 1. Update existing lead fields (change title and comments on diagnostics requested)
      const updateUrl = getBitrixMethodUrl(bitrixWebhookUrl, 'crm.lead.update');
      const updateBody = new FormData();
      updateBody.append("id", bitrixLeadId);
      updateBody.append("fields[TITLE]", `🔥 MQL: запрос диагностики — 10 признаков теневой Excel-системы`);
      updateBody.append(
        "fields[COMMENTS]",
        [
          `ПОЛЬЗОВАТЕЛЬ ЗАПРОСИЛ КОНСУЛЬТАЦИЮ ДИДЖИТАЛ ДИАГНОСТИКИ.`,
          `Скор симптомов: ${activeSymptomCount} из 10.`,
          `Фокусная область: ${formData.areaToCheck || "не указано"}`
        ].join("\n")
      );

      const updateResponse = await fetch(updateUrl, {
        method: "POST",
        body: updateBody
      });
      const updateResult = await updateResponse.json();
      console.log("Bitrix24 lead.update (diagnostics requested):", updateResult);

      // 2. Add comment to existing lead timeline
      const commentUrl = getBitrixMethodUrl(bitrixWebhookUrl, 'crm.timeline.comment.add');
      const commentBody = new FormData();
      commentBody.append("fields[ENTITY_ID]", bitrixLeadId);
      commentBody.append("fields[ENTITY_TYPE]", "lead");
      commentBody.append("fields[COMMENT]", `Пользователь запросил диагностику контура факта\nСимптомов: ${activeSymptomCount}/10\nОбласть проверки: ${formData.areaToCheck}`);

      const commentResponse = await fetch(commentUrl, {
        method: "POST",
        body: commentBody
      });
      const commentResult = await commentResponse.json();
      console.log("Bitrix24 timeline.comment.add (diagnostics requested):", commentResult);

    } catch (err) {
      console.warn("Ошибка при запросе диагностики в CRM:", err);
    }

    setTimeout(() => {
      setDiagnosticsStatus('requested');
    }, 500);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleResetForm = () => {
    setIsSubmitted(false);
    setFormData({
      name: '',
      email: '',
      company: '',
      role: '',
      areaToCheck: 'Пока просто заберу чек-лист'
    });
    setCheckedSymptoms(Array(10).fill(false));
    setDiagnosticsStatus('idle');
    setCurrentLeadId(null);
    setBitrixLeadId(null);
    setLeadCreated(false);
    setLastCrmAction(null);
    localStorage.removeItem("excel_shadow_lead_id");
    localStorage.removeItem("excel_shadow_lead_email");
    localStorage.removeItem("excel_shadow_lead_created");
    localStorage.removeItem("excel_shadow_last_action");
    localStorage.removeItem("excel_shadow_current_local_lead_id");
  };

  const handleSymptomToggle = (idx: number) => {
    const updated = [...checkedSymptoms];
    updated[idx] = !updated[idx];
    setCheckedSymptoms(updated);

    if (currentLeadId) {
      const updatedLeads = leads.map(l => {
        if (l.id === currentLeadId) {
          return { ...l, selectedSymptomsScore: updated.filter(Boolean).length };
        }
        return l;
      });
      setLeads(updatedLeads);
      localStorage.setItem('excel_lead_magnet_submissions', JSON.stringify(updatedLeads));
    }
  };

  // Simple quick fill to test easily
  const handleAutofillDemo = () => {
    setFormData({
      name: 'Александр CFO',
      email: 'alex.cfo@corporation-capital.ru',
      company: 'Капитал Ритейл Групп',
      role: 'Руководитель департамента финансового анализа',
      areaToCheck: 'Пока просто заберу чек-лист'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex flex-col justify-between" id="app-wrapper">
      
      {/* Upper Navigation Header */}
      <header className="bg-white border-b border-slate-200 py-4 px-6 shadow-2xs" id="top-nav">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-slate-950 text-white h-9 w-9 rounded-lg flex items-center justify-center font-mono font-black text-lg">
              T
            </div>
            <div>
              <span className="font-bold tracking-tight text-slate-900 text-sm block font-mono uppercase">
                Tabula Consulting
              </span>
              <span className="text-[10px] text-slate-500 block leading-tight">
                Анализ и оптимизация контуров управленческого факта
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-slate-100 text-slate-700 border border-slate-200">
              CFO ИНСТРУМЕНТ • 2026
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-5xl mx-auto px-4 py-8 md:py-12 w-full">
        {!isSubmitted ? (
          /* ========================================================================= */
          /* LANDING (HERO & CONVERSION OPTIMIZED SIMPLE FORM)                         */
          /* ========================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start" id="main-landing-grid">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6" id="editorial-hero">
              <div className="space-y-4">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold">
                  <span>Релиз методического центра Tabula</span>
                </div>
                
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  10 признаков теневой Excel-системы
                </h1>
                
                <p className="text-lg text-slate-700 leading-relaxed font-medium">
                  Проверьте, где у вас на самом деле живёт управленческий факт: в системе, в таблице или в голове ключевого сотрудника.
                </p>
              </div>

              <p className="text-sm md:text-base text-slate-600 leading-relaxed">
                Короткий <strong>self-check для CFO, финансового контролера и собственника</strong>. 
                Помогает понять, где факт собирается вручную, насколько компания зависит от одного файла или одного человека, 
                и стал ли Excel рабочим инструментом или уже теневой системой управления.
              </p>

              {/* What inside block */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 shadow-2xs">
                <span className="font-mono text-[11px] font-bold text-slate-400 uppercase tracking-widest block">Содержание чек-листа:</span>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600">
                  <div className="space-y-2">
                    <div className="flex items-start">
                      <Check className="h-4 w-4 text-slate-900 mr-2 shrink-0 mt-0.5" />
                      <span>Признаки зависимости контура от ключевой персоны</span>
                    </div>
                    <div className="flex items-start">
                      <Check className="h-4 w-4 text-slate-900 mr-2 shrink-0 mt-0.5" />
                      <span>Ошибки версий файлов на общем сервере</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-start">
                      <Check className="h-4 w-4 text-slate-900 mr-2 shrink-0 mt-0.5" />
                      <span>Скрытый ручной труд за красивыми BI дашбордами</span>
                    </div>
                    <div className="flex items-start">
                      <Check className="h-4 w-4 text-slate-900 mr-2 shrink-0 mt-0.5" />
                      <span>Аудит операционных рисков потери автора файлов</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-l-2 border-slate-300 pl-4 py-1 text-xs text-slate-500 italic">
                “Теневой автоматизацией” называют практику, когда для принятия ключевых решений совет директоров использует разрозненные ручные калькуляторы, замаскированные под системные отчеты. Сделайте первый шаг к цифровой стабильности.
              </div>
            </div>

            {/* Right Form Column: Highly Optimized with Email required only */}
            <div className="lg:col-span-5" id="conversion-form-wrapper">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-950"></div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-950">
                    Получить доступ к материалам
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Доступ к интерактивной форме скоринга и текстовой версии чек-листа откроется сразу после подтверждения почты.
                  </p>
                </div>

                {submissionError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-start space-x-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{submissionError}</span>
                  </div>
                )}

                <form onSubmit={submitLead} className="space-y-4">
                  
                  {/* WORK EMAIL - COMPULSORY FIELD */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Рабочий email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Mail className="h-4 w-4" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        placeholder="cfo@company.ru"
                        className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors"
                      />
                    </div>
                  </div>

                  {/* NAME - OPTIONAL */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex justify-between">
                      <span>Имя</span>
                      <span className="text-slate-400 font-normal normal-case">необязательно</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="Александр"
                        className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors"
                      />
                    </div>
                  </div>

                  {/* COMPANY - OPTIONAL */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex justify-between">
                      <span>Компания</span>
                      <span className="text-slate-400 font-normal normal-case">необязательно</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        name="company"
                        value={formData.company}
                        onChange={handleInputChange}
                        placeholder="Название компании"
                        className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors"
                      />
                    </div>
                  </div>

                  {/* ROLE / TITLE - OPTIONAL */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex justify-between">
                      <span>Роль / Должность</span>
                      <span className="text-slate-400 font-normal normal-case">необязательно</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Briefcase className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        name="role"
                        value={formData.role}
                        onChange={handleInputChange}
                        placeholder="Например: CFO или Финансовый аналитик"
                        className="block w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Primary Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-slate-950 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-lg shadow-sm text-sm transition-all focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 flex items-center justify-center space-x-2 mt-2 cursor-pointer disabled:opacity-75"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Подготовка чек-листа...</span>
                      </>
                    ) : (
                      <>
                        <span>Получить чек-лист</span>
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </form>

                {/* Highly specific CTA text required under the form */}
                <p className="text-xs text-slate-600 text-center font-medium pt-2">
                  Материал откроется сразу после отправки. Без спама и навязчивых звонков.
                </p>

                {/* Real-time testing trigger placeholder */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Тестируете форму?</span>
                  <button 
                    onClick={handleAutofillDemo}
                    className="text-[11px] text-slate-600 hover:text-slate-950 underline font-semibold focus:outline-none decoration-dotted"
                  >
                    Заполнить демо-данными
                  </button>
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* ========================================================================= */
          /* STAGE 2: ACCESS & INTERACTIVE SCORECARD WITH MOVED SELECTOR               */
          /* ========================================================================= */
          <div className="space-y-8 max-w-4xl mx-auto" id="results-dashboard">
            
            {/* Top Thank You Box with immediate download links */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-xs text-center space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-950"></div>
              
              <div className="mx-auto h-12 w-12 bg-slate-900 rounded-full flex items-center justify-center text-white">
                <CheckCircle className="h-6 w-6" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-950">Чек-лист уже у вас</h2>
                <p className="text-sm text-slate-600 max-w-2xl mx-auto leading-relaxed">
                  Спасибо. Вы можете открыть чек-лист сразу по ссылке ниже. <br />
                  Если у вас совпало <strong>3+ признака</strong>, это уже сигнал, что управленческий факт в компании частично собирается вручную и зависит не только от системы.
                </p> 
              </div>

              {/* TWO DIRECT PRIMARY BUTTONS: Download & Ask Diagnostics */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
                <a
                  href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                    `МЕТОДИКА: 10 ПРИЗНАКОВ ТЕНЕВОЙ EXCEL-СИСТЕМЫ\n\n` +
                    SYMPTOMS.map(s => `[${checkedSymptoms[s.id-1] ? 'X' : ' '}] ${s.id}. ${s.text}`).join('\n') +
                    `\n\nРезультат скоринга: ${activeSymptomCount} из 10.\nКлассификация риска: ${currentScoreInfo.label}.\nСвяжитесь с Tabula для настройки контура.`
                  )}`}
                  download="10_signs_shadow_excel_checklist.txt"
                  className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-slate-150 hover:bg-slate-200 text-slate-900 border border-slate-300 font-semibold py-2.5 px-6 rounded-lg text-sm transition-all shadow-2xs"
                >
                  <Download className="h-4 w-4 text-slate-700" />
                  <span>Открыть/Скачать чек-лист (.txt)</span>
                </a>

                {diagnosticsStatus === 'requested' ? (
                  <button
                    disabled
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold py-2.5 px-6 rounded-lg text-sm"
                  >
                    <Check className="h-4 w-4" />
                    <span>Заявка принята. Свяжемся с вами!</span>
                  </button>
                ) : (
                  <button
                    onClick={requestDiagnostics}
                    disabled={diagnosticsStatus === 'sending'}
                    className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 bg-slate-950 hover:bg-slate-800 text-white font-semibold py-2.5 px-6 rounded-lg text-sm transition-all focus:outline-none cursor-pointer"
                  >
                    {diagnosticsStatus === 'sending' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-amber-400" />
                    )}
                    <span>Запросить диагностику</span>
                  </button>
                )}
              </div>

              <p className="text-[11px] text-slate-400">
                Диагностика проводится экспертами Tabula Consulting в формате закрытого Zoom-звонка (30-40 минут) под NDA.
              </p>
            </div>

            {/* NEW ADDED COMPONENT: Focus query selector moved to Thank You Screen */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 md:p-8 space-y-4 border border-slate-800 shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="bg-amber-400/10 p-2 rounded-lg border border-amber-400/20 text-amber-400 shrink-0">
                  <Info className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-base font-bold text-white">Если хотите, выберите, что проверить первым</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Это поможет нам структурировать отправляемую инструкцию под специфику вашего финансового планирования.
                  </p>
                </div>
              </div>

              {/* Choices interactive selector block */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
                {[
                  'БДР',
                  'БДДС',
                  'Казначейство',
                  'Управленческий отчет',
                  'Пока просто заберу чек-лист'
                ].map((option) => {
                  const isOptionSelected = formData.areaToCheck === option;
                  return (
                    <button
                      key={option}
                      onClick={() => handleAreaSelect(option)}
                      type="button"
                      className={`p-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                        isOptionSelected
                          ? 'bg-amber-400 border-amber-400 text-slate-950 shadow-sm'
                          : 'bg-slate-950 border-slate-800 hover:bg-slate-800/80 text-slate-300'
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              
              <div className="text-right">
                <span className="text-[10px] text-slate-500 font-mono">
                  Выбранный селектор: <strong className="text-slate-300 uppercase">{formData.areaToCheck}</strong>
                </span>
              </div>
            </div>

            {/* Interactive Express Calculator Scoreboard */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 space-y-6">
              
              <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">
                    Интерактивный калькулятор симптомов «теневого» учета
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Отметьте галочками признаки, которые наиболее точно отражают текущую картину в вашей финансовой службе.
                  </p>
                </div>
                
                <div className="flex items-center space-x-2 shrink-0">
                  <span className="text-xs text-slate-400 font-mono">Выявлено симптомов:</span>
                  <div className="text-xl font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 font-mono">
                    {activeSymptomCount} <span className="text-xs text-slate-400 font-normal">/ 10</span>
                  </div>
                </div>
              </div>

              {/* Progress and Level Alert Details */}
              <div className="space-y-3">
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div 
                    className={`h-full transition-all duration-500 ${currentScoreInfo.barColor}`} 
                    style={{ width: `${Math.max(activeSymptomCount * 10, 5)}%` }}
                  ></div>
                </div>
                
                <div className={`p-4 rounded-xl border flex items-start space-x-3 transition-colors duration-300 ${currentScoreInfo.color}`}>
                  <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest font-mono">
                      Интерпретация: {currentScoreInfo.label} ({currentScoreInfo.level})
                    </h4>
                    <p className="text-xs mt-1 leading-relaxed font-medium">
                      {currentScoreInfo.desc}
                    </p>
                  </div>
                </div>
              </div>

              {/* Eleven Symptoms list layout */}
              <div className="grid grid-cols-1 gap-3 pt-2">
                {SYMPTOMS.map((symptom, idx) => {
                  const isChecked = checkedSymptoms[idx];
                  return (
                    <div 
                      key={symptom.id}
                      onClick={() => handleSymptomToggle(idx)}
                      className={`p-4 rounded-xl border transition-all duration-150 cursor-pointer flex items-start space-x-3 select-none ${
                        isChecked 
                          ? 'bg-slate-950 text-white border-slate-950 shadow-sm' 
                          : 'bg-slate-50 hover:bg-slate-100/50 border-slate-200 text-slate-800'
                      }`}
                    >
                      <div className="pt-0.5">
                        <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                          isChecked 
                            ? 'bg-white text-slate-950' 
                            : 'border-2 border-slate-300'
                        }`}>
                          {isChecked && <Check className="h-3.5 w-3.5 stroke-[4]" />}
                        </div>
                      </div>

                      <div className="text-xs md:text-sm flex-grow">
                        <span className="font-mono text-[10px] opacity-50 block mb-0.5">ВЫЯВЛЯЕМЫЙ ПРИЗНАК #{symptom.id}</span>
                        <p className="font-semibold leading-relaxed">{symptom.text}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Visual scoring ranges definition legend */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Шкала оценки рисков (методический регламент):</span>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px] text-slate-600">
                  <div className="p-2 bg-white rounded border border-slate-150">
                    <span className="font-bold text-emerald-600 block">0-2 признака</span>
                    <span className="text-[10px] text-slate-400 block mb-1">Низкий риск</span>
                    <p className="leading-tight text-slate-500">Система под полным финансовым контролем.</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-150">
                    <span className="font-bold text-amber-600 block">3-5 признаков</span>
                    <span className="text-[10px] text-slate-400 block mb-1">Умеренный риск</span>
                    <p className="leading-tight text-slate-500">Контур сбора финансового факта частично размыт руками.</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-150">
                    <span className="font-bold text-orange-600 block">6-8 признаков</span>
                    <span className="text-[10px] text-slate-400 block mb-1">Теневой Excel</span>
                    <p className="leading-tight text-slate-500">Существенные риски потери фокуса при внезапных кадровых изменениях.</p>
                  </div>
                  <div className="p-2 bg-white rounded border border-slate-150">
                    <span className="font-bold text-red-600 block">9-10 признаков</span>
                    <span className="text-[10px] text-slate-400 block mb-1">Критический риск</span>
                    <p className="leading-tight text-slate-500">Внешний аудит рекомендуется в оперативном порядке.</p>
                  </div>
                </div>
              </div>

              {/* Return link */}
              <div className="text-center pt-2">
                <button 
                  onClick={handleResetForm}
                  className="text-xs text-slate-500 hover:text-slate-900 underline font-semibold focus:outline-none"
                >
                  ◀ Вернуться на главную & Отправить чистую форму
                </button>
              </div>

            </div>

          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* INTEGRATION CONTROL & UTM SEEDING HUB (DOCK PANEL AT UNDERFOOTER)         */}
      {/* ========================================================================= */}
      <section className="bg-slate-950 text-slate-300 border-t border-slate-800" id="admin-hub-panel">
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
            <div className="space-y-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-400 border border-amber-400/30 uppercase tracking-widest font-mono">
                Панель Интегратора и Маркетолога
              </span>
              <h4 className="text-base font-bold text-white flex items-center space-x-2">
                <Settings className="h-4 w-4 text-amber-400" />
                <span>Генератор UTM-меток & Контроль заявок</span>
              </h4>
              <p className="text-xs text-slate-400">
                Скопируйте подготовленные ссылки для дистрибуции лид-магнита на сторонних ресурсах и проверьте состояние Bitrix24 интеграции.
              </p>
            </div>

            <div className="flex items-center space-x-2 text-xs shrink-0 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-slate-300">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="font-mono">Bitrix Webhook подключен</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* COLUMN 1: UTM links helper */}
            <div className="lg:col-span-6 space-y-4">
              <div className="space-y-3">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest block">
                  1. Готовые ссылки с UTM для выкладывания:
                </span>

                <div className="space-y-3">
                  {distributionLinks.map((link, idx) => (
                    <div key={link.badge} className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-100 bg-slate-800 tracking-wider font-mono">
                            {link.channel}
                          </span>
                          <span className="text-[11px] text-slate-500 italic font-mono">{link.desc}</span>
                        </div>
                        
                        <button
                          onClick={() => handleCopy(link.url, `dl_${idx}`)}
                          className={`text-[11px] px-2.5 py-1 rounded font-bold transition-all ${
                            copiedIndex === `dl_${idx}`
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 cursor-pointer'
                          }`}
                        >
                          {copiedIndex === `dl_${idx}` ? 'Скопировано!' : 'Копировать ссылку'}
                        </button>
                      </div>

                      <code className="block text-[10px] bg-slate-950 p-2 rounded text-amber-300 font-mono overflow-x-auto whitespace-nowrap scrollbar-thin">
                        {link.url}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* COLUMN 2: BITRIX WEBHOOK PORT */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-slate-900/40 p-5 rounded-xl border border-slate-800 space-y-4">
                
                <div>
                  <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest block mb-2">
                    2. Настройка webhook Битрикс24:
                  </span>
                  
                  <div className="space-y-2">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Для отправки лидов в CRM укажите URL вашего входящего вебхука (метод <code>crm.lead.add</code>):
                    </p>
                    
                    <input 
                      type="text" 
                      value={bitrixWebhookUrl}
                      onChange={(e) => setBitrixWebhookUrl(e.target.value)}
                      placeholder="https://yourdomain.bitrix24.ru/rest/1/xxxxxxxx/crm.lead.add.json"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white font-mono text-xs focus:ring-1 focus:ring-amber-400 focus:outline-none"
                    />
                    
                    <span className="text-[10px] text-slate-500 block leading-normal">
                      * Если оставить поле по умолчанию, лид будет логироваться в локальную базу данных и в сессию <code>console.log</code>.
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    Справочник UTM в вашей адресной строке сейчас:
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400 pt-1">
                    <div className="bg-slate-950 p-1.5 rounded">
                      <span className="text-slate-500 block">utm_source:</span>
                      <span className="text-amber-400 font-semibold">{utmParams.utm_source || '(не задан)'}</span>
                    </div>
                    <div className="bg-slate-950 p-1.5 rounded">
                      <span className="text-slate-500 block">utm_medium:</span>
                      <span className="text-amber-400 font-semibold">{utmParams.utm_medium || '(не задан)'}</span>
                    </div>
                    <div className="bg-slate-950 p-1.5 rounded">
                      <span className="text-slate-500 block">utm_campaign:</span>
                      <span className="text-amber-400 font-semibold">{utmParams.utm_campaign || '(не задан)'}</span>
                    </div>
                    <div className="bg-slate-950 p-1.5 rounded">
                      <span className="text-slate-500 block">utm_content:</span>
                      <span className="text-amber-400 font-semibold">{utmParams.utm_content || '(не задан)'}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-normal pt-2">
                    Перейдите по любой ссылке из левого блока, чтобы проверить автоматический захват UTM параметров на лету.
                  </p>
                </div>

              </div>
            </div>

          </div>

          {/* REAL TIME LEAD BOARD IN THE SCREEN (MONITOR LEADS IN REAL-TIME) */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4" id="submission-monitor">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest flex items-center space-x-1.5">
                <Database className="h-4 w-4 text-emerald-400" />
                <span>3. Таблица полученных заявок (Локальная База):</span>
              </span>
              
              <button 
                onClick={() => {
                  localStorage.removeItem('excel_lead_magnet_submissions');
                  setLeads([]);
                }}
                className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold underline focus:outline-none"
              >
                Очистить всю таблицу заявок
              </button>
            </div>

            {leads.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-500 italic">
                Таблица пока пуста. Отправьте тестовую заявку в форме выше, и данные мгновенно отобразятся в этом реестре.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-slate-400 font-mono text-[10px] uppercase">
                    <tr>
                      <th className="p-3">Дата / Время</th>
                      <th className="p-3">Рабочий Email</th>
                      <th className="p-3">Имя</th>
                      <th className="p-3">Организация и Роль</th>
                      <th className="p-3 text-center">Выборка фокуса</th>
                      <th className="p-3 text-center">Симптомов</th>
                      <th className="p-3">UTM Метки</th>
                      <th className="p-3">Статус воронки</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {leads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-slate-900/60 transition-colors">
                        <td className="p-3 whitespace-nowrap font-mono text-slate-400">
                          {lead.submittedAt}
                        </td>
                        <td className="p-3 font-semibold text-white">
                          {lead.email}
                        </td>
                        <td className="p-3">
                          {lead.name}
                        </td>
                        <td className="p-3">
                          <span className="font-medium text-slate-200 block">{lead.company}</span>
                          <span className="text-[10px] text-slate-500 block">{lead.role}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-300">
                            {lead.areaToCheck}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                            lead.selectedSymptomsScore >= 6 ? 'bg-red-500/10 text-red-400' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {lead.selectedSymptomsScore} / 10
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[10px] text-slate-400 max-w-xs truncate">
                          src={lead.utm_source} | cmp={lead.utm_campaign}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            lead.status === 'diagnostics_requested'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {lead.status === 'diagnostics_requested' ? '🔥 Хочет аудит' : 'Скачал Чек-лист'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* Corporate bottom footer */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6 text-center text-xs text-slate-500" id="brand-footer">
        <div className="max-w-6xl mx-auto space-y-1">
          <p>© {new Date().getFullYear()} Tabula Consulting. Все права защищены.</p>
          <p className="text-[10px] text-slate-400">
            Официальные материалы методического руководства по борьбе со скрытыми Excel калькуляциями. Продукт сертифицирован CFO клубами СНГ.
          </p>
        </div>
      </footer>

    </div>
  );
}
