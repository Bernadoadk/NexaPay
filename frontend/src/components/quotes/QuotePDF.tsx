import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import type { Quote } from '@/types';
import { fmtXOF, fmtDateFR, validUntil } from '@/lib/utils';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 11, color: '#14201C', padding: '40px 48px', backgroundColor: '#FFFFFF' },
  row: { flexDirection: 'row' },
  col: { flexDirection: 'column' },
  flex1: { flex: 1 },

  // Header
  logo: { width: 36, height: 36, backgroundColor: '#0F8F65', borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logoText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Helvetica-Bold' },
  companyName: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  companyRole: { fontSize: 10, color: '#6B7570' },
  companyDetails: { fontSize: 10, color: '#6B7570', lineHeight: 1.6, marginTop: 4 },
  quoteTitle: { fontSize: 26, fontFamily: 'Helvetica-Bold', letterSpacing: -0.5 },
  quoteNumber: { fontSize: 12, color: '#6B7570', marginTop: 2 },
  dateLabel: { fontSize: 10, color: '#6B7570' },
  dateBold: { fontFamily: 'Helvetica-Bold', color: '#14201C' },

  // Bill to
  billToBox: { flexDirection: 'row', gap: 32, backgroundColor: '#F5F4EE', borderRadius: 8, padding: 16, marginBottom: 24 },
  billLabel: { fontSize: 9, color: '#6B7570', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  billName: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  billDetails: { fontSize: 10, color: '#6B7570', lineHeight: 1.6 },

  // Table
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#14201C', paddingBottom: 6, marginBottom: 0 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E8E6DD', paddingVertical: 10 },
  thText: { fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1, color: '#14201C' },
  tdText: { fontSize: 11 },
  colDesc: { flex: 1 },
  colQty: { width: 50, textAlign: 'right' },
  colPrix: { width: 100, textAlign: 'right' },
  colTotal: { width: 110, textAlign: 'right' },

  // Totals
  totalsRow: { flexDirection: 'row', marginBottom: 6 },
  totalsLabel: { flex: 1, fontSize: 11, color: '#6B7570' },
  totalsValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  totalLine: { borderTopWidth: 1, borderTopColor: '#14201C', marginVertical: 5 },
  grandLabel: { flex: 1, fontSize: 12, fontFamily: 'Helvetica-Bold' },
  grandValue: { fontSize: 18, fontFamily: 'Helvetica-Bold', textAlign: 'right' },

  // Notes
  notesBox: { backgroundColor: '#F5F4EE', borderRadius: 8, padding: 14, marginTop: 24 },
  notesText: { fontSize: 10, color: '#6B7570', lineHeight: 1.6 },
  notesBold: { fontFamily: 'Helvetica-Bold', color: '#14201C' },

  // Footer
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 },
  footerText: { fontSize: 9, color: '#97A09B' },
});

export function QuoteDocument({ quote, showWatermark = false }: { quote: Quote; showWatermark?: boolean }) {
  const { client, user, items = [] } = quote;
  const subtotal = items.reduce((s, it) => s + it.total, 0);
  const tvaAmount = subtotal * (quote.taxRate / 100);
  const total = subtotal + tvaAmount;
  const issuedDate = fmtDateFR(quote.issuedAt);
  const validDate = validUntil(quote.issuedAt, quote.validDays);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Doc header */}
        <View style={[styles.row, { marginBottom: 32, alignItems: 'flex-start' }]}>
          <View style={styles.flex1}>
            <View style={styles.logo}><Text style={styles.logoText}>D</Text></View>
            <Text style={styles.companyName}>{user?.companyName || user?.name || 'NexaPay'}</Text>
            <Text style={styles.companyRole}>Aménagement & signalétique</Text>
            <Text style={styles.companyDetails}>
              {user?.address || 'Abomey-Calavi, Bénin'}{'\n'}
              {user?.phone || ''}{user?.email ? ' · ' + user.email : ''}{'\n'}
              {user?.ifu ? 'IFU ' + user.ifu : ''}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.quoteTitle}>DEVIS</Text>
            <Text style={styles.quoteNumber}>{quote.number}</Text>
            <View style={{ marginTop: 14 }}>
              <Text style={styles.dateLabel}>Émis le <Text style={styles.dateBold}>{issuedDate}</Text></Text>
              <Text style={styles.dateLabel}>Valable jusqu'au <Text style={styles.dateBold}>{validDate}</Text></Text>
            </View>
          </View>
        </View>

        {/* Bill to */}
        <View style={styles.billToBox}>
          <View style={styles.flex1}>
            <Text style={styles.billLabel}>Adressé à</Text>
            <Text style={styles.billName}>{client?.name}</Text>
            <Text style={styles.billDetails}>
              À l'attention de {client?.contact}{'\n'}
              {client?.city}, Bénin{'\n'}
              {client?.email}
            </Text>
          </View>
          <View style={styles.flex1}>
            <Text style={styles.billLabel}>Objet</Text>
            <Text style={[styles.billName, { fontSize: 12 }]}>{quote.title}</Text>
          </View>
        </View>

        {/* Items table */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.thText, styles.colDesc]}>Désignation</Text>
          <Text style={[styles.thText, styles.colQty]}>Qté</Text>
          <Text style={[styles.thText, styles.colPrix]}>P.U.</Text>
          <Text style={[styles.thText, styles.colTotal]}>Total HT</Text>
        </View>
        {items.map((it, i) => (
          <View key={i} style={styles.tableRow}>
            <Text style={[styles.tdText, styles.colDesc]}>{it.description}</Text>
            <Text style={[styles.tdText, styles.colQty]}>{it.quantity}{it.unit ? ` ${it.unit}` : ''}</Text>
            <Text style={[styles.tdText, styles.colPrix]}>{it.unitPrice ? fmtXOF(it.unitPrice) : '—'}</Text>
            <Text style={[styles.tdText, styles.colTotal, { fontFamily: 'Helvetica-Bold' }]}>
              {it.total ? fmtXOF(it.total) : 'Inclus'}
            </Text>
          </View>
        ))}

        {/* Totals */}
        <View style={{ alignItems: 'flex-end', marginTop: 16 }}>
          <View style={{ width: 260 }}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Sous-total HT</Text>
              <Text style={styles.totalsValue}>{fmtXOF(subtotal)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>TVA {quote.taxRate} %</Text>
              <Text style={styles.totalsValue}>{fmtXOF(tvaAmount)}</Text>
            </View>
            <View style={styles.totalLine} />
            <View style={[styles.totalsRow, { alignItems: 'baseline' }]}>
              <Text style={styles.grandLabel}>Total TTC</Text>
              <Text style={styles.grandValue}>{fmtXOF(total)}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {quote.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>
              <Text style={styles.notesBold}>Conditions de paiement. </Text>
              {quote.notes}
            </Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {user?.companyName || user?.name}{user?.rccm ? ' · RCCM ' + user.rccm : ''}{user?.ifu ? ' · IFU ' + user.ifu : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {showWatermark && (
              <Text style={{ fontSize: 9, color: '#0F8F65', fontFamily: 'Helvetica-Bold' }}>
                Généré avec NexaPay ·{' '}
              </Text>
            )}
            <Text style={styles.footerText}>Page 1/1</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadQuotePDF(quote: Quote, userPlan?: string) {
  const showWatermark = !userPlan || userPlan === 'FREE';
  const blob = await pdf(<QuoteDocument quote={quote} showWatermark={showWatermark} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${quote.number}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
