import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:dio/dio.dart';
import '../../theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../widgets/social_login_section.dart';
import 'register_screen.dart';
import 'verify_otp_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  bool _loading = false;
  String? _error;
  bool _obscure = true;

  late AnimationController _anim;
  late Animation<double> _logoFade;
  late Animation<Offset> _logoSlide;
  late Animation<double> _formFade;
  late Animation<Offset> _formSlide;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );

    _logoFade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _anim, curve: const Interval(0.0, 0.5, curve: Curves.easeOut)),
    );
    _logoSlide = Tween<Offset>(begin: const Offset(0, -0.3), end: Offset.zero).animate(
      CurvedAnimation(parent: _anim, curve: const Interval(0.0, 0.5, curve: Curves.easeOut)),
    );
    _formFade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _anim, curve: const Interval(0.3, 1.0, curve: Curves.easeOut)),
    );
    _formSlide = Tween<Offset>(begin: const Offset(0, 0.15), end: Offset.zero).animate(
      CurvedAnimation(parent: _anim, curve: const Interval(0.3, 1.0, curve: Curves.easeOut)),
    );

    _anim.forward();
  }

  @override
  void dispose() {
    _anim.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _error = null; });
    try {
      final verified = await context.read<AuthProvider>().login(
        _emailCtrl.text.trim(),
        _passCtrl.text,
      );
      if (!verified && mounted) {
        final email = context.read<AuthProvider>().pendingEmail ?? _emailCtrl.text.trim();
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => VerifyOtpScreen(email: email)),
        );
      }
    } on DioException catch (e) {
      setState(() => _error = e.response?.data?['message'] ?? 'Erreur de connexion');
    } catch (_) {
      setState(() => _error = 'Impossible de se connecter au serveur');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _googleLogin() async {
    setState(() { _loading = true; _error = null; });
    try {
      await context.read<AuthProvider>().loginWithGoogle();
    } on DioException catch (e) {
      setState(() => _error = e.response?.data?['message'] ?? 'Erreur Google');
    } catch (e) {
      if (e.toString().contains('annulée') || e.toString().contains('canceled')) return;
      setState(() => _error = 'Connexion Google impossible');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _appleLogin() async {
    setState(() => _error = null);
    await showAppleComingSoonDialog(context);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appBg,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ---- Logo + titre ----
                SlideTransition(
                  position: _logoSlide,
                  child: FadeTransition(
                    opacity: _logoFade,
                    child: Column(
                      children: [
                        const SizedBox(height: 24),
                        // Logo tel quel
                        Builder(builder: (ctx) {
                          final isDark = ctx.watch<ThemeProvider>().effectiveIsDark(ctx);
                          return Image.asset(
                            isDark ? 'lib/assets/Logo-dark.png' : 'lib/assets/Logo.png',
                            height: 130,
                            filterQuality: FilterQuality.high,
                          );
                        }),
                        const SizedBox(height: 20),
                        Text(
                          'Bon retour 👋',
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.5,
                            color: context.appText,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Connectez-vous à votre espace NexaPay',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 14.5, color: context.appTextMuted),
                        ),
                        const SizedBox(height: 36),
                      ],
                    ),
                  ),
                ),

                // ---- Formulaire ----
                SlideTransition(
                  position: _formSlide,
                  child: FadeTransition(
                    opacity: _formFade,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_error != null) ...[
                          _ErrorBox(message: _error!),
                          const SizedBox(height: 16),
                        ],

                        _Label('Adresse e-mail'),
                        const SizedBox(height: 6),
                        TextFormField(
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
                        const SizedBox(height: 16),

                        _Label('Mot de passe'),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _passCtrl,
                          obscureText: _obscure,
                          textInputAction: TextInputAction.done,
                          onFieldSubmitted: (_) => _submit(),
                          decoration: InputDecoration(
                            hintText: '••••••••',
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
                              onPressed: () => setState(() => _obscure = !_obscure),
                            ),
                          ),
                          validator: (v) =>
                              (v == null || v.length < 6) ? 'Minimum 6 caractères' : null,
                        ),
                        const SizedBox(height: 28),

                        // Bouton connexion
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
                                      Text('Se connecter',
                                          style: TextStyle(
                                              fontSize: 15.5,
                                              fontWeight: FontWeight.w600)),
                                      SizedBox(width: 8),
                                      Icon(Icons.arrow_forward_rounded, size: 18),
                                    ],
                                  ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        SocialLoginSection(
                          onGoogle: _googleLogin,
                          onApple: _appleLogin,
                          disabled: _loading,
                        ),
                        const SizedBox(height: 24),

                        // Lien inscription
                        Wrap(
                          alignment: WrapAlignment.center,
                          children: [
                            Text("Pas encore de compte ? ",
                                style: TextStyle(
                                    color: context.appTextMuted, fontSize: 14)),
                            GestureDetector(
                              onTap: () => Navigator.push(
                                context,
                                PageRouteBuilder(
                                  pageBuilder: (_, anim, __) =>
                                      FadeTransition(opacity: anim, child: const RegisterScreen()),
                                  transitionDuration:
                                      const Duration(milliseconds: 300),
                                ),
                              ),
                              child: Text(
                                'Créer un compte',
                                style: TextStyle(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w600,
                                  fontSize: 14,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
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
