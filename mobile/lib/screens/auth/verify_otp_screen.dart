import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:dio/dio.dart';
import '../../theme.dart';
import '../../providers/auth_provider.dart';

class VerifyOtpScreen extends StatefulWidget {
  final String email;
  const VerifyOtpScreen({super.key, required this.email});

  @override
  State<VerifyOtpScreen> createState() => _VerifyOtpScreenState();
}

class _VerifyOtpScreenState extends State<VerifyOtpScreen>
    with SingleTickerProviderStateMixin {
  final List<TextEditingController> _controllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());

  bool _loading = false;
  bool _resending = false;
  String? _error;
  int _cooldown = 60;
  Timer? _timer;

  late AnimationController _anim;
  late Animation<double> _fade;
  late Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _anim = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fade = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _anim, curve: Curves.easeOut),
    );
    _slide = Tween<Offset>(begin: const Offset(0, 0.12), end: Offset.zero).animate(
      CurvedAnimation(parent: _anim, curve: Curves.easeOut),
    );
    _anim.forward();
    _startTimer();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNodes[0].requestFocus();
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _anim.dispose();
    for (final c in _controllers) { c.dispose(); }
    for (final f in _focusNodes) { f.dispose(); }
    super.dispose();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_cooldown <= 0) { t.cancel(); return; }
      if (mounted) setState(() => _cooldown--);
    });
  }

  String get _code => _controllers.map((c) => c.text).join();

  void _onDigitChanged(int index, String value) {
    if (value.isNotEmpty && index < 5) {
      _focusNodes[index + 1].requestFocus();
    }
    setState(() {});
  }

  void _onKeyEvent(int index, KeyEvent event) {
    if (event is KeyDownEvent &&
        event.logicalKey == LogicalKeyboardKey.backspace &&
        _controllers[index].text.isEmpty &&
        index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
  }

  Future<void> _submit() async {
    if (_code.length < 6) {
      setState(() => _error = 'Entrez les 6 chiffres du code');
      return;
    }
    setState(() { _loading = true; _error = null; });
    try {
      await context.read<AuthProvider>().verifyOtp(widget.email, _code);
      // AuthProvider notifies listeners → main.dart rebuilds to MainScreen
    } on DioException catch (e) {
      setState(() {
        _error = e.response?.data?['message'] ?? 'Code invalide ou expiré';
        for (final c in _controllers) { c.clear(); }
      });
      _focusNodes[0].requestFocus();
    } catch (_) {
      setState(() => _error = 'Erreur de connexion au serveur');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resend() async {
    if (_cooldown > 0 || _resending) return;
    setState(() { _resending = true; _error = null; });
    try {
      await context.read<AuthProvider>().resendOtp(widget.email);
      for (final c in _controllers) { c.clear(); }
      _focusNodes[0].requestFocus();
      setState(() { _cooldown = 60; });
      _startTimer();
    } on DioException catch (e) {
      setState(() => _error = e.response?.data?['message'] ?? 'Erreur lors du renvoi');
    } catch (_) {
      setState(() => _error = 'Impossible de renvoyer le code');
    } finally {
      if (mounted) setState(() => _resending = false);
    }
  }

  String get _maskedEmail {
    final parts = widget.email.split('@');
    if (parts.length < 2) return widget.email;
    final local = parts[0];
    final domain = parts[1];
    if (local.length <= 2) return widget.email;
    return '${local.substring(0, 2)}***@$domain';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appBg,
      body: SafeArea(
        child: FadeTransition(
          opacity: _fade,
          child: SlideTransition(
            position: _slide,
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const SizedBox(height: 16),

                  // Icon
                  Center(
                    child: Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Icon(Icons.mark_email_read_outlined,
                          color: AppColors.primary, size: 36),
                    ),
                  ),
                  const SizedBox(height: 24),

                  Text(
                    'Vérifiez votre e-mail',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.5,
                      color: context.appText,
                    ),
                  ),
                  const SizedBox(height: 10),
                  RichText(
                    textAlign: TextAlign.center,
                    text: TextSpan(
                      style: TextStyle(fontSize: 14.5, color: context.appTextMuted, height: 1.5),
                      children: [
                        const TextSpan(text: 'Nous avons envoyé un code à 6 chiffres à\n'),
                        TextSpan(
                          text: _maskedEmail,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: context.appText,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 36),

                  if (_error != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: AppColors.statusOverdue.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.statusOverdue.withOpacity(0.25)),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline_rounded, color: AppColors.statusOverdue, size: 16),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(_error!,
                                style: TextStyle(color: AppColors.statusOverdue, fontSize: 13.5)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // 6-digit OTP input
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(6, (i) => _buildDigitBox(i)),
                  ),
                  const SizedBox(height: 36),

                  // Submit button
                  SizedBox(
                    height: 52,
                    child: ElevatedButton(
                      onPressed: (_loading || _code.length < 6) ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                        shadowColor: Colors.transparent,
                      ),
                      child: _loading
                          ? const SizedBox(
                              height: 20, width: 20,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text('Vérifier mon compte',
                                    style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w600)),
                                SizedBox(width: 8),
                                Icon(Icons.arrow_forward_rounded, size: 18),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Resend
                  Wrap(
                    alignment: WrapAlignment.center,
                    children: [
                      Text('Pas reçu le code ? ',
                          style: TextStyle(color: context.appTextMuted, fontSize: 14)),
                      _cooldown > 0
                          ? Text('Renvoyer dans ${_cooldown}s',
                              style: TextStyle(color: context.appTextSubtle, fontSize: 14))
                          : GestureDetector(
                              onTap: _resend,
                              child: _resending
                                  ? Text('Envoi...',
                                      style: TextStyle(color: AppColors.primary, fontSize: 14))
                                  : Text('Renvoyer le code',
                                      style: TextStyle(
                                          color: AppColors.primary,
                                          fontWeight: FontWeight.w600,
                                          fontSize: 14)),
                            ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  Center(
                    child: GestureDetector(
                      onTap: () => Navigator.pop(context),
                      child: Text(
                        '← Retour',
                        style: TextStyle(color: context.appTextSubtle, fontSize: 13),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDigitBox(int index) {
    final filled = _controllers[index].text.isNotEmpty;
    return Container(
      width: 46,
      height: 56,
      margin: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: context.appSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: filled ? AppColors.primary : context.appBorderStrong,
          width: filled ? 2 : 1.5,
        ),
      ),
      child: KeyboardListener(
        focusNode: FocusNode(),
        onKeyEvent: (e) => _onKeyEvent(index, e),
        child: TextField(
          controller: _controllers[index],
          focusNode: _focusNodes[index],
          textAlign: TextAlign.center,
          keyboardType: TextInputType.number,
          maxLength: 1,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: filled ? AppColors.primary : context.appText,
          ),
          decoration: const InputDecoration(
            counterText: '',
            border: InputBorder.none,
            contentPadding: EdgeInsets.zero,
          ),
          onChanged: (v) => _onDigitChanged(index, v),
        ),
      ),
    );
  }
}
