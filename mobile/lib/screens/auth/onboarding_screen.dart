import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:dio/dio.dart';
import '../../theme.dart';
import '../../providers/auth_provider.dart';
import '../../utils/phone.dart';

/// Post-signup onboarding — collects the *minimum* info needed before the
/// user can use the app productively. Today that's:
///
/// - **Numéro Mobile Money** (required) — the MoMo number we'll pay out to.
///   Without it the whole payment loop is broken.
/// - **Nom d'entreprise** (optional but encouraged) — shown in the PDF header.
///
/// Everything else (adresse, IFU, RCCM, logo, mot de passe) stays in
/// `Réglages → Profil & entreprise` so we don't drown the user on first run.
///
/// The root router (`_AppEntry`) re-renders this every session as long as
/// `user.needsMomoSetup == true`. The user CANNOT skip — we don't want them
/// to land in an app where payments silently fail.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _phoneCtrl = TextEditingController();
  final _companyCtrl = TextEditingController();
  String _country = 'bj';
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    _country = user?.phoneCountry ?? 'bj';
    _companyCtrl.text = user?.companyName ?? '';
    // Phone is by definition empty here (that's why we're showing this
    // screen) but we still call displayPhone for safety in case the screen
    // is reached with a partial number later.
    _phoneCtrl.text = displayPhone(user?.phone, _country);
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _companyCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final raw = _phoneCtrl.text.trim();
    if (raw.isEmpty) {
      setState(() => _error = 'Le numéro Mobile Money est obligatoire.');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<AuthProvider>().updateProfile({
        'phone': toE164(raw, _country),
        'phoneCountry': _country,
        if (_companyCtrl.text.trim().isNotEmpty)
          'companyName': _companyCtrl.text.trim(),
      });
      // No navigation — _AppEntry will rebuild and route to MainScreen since
      // `needsMomoSetup` is now false.
    } on DioException catch (e) {
      setState(() {
        _error = e.response?.data?['message'] ??
            'Erreur lors de l\'enregistrement.';
      });
    } catch (_) {
      setState(() => _error = 'Erreur lors de l\'enregistrement.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    // Escape hatch — lets the user back out of an account they don't want
    // to complete onboarding for (e.g. wrong Google account).
    await context.read<AuthProvider>().logout();
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final c = getCountry(_country);

    return Scaffold(
      backgroundColor: context.appBg,
      body: SafeArea(
        child: Column(
          children: [
            // Top bar — no back button (the user can't dismiss onboarding),
            // but we expose a discreet "Se déconnecter" on the right.
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 12, 12, 0),
              child: Row(
                children: [
                  const Expanded(
                    child: Text('NexaPay',
                        style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.3)),
                  ),
                  TextButton(
                    onPressed: _loading ? null : _logout,
                    style: TextButton.styleFrom(
                      foregroundColor: context.appTextMuted,
                      minimumSize: Size.zero,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 6),
                      textStyle: const TextStyle(fontSize: 12),
                    ),
                    child: const Text('Se déconnecter'),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(22, 12, 22, 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 8),
                    Container(
                      width: 64,
                      height: 64,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppColors.primarySoft,
                        borderRadius: BorderRadius.circular(18),
                      ),
                      child: const Icon(
                        Icons.account_balance_wallet_outlined,
                        size: 30,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 18),
                    Text(
                      user?.name != null
                          ? 'Bienvenue ${user!.name.split(' ').first} 👋'
                          : 'Bienvenue 👋',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                        color: context.appText,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Encore deux infos pour configurer votre compte. '
                      'C\'est là que NexaPay vous reversera vos paiements clients.',
                      style: TextStyle(
                        fontSize: 13.5,
                        color: context.appTextMuted,
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 26),

                    if (_error != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: AppColors.statusOverdue.withOpacity(0.08),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                              color:
                                  AppColors.statusOverdue.withOpacity(0.25)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.error_outline_rounded,
                                color: AppColors.statusOverdue, size: 16),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _error!,
                                style: TextStyle(
                                    color: AppColors.statusOverdue,
                                    fontSize: 13),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Numéro Mobile Money — required
                    _Label('Numéro Mobile Money *'),
                    const SizedBox(height: 6),
                    Container(
                      decoration: BoxDecoration(
                        color: context.appSurface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: context.appBorder),
                      ),
                      child: Row(
                        children: [
                          DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: _country,
                              borderRadius: BorderRadius.circular(12),
                              onChanged: (v) => setState(() {
                                _country = v ?? _country;
                                _phoneCtrl.clear();
                              }),
                              items: kCountries
                                  .map((c) => DropdownMenuItem(
                                        value: c.code,
                                        child: Padding(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 8),
                                          child: Text('${c.flag} ${c.dial}',
                                              style: const TextStyle(
                                                  fontSize: 13)),
                                        ),
                                      ))
                                  .toList(),
                            ),
                          ),
                          Container(
                              width: 1, height: 30, color: context.appBorder),
                          Expanded(
                            child: TextField(
                              controller: _phoneCtrl,
                              keyboardType: TextInputType.phone,
                              inputFormatters: [PhoneFormatter(c.groups)],
                              decoration: InputDecoration(
                                hintText: phonePlaceholder(c.groups),
                                contentPadding:
                                    const EdgeInsets.symmetric(horizontal: 12),
                                border: InputBorder.none,
                                enabledBorder: InputBorder.none,
                                focusedBorder: InputBorder.none,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                      decoration: BoxDecoration(
                        color: AppColors.primarySoft,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                            color: AppColors.primary.withOpacity(0.18)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.info_outline_rounded,
                              size: 15, color: AppColors.primary),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Vos clients vous paieront sur ce numéro. '
                              'NexaPay vous reverse 97 % automatiquement '
                              '(commission 3 %).',
                              style: TextStyle(
                                fontSize: 11.5,
                                color: AppColors.primary,
                                height: 1.45,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),

                    // Nom d'entreprise — optional
                    _Label('Nom de votre entreprise'),
                    const SizedBox(height: 6),
                    TextField(
                      controller: _companyCtrl,
                      decoration: InputDecoration(
                        hintText: 'Ex : Studio Dolce, Plomberie Gnonlonfoun…',
                        hintStyle: TextStyle(
                            color: context.appTextSubtle, fontSize: 13),
                        prefixIcon: Icon(Icons.business_outlined,
                            size: 18, color: context.appTextMuted),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Apparaîtra dans l\'en-tête de vos devis. Vous pourrez '
                      'le modifier plus tard.',
                      style: TextStyle(
                          fontSize: 11.5, color: context.appTextSubtle),
                    ),
                    const SizedBox(height: 30),

                    SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        onPressed: _loading ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14)),
                          elevation: 0,
                          shadowColor: Colors.transparent,
                        ),
                        child: _loading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2))
                            : const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    'Terminer la configuration',
                                    style: TextStyle(
                                        fontSize: 15.5,
                                        fontWeight: FontWeight.w600),
                                  ),
                                  SizedBox(width: 8),
                                  Icon(Icons.arrow_forward_rounded, size: 18),
                                ],
                              ),
                      ),
                    ),
                    const SizedBox(height: 14),
                    Center(
                      child: Text(
                        'Les autres infos (adresse, IFU, RCCM, logo) se règlent\n'
                        'dans Réglages → Profil & entreprise.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontSize: 11.5,
                            color: context.appTextSubtle,
                            height: 1.5),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  final String text;
  const _Label(this.text);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 12.5,
        fontWeight: FontWeight.w600,
        color: context.appText,
      ),
    );
  }
}
