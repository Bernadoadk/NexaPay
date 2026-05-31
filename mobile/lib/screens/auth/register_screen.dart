import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:dio/dio.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../utils/phone.dart';
import '../../widgets/social_login_section.dart';
import 'verify_otp_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _nameCtrl = TextEditingController();
  final _companyCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  String _phoneCountry = 'bj';
  bool _loading = false;
  String? _error;
  bool _obscure = true;

  late AnimationController _anim;
  late Animation<double> _headerFade;
  late Animation<Offset> _headerSlide;
  late Animation<double> _formFade;
  late Animation<Offset> _formSlide;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    _headerFade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _anim, curve: const Interval(0.0, 0.5, curve: Curves.easeOut)),
    );
    _headerSlide = Tween<Offset>(begin: const Offset(0, -0.2), end: Offset.zero).animate(
      CurvedAnimation(parent: _anim, curve: const Interval(0.0, 0.5, curve: Curves.easeOut)),
    );
    _formFade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _anim, curve: const Interval(0.25, 1.0, curve: Curves.easeOut)),
    );
    _formSlide = Tween<Offset>(begin: const Offset(0, 0.12), end: Offset.zero).animate(
      CurvedAnimation(parent: _anim, curve: const Interval(0.25, 1.0, curve: Curves.easeOut)),
    );

    _anim.forward();
  }

  @override
  void dispose() {
    _anim.dispose();
    _nameCtrl.dispose();
    _companyCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      final rawPhone = _phoneCtrl.text.trim();
      final verified = await context.read<AuthProvider>().register(
        _nameCtrl.text.trim(),
        _emailCtrl.text.trim(),
        _passCtrl.text,
        _companyCtrl.text.trim().isNotEmpty ? _companyCtrl.text.trim() : null,
        phone: rawPhone.isNotEmpty ? toE164(rawPhone, _phoneCountry) : null,
        phoneCountry: _phoneCountry,
      );
      if (!verified && mounted) {
        final email = context.read<AuthProvider>().pendingEmail ?? _emailCtrl.text.trim();
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => VerifyOtpScreen(email: email)),
        );
      }
    } on DioException catch (e) {
      setState(() => _error = e.response?.data?['message'] ?? 'Erreur lors de la création');
    } catch (_) {
      setState(() => _error = 'Impossible de se connecter au serveur');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Social signups never include a phone number — the root router will
  /// detect `user.needsMomoSetup == true` after the provider resolves and
  /// push the user to the OnboardingScreen automatically.
  Future<void> _googleSignup() async {
    setState(() { _loading = true; _error = null; });
    try {
      await context.read<AuthProvider>().registerWithGoogle();
    } on DioException catch (e) {
      setState(() => _error = e.response?.data?['message'] ?? 'Erreur Google');
    } catch (_) {
      setState(() => _error = 'Inscription Google impossible');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _appleSignup() async {
    setState(() => _error = null);
    await showAppleComingSoonDialog(context);
  }

  Future<void> _openLegal(String url) async {
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appBg,
      body: SafeArea(
        child: Column(
          children: [
            // Header — juste le bouton retour
            SlideTransition(
              position: _headerSlide,
              child: FadeTransition(
                opacity: _headerFade,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(4, 8, 24, 0),
                  child: Row(
                    children: [
                      IconButton(
                        icon: Icon(Icons.arrow_back_ios_new_rounded,
                            size: 18, color: context.appText),
                        onPressed: () => Navigator.pop(context),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // Corps scrollable
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 4, 24, 32),
                child: Form(
                  key: _formKey,
                  child: SlideTransition(
                    position: _formSlide,
                    child: FadeTransition(
                      opacity: _formFade,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Logo grand dans le corps
                          Center(
                            child: Builder(builder: (ctx) {
                              final isDark = ctx.watch<ThemeProvider>().effectiveIsDark(ctx);
                              return Image.asset(
                                isDark ? 'lib/assets/Logo-dark.png' : 'lib/assets/Logo.png',
                                height: 110,
                                filterQuality: FilterQuality.high,
                              );
                            }),
                          ),
                          const SizedBox(height: 24),
                          Text(
                            'Créer un compte',
                            style: TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.5,
                              color: context.appText,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Rejoignez des centaines d\'entrepreneurs béninois.',
                            style: TextStyle(
                                fontSize: 14.5, color: context.appTextMuted),
                          ),
                          const SizedBox(height: 28),

                          if (_error != null) ...[
                            _ErrorBox(message: _error!),
                            const SizedBox(height: 16),
                          ],

                          // Nom + Entreprise côte à côte
                          Row(
                            children: [
                              Expanded(
                                child: _FieldGroup(
                                  label: 'Votre nom *',
                                  child: TextFormField(
                                    controller: _nameCtrl,
                                    textInputAction: TextInputAction.next,
                                    decoration: InputDecoration(
                                      hintText: 'Kévin Aguidi',
                                      prefixIcon: Icon(Icons.person_outline_rounded,
                                          size: 18, color: context.appTextMuted),
                                    ),
                                    validator: (v) => (v == null || v.trim().isEmpty)
                                        ? 'Requis'
                                        : null,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _FieldGroup(
                                  label: 'Entreprise',
                                  child: TextFormField(
                                    controller: _companyCtrl,
                                    textInputAction: TextInputAction.next,
                                    decoration: InputDecoration(
                                      hintText: 'Optionnel',
                                      prefixIcon: Icon(Icons.business_outlined,
                                          size: 18, color: context.appTextMuted),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),

                          _FieldGroup(
                            label: 'Adresse e-mail *',
                            child: TextFormField(
                              controller: _emailCtrl,
                              keyboardType: TextInputType.emailAddress,
                              textInputAction: TextInputAction.next,
                              decoration: InputDecoration(
                                hintText: 'vous@exemple.com',
                                prefixIcon: Icon(Icons.mail_outline_rounded,
                                    size: 18, color: context.appTextMuted),
                              ),
                              validator: (v) =>
                                  (v == null || !v.contains('@')) ? 'E-mail invalide' : null,
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Phone with country selector — framed as the MoMo
                          // receiving number, since this is what becomes the
                          // user's payout target by default.
                          _FieldGroup(
                            label: 'Numéro Mobile Money *',
                            child: StatefulBuilder(
                              builder: (ctx, setPhone) => Container(
                                decoration: BoxDecoration(
                                  color: context.appSurface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: context.appBorder),
                                ),
                                child: Row(
                                  children: [
                                    DropdownButtonHideUnderline(
                                      child: DropdownButton<String>(
                                        value: _phoneCountry,
                                        borderRadius: BorderRadius.circular(12),
                                        onChanged: (v) {
                                          setState(() => _phoneCountry = v ?? _phoneCountry);
                                          setPhone(() {});
                                          _phoneCtrl.clear();
                                        },
                                        items: kCountries.map((c) => DropdownMenuItem(
                                          value: c.code,
                                          child: Padding(
                                            padding: const EdgeInsets.symmetric(horizontal: 8),
                                            child: Text('${c.flag} ${c.dial}',
                                                style: const TextStyle(fontSize: 13)),
                                          ),
                                        )).toList(),
                                      ),
                                    ),
                                    Container(width: 1, height: 32, color: context.appBorder),
                                    Expanded(
                                      child: TextField(
                                        controller: _phoneCtrl,
                                        keyboardType: TextInputType.phone,
                                        textInputAction: TextInputAction.next,
                                        inputFormatters: [PhoneFormatter(getCountry(_phoneCountry).groups)],
                                        decoration: InputDecoration(
                                          hintText: phonePlaceholder(getCountry(_phoneCountry).groups),
                                          contentPadding: const EdgeInsets.symmetric(horizontal: 12),
                                          border: InputBorder.none,
                                          enabledBorder: InputBorder.none,
                                          focusedBorder: InputBorder.none,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 8),
                          // Explainer aligned with the web sign-up flow —
                          // makes it unambiguous why we ask for this.
                          Container(
                            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                            decoration: BoxDecoration(
                              color: AppColors.primarySoft,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                  color:
                                      AppColors.primary.withOpacity(0.18)),
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
                                    'Vous pourrez le changer plus tard dans '
                                    'Réglages → Mobile Money.',
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
                          const SizedBox(height: 16),

                          _FieldGroup(
                            label: 'Mot de passe *',
                            child: TextFormField(
                              controller: _passCtrl,
                              obscureText: _obscure,
                              textInputAction: TextInputAction.done,
                              onFieldSubmitted: (_) => _submit(),
                              decoration: InputDecoration(
                                hintText: 'Minimum 8 caractères',
                                prefixIcon: Icon(Icons.lock_outline_rounded,
                                    size: 18, color: context.appTextMuted),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscure
                                        ? Icons.visibility_outlined
                                        : Icons.visibility_off_outlined,
                                    size: 18,
                                    color: context.appTextMuted,
                                  ),
                                  onPressed: () =>
                                      setState(() => _obscure = !_obscure),
                                ),
                              ),
                              validator: (v) => (v == null || v.length < 8)
                                  ? 'Minimum 8 caractères'
                                  : null,
                            ),
                          ),
                          const SizedBox(height: 28),

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
                                        Text('Créer mon compte gratuit',
                                            style: TextStyle(
                                                fontSize: 15.5,
                                                fontWeight: FontWeight.w600)),
                                        SizedBox(width: 8),
                                        Icon(Icons.arrow_forward_rounded, size: 18),
                                      ],
                                    ),
                            ),
                          ),
                          const SizedBox(height: 20),

                          // Social signup — falls into the same flow as login.
                          // Missing phone after signup triggers the onboarding
                          // screen via the root router.
                          SocialLoginSection(
                            onGoogle: _googleSignup,
                            onApple: _appleSignup,
                            disabled: _loading,
                          ),
                          const SizedBox(height: 20),

                          Wrap(
                            alignment: WrapAlignment.center,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(
                                'En créant un compte, vous acceptez nos ',
                                style: TextStyle(fontSize: 11.5, color: context.appTextSubtle),
                              ),
                              TextButton(
                                onPressed: () => _openLegal('https://nexapay-page.vercel.app/conditions-utilisation'),
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: Size.zero,
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: Text('conditions d\'utilisation', style: TextStyle(fontSize: 11.5, color: AppColors.primary)),
                              ),
                              Text(
                                ' et notre ',
                                style: TextStyle(fontSize: 11.5, color: context.appTextSubtle),
                              ),
                              TextButton(
                                onPressed: () => _openLegal('https://nexapay-page.vercel.app/politique-confidentialite'),
                                style: TextButton.styleFrom(
                                  padding: EdgeInsets.zero,
                                  minimumSize: Size.zero,
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: Text('politique de confidentialité', style: TextStyle(fontSize: 11.5, color: AppColors.primary)),
                              ),
                              Text(
                                '.',
                                style: TextStyle(fontSize: 11.5, color: context.appTextSubtle),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FieldGroup extends StatelessWidget {
  final String label;
  final Widget child;
  const _FieldGroup({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 12.5,
            fontWeight: FontWeight.w600,
            color: context.appText,
          ),
        ),
        const SizedBox(height: 6),
        child,
      ],
    );
  }
}

class _ErrorBox extends StatelessWidget {
  final String message;
  const _ErrorBox({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.statusOverdue.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.statusOverdue.withOpacity(0.25)),
      ),
      child: Row(
        children: [
          Icon(Icons.error_outline_rounded,
              color: AppColors.statusOverdue, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(message,
                style: TextStyle(
                    color: AppColors.statusOverdue, fontSize: 13.5)),
          ),
        ],
      ),
    );
  }
}
