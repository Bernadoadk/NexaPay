import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bold, CheckCircle2, Italic, List, ListOrdered, MessageCircle, Minus, Search, Send, Type, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import { feedbackApi, storesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const FALLBACK_FONTS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Poppins',
  'Nunito',
  'Raleway',
  'Merriweather',
  'Playfair Display',
  'Source Sans 3',
  'Work Sans',
  'Manrope',
  'Plus Jakarta Sans',
  'DM Sans',
];

type FontItem = { family: string; category?: string };
type ListMode = 'ordered' | 'dash' | 'dot' | null;

type SentFeedback = {
  id: string;
  subject: string;
  messageHtml: string;
  messageText: string;
  createdAt: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fontCssUrl(fonts: string[]) {
  const unique = Array.from(new Set(fonts.filter(Boolean))).slice(0, 80);
  const families = unique
    .map(font => `family=${font.replace(/ /g, '+')}:wght@400;500;600;700`)
    .join('&');
  return families ? `https://fonts.googleapis.com/css2?${families}&display=swap` : '';
}

function lineBounds(text: string, position: number) {
  const start = text.lastIndexOf('\n', Math.max(0, position - 1)) + 1;
  const nextBreak = text.indexOf('\n', position);
  const end = nextBreak === -1 ? text.length : nextBreak;
  return { start, end, line: text.slice(start, end) };
}

function stripMarker(line: string) {
  return line.replace(/^\s*(?:\d+[.)]|[-•.])\s*/, '');
}

function countOrderedBefore(text: string, position: number) {
  const before = text.slice(0, position).split('\n');
  return before.filter(line => /^\s*\d+[.)]\s+/.test(line)).length;
}

function markerFor(mode: Exclude<ListMode, null>, text: string, position: number) {
  if (mode === 'ordered') return `${Math.max(1, countOrderedBefore(text, position) + 1)}. `;
  if (mode === 'dash') return '- ';
  return '• ';
}

function textToHtml(text: string, options: { fontFamily: string; fontSize: number; bold: boolean; italic: boolean }) {
  const lines = text.split('\n');
  const chunks: string[] = [];
  let orderedOpen = false;
  let dotOpen = false;

  function closeLists() {
    if (orderedOpen) {
      chunks.push('</ol>');
      orderedOpen = false;
    }
    if (dotOpen) {
      chunks.push('</ul>');
      dotOpen = false;
    }
  }

  lines.forEach(rawLine => {
    const line = rawLine.trimEnd();
    const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
    const dash = line.match(/^\s*-\s+(.*)$/);
    const dot = line.match(/^\s*(?:•|\.)\s+(.*)$/);

    if (ordered) {
      if (dotOpen) {
        chunks.push('</ul>');
        dotOpen = false;
      }
      if (!orderedOpen) {
        chunks.push('<ol>');
        orderedOpen = true;
      }
      chunks.push(`<li>${escapeHtml(ordered[1]) || '&nbsp;'}</li>`);
      return;
    }

    if (dot) {
      if (orderedOpen) {
        chunks.push('</ol>');
        orderedOpen = false;
      }
      if (!dotOpen) {
        chunks.push('<ul>');
        dotOpen = true;
      }
      chunks.push(`<li>${escapeHtml(dot[1]) || '&nbsp;'}</li>`);
      return;
    }

    closeLists();
    if (dash) {
      chunks.push(`<p>- ${escapeHtml(dash[1]) || '&nbsp;'}</p>`);
      return;
    }
    chunks.push(line.trim() ? `<p>${escapeHtml(line)}</p>` : '<p><br/></p>');
  });

  closeLists();

  const style = [
    `font-family:${options.fontFamily}`,
    `font-size:${options.fontSize}px`,
    options.bold ? 'font-weight:700' : '',
    options.italic ? 'font-style:italic' : '',
  ].filter(Boolean).join(';');

  return `<div style="${style}">${chunks.join('')}</div>`;
}

export default function FeedbackWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const hintKey = user ? `feedback-hint-dismissed:${user.id}` : 'feedback-hint-dismissed';
  const [hintVisible, setHintVisible] = useState(() => sessionStorage.getItem(hintKey) !== '1');
  const [subject, setSubject] = useState('');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [fontSize, setFontSize] = useState(14);
  const [bodyText, setBodyText] = useState('');
  const [boldActive, setBoldActive] = useState(false);
  const [italicActive, setItalicActive] = useState(false);
  const [listMode, setListMode] = useState<ListMode>(null);
  const [fontSearch, setFontSearch] = useState('');
  const [fontMenuOpen, setFontMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState<SentFeedback[]>([]);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const fontsQuery = useQuery<FontItem[]>({
    queryKey: ['google-fonts-feedback'],
    queryFn: () => storesApi.fonts().then(r => r.data),
    enabled: open,
    staleTime: 6 * 60 * 60 * 1000,
  });

  const allFonts = useMemo(() => {
    const remote = fontsQuery.data?.map(font => font.family).filter(Boolean) ?? [];
    return Array.from(new Set([...FALLBACK_FONTS, ...remote])).sort((a, b) => a.localeCompare(b));
  }, [fontsQuery.data]);

  const filteredFonts = useMemo(() => {
    const q = fontSearch.trim().toLowerCase();
    if (!q) return allFonts;
    return allFonts.filter(font => font.toLowerCase().includes(q));
  }, [allFonts, fontSearch]);

  const previewFonts = useMemo(() => [fontFamily, ...filteredFonts.slice(0, 79)], [filteredFonts, fontFamily]);
  const messageHtml = useMemo(
    () => textToHtml(bodyText, { fontFamily, fontSize, bold: boldActive, italic: italicActive }),
    [bodyText, fontFamily, fontSize, boldActive, italicActive],
  );

  useEffect(() => {
    setHintVisible(sessionStorage.getItem(hintKey) !== '1');
  }, [hintKey]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: 'smooth' });
  }, [sent.length, open]);

  const mutation = useMutation({
    mutationFn: () => feedbackApi.create({
      subject: subject.trim(),
      messageHtml,
      messageText: bodyText.trim(),
      fontFamily,
      fontSize,
      source: 'dashboard-widget',
    }),
    onSuccess: (res) => {
      const created = res.data;
      setSent(prev => [...prev, {
        id: created.id,
        subject: created.subject,
        messageHtml: created.messageHtml,
        messageText: created.messageText,
        createdAt: created.createdAt,
      }]);
      setSubject('');
      setBodyText('');
      setListMode(null);
      setError('');
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || "Impossible d'envoyer le retour pour le moment.");
    },
  });

  function dismissHint() {
    sessionStorage.setItem(hintKey, '1');
    setHintVisible(false);
  }

  function setCaret(position: number) {
    requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(position, position);
    });
  }

  function toggleList(mode: Exclude<ListMode, null>) {
    const textarea = editorRef.current;
    const position = textarea?.selectionStart ?? bodyText.length;

    if (listMode === mode) {
      const { start, end, line } = lineBounds(bodyText, position);
      const clean = stripMarker(line);
      const next = `${bodyText.slice(0, start)}${clean}${bodyText.slice(end)}`;
      setListMode(null);
      setBodyText(next);
      setCaret(start + clean.length);
      return;
    }

    const { start, end, line } = lineBounds(bodyText, position);
    const clean = stripMarker(line);
    const marker = markerFor(mode, bodyText, start);
    const nextLine = `${marker}${clean}`;
    const next = `${bodyText.slice(0, start)}${nextLine}${bodyText.slice(end)}`;
    setListMode(mode);
    setBodyText(next);
    setCaret(start + nextLine.length);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || !listMode) return;
    event.preventDefault();

    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const marker = markerFor(listMode, bodyText, start);
    const insert = `\n${marker}`;
    const next = `${bodyText.slice(0, start)}${insert}${bodyText.slice(end)}`;
    setBodyText(next);
    setCaret(start + insert.length);
  }

  function submit() {
    const cleanSubject = subject.trim();
    const cleanMessage = bodyText.trim();
    if (cleanSubject.length < 2) {
      setError("Ajoutez un objet court pour votre retour.");
      return;
    }
    if (cleanMessage.length < 4) {
      setError('Écrivez quelques mots avant d’envoyer.');
      return;
    }
    mutation.mutate();
  }

  return (
    <>
      {open && <link rel="stylesheet" href={fontCssUrl(previewFonts)} />}
      <div className="fixed bottom-[84px] right-4 z-[60] flex flex-col items-end gap-3 lg:bottom-6 lg:right-6">
        {hintVisible && !open && (
          <div className="relative max-w-[210px] rounded-xl border border-border bg-surface px-3 py-2.5 shadow-lg">
            <button
              type="button"
              onClick={dismissHint}
              aria-label="Masquer"
              className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-md text-text-muted hover:bg-surface-2 hover:text-text"
            >
              <X size={12} />
            </button>
            <div className="pr-5 text-[13px] font-semibold text-text">Aide & retour</div>
            <div className="mt-0.5 text-[11.5px] leading-snug text-text-muted">
              Signalez un bug ou partagez votre expérience.
            </div>
            <span className="absolute -bottom-2 right-8 h-4 w-4 rotate-45 border-b border-r border-border bg-surface" />
          </div>
        )}

        {open && (
          <section
            aria-label="Aide et retour"
            className="flex h-[min(720px,calc(100vh-112px))] w-[calc(100vw-24px)] max-w-[410px] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-border bg-primary px-4 py-3 text-white">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/15">
                <MessageCircle size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold">Aide & retour</div>
                <div className="text-[11.5px] text-white/75">Votre message sera envoyé par e-mail.</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="grid h-8 w-8 place-items-center rounded-lg text-white/80 hover:bg-white/15 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div ref={transcriptRef} className="flex-1 overflow-auto bg-surface-2 p-3 scrollbar-thin">
              <div className="mb-3 max-w-[86%] rounded-2xl rounded-bl-md border border-border bg-surface px-3 py-2.5 text-[12.5px] leading-relaxed text-text-muted shadow-sm">
                Un avis, un bug ou une idée ? Écrivez votre retour ici. Ce n'est pas un live chat : votre message arrive directement par e-mail.
              </div>

              {sent.map(item => (
                <div key={item.id} className="mb-3 ml-auto max-w-[88%]">
                  <div className="rounded-2xl rounded-br-md bg-primary px-3 py-2.5 text-white shadow-sm">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-white/70">Objet</div>
                    <div className="text-[13px] font-semibold">{item.subject}</div>
                    <div
                      className="mt-2 border-t border-white/15 pt-2 text-[12.5px] leading-relaxed [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
                      dangerouslySetInnerHTML={{ __html: item.messageHtml }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-end gap-1.5 text-[11.5px] font-medium text-primary-hover">
                    <CheckCircle2 size={13} /> Message envoyé
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border bg-surface p-3">
              <label className="mb-2 block">
                <span className="mb-1 block text-[11px] font-semibold text-text-muted">Objet</span>
                <input
                  value={subject}
                  onChange={event => setSubject(event.target.value)}
                  placeholder="Bug, suggestion, avis..."
                  maxLength={160}
                  className="h-9 w-full rounded-sm border border-border-strong bg-surface px-3 text-[13px] outline-none focus:border-primary focus:ring-3 focus:ring-primary-soft"
                />
              </label>

              <div className="mb-2 rounded-lg border border-border bg-surface-2 p-1.5">
                <div className="mb-1.5 flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={() => setFontMenuOpen(value => !value)}
                      className="flex h-8 w-full items-center gap-2 rounded-md border border-border bg-surface px-2 text-left text-[12px] outline-none transition-colors hover:border-border-strong focus:border-primary"
                      style={{ fontFamily }}
                    >
                      <Type size={13} className="text-text-muted" />
                      <span className="min-w-0 flex-1 truncate">{fontFamily}</span>
                    </button>

                    {fontMenuOpen && (
                      <div className="absolute bottom-full left-0 z-20 mb-1.5 w-[270px] overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                        <div className="border-b border-border p-2">
                          <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                              value={fontSearch}
                              onChange={event => setFontSearch(event.target.value)}
                              placeholder={`Rechercher parmi ${allFonts.length} polices`}
                              className="h-8 w-full rounded-md border border-border-strong bg-surface pl-8 pr-2 text-[12px] outline-none focus:border-primary"
                            />
                          </div>
                        </div>
                        <div className="max-h-[260px] overflow-auto p-1 scrollbar-thin">
                          {filteredFonts.map(font => (
                            <button
                              key={font}
                              type="button"
                              onClick={() => {
                                setFontFamily(font);
                                setFontMenuOpen(false);
                                editorRef.current?.focus();
                              }}
                              className={[
                                'flex w-full items-center rounded-md px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-primary-soft hover:text-primary-hover',
                                font === fontFamily ? 'bg-primary-soft font-semibold text-primary-hover' : 'text-text',
                              ].join(' ')}
                              style={{ fontFamily: font }}
                            >
                              <span className="min-w-0 flex-1 truncate">{font}</span>
                            </button>
                          ))}
                          {filteredFonts.length === 0 && (
                            <div className="px-3 py-6 text-center text-[12px] text-text-muted">Aucune police trouvée.</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <select
                    value={fontSize}
                    onChange={event => setFontSize(Number(event.target.value))}
                    className="h-8 w-[74px] rounded-md border border-border bg-surface px-2 text-[12px] outline-none focus:border-primary"
                    aria-label="Taille du texte"
                  >
                    {[12, 13, 14, 15, 16, 18, 20, 22].map(size => (
                      <option key={size} value={size}>{size}px</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <ToolButton active={boldActive} label="Gras" onClick={() => setBoldActive(value => !value)}><Bold size={14} /></ToolButton>
                  <ToolButton active={italicActive} label="Italique" onClick={() => setItalicActive(value => !value)}><Italic size={14} /></ToolButton>
                  <ToolButton active={listMode === 'ordered'} label="Liste numérotée" onClick={() => toggleList('ordered')}><ListOrdered size={14} /></ToolButton>
                  <ToolButton active={listMode === 'dot'} label="Liste à points" onClick={() => toggleList('dot')}><List size={14} /></ToolButton>
                  <ToolButton active={listMode === 'dash'} label="Liste avec tiret" onClick={() => toggleList('dash')}><Minus size={14} /></ToolButton>
                </div>
              </div>

              <textarea
                ref={editorRef}
                value={bodyText}
                onChange={event => setBodyText(event.target.value)}
                onKeyDown={handleKeyDown}
                aria-label="Votre message"
                placeholder="Écrivez votre retour d’expérience..."
                className={[
                  'min-h-[104px] max-h-[170px] w-full resize-none overflow-auto rounded-lg border border-border-strong bg-surface px-3 py-2 leading-relaxed outline-none scrollbar-thin focus:border-primary focus:ring-3 focus:ring-primary-soft',
                  boldActive ? 'font-bold' : '',
                  italicActive ? 'italic' : '',
                ].join(' ')}
                style={{ fontFamily, fontSize }}
              />

              {error && <div className="mt-2 text-[12px] font-medium text-danger">{error}</div>}

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-[11px] leading-snug text-text-muted">
                  Stocké en interne et transmis par e-mail.
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  loading={mutation.isPending}
                  onClick={submit}
                  className="h-9 rounded-lg"
                >
                  <Send size={14} /> Envoyer
                </Button>
              </div>
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={() => {
            setOpen(value => !value);
            if (hintVisible) dismissHint();
          }}
          aria-label="Ouvrir Aide et retour"
          className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-white shadow-lg transition-colors hover:bg-primary-hover focus:outline-none focus:ring-4 focus:ring-primary-soft"
        >
          {open ? <X size={22} /> : <MessageCircle size={23} />}
        </button>
      </div>
    </>
  );
}

function ToolButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={[
        'grid h-8 w-8 place-items-center rounded-md border transition-colors',
        active
          ? 'border-primary bg-primary text-white shadow-sm'
          : 'border-border bg-surface text-text-muted hover:bg-primary-soft hover:text-primary-hover',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
