import { Document, Page, Text, View, Image, pdf } from '@react-pdf/renderer';
import type { Quote } from '@/types';
import { fmtXOF, fmtDateFR, validUntil } from '@/lib/utils';

// ─── Styles partagés ─────────────────────────────────────────────────────────

const s = {
  flex1: { flex: 1 } as const,
  companyName: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 2 } as const,
  billLabel: { fontSize: 9, color: '#6B7570', textTransform: 'uppercase' as const, letterSpacing: 1.2, marginBottom: 4 },
  billName: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 } as const,
  billDetails: { fontSize: 10, color: '#6B7570', lineHeight: 1.6 } as const,
  thText: { fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' as const, letterSpacing: 1 },
  tdText: { fontSize: 11 } as const,
  colDesc: { flex: 1 } as const,
  colQty: { width: 50, textAlign: 'right' as const },
  colPrix: { width: 100, textAlign: 'right' as const },
  colTotal: { width: 110, textAlign: 'right' as const },
  totalsLabel: { flex: 1, fontSize: 11, color: '#6B7570' } as const,
  totalsValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right' as const },
  grandLabel: { flex: 1, fontSize: 12, fontFamily: 'Helvetica-Bold' } as const,
  grandValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', textAlign: 'right' as const },
  footerText: { fontSize: 9, color: '#97A09B' } as const,
  notesText: { fontSize: 10, color: '#6B7570', lineHeight: 1.6 } as const,
  notesBold: { fontFamily: 'Helvetica-Bold', color: '#14201C' } as const,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initial(quote: Quote) {
  return (quote.user?.companyName || quote.user?.name || 'D')[0].toUpperCase();
}

export function getEffectiveLogo(quote: Quote): string | null {
  const u = quote.user;
  if (!u) return null;
  if (u.useProfilePhotoAsLogo !== false) return u.logoUrl ?? null;
  return u.quoteLogoUrl ?? null;
}

export async function fetchLogoBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function LogoBlock({ quote, logo, size, bgColor, textColor, radius = 8 }: {
  quote: Quote; logo: string | null; size: number;
  bgColor: string; textColor: string; radius?: number;
}) {
  if (logo) return <Image src={logo} style={{ width: size, height: size, borderRadius: radius, objectFit: 'cover' }} />;
  return (
    <View style={{ width: size, height: size, backgroundColor: bgColor, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: textColor, fontSize: size * 0.38, fontFamily: 'Helvetica-Bold' }}>{initial(quote)}</Text>
    </View>
  );
}

function TableRows({ items }: { items: Quote['items'] }) {
  return (
    <>
      {(items ?? []).map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E8E6DD', paddingVertical: 10 }}>
          <Text style={[s.tdText, s.colDesc]}>{it.description}</Text>
          <Text style={[s.tdText, s.colQty]}>{it.quantity}{it.unit ? ` ${it.unit}` : ''}</Text>
          <Text style={[s.tdText, s.colPrix]}>{it.unitPrice ? fmtXOF(it.unitPrice) : '—'}</Text>
          <Text style={[s.tdText, s.colTotal, { fontFamily: 'Helvetica-Bold' }]}>{it.total ? fmtXOF(it.total) : 'Inclus'}</Text>
        </View>
      ))}
    </>
  );
}

function TableRowsE({ items, stripeBg }: { items: Quote['items']; stripeBg: string }) {
  return (
    <>
      {(items ?? []).map((it, i) => (
        <View key={i} style={{ flexDirection: 'row', backgroundColor: i % 2 === 0 ? '#FFFFFF' : stripeBg, paddingVertical: 9, paddingHorizontal: 6 }}>
          <Text style={[s.tdText, s.colDesc]}>{it.description}</Text>
          <Text style={[s.tdText, s.colQty]}>{it.quantity}{it.unit ? ` ${it.unit}` : ''}</Text>
          <Text style={[s.tdText, s.colPrix]}>{it.unitPrice ? fmtXOF(it.unitPrice) : '—'}</Text>
          <Text style={[s.tdText, s.colTotal, { fontFamily: 'Helvetica-Bold' }]}>{it.total ? fmtXOF(it.total) : 'Inclus'}</Text>
        </View>
      ))}
    </>
  );
}

function Totals({ quote, accentColor }: { quote: Quote; accentColor: string }) {
  const items = quote.items ?? [];
  const subtotal = items.reduce((sum, it) => sum + it.total, 0);
  const tva = subtotal * (quote.taxRate / 100);
  const total = subtotal + tva;
  return (
    <View style={{ alignItems: 'flex-end', marginTop: 16 }}>
      <View style={{ width: 260 }}>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          <Text style={s.totalsLabel}>Sous-total HT</Text>
          <Text style={s.totalsValue}>{fmtXOF(subtotal)}</Text>
        </View>
        <View style={{ flexDirection: 'row', marginBottom: 6 }}>
          <Text style={s.totalsLabel}>TVA {quote.taxRate} %</Text>
          <Text style={s.totalsValue}>{fmtXOF(tva)}</Text>
        </View>
        {quote.discount > 0 && (
          <View style={{ flexDirection: 'row', marginBottom: 6 }}>
            <Text style={s.totalsLabel}>Remise</Text>
            <Text style={[s.totalsValue, { color: '#ef4444' }]}>- {fmtXOF(quote.discount)}</Text>
          </View>
        )}
        <View style={{ borderTopWidth: 1, borderTopColor: accentColor, marginVertical: 5 }} />
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <Text style={s.grandLabel}>Total TTC</Text>
          <Text style={[s.grandValue, { color: accentColor }]}>{fmtXOF(total)}</Text>
        </View>
      </View>
    </View>
  );
}

function Footer({ quote, showWatermark }: { quote: Quote; showWatermark?: boolean }) {
  const { user } = quote;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 28, alignItems: 'flex-end' }}>
      <Text style={s.footerText}>
        {user?.companyName || user?.name}{user?.rccm ? ' · RCCM ' + user.rccm : ''}{user?.ifu ? ' · IFU ' + user.ifu : ''}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {showWatermark && (
          <Text style={{ fontSize: 8, color: '#0F8F65', fontFamily: 'Helvetica-Bold' }}>
            Généré avec NexaPay ·{'  '}
          </Text>
        )}
        <Text style={s.footerText}>Page 1/1</Text>
      </View>
    </View>
  );
}

// ─── Layout A : Classique — logo gauche, DEVIS droite ────────────────────────

function LayoutA({ quote, theme, logo, showWatermark }: { quote: Quote; theme: { primary: string; billBg: string }; logo: string | null; showWatermark?: boolean }) {
  const { client, user, items = [] } = quote;
  return (
    <Document>
      <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 11, color: '#14201C', padding: '40px 48px', backgroundColor: '#FFFFFF' }}>
        <View style={{ flexDirection: 'row', marginBottom: 32, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <LogoBlock quote={quote} logo={logo} size={40} bgColor={theme.primary} textColor="#FFFFFF" radius={10} />
            <Text style={[s.companyName, { marginTop: 10 }]}>{user?.companyName || user?.name || 'Mon Entreprise'}</Text>
            <Text style={{ fontSize: 10, color: '#6B7570', lineHeight: 1.6, marginTop: 4 }}>
              {user?.address || 'Bénin'}{'\n'}
              {user?.phone || ''}{user?.email ? ' · ' + user.email : ''}{'\n'}
              {user?.ifu ? 'IFU ' + user.ifu : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 26, fontFamily: 'Helvetica-Bold', letterSpacing: -0.5, color: theme.primary }}>DEVIS</Text>
            <Text style={{ fontSize: 12, color: '#6B7570', marginTop: 2 }}>{quote.number}</Text>
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 10, color: '#6B7570' }}>Émis le <Text style={{ fontFamily: 'Helvetica-Bold', color: '#14201C' }}>{fmtDateFR(quote.issuedAt)}</Text></Text>
              <Text style={{ fontSize: 10, color: '#6B7570' }}>Valable jusqu'au <Text style={{ fontFamily: 'Helvetica-Bold', color: '#14201C' }}>{validUntil(quote.issuedAt, quote.validDays)}</Text></Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 32, backgroundColor: theme.billBg, borderRadius: 8, padding: 16, marginBottom: 24 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.billLabel}>Adressé à</Text>
            <Text style={s.billName}>{client?.name}</Text>
            <Text style={s.billDetails}>À l'attention de {client?.contact}{'\n'}{client?.city}, Bénin{'\n'}{client?.email}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.billLabel}>Objet</Text>
            <Text style={[s.billName, { fontSize: 12 }]}>{quote.title}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: theme.primary, paddingBottom: 6 }}>
          <Text style={[s.thText, s.colDesc, { color: theme.primary }]}>Désignation</Text>
          <Text style={[s.thText, s.colQty, { color: theme.primary }]}>Qté</Text>
          <Text style={[s.thText, s.colPrix, { color: theme.primary }]}>P.U.</Text>
          <Text style={[s.thText, s.colTotal, { color: theme.primary }]}>Total HT</Text>
        </View>
        <TableRows items={items} />
        <Totals quote={quote} accentColor={theme.primary} />
        {quote.notes && (
          <View style={{ backgroundColor: theme.billBg, borderRadius: 8, padding: 14, marginTop: 24 }}>
            <Text style={s.notesText}><Text style={s.notesBold}>Conditions de paiement. </Text>{quote.notes}</Text>
          </View>
        )}
        <Footer quote={quote} showWatermark={showWatermark} />
      </Page>
    </Document>
  );
}

// ─── Layout B : Dynamique — bannière colorée pleine largeur ──────────────────

function LayoutB({ quote, theme, logo, showWatermark }: { quote: Quote; theme: { headerBg: string; accent: string; billBg?: string }; logo: string | null; showWatermark?: boolean }) {
  const { client, user, items = [] } = quote;
  const billBg = theme.billBg ?? '#F5F4EE';
  return (
    <Document>
      <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 11, color: '#14201C', padding: 0, backgroundColor: '#FFFFFF' }}>
        <View style={{ backgroundColor: theme.headerBg, padding: '32px 48px 28px', flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24 }}>
          <View style={{ flex: 1 }}>
            <LogoBlock quote={quote} logo={logo} size={44} bgColor={theme.accent} textColor={theme.headerBg} radius={10} />
            <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', marginTop: 10, marginBottom: 2 }}>{user?.companyName || user?.name || 'Mon Entreprise'}</Text>
            <Text style={{ fontSize: 10, color: '#FFFFFF', opacity: 0.55, lineHeight: 1.6, marginTop: 4 }}>
              {user?.address || 'Bénin'}{'\n'}{user?.phone || ''}{user?.email ? ' · ' + user.email : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 28, fontFamily: 'Helvetica-Bold', color: theme.accent, letterSpacing: -0.5 }}>DEVIS</Text>
            <Text style={{ fontSize: 12, color: '#FFFFFF', opacity: 0.65, marginTop: 2 }}>{quote.number}</Text>
            <View style={{ marginTop: 14 }}>
              <Text style={{ fontSize: 10, color: '#FFFFFF', opacity: 0.65 }}>Émis le <Text style={{ color: theme.accent, fontFamily: 'Helvetica-Bold', opacity: 1 }}>{fmtDateFR(quote.issuedAt)}</Text></Text>
              <Text style={{ fontSize: 10, color: '#FFFFFF', opacity: 0.65 }}>Valable jusqu'au <Text style={{ color: theme.accent, fontFamily: 'Helvetica-Bold', opacity: 1 }}>{validUntil(quote.issuedAt, quote.validDays)}</Text></Text>
            </View>
          </View>
        </View>
        <View style={{ padding: '0 48px 40px' }}>
          <View style={{ flexDirection: 'row', gap: 32, backgroundColor: billBg, borderRadius: 8, padding: 16, marginBottom: 24 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.billLabel}>Adressé à</Text>
              <Text style={s.billName}>{client?.name}</Text>
              <Text style={s.billDetails}>À l'attention de {client?.contact}{'\n'}{client?.city}, Bénin{'\n'}{client?.email}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.billLabel}>Objet</Text>
              <Text style={[s.billName, { fontSize: 12 }]}>{quote.title}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: theme.headerBg, paddingBottom: 6 }}>
            <Text style={[s.thText, s.colDesc, { color: theme.headerBg }]}>Désignation</Text>
            <Text style={[s.thText, s.colQty, { color: theme.headerBg }]}>Qté</Text>
            <Text style={[s.thText, s.colPrix, { color: theme.headerBg }]}>P.U.</Text>
            <Text style={[s.thText, s.colTotal, { color: theme.headerBg }]}>Total HT</Text>
          </View>
          <TableRows items={items} />
          <Totals quote={quote} accentColor={theme.accent} />
          {quote.notes && (
            <View style={{ backgroundColor: billBg, borderRadius: 8, padding: 14, marginTop: 24 }}>
              <Text style={s.notesText}><Text style={s.notesBold}>Conditions de paiement. </Text>{quote.notes}</Text>
            </View>
          )}
          <Footer quote={quote} showWatermark={showWatermark} />
        </View>
      </Page>
    </Document>
  );
}

// ─── Layout C : Épuré — typographie pure, ligne accent ───────────────────────

function LayoutC({ quote, accent, logo, showWatermark }: { quote: Quote; accent: string; logo: string | null; showWatermark?: boolean }) {
  const { client, user, items = [] } = quote;
  return (
    <Document>
      <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 11, color: '#14201C', padding: '40px 48px', backgroundColor: '#FFFFFF' }}>
        <View style={{ flexDirection: 'row', marginBottom: 20, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            {logo ? (
              <Image src={logo} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', marginBottom: 10 }} />
            ) : (
              <View style={{ width: 44, height: 44, backgroundColor: accent, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                <Text style={{ color: '#fff', fontSize: 17, fontFamily: 'Helvetica-Bold' }}>{initial(quote)}</Text>
              </View>
            )}
            <Text style={{ fontSize: 16, fontFamily: 'Helvetica-Bold', color: accent, marginBottom: 4 }}>{user?.companyName || user?.name || 'Mon Entreprise'}</Text>
            <Text style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.7 }}>
              {user?.address || 'Bénin'}{'\n'}{user?.phone || ''}{user?.email ? ' · ' + user.email : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 28, fontFamily: 'Helvetica-Bold', color: accent, letterSpacing: -0.5 }}>DEVIS</Text>
            <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{quote.number}</Text>
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 10, color: '#94a3b8' }}>Émis le <Text style={{ color: '#334155', fontFamily: 'Helvetica-Bold' }}>{fmtDateFR(quote.issuedAt)}</Text></Text>
              <Text style={{ fontSize: 10, color: '#94a3b8' }}>Valable jusqu'au <Text style={{ color: '#334155', fontFamily: 'Helvetica-Bold' }}>{validUntil(quote.issuedAt, quote.validDays)}</Text></Text>
            </View>
          </View>
        </View>
        <View style={{ borderTopWidth: 2, borderTopColor: accent, marginBottom: 20 }} />
        <View style={{ flexDirection: 'row', gap: 32, marginBottom: 28 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, color: accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Adressé à</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>{client?.name}</Text>
            <Text style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6 }}>À l'attention de {client?.contact}{'\n'}{client?.city}, Bénin{'\n'}{client?.email}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 9, color: accent, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Objet</Text>
            <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold' }}>{quote.title}</Text>
          </View>
        </View>
        <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', marginBottom: 10 }} />
        <View style={{ flexDirection: 'row', paddingBottom: 6 }}>
          <Text style={[s.thText, s.colDesc, { color: accent }]}>Désignation</Text>
          <Text style={[s.thText, s.colQty, { color: accent }]}>Qté</Text>
          <Text style={[s.thText, s.colPrix, { color: accent }]}>P.U.</Text>
          <Text style={[s.thText, s.colTotal, { color: accent }]}>Total HT</Text>
        </View>
        <View style={{ borderTopWidth: 1.5, borderTopColor: accent }} />
        <TableRows items={items} />
        <Totals quote={quote} accentColor={accent} />
        {quote.notes && (
          <View style={{ borderLeftWidth: 3, borderLeftColor: accent, paddingLeft: 12, marginTop: 24 }}>
            <Text style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6 }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: '#334155' }}>Conditions de paiement. </Text>{quote.notes}
            </Text>
          </View>
        )}
        <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, marginTop: 28, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={s.footerText}>{user?.companyName || user?.name}{user?.rccm ? ' · RCCM ' + user.rccm : ''}{user?.ifu ? ' · IFU ' + user.ifu : ''}</Text>
          <Text style={s.footerText}>Page 1/1</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Layout D : Moderne — colonne latérale gauche ────────────────────────────

function LayoutD({ quote, theme, logo, showWatermark }: { quote: Quote; theme: { sidebarBg: string; sidebarText: string; accent: string }; logo: string | null; showWatermark?: boolean }) {
  const { client, user, items = [] } = quote;
  return (
    <Document>
      <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 11, color: '#14201C', padding: 0, backgroundColor: '#FFFFFF', flexDirection: 'row' }}>
        <View style={{ width: 170, backgroundColor: theme.sidebarBg, padding: '36px 20px', flexDirection: 'column', gap: 24 }}>
          <LogoBlock quote={quote} logo={logo} size={48} bgColor={theme.accent} textColor={theme.sidebarBg} radius={12} />
          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: theme.sidebarText, marginBottom: 3 }}>{user?.companyName || user?.name || 'Mon Entreprise'}</Text>
            <Text style={{ fontSize: 9, color: theme.sidebarText, opacity: 0.6, lineHeight: 1.7 }}>{user?.address || 'Bénin'}{'\n'}{user?.phone || ''}{'\n'}{user?.email || ''}</Text>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: theme.accent, opacity: 0.3 }} />
          <View>
            <Text style={{ fontSize: 9, color: theme.accent, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>Adressé à</Text>
            <Text style={{ fontSize: 11, fontFamily: 'Helvetica-Bold', color: theme.sidebarText, marginBottom: 3 }}>{client?.name}</Text>
            <Text style={{ fontSize: 9, color: theme.sidebarText, opacity: 0.6, lineHeight: 1.7 }}>{client?.contact}{'\n'}{client?.city}, Bénin{'\n'}{client?.email}</Text>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: theme.accent, opacity: 0.3 }} />
          <View>
            <Text style={{ fontSize: 9, color: theme.accent, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 5 }}>Dates</Text>
            <Text style={{ fontSize: 9, color: theme.sidebarText, opacity: 0.65, marginBottom: 3 }}>Émis le</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: theme.sidebarText, marginBottom: 6 }}>{fmtDateFR(quote.issuedAt)}</Text>
            <Text style={{ fontSize: 9, color: theme.sidebarText, opacity: 0.65, marginBottom: 3 }}>Valable jusqu'au</Text>
            <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: theme.sidebarText }}>{validUntil(quote.issuedAt, quote.validDays)}</Text>
          </View>
        </View>
        <View style={{ flex: 1, padding: '36px 36px 36px 32px' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
            <Text style={{ fontSize: 28, fontFamily: 'Helvetica-Bold', color: theme.accent, letterSpacing: -0.5 }}>DEVIS</Text>
            <Text style={{ fontSize: 12, color: '#6B7570' }}>{quote.number}</Text>
          </View>
          <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 20 }}>{quote.title}</Text>
          <View style={{ flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: theme.accent, paddingBottom: 6 }}>
            <Text style={[s.thText, s.colDesc, { color: theme.accent }]}>Désignation</Text>
            <Text style={[s.thText, s.colQty, { color: theme.accent }]}>Qté</Text>
            <Text style={[s.thText, s.colPrix, { color: theme.accent }]}>P.U.</Text>
            <Text style={[s.thText, s.colTotal, { color: theme.accent }]}>Total HT</Text>
          </View>
          <TableRows items={items} />
          <Totals quote={quote} accentColor={theme.accent} />
          {quote.notes && (
            <View style={{ backgroundColor: '#f8fafc', borderRadius: 6, padding: 12, marginTop: 20 }}>
              <Text style={s.notesText}><Text style={s.notesBold}>Conditions. </Text>{quote.notes}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 20 }}>
            <Text style={s.footerText}>{user?.ifu ? 'IFU ' + user.ifu : ''}</Text>
            <Text style={s.footerText}>Page 1/1</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── Layout E : Corporate — tableau avec header coloré + rangées alternées ───

function LayoutE({ quote, theme, logo, showWatermark }: { quote: Quote; theme: { primary: string; headerRowBg: string; headerRowText: string; stripeBg: string; billBg: string }; logo: string | null; showWatermark?: boolean }) {
  const { client, user, items = [] } = quote;
  return (
    <Document>
      <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 11, color: '#14201C', padding: '40px 48px', backgroundColor: '#FFFFFF' }}>
        <View style={{ flexDirection: 'row', marginBottom: 28, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <LogoBlock quote={quote} logo={logo} size={42} bgColor={theme.primary} textColor="#FFFFFF" radius={6} />
            <Text style={[s.companyName, { marginTop: 10 }]}>{user?.companyName || user?.name || 'Mon Entreprise'}</Text>
            <Text style={{ fontSize: 10, color: '#6B7570', lineHeight: 1.6, marginTop: 4 }}>
              {user?.address || 'Bénin'}{'\n'}{user?.phone || ''}{user?.email ? ' · ' + user.email : ''}{'\n'}{user?.ifu ? 'IFU ' + user.ifu : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ backgroundColor: theme.primary, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 8 }}>
              <Text style={{ fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#FFFFFF', letterSpacing: -0.3 }}>DEVIS</Text>
            </View>
            <Text style={{ fontSize: 12, color: '#6B7570' }}>{quote.number}</Text>
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 10, color: '#6B7570' }}>Émis le <Text style={{ fontFamily: 'Helvetica-Bold', color: '#14201C' }}>{fmtDateFR(quote.issuedAt)}</Text></Text>
              <Text style={{ fontSize: 10, color: '#6B7570' }}>Valable jusqu'au <Text style={{ fontFamily: 'Helvetica-Bold', color: '#14201C' }}>{validUntil(quote.issuedAt, quote.validDays)}</Text></Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 32, backgroundColor: theme.billBg, borderRadius: 6, padding: 16, marginBottom: 20 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.billLabel}>Adressé à</Text>
            <Text style={s.billName}>{client?.name}</Text>
            <Text style={s.billDetails}>À l'attention de {client?.contact}{'\n'}{client?.city}, Bénin{'\n'}{client?.email}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.billLabel}>Objet</Text>
            <Text style={[s.billName, { fontSize: 12 }]}>{quote.title}</Text>
          </View>
        </View>
        {/* Table header colorée */}
        <View style={{ flexDirection: 'row', backgroundColor: theme.headerRowBg, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 4 }}>
          <Text style={[s.thText, s.colDesc, { color: theme.headerRowText }]}>Désignation</Text>
          <Text style={[s.thText, s.colQty, { color: theme.headerRowText }]}>Qté</Text>
          <Text style={[s.thText, s.colPrix, { color: theme.headerRowText }]}>P.U.</Text>
          <Text style={[s.thText, s.colTotal, { color: theme.headerRowText }]}>Total HT</Text>
        </View>
        <TableRowsE items={items} stripeBg={theme.stripeBg} />
        <Totals quote={quote} accentColor={theme.primary} />
        {quote.notes && (
          <View style={{ backgroundColor: theme.billBg, borderRadius: 6, padding: 14, marginTop: 24 }}>
            <Text style={s.notesText}><Text style={s.notesBold}>Conditions de paiement. </Text>{quote.notes}</Text>
          </View>
        )}
        <Footer quote={quote} showWatermark={showWatermark} />
      </Page>
    </Document>
  );
}

// ─── Layout F : Épuré barre gauche — bordure verticale colorée ───────────────

function LayoutF({ quote, accent, logo, showWatermark }: { quote: Quote; accent: string; logo: string | null; showWatermark?: boolean }) {
  const { client, user, items = [] } = quote;
  return (
    <Document>
      <Page size="A4" style={{ fontFamily: 'Helvetica', fontSize: 11, color: '#14201C', padding: 0, backgroundColor: '#FFFFFF', flexDirection: 'row' }}>
        <View style={{ width: 5, backgroundColor: accent }} />
        <View style={{ flex: 1, padding: '40px 48px 40px 43px' }}>
          <View style={{ flexDirection: 'row', marginBottom: 28, alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <LogoBlock quote={quote} logo={logo} size={38} bgColor={accent} textColor="#FFFFFF" radius={6} />
              <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 2 }}>{user?.companyName || user?.name || 'Mon Entreprise'}</Text>
              <Text style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.6 }}>
                {user?.address || 'Bénin'}{'\n'}{user?.phone || ''}{user?.email ? ' · ' + user.email : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 30, fontFamily: 'Helvetica-Bold', color: '#1e293b', letterSpacing: -0.5 }}>DEVIS</Text>
              <Text style={{ fontSize: 11, color: accent, marginTop: 2, fontFamily: 'Helvetica-Bold' }}>{quote.number}</Text>
              <View style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 10, color: '#94a3b8' }}>Émis le <Text style={{ color: '#1e293b', fontFamily: 'Helvetica-Bold' }}>{fmtDateFR(quote.issuedAt)}</Text></Text>
                <Text style={{ fontSize: 10, color: '#94a3b8' }}>Valable jusqu'au <Text style={{ color: '#1e293b', fontFamily: 'Helvetica-Bold' }}>{validUntil(quote.issuedAt, quote.validDays)}</Text></Text>
              </View>
            </View>
          </View>
          <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', marginBottom: 20 }} />
          <View style={{ flexDirection: 'row', gap: 32, marginBottom: 24 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, color: accent, textTransform: 'uppercase', letterSpacing: 1.8, marginBottom: 6, fontFamily: 'Helvetica-Bold' }}>Adressé à</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 }}>{client?.name}</Text>
              <Text style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6 }}>À l'attention de {client?.contact}{'\n'}{client?.city}, Bénin{'\n'}{client?.email}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, color: accent, textTransform: 'uppercase', letterSpacing: 1.8, marginBottom: 6, fontFamily: 'Helvetica-Bold' }}>Objet</Text>
              <Text style={{ fontSize: 13, fontFamily: 'Helvetica-Bold' }}>{quote.title}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#334155', paddingBottom: 7 }}>
            <Text style={[s.thText, s.colDesc, { color: '#334155' }]}>Désignation</Text>
            <Text style={[s.thText, s.colQty, { color: '#334155' }]}>Qté</Text>
            <Text style={[s.thText, s.colPrix, { color: '#334155' }]}>P.U.</Text>
            <Text style={[s.thText, s.colTotal, { color: '#334155' }]}>Total HT</Text>
          </View>
          <TableRows items={items} />
          <Totals quote={quote} accentColor={accent} />
          {quote.notes && (
            <View style={{ marginTop: 24, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: accent }}>
              <Text style={{ fontSize: 10, color: '#64748b', lineHeight: 1.6 }}>
                <Text style={{ fontFamily: 'Helvetica-Bold', color: '#334155' }}>Conditions. </Text>{quote.notes}
              </Text>
            </View>
          )}
          <View style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 10, marginTop: 28, flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={s.footerText}>{user?.companyName || user?.name}{user?.rccm ? ' · RCCM ' + user.rccm : ''}{user?.ifu ? ' · IFU ' + user.ifu : ''}</Text>
            <Text style={s.footerText}>Page 1/1</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── Miniatures HTML ──────────────────────────────────────────────────────────

function ThumbnailA({ primary, billBg }: { primary: string; billBg: string }) {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#fff', padding: '8%', display: 'flex', flexDirection: 'column', gap: '3%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ width: 14, height: 14, backgroundColor: primary, borderRadius: 3 }} />
          <div style={{ height: 4, width: 46, backgroundColor: '#333', borderRadius: 2, marginTop: 4 }} />
          <div style={{ height: 2, width: 52, backgroundColor: '#e0e0e0', borderRadius: 2 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ height: 9, width: 34, backgroundColor: primary, borderRadius: 2 }} />
          <div style={{ height: 2, width: 26, backgroundColor: '#ccc', borderRadius: 2 }} />
          <div style={{ height: 2, width: 42, backgroundColor: '#e0e0e0', borderRadius: 2, marginTop: 3 }} />
          <div style={{ height: 2, width: 38, backgroundColor: '#e0e0e0', borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ backgroundColor: billBg, borderRadius: 4, padding: '5%', display: 'flex', gap: '8%', marginTop: '2%' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 2, width: '50%', backgroundColor: '#bbb', borderRadius: 2 }} />
          <div style={{ height: 4, width: '80%', backgroundColor: '#444', borderRadius: 2 }} />
          <div style={{ height: 2, width: '65%', backgroundColor: '#ccc', borderRadius: 2 }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 2, width: '50%', backgroundColor: '#bbb', borderRadius: 2 }} />
          <div style={{ height: 4, width: '75%', backgroundColor: '#444', borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ borderBottom: `2px solid ${primary}`, paddingBottom: 3, display: 'flex', gap: 4, marginTop: '3%' }}>
        <div style={{ flex: 1, height: 2, backgroundColor: primary, borderRadius: 2, opacity: 0.5 }} />
        <div style={{ height: 2, width: '8%', backgroundColor: primary, borderRadius: 2, opacity: 0.5 }} />
        <div style={{ height: 2, width: '16%', backgroundColor: primary, borderRadius: 2, opacity: 0.5 }} />
        <div style={{ height: 2, width: '16%', backgroundColor: primary, borderRadius: 2, opacity: 0.5 }} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: 'flex', borderBottom: '1px solid #eee', padding: '3px 0', gap: 4 }}>
          <div style={{ flex: 1, height: 2, backgroundColor: '#ddd', borderRadius: 2 }} />
          <div style={{ height: 2, width: '8%', backgroundColor: '#ddd', borderRadius: 2 }} />
          <div style={{ height: 2, width: '16%', backgroundColor: '#ddd', borderRadius: 2 }} />
          <div style={{ height: 2, width: '16%', backgroundColor: '#bbb', borderRadius: 2 }} />
        </div>
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, marginTop: '3%' }}>
        <div style={{ width: '46%', borderTop: `1.5px solid ${primary}`, margin: '2px 0' }} />
        <div style={{ display: 'flex', gap: 8, width: '46%', alignItems: 'center' }}>
          <div style={{ flex: 1, height: 3, backgroundColor: '#555', borderRadius: 2 }} />
          <div style={{ height: 5, width: '38%', backgroundColor: primary, borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '3%' }}>
        <div style={{ height: 2, width: '38%', backgroundColor: '#e5e5e5', borderRadius: 2 }} />
        <div style={{ height: 2, width: '10%', backgroundColor: '#e5e5e5', borderRadius: 2 }} />
      </div>
    </div>
  );
}

function ThumbnailB({ headerBg, accent }: { headerBg: string; accent: string }) {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ backgroundColor: headerBg, padding: '8% 8% 7%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ width: 14, height: 14, backgroundColor: accent, borderRadius: 3 }} />
          <div style={{ height: 4, width: 42, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 2, marginTop: 4 }} />
          <div style={{ height: 2, width: 48, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ height: 9, width: 36, backgroundColor: accent, borderRadius: 2 }} />
          <div style={{ height: 2, width: 26, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 2 }} />
          <div style={{ height: 2, width: 44, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, marginTop: 3 }} />
          <div style={{ height: 2, width: 38, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ flex: 1, padding: '4% 8%', display: 'flex', flexDirection: 'column', gap: '4%' }}>
        <div style={{ backgroundColor: '#F5F4EE', borderRadius: 3, padding: '5%', display: 'flex', gap: '8%' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ height: 2, width: '50%', backgroundColor: '#bbb', borderRadius: 2 }} />
            <div style={{ height: 4, width: '80%', backgroundColor: '#444', borderRadius: 2 }} />
            <div style={{ height: 2, width: '65%', backgroundColor: '#ccc', borderRadius: 2 }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ height: 2, width: '50%', backgroundColor: '#bbb', borderRadius: 2 }} />
            <div style={{ height: 4, width: '75%', backgroundColor: '#444', borderRadius: 2 }} />
          </div>
        </div>
        <div style={{ borderBottom: `2px solid ${headerBg}`, paddingBottom: 3, display: 'flex', gap: 4 }}>
          <div style={{ flex: 1, height: 2, backgroundColor: '#999', borderRadius: 2 }} />
          <div style={{ height: 2, width: '8%', backgroundColor: '#999', borderRadius: 2 }} />
          <div style={{ height: 2, width: '16%', backgroundColor: '#999', borderRadius: 2 }} />
          <div style={{ height: 2, width: '16%', backgroundColor: '#999', borderRadius: 2 }} />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', borderBottom: '1px solid #eee', padding: '2px 0', gap: 4 }}>
            <div style={{ flex: 1, height: 2, backgroundColor: '#ddd', borderRadius: 2 }} />
            <div style={{ height: 2, width: '8%', backgroundColor: '#ddd', borderRadius: 2 }} />
            <div style={{ height: 2, width: '16%', backgroundColor: '#ddd', borderRadius: 2 }} />
            <div style={{ height: 2, width: '16%', backgroundColor: '#bbb', borderRadius: 2 }} />
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, marginTop: '2%' }}>
          <div style={{ width: '46%', borderTop: `1.5px solid ${headerBg}`, margin: '1px 0' }} />
          <div style={{ display: 'flex', gap: 8, width: '46%', alignItems: 'center' }}>
            <div style={{ flex: 1, height: 3, backgroundColor: '#555', borderRadius: 2 }} />
            <div style={{ height: 5, width: '38%', backgroundColor: accent, borderRadius: 2 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ThumbnailC({ accent }: { accent: string }) {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#fff', padding: '8%', display: 'flex', flexDirection: 'column', gap: '3%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 5, width: 50, backgroundColor: accent, borderRadius: 2 }} />
          <div style={{ height: 2, width: 50, backgroundColor: '#e2e8f0', borderRadius: 2 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ height: 9, width: 34, backgroundColor: accent, borderRadius: 2 }} />
          <div style={{ height: 2, width: 26, backgroundColor: '#e2e8f0', borderRadius: 2 }} />
          <div style={{ height: 2, width: 42, backgroundColor: '#e2e8f0', borderRadius: 2, marginTop: 3 }} />
        </div>
      </div>
      <div style={{ borderTop: `2px solid ${accent}`, margin: '2% 0' }} />
      <div style={{ display: 'flex', gap: '8%' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 2, width: '50%', backgroundColor: accent, borderRadius: 2, opacity: 0.7 }} />
          <div style={{ height: 4, width: '78%', backgroundColor: '#333', borderRadius: 2 }} />
          <div style={{ height: 2, width: '62%', backgroundColor: '#cbd5e1', borderRadius: 2 }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 2, width: '50%', backgroundColor: accent, borderRadius: 2, opacity: 0.7 }} />
          <div style={{ height: 4, width: '80%', backgroundColor: '#333', borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ borderTop: '1px solid #e2e8f0', margin: '1% 0' }} />
      <div style={{ borderBottom: `1.5px solid ${accent}`, paddingBottom: 3, display: 'flex', gap: 4 }}>
        <div style={{ flex: 1, height: 2, backgroundColor: accent, borderRadius: 2, opacity: 0.6 }} />
        <div style={{ height: 2, width: '8%', backgroundColor: accent, borderRadius: 2, opacity: 0.6 }} />
        <div style={{ height: 2, width: '16%', backgroundColor: accent, borderRadius: 2, opacity: 0.6 }} />
        <div style={{ height: 2, width: '16%', backgroundColor: accent, borderRadius: 2, opacity: 0.6 }} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', padding: '3px 0', gap: 4 }}>
          <div style={{ flex: 1, height: 2, backgroundColor: '#e2e8f0', borderRadius: 2 }} />
          <div style={{ height: 2, width: '8%', backgroundColor: '#e2e8f0', borderRadius: 2 }} />
          <div style={{ height: 2, width: '16%', backgroundColor: '#e2e8f0', borderRadius: 2 }} />
          <div style={{ height: 2, width: '16%', backgroundColor: '#bbb', borderRadius: 2 }} />
        </div>
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, marginTop: '3%' }}>
        <div style={{ width: '46%', borderTop: `2px solid ${accent}`, margin: '2px 0' }} />
        <div style={{ display: 'flex', gap: 8, width: '46%', alignItems: 'center' }}>
          <div style={{ flex: 1, height: 3, backgroundColor: '#555', borderRadius: 2 }} />
          <div style={{ height: 5, width: '38%', backgroundColor: accent, borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '3%', display: 'flex', justifyContent: 'space-between', marginTop: 'auto' }}>
        <div style={{ height: 2, width: '38%', backgroundColor: '#e5e5e5', borderRadius: 2 }} />
        <div style={{ height: 2, width: '10%', backgroundColor: '#e5e5e5', borderRadius: 2 }} />
      </div>
    </div>
  );
}

function ThumbnailD({ sidebarBg, accent }: { sidebarBg: string; accent: string }) {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#fff', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
      <div style={{ width: '32%', backgroundColor: sidebarBg, padding: '8% 5%', display: 'flex', flexDirection: 'column', gap: '10%' }}>
        <div style={{ width: 16, height: 16, backgroundColor: accent, borderRadius: 4 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 4, width: '85%', backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 2 }} />
          <div style={{ height: 2, width: '90%', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
          <div style={{ height: 2, width: '80%', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2 }} />
        </div>
        <div style={{ borderTop: `1px solid ${accent}`, opacity: 0.4 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 2, width: '55%', backgroundColor: accent, borderRadius: 2 }} />
          <div style={{ height: 4, width: '88%', backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 2 }} />
          <div style={{ height: 2, width: '75%', backgroundColor: 'rgba(255,255,255,0.35)', borderRadius: 2 }} />
        </div>
        <div style={{ borderTop: `1px solid ${accent}`, opacity: 0.4 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 2, width: '45%', backgroundColor: accent, borderRadius: 2 }} />
          <div style={{ height: 3, width: '70%', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 2 }} />
          <div style={{ height: 3, width: '80%', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ flex: 1, padding: '8% 6%', display: 'flex', flexDirection: 'column', gap: '5%' }}>
        <div style={{ height: 8, width: '60%', backgroundColor: accent, borderRadius: 2 }} />
        <div style={{ height: 4, width: '80%', backgroundColor: '#333', borderRadius: 2 }} />
        <div style={{ borderBottom: `2px solid ${accent}`, paddingBottom: 3, display: 'flex', gap: 3 }}>
          <div style={{ flex: 1, height: 2, backgroundColor: '#999', borderRadius: 2 }} />
          <div style={{ height: 2, width: '12%', backgroundColor: '#999', borderRadius: 2 }} />
          <div style={{ height: 2, width: '18%', backgroundColor: '#999', borderRadius: 2 }} />
          <div style={{ height: 2, width: '18%', backgroundColor: '#999', borderRadius: 2 }} />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', borderBottom: '1px solid #eee', padding: '2px 0', gap: 3 }}>
            <div style={{ flex: 1, height: 2, backgroundColor: '#ddd', borderRadius: 2 }} />
            <div style={{ height: 2, width: '12%', backgroundColor: '#ddd', borderRadius: 2 }} />
            <div style={{ height: 2, width: '18%', backgroundColor: '#ddd', borderRadius: 2 }} />
            <div style={{ height: 2, width: '18%', backgroundColor: '#bbb', borderRadius: 2 }} />
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, marginTop: 'auto' }}>
          <div style={{ width: '50%', borderTop: `1.5px solid ${accent}`, margin: '1px 0' }} />
          <div style={{ display: 'flex', gap: 6, width: '50%', alignItems: 'center' }}>
            <div style={{ flex: 1, height: 3, backgroundColor: '#555', borderRadius: 2 }} />
            <div style={{ height: 5, width: '38%', backgroundColor: accent, borderRadius: 2 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ThumbnailE({ primary, headerRowBg, headerRowText, stripeBg }: { primary: string; headerRowBg: string; headerRowText: string; stripeBg: string }) {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#fff', padding: '8%', display: 'flex', flexDirection: 'column', gap: '3%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ width: 14, height: 14, backgroundColor: primary, borderRadius: 3 }} />
          <div style={{ height: 4, width: 46, backgroundColor: '#333', borderRadius: 2, marginTop: 4 }} />
          <div style={{ height: 2, width: 52, backgroundColor: '#e0e0e0', borderRadius: 2 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          <div style={{ backgroundColor: primary, borderRadius: 3, padding: '3px 7px' }}>
            <div style={{ height: 7, width: 30, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 1 }} />
          </div>
          <div style={{ height: 2, width: 26, backgroundColor: '#ccc', borderRadius: 2, marginTop: 3 }} />
          <div style={{ height: 2, width: 42, backgroundColor: '#e0e0e0', borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ backgroundColor: '#f5f5f5', borderRadius: 4, padding: '4% 4%', display: 'flex', gap: '8%', marginTop: '2%' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 2, width: '50%', backgroundColor: '#bbb', borderRadius: 2 }} />
          <div style={{ height: 4, width: '80%', backgroundColor: '#444', borderRadius: 2 }} />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ height: 2, width: '50%', backgroundColor: '#bbb', borderRadius: 2 }} />
          <div style={{ height: 4, width: '75%', backgroundColor: '#444', borderRadius: 2 }} />
        </div>
      </div>
      {/* Header row colorée */}
      <div style={{ backgroundColor: headerRowBg, borderRadius: 3, padding: '4px 4px', display: 'flex', gap: 4, marginTop: '2%' }}>
        <div style={{ flex: 1, height: 2, backgroundColor: headerRowText === '#FFFFFF' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.5)', borderRadius: 2 }} />
        <div style={{ height: 2, width: '8%', backgroundColor: headerRowText === '#FFFFFF' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.5)', borderRadius: 2 }} />
        <div style={{ height: 2, width: '16%', backgroundColor: headerRowText === '#FFFFFF' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.5)', borderRadius: 2 }} />
        <div style={{ height: 2, width: '16%', backgroundColor: headerRowText === '#FFFFFF' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.5)', borderRadius: 2 }} />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ display: 'flex', backgroundColor: i % 2 === 0 ? '#fff' : stripeBg, padding: '3px 4px', gap: 4 }}>
          <div style={{ flex: 1, height: 2, backgroundColor: '#ddd', borderRadius: 2 }} />
          <div style={{ height: 2, width: '8%', backgroundColor: '#ddd', borderRadius: 2 }} />
          <div style={{ height: 2, width: '16%', backgroundColor: '#ddd', borderRadius: 2 }} />
          <div style={{ height: 2, width: '16%', backgroundColor: '#bbb', borderRadius: 2 }} />
        </div>
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, marginTop: '3%' }}>
        <div style={{ width: '46%', borderTop: `1.5px solid ${primary}`, margin: '2px 0' }} />
        <div style={{ display: 'flex', gap: 8, width: '46%', alignItems: 'center' }}>
          <div style={{ flex: 1, height: 3, backgroundColor: '#555', borderRadius: 2 }} />
          <div style={{ height: 5, width: '38%', backgroundColor: primary, borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: '2%' }}>
        <div style={{ height: 2, width: '38%', backgroundColor: '#e5e5e5', borderRadius: 2 }} />
        <div style={{ height: 2, width: '10%', backgroundColor: '#e5e5e5', borderRadius: 2 }} />
      </div>
    </div>
  );
}

function ThumbnailF({ accent }: { accent: string }) {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#fff', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
      <div style={{ width: '4%', backgroundColor: accent }} />
      <div style={{ flex: 1, padding: '8% 7%', display: 'flex', flexDirection: 'column', gap: '3%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ width: 12, height: 12, backgroundColor: accent, borderRadius: 2 }} />
            <div style={{ height: 4, width: 44, backgroundColor: '#333', borderRadius: 2, marginTop: 3 }} />
            <div style={{ height: 2, width: 48, backgroundColor: '#e0e0e0', borderRadius: 2 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            <div style={{ height: 9, width: 32, backgroundColor: '#1e293b', borderRadius: 2 }} />
            <div style={{ height: 2, width: 24, backgroundColor: accent, borderRadius: 2 }} />
            <div style={{ height: 2, width: 40, backgroundColor: '#e0e0e0', borderRadius: 2, marginTop: 3 }} />
          </div>
        </div>
        <div style={{ borderTop: '1px solid #e2e8f0', margin: '1% 0' }} />
        <div style={{ display: 'flex', gap: '8%' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ height: 2, width: '50%', backgroundColor: accent, borderRadius: 2 }} />
            <div style={{ height: 4, width: '78%', backgroundColor: '#333', borderRadius: 2 }} />
            <div style={{ height: 2, width: '62%', backgroundColor: '#ccc', borderRadius: 2 }} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ height: 2, width: '50%', backgroundColor: accent, borderRadius: 2 }} />
            <div style={{ height: 4, width: '80%', backgroundColor: '#333', borderRadius: 2 }} />
          </div>
        </div>
        <div style={{ borderBottom: '1px solid #334155', paddingBottom: 3, display: 'flex', gap: 3, marginTop: '1%' }}>
          <div style={{ flex: 1, height: 2, backgroundColor: '#888', borderRadius: 2 }} />
          <div style={{ height: 2, width: '8%', backgroundColor: '#888', borderRadius: 2 }} />
          <div style={{ height: 2, width: '16%', backgroundColor: '#888', borderRadius: 2 }} />
          <div style={{ height: 2, width: '16%', backgroundColor: '#888', borderRadius: 2 }} />
        </div>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', padding: '2px 0', gap: 3 }}>
            <div style={{ flex: 1, height: 2, backgroundColor: '#e2e8f0', borderRadius: 2 }} />
            <div style={{ height: 2, width: '8%', backgroundColor: '#e2e8f0', borderRadius: 2 }} />
            <div style={{ height: 2, width: '16%', backgroundColor: '#e2e8f0', borderRadius: 2 }} />
            <div style={{ height: 2, width: '16%', backgroundColor: '#bbb', borderRadius: 2 }} />
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, marginTop: '2%' }}>
          <div style={{ width: '46%', borderTop: `1.5px solid ${accent}`, margin: '1px 0' }} />
          <div style={{ display: 'flex', gap: 6, width: '46%', alignItems: 'center' }}>
            <div style={{ flex: 1, height: 3, backgroundColor: '#555', borderRadius: 2 }} />
            <div style={{ height: 5, width: '38%', backgroundColor: accent, borderRadius: 2 }} />
          </div>
        </div>
        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '2%', display: 'flex', justifyContent: 'space-between', marginTop: 'auto' }}>
          <div style={{ height: 2, width: '38%', backgroundColor: '#e5e5e5', borderRadius: 2 }} />
          <div style={{ height: 2, width: '10%', backgroundColor: '#e5e5e5', borderRadius: 2 }} />
        </div>
      </div>
    </div>
  );
}

// ─── Registre des templates ───────────────────────────────────────────────────

export type TemplateCategory = 'tous' | 'classique' | 'dynamique' | 'épuré' | 'moderne';

export type TemplateId =
  // Classique
  | 'classique' | 'marine' | 'bordeaux' | 'or' | 'anthracite' | 'prune' | 'sable' | 'encre'
  // Dynamique
  | 'nuit' | 'ocean' | 'foret' | 'violet' | 'rubis' | 'teal-vif' | 'amber' | 'ardoise-header'
  // Épuré
  | 'ardoise' | 'corail' | 'emeraude' | 'indigo' | 'bronze' | 'barre-rose' | 'barre-teal'
  // Moderne
  | 'sidebar-nuit' | 'sidebar-vert' | 'sidebar-bordeaux'
  | 'corp-bleu' | 'corp-sombre' | 'corp-vert' | 'corp-rouge';

export interface PDFTemplate {
  id: TemplateId;
  name: string;
  category: Exclude<TemplateCategory, 'tous'>;
  document: (q: Quote, logo: string | null, showWatermark?: boolean) => React.ReactElement;
  thumbnail: React.ReactElement;
}

export const PDF_TEMPLATES: PDFTemplate[] = [
  // ── Classique ──────────────────────────────────────────────────────────────
  { id: 'classique', name: 'Classique', category: 'classique',
    document: (q, l, w) => <LayoutA quote={q} theme={{ primary: '#0F8F65', billBg: '#F5F4EE' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailA primary="#0F8F65" billBg="#F5F4EE" /> },
  { id: 'marine', name: 'Marine', category: 'classique',
    document: (q, l, w) => <LayoutA quote={q} theme={{ primary: '#1e3a5f', billBg: '#EEF3FB' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailA primary="#1e3a5f" billBg="#EEF3FB" /> },
  { id: 'bordeaux', name: 'Bordeaux', category: 'classique',
    document: (q, l, w) => <LayoutA quote={q} theme={{ primary: '#9b1c1c', billBg: '#FEF2F2' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailA primary="#9b1c1c" billBg="#FEF2F2" /> },
  { id: 'or', name: 'Or', category: 'classique',
    document: (q, l, w) => <LayoutA quote={q} theme={{ primary: '#b45309', billBg: '#FFFBEB' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailA primary="#b45309" billBg="#FFFBEB" /> },
  { id: 'anthracite', name: 'Anthracite', category: 'classique',
    document: (q, l, w) => <LayoutA quote={q} theme={{ primary: '#374151', billBg: '#F9FAFB' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailA primary="#374151" billBg="#F9FAFB" /> },
  { id: 'prune', name: 'Prune', category: 'classique',
    document: (q, l, w) => <LayoutA quote={q} theme={{ primary: '#6d28d9', billBg: '#F5F3FF' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailA primary="#6d28d9" billBg="#F5F3FF" /> },
  { id: 'sable', name: 'Sable', category: 'classique',
    document: (q, l, w) => <LayoutA quote={q} theme={{ primary: '#78716c', billBg: '#FAFAF9' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailA primary="#78716c" billBg="#FAFAF9" /> },
  { id: 'encre', name: 'Encre', category: 'classique',
    document: (q, l, w) => <LayoutA quote={q} theme={{ primary: '#0c4a6e', billBg: '#F0F9FF' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailA primary="#0c4a6e" billBg="#F0F9FF" /> },

  // ── Dynamique ──────────────────────────────────────────────────────────────
  { id: 'nuit', name: 'Nuit Dorée', category: 'dynamique',
    document: (q, l, w) => <LayoutB quote={q} theme={{ headerBg: '#0f172a', accent: '#f59e0b', billBg: '#F8F8F4' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailB headerBg="#0f172a" accent="#f59e0b" /> },
  { id: 'ocean', name: 'Océan', category: 'dynamique',
    document: (q, l, w) => <LayoutB quote={q} theme={{ headerBg: '#1e40af', accent: '#93c5fd', billBg: '#EFF6FF' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailB headerBg="#1e40af" accent="#93c5fd" /> },
  { id: 'foret', name: 'Forêt', category: 'dynamique',
    document: (q, l, w) => <LayoutB quote={q} theme={{ headerBg: '#14532d', accent: '#86efac', billBg: '#F0FDF4' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailB headerBg="#14532d" accent="#86efac" /> },
  { id: 'violet', name: 'Violet', category: 'dynamique',
    document: (q, l, w) => <LayoutB quote={q} theme={{ headerBg: '#4c1d95', accent: '#c4b5fd', billBg: '#F5F3FF' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailB headerBg="#4c1d95" accent="#c4b5fd" /> },
  { id: 'rubis', name: 'Rubis', category: 'dynamique',
    document: (q, l, w) => <LayoutB quote={q} theme={{ headerBg: '#be123c', accent: '#fecdd3', billBg: '#FFF1F2' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailB headerBg="#be123c" accent="#fecdd3" /> },
  { id: 'teal-vif', name: 'Teal', category: 'dynamique',
    document: (q, l, w) => <LayoutB quote={q} theme={{ headerBg: '#0f766e', accent: '#5eead4', billBg: '#F0FDFA' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailB headerBg="#0f766e" accent="#5eead4" /> },
  { id: 'amber', name: 'Ambre', category: 'dynamique',
    document: (q, l, w) => <LayoutB quote={q} theme={{ headerBg: '#92400e', accent: '#fbbf24', billBg: '#FFFBEB' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailB headerBg="#92400e" accent="#fbbf24" /> },
  { id: 'ardoise-header', name: 'Ardoise', category: 'dynamique',
    document: (q, l, w) => <LayoutB quote={q} theme={{ headerBg: '#334155', accent: '#e2e8f0', billBg: '#F8FAFC' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailB headerBg="#334155" accent="#e2e8f0" /> },

  // ── Épuré ──────────────────────────────────────────────────────────────────
  { id: 'ardoise', name: 'Ardoise', category: 'épuré',
    document: (q, l, w) => <LayoutC quote={q} accent="#475569" logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailC accent="#475569" /> },
  { id: 'corail', name: 'Corail', category: 'épuré',
    document: (q, l, w) => <LayoutC quote={q} accent="#e11d48" logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailC accent="#e11d48" /> },
  { id: 'emeraude', name: 'Émeraude', category: 'épuré',
    document: (q, l, w) => <LayoutC quote={q} accent="#059669" logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailC accent="#059669" /> },
  { id: 'indigo', name: 'Indigo', category: 'épuré',
    document: (q, l, w) => <LayoutC quote={q} accent="#4338ca" logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailC accent="#4338ca" /> },
  { id: 'bronze', name: 'Bronze', category: 'épuré',
    document: (q, l, w) => <LayoutC quote={q} accent="#92400e" logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailC accent="#92400e" /> },
  { id: 'barre-rose', name: 'Barre Rose', category: 'épuré',
    document: (q, l, w) => <LayoutF quote={q} accent="#db2777" logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailF accent="#db2777" /> },
  { id: 'barre-teal', name: 'Barre Teal', category: 'épuré',
    document: (q, l, w) => <LayoutF quote={q} accent="#0891b2" logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailF accent="#0891b2" /> },

  // ── Moderne ────────────────────────────────────────────────────────────────
  { id: 'sidebar-nuit', name: 'Colonne Nuit', category: 'moderne',
    document: (q, l, w) => <LayoutD quote={q} theme={{ sidebarBg: '#1e293b', sidebarText: '#FFFFFF', accent: '#38bdf8' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailD sidebarBg="#1e293b" accent="#38bdf8" /> },
  { id: 'sidebar-vert', name: 'Colonne Vert', category: 'moderne',
    document: (q, l, w) => <LayoutD quote={q} theme={{ sidebarBg: '#064e3b', sidebarText: '#FFFFFF', accent: '#6ee7b7' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailD sidebarBg="#064e3b" accent="#6ee7b7" /> },
  { id: 'sidebar-bordeaux', name: 'Colonne Rouge', category: 'moderne',
    document: (q, l, w) => <LayoutD quote={q} theme={{ sidebarBg: '#7f1d1d', sidebarText: '#FFFFFF', accent: '#fca5a5' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailD sidebarBg="#7f1d1d" accent="#fca5a5" /> },
  { id: 'corp-bleu', name: 'Corporate Bleu', category: 'moderne',
    document: (q, l, w) => <LayoutE quote={q} theme={{ primary: '#1e40af', headerRowBg: '#1e40af', headerRowText: '#FFFFFF', stripeBg: '#EFF6FF', billBg: '#F0F7FF' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailE primary="#1e40af" headerRowBg="#1e40af" headerRowText="#FFFFFF" stripeBg="#EFF6FF" /> },
  { id: 'corp-sombre', name: 'Corporate Nuit', category: 'moderne',
    document: (q, l, w) => <LayoutE quote={q} theme={{ primary: '#f59e0b', headerRowBg: '#0f172a', headerRowText: '#FFFFFF', stripeBg: '#F8FAFC', billBg: '#F1F5F9' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailE primary="#f59e0b" headerRowBg="#0f172a" headerRowText="#FFFFFF" stripeBg="#F8FAFC" /> },
  { id: 'corp-vert', name: 'Corporate Vert', category: 'moderne',
    document: (q, l, w) => <LayoutE quote={q} theme={{ primary: '#059669', headerRowBg: '#059669', headerRowText: '#FFFFFF', stripeBg: '#F0FDF4', billBg: '#F0FDF4' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailE primary="#059669" headerRowBg="#059669" headerRowText="#FFFFFF" stripeBg="#F0FDF4" /> },
  { id: 'corp-rouge', name: 'Corporate Rouge', category: 'moderne',
    document: (q, l, w) => <LayoutE quote={q} theme={{ primary: '#dc2626', headerRowBg: '#dc2626', headerRowText: '#FFFFFF', stripeBg: '#FEF2F2', billBg: '#FFF5F5' }} logo={l} showWatermark={w} />,
    thumbnail: <ThumbnailE primary="#dc2626" headerRowBg="#dc2626" headerRowText="#FFFFFF" stripeBg="#FEF2F2" /> },
];

// ─── Téléchargement ───────────────────────────────────────────────────────────

export async function downloadWithTemplate(quote: Quote, templateId: TemplateId, userPlan?: string) {
  const blob = await generatePdfBlobWithTemplate(quote, templateId, userPlan);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${quote.number}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function generatePdfBlobWithTemplate(quote: Quote, templateId: TemplateId, userPlan?: string) {
  const effectiveLogoUrl = getEffectiveLogo(quote);
  const logo = effectiveLogoUrl ? await fetchLogoBase64(effectiveLogoUrl) : null;
  const tmpl = PDF_TEMPLATES.find((t) => t.id === templateId) ?? PDF_TEMPLATES[0];
  const showWatermark = !userPlan || userPlan === 'FREE';
  const doc = tmpl.document(quote, logo, showWatermark);
  return pdf(doc).toBlob();
}
