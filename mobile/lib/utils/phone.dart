import 'package:flutter/services.dart';

// ── Country data ───────────────────────────────────────────────────────────────

class CountryInfo {
  final String code;
  final String flag;
  final String name;
  final String dial;       // "+229"
  final List<int> groups;  // local digit grouping
  final List<String> momoNetworks;

  const CountryInfo({
    required this.code,
    required this.flag,
    required this.name,
    required this.dial,
    required this.groups,
    required this.momoNetworks,
  });
}

const kCountries = [
  CountryInfo(
    code: 'bj', flag: '🇧🇯', name: 'Bénin',         dial: '+229',
    groups: [2, 2, 2, 2, 2],
    momoNetworks: ['MTN MoMo', 'Moov Flooz'],
  ),
  CountryInfo(
    code: 'ci', flag: '🇨🇮', name: "Côte d'Ivoire",  dial: '+225',
    groups: [2, 2, 2, 2, 2],
    momoNetworks: ['MTN MoMo', 'Orange Money', 'Wave'],
  ),
  CountryInfo(
    code: 'sn', flag: '🇸🇳', name: 'Sénégal',        dial: '+221',
    groups: [2, 3, 4],
    momoNetworks: ['Wave', 'Orange Money', 'Free Money'],
  ),
  CountryInfo(
    code: 'tg', flag: '🇹🇬', name: 'Togo',           dial: '+228',
    groups: [2, 2, 2, 2],
    momoNetworks: ['T-Money', 'Flooz (Moov)'],
  ),
  CountryInfo(
    code: 'gn', flag: '🇬🇳', name: 'Guinée',         dial: '+224',
    groups: [3, 3, 3],
    momoNetworks: ['MTN MoMo', 'Orange Money'],
  ),
  CountryInfo(
    code: 'cm', flag: '🇨🇲', name: 'Cameroun',       dial: '+237',
    groups: [3, 2, 2, 2],
    momoNetworks: ['MTN MoMo', 'Orange Money'],
  ),
];

CountryInfo getCountry(String code) =>
    kCountries.firstWhere((c) => c.code == code, orElse: () => kCountries.first);

// ── E.164 utilities ────────────────────────────────────────────────────────────

/// Local formatted phone + country code → E.164 ("+22997000000"). Idempotent.
String toE164(String localPhone, String countryCode) {
  if (localPhone.isEmpty) return '';
  final trimmed = localPhone.trim();
  if (trimmed.startsWith('+')) return trimmed.replaceAll(' ', '');
  final country = getCountry(countryCode);
  final digits = trimmed.replaceAll(RegExp(r'\D'), '');
  return '${country.dial}$digits';
}

class _E164Parsed {
  final CountryInfo country;
  final String local; // formatted local string e.g. "97 00 00 00"
  _E164Parsed(this.country, this.local);
}

/// E.164 → country + formatted local. Returns null if unrecognised.
_E164Parsed? fromE164(String e164) {
  if (!e164.startsWith('+')) return null;
  for (final country in kCountries) {
    if (e164.startsWith(country.dial)) {
      final digits = e164.substring(country.dial.length);
      return _E164Parsed(country, formatLocalDigits(digits, country.groups));
    }
  }
  return null;
}

/// Returns the local formatted string from whatever is stored (E.164 or legacy local).
String displayPhone(String? stored, String countryCode) {
  if (stored == null || stored.isEmpty) return '';
  if (stored.startsWith('+')) {
    return fromE164(stored)?.local ?? stored;
  }
  return stored;
}

/// Returns the country code from stored E.164, falling back to hint.
String phoneCountryFromStored(String? stored, String hint) {
  if (stored == null || !stored.startsWith('+')) return hint;
  return fromE164(stored)?.country.code ?? hint;
}

// ── Formatting helpers ─────────────────────────────────────────────────────────

String formatLocalDigits(String digits, List<int> groups) {
  final maxDigits = groups.fold(0, (a, b) => a + b);
  final clamped = digits.length > maxDigits ? digits.substring(0, maxDigits) : digits;
  final buf = StringBuffer();
  int pos = 0;
  for (int i = 0; i < groups.length; i++) {
    if (pos >= clamped.length) break;
    if (i > 0) buf.write(' ');
    final end = (pos + groups[i]).clamp(0, clamped.length);
    buf.write(clamped.substring(pos, end));
    pos += groups[i];
  }
  return buf.toString();
}

String phonePlaceholder(List<int> groups) =>
    groups.map((g) => '0' * g).join(' ');

/// MoMo networks for a given country as a comma-separated label
String momoLabel(String countryCode) =>
    getCountry(countryCode).momoNetworks.join(', ');

// ── TextInputFormatter ─────────────────────────────────────────────────────────

class PhoneFormatter extends TextInputFormatter {
  final List<int> groups;
  PhoneFormatter(this.groups);

  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final text = formatLocalDigits(digits, groups);
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
