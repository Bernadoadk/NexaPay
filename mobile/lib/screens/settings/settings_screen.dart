import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../../theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/theme_provider.dart';
import '../../utils/phone.dart';
import '../../widgets/avatar_widget.dart';
import '../../widgets/ai_coming_soon_dialog.dart';
import '../../widgets/slide_in.dart';
import '../plan/plan_screen.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  void _push(BuildContext context, Widget screen) {
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (_, a, __) => screen,
        transitionsBuilder: (_, anim, __, child) {
          return FadeTransition(
            opacity: anim,
            child: SlideTransition(
              position: Tween(
                begin: const Offset(0.04, 0),
                end: Offset.zero,
              ).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
              child: child,
            ),
          );
        },
        transitionDuration: const Duration(milliseconds: 280),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return Scaffold(
      backgroundColor: context.appBg,
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
                child: Text('Réglages',
                    style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.5)),
              ),
            ),
            if (user != null) ...[
              SliverToBoxAdapter(
                child: SlideIn(
                  delay: const Duration(milliseconds: 60),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 16, 18, 0),
                    child: GestureDetector(
                      onTap: () => _push(context, const _ProfileScreen()),
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: context.appSurface,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: context.appBorder),
                        ),
                        child: Row(
                          children: [
                            AvatarWidget(
                                name: user.name,
                                color: '#0F8F65',
                                size: 46,
                                photoUrl: user.logoUrl),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(user.name,
                                      style: TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w600)),
                                  const SizedBox(height: 2),
                                  Text(user.email,
                                      style: TextStyle(
                                          fontSize: 12.5,
                                          color: context.appTextMuted)),
                                  if (user.companyName != null) ...[
                                    const SizedBox(height: 1),
                                    Text(user.companyName!,
                                        style: TextStyle(
                                            fontSize: 12.5,
                                            color: context.appTextMuted)),
                                  ],
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            _PlanBadge(plan: user.plan),
                            const SizedBox(width: 4),
                            Icon(Icons.chevron_right_rounded,
                                color: context.appTextSubtle, size: 18),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              if (user.plan != 'BUSINESS')
                SliverToBoxAdapter(
                  child: SlideIn(
                    delay: const Duration(milliseconds: 100),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
                      child: GestureDetector(
                        onTap: () => _push(context, const PlanScreen()),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 13),
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF0F8F65), Color(0xFF0C7A56)],
                            ),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.rocket_launch_rounded,
                                  color: Colors.white, size: 20),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      user.plan == 'FREE'
                                          ? 'Passer au plan Pro'
                                          : 'Passer au plan Business',
                                      style: TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 14),
                                    ),
                                    Text(
                                      user.plan == 'FREE'
                                          ? '30 devis/mois + PDF personnalisé'
                                          : 'Devis illimités + support prioritaire',
                                      style: TextStyle(
                                          color: Colors.white.withOpacity(0.85),
                                          fontSize: 12),
                                    ),
                                  ],
                                ),
                              ),
                              Icon(Icons.chevron_right_rounded,
                                  color: Colors.white, size: 20),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
            ],
            SliverToBoxAdapter(
              child: SlideIn(
                delay: const Duration(milliseconds: 120),
                child: _buildSection(context, 'Apparence', [
                  _ThemeSelector(),
                ]),
              ),
            ),
            SliverToBoxAdapter(
              child: SlideIn(
                delay: const Duration(milliseconds: 140),
                child: _buildSection(context, 'Compte', [
                  _Item(
                      icon: Icons.person_outline,
                      label: 'Profil & entreprise',
                      onTap: () => _push(context, const _ProfileScreen())),
                  _Item(
                      icon: Icons.lock_outline,
                      label: 'Mot de passe',
                      onTap: () => _push(context, const _PasswordScreen())),
                  _Item(
                      icon: Icons.notifications_outlined,
                      label: 'Notifications',
                      onTap: () => _showComingSoon(context, 'Notifications')),
                ]),
              ),
            ),
            SliverToBoxAdapter(
              child: SlideIn(
                delay: const Duration(milliseconds: 180),
                child: _buildSection(context, 'Facturation & paiements', [
                  _Item(
                      icon: Icons.account_balance_wallet_outlined,
                      label: 'Mobile Money (MoMo)',
                      subtitle: user?.needsMomoSetup == true
                          ? 'Aucun numéro configuré — vos paiements ne seront pas reversés'
                          : 'Numéro de réception : ${user?.phone ?? ''}',
                      destructive: user?.needsMomoSetup == true,
                      onTap: () => _push(context, const _MoMoScreen())),
                  _Item(
                      icon: Icons.payments_outlined,
                      label: 'Mes reversements',
                      subtitle: 'Argent reçu via MoMo · commission 3 %',
                      onTap: () =>
                          Navigator.of(context).pushNamed('/payouts')),
                  _Item(
                      icon: Icons.auto_awesome_rounded,
                      label: 'Crédits IA',
                      subtitle: 'Disponible prochainement',
                      onTap: () => showAiComingSoonDialog(context)),
                  _Item(
                      icon: Icons.receipt_outlined,
                      label: 'Modèles de devis',
                      subtitle: 'Disponible dès le plan Pro',
                      onTap: () => _push(context, const PlanScreen())),
                  _Item(
                      icon: Icons.percent_rounded,
                      label: 'TVA et taxes',
                      onTap: () => _push(context, const _TvaScreen())),
                ]),
              ),
            ),
            SliverToBoxAdapter(
              child: SlideIn(
                delay: const Duration(milliseconds: 220),
                child: _buildSection(context, 'Abonnement', [
                  _Item(
                      icon: Icons.star_outline,
                      label: 'Plans & Tarifs',
                      subtitle: _planSubtitle(user?.plan),
                      onTap: () => _push(context, const PlanScreen())),
                ]),
              ),
            ),
            SliverToBoxAdapter(
              child: SlideIn(
                delay: const Duration(milliseconds: 260),
                child: _buildSection(context, '', [
                  _Item(
                    icon: Icons.logout_rounded,
                    label: 'Se déconnecter',
                    destructive: true,
                    onTap: () => _confirmLogout(context),
                  ),
                ]),
              ),
            ),
            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }

  String _planSubtitle(String? plan) {
    switch (plan) {
      case 'PRO':
        return 'Plan Pro actif — 30 devis/mois';
      case 'BUSINESS':
        return 'Plan Business actif — Illimité';
      default:
        return 'Gratuit — 5 devis/mois';
    }
  }

  Widget _buildSection(BuildContext context, String title, List<Widget> items) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (title.isNotEmpty) ...[
            Text(title,
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: context.appTextMuted,
                    letterSpacing: 0.5)),
            const SizedBox(height: 8),
          ],
          // Material wrapper required so child ListTile splashes/ink layers
          // render above the rounded background (avoids the "ListTile background
          // color or ink splashes may be invisible" assertion).
          Material(
            color: context.appSurface,
            borderRadius: BorderRadius.circular(14),
            clipBehavior: Clip.antiAlias,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: context.appBorder),
              ),
              child: Column(children: items),
            ),
          ),
        ],
      ),
    );
  }

  void _showComingSoon(BuildContext context, String feature) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$feature — bientôt disponible'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _confirmLogout(BuildContext context) {
    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Se déconnecter'),
        content: Text('Êtes-vous sûr de vouloir vous déconnecter ?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('Annuler')),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              context.read<AuthProvider>().logout();
            },
            child: Text('Déconnecter',
                style: TextStyle(color: AppColors.statusOverdue)),
          ),
        ],
      ),
    );
  }
}

class _PlanBadge extends StatelessWidget {
  final String plan;
  const _PlanBadge({required this.plan});

  @override
  Widget build(BuildContext context) {
    Color bg, fg;
    switch (plan) {
      case 'PRO':
        bg = AppColors.primarySoft;
        fg = AppColors.primary;
        break;
      case 'BUSINESS':
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFFB45309);
        break;
      default:
        bg = context.appBg;
        fg = context.appTextMuted;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(plan,
          style: TextStyle(
              color: fg,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.5)),
    );
  }
}

class _Item extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;
  final bool destructive;
  final bool accent;

  const _Item({
    required this.icon,
    required this.label,
    this.subtitle,
    required this.onTap,
    this.destructive = false,
    this.accent = false,
  });

  @override
  Widget build(BuildContext context) {
    final color = destructive
        ? AppColors.statusOverdue
        : (accent ? AppColors.primary : context.appText);
    return ListTile(
      leading: Icon(icon, size: 20, color: color),
      title: Text(label,
          style: TextStyle(
              fontSize: 14, color: color, fontWeight: FontWeight.w500)),
      subtitle: subtitle != null
          ? Text(subtitle!,
              style: TextStyle(fontSize: 12, color: context.appTextMuted))
          : null,
      trailing: Icon(Icons.chevron_right_rounded,
          color: context.appTextSubtle, size: 18),
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
    );
  }
}

// ── Profile Edit Screen ────────────────────────────────────────────────────

class _ProfileScreen extends StatefulWidget {
  const _ProfileScreen();

  @override
  State<_ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<_ProfileScreen> {
  late TextEditingController _nameCtrl;
  late TextEditingController _companyCtrl;
  late TextEditingController _phoneCtrl;
  late TextEditingController _addressCtrl;
  late TextEditingController _ifuCtrl;
  late TextEditingController _rccmCtrl;
  String _phoneCountry = 'bj';
  bool _loading = false;
  bool _dirty = false;
  bool _avatarLoading = false;
  bool _quoteLogoLoading = false;
  final _picker = ImagePicker();

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    _phoneCountry = user?.phoneCountry ?? 'bj';
    _nameCtrl = TextEditingController(text: user?.name ?? '');
    _companyCtrl = TextEditingController(text: user?.companyName ?? '');
    _phoneCtrl = TextEditingController(
        text: displayPhone(user?.phone, _phoneCountry));
    _addressCtrl = TextEditingController(text: user?.address ?? '');
    _ifuCtrl = TextEditingController(text: user?.ifu ?? '');
    _rccmCtrl = TextEditingController(text: user?.rccm ?? '');

    for (final c in [_nameCtrl, _companyCtrl, _phoneCtrl, _addressCtrl, _ifuCtrl, _rccmCtrl]) {
      c.addListener(() => setState(() => _dirty = true));
    }
  }

  @override
  void dispose() {
    for (final c in [_nameCtrl, _companyCtrl, _phoneCtrl, _addressCtrl, _ifuCtrl, _rccmCtrl]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickAndUploadAvatar() async {
    final xfile = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85, maxWidth: 800);
    if (xfile == null || !mounted) return;
    setState(() => _avatarLoading = true);
    try {
      await context.read<AuthProvider>().uploadAvatar(xfile.path);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Échec du téléchargement')));
    } finally {
      if (mounted) setState(() => _avatarLoading = false);
    }
  }

  Future<void> _deleteAvatar() async {
    setState(() => _avatarLoading = true);
    try {
      await context.read<AuthProvider>().deleteAvatar();
    } finally {
      if (mounted) setState(() => _avatarLoading = false);
    }
  }

  Future<void> _pickAndUploadQuoteLogo() async {
    final xfile = await _picker.pickImage(source: ImageSource.gallery, imageQuality: 85, maxWidth: 800);
    if (xfile == null || !mounted) return;
    setState(() => _quoteLogoLoading = true);
    try {
      await context.read<AuthProvider>().uploadQuoteLogo(xfile.path);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Échec du téléchargement')));
    } finally {
      if (mounted) setState(() => _quoteLogoLoading = false);
    }
  }

  Future<void> _deleteQuoteLogo() async {
    setState(() => _quoteLogoLoading = true);
    try {
      await context.read<AuthProvider>().deleteQuoteLogo();
    } finally {
      if (mounted) setState(() => _quoteLogoLoading = false);
    }
  }

  Future<void> _save() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _loading = true);
    try {
      final rawPhone = _phoneCtrl.text.trim();
      await context.read<AuthProvider>().updateProfile({
        'name': _nameCtrl.text.trim(),
        if (_companyCtrl.text.trim().isNotEmpty) 'companyName': _companyCtrl.text.trim(),
        if (rawPhone.isNotEmpty) 'phone': toE164(rawPhone, _phoneCountry),
        'phoneCountry': _phoneCountry,
        if (_addressCtrl.text.trim().isNotEmpty) 'address': _addressCtrl.text.trim(),
        if (_ifuCtrl.text.trim().isNotEmpty) 'ifu': _ifuCtrl.text.trim(),
        if (_rccmCtrl.text.trim().isNotEmpty) 'rccm': _rccmCtrl.text.trim(),
      });
      if (mounted) {
        setState(() { _dirty = false; _loading = false; });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profil mis à jour'),
            backgroundColor: AppColors.primary,
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erreur lors de la mise à jour')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appBg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 10, 18, 0),
              child: Row(
                children: [
                  IconButton(
                    icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const Expanded(
                    child: Text('Profil & entreprise',
                        style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.3)),
                  ),
                  if (_dirty)
                    TextButton(
                      onPressed: _loading ? null : _save,
                      child: _loading
                          ? const SizedBox(
                              height: 18, width: 18,
                              child: CircularProgressIndicator(
                                  color: AppColors.primary, strokeWidth: 2))
                          : Text('Enregistrer',
                              style: TextStyle(
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.primary)),
                    ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionLabel('Photo & Logo'),
                    const SizedBox(height: 8),
                    _buildPhotoSection(),
                    const SizedBox(height: 20),
                    _sectionLabel('Informations personnelles'),
                    const SizedBox(height: 8),
                    _fieldCard([
                      _Field(label: 'Nom complet *', controller: _nameCtrl),
                      // Phone + country row
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                value: _phoneCountry,
                                borderRadius: BorderRadius.circular(12),
                                onChanged: (v) => setState(() {
                                  _phoneCountry = v ?? _phoneCountry;
                                  _dirty = true;
                                  _phoneCtrl.clear();
                                }),
                                items: kCountries.map((c) => DropdownMenuItem(
                                  value: c.code,
                                  child: Text('${c.flag} ${c.dial}',
                                      style: const TextStyle(fontSize: 12.5)),
                                )).toList(),
                              ),
                            ),
                            Expanded(
                              child: TextField(
                                controller: _phoneCtrl,
                                keyboardType: TextInputType.phone,
                                inputFormatters: [PhoneFormatter(getCountry(_phoneCountry).groups)],
                                decoration: InputDecoration(
                                  labelText: 'Téléphone (WhatsApp)',
                                  hintText: phonePlaceholder(getCountry(_phoneCountry).groups),
                                  border: InputBorder.none,
                                  enabledBorder: InputBorder.none,
                                  focusedBorder: InputBorder.none,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ]),
                    const SizedBox(height: 20),
                    _sectionLabel('Entreprise'),
                    const SizedBox(height: 8),
                    _fieldCard([
                      _Field(label: 'Nom de l\'entreprise', controller: _companyCtrl),
                      _Field(label: 'Adresse', controller: _addressCtrl, lines: 2),
                      _Field(label: 'Numéro IFU', controller: _ifuCtrl),
                      _Field(label: 'RCCM', controller: _rccmCtrl),
                    ]),
                    const SizedBox(height: 28),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: (_dirty && !_loading) ? _save : null,
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        child: _loading
                            ? const SizedBox(
                                height: 20, width: 20,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2))
                            : Text('Enregistrer les modifications',
                                style: TextStyle(fontWeight: FontWeight.w600)),
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

  Widget _buildPhotoSection() {
    final user = context.watch<AuthProvider>().user;
    final useProfile = user?.useProfilePhotoAsLogo ?? true;

    return Container(
      decoration: BoxDecoration(
        color: context.appSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.appBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar upload
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                GestureDetector(
                  onTap: _pickAndUploadAvatar,
                  child: Stack(
                    children: [
                      AvatarWidget(
                        name: user?.name ?? '',
                        color: '#0F8F65',
                        size: 64,
                        photoUrl: user?.logoUrl,
                      ),
                      if (_avatarLoading)
                        Positioned.fill(
                          child: Container(
                            decoration: BoxDecoration(
                              color: Colors.black38,
                              borderRadius: BorderRadius.circular(19),
                            ),
                            child: const Center(
                              child: SizedBox(
                                width: 20, height: 20,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              ),
                            ),
                          ),
                        ),
                      Positioned(
                        right: 0, bottom: 0,
                        child: Container(
                          width: 22, height: 22,
                          decoration: BoxDecoration(
                            color: AppColors.primary,
                            shape: BoxShape.circle,
                            border: Border.all(color: context.appSurface, width: 2),
                          ),
                          child: const Icon(Icons.camera_alt_rounded, size: 11, color: Colors.white),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Photo de profil',
                          style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text('JPG, PNG · max 5 Mo',
                          style: TextStyle(fontSize: 12, color: context.appTextMuted)),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          GestureDetector(
                            onTap: _avatarLoading ? null : _pickAndUploadAvatar,
                            child: Text(
                              user?.logoUrl != null ? 'Changer' : 'Importer',
                              style: TextStyle(
                                fontSize: 12.5, fontWeight: FontWeight.w600,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                          if (user?.logoUrl != null) ...[
                            const SizedBox(width: 12),
                            GestureDetector(
                              onTap: _avatarLoading ? null : _deleteAvatar,
                              child: Text('Supprimer',
                                  style: TextStyle(
                                    fontSize: 12.5, fontWeight: FontWeight.w600,
                                    color: AppColors.statusOverdue,
                                  )),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Divider
          Divider(height: 1, color: context.appBorder),

          // Toggle
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Utiliser comme logo de devis',
                          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 2),
                      Text('Votre photo apparaîtra dans l\'en-tête des PDFs',
                          style: TextStyle(fontSize: 11.5, color: context.appTextMuted)),
                    ],
                  ),
                ),
                Switch(
                  value: useProfile,
                  activeColor: AppColors.primary,
                  onChanged: (v) async {
                    await context.read<AuthProvider>().setUseProfilePhotoAsLogo(v);
                  },
                ),
              ],
            ),
          ),

          // Logo devis séparé (si toggle OFF)
          if (!useProfile) ...[
            Divider(height: 1, color: context.appBorder),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: _pickAndUploadQuoteLogo,
                    child: Stack(
                      children: [
                        Container(
                          width: 64, height: 64,
                          decoration: BoxDecoration(
                            color: context.appBg,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: user?.quoteLogoUrl != null
                                  ? AppColors.primary
                                  : context.appBorder,
                              width: user?.quoteLogoUrl != null ? 1.5 : 1,
                            ),
                          ),
                          child: user?.quoteLogoUrl != null
                              ? ClipRRect(
                                  borderRadius: BorderRadius.circular(9),
                                  child: Image.network(user!.quoteLogoUrl!, fit: BoxFit.cover),
                                )
                              : Icon(Icons.add_photo_alternate_outlined,
                                  size: 26, color: context.appTextMuted),
                        ),
                        if (_quoteLogoLoading)
                          Positioned.fill(
                            child: Container(
                              decoration: BoxDecoration(
                                color: Colors.black38,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Center(
                                child: SizedBox(
                                  width: 20, height: 20,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Logo personnalisé',
                            style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 2),
                        Text('Affiché sur vos devis PDF',
                            style: TextStyle(fontSize: 12, color: context.appTextMuted)),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            GestureDetector(
                              onTap: _quoteLogoLoading ? null : _pickAndUploadQuoteLogo,
                              child: Text(
                                user?.quoteLogoUrl != null ? 'Changer' : 'Importer',
                                style: TextStyle(
                                  fontSize: 12.5, fontWeight: FontWeight.w600,
                                  color: AppColors.primary,
                                ),
                              ),
                            ),
                            if (user?.quoteLogoUrl != null) ...[
                              const SizedBox(width: 12),
                              GestureDetector(
                                onTap: _quoteLogoLoading ? null : _deleteQuoteLogo,
                                child: Text('Supprimer',
                                    style: TextStyle(
                                      fontSize: 12.5, fontWeight: FontWeight.w600,
                                      color: AppColors.statusOverdue,
                                    )),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _sectionLabel(String text) => Text(text,
      style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: context.appTextMuted,
          letterSpacing: 0.5));

  Widget _fieldCard(List<Widget> fields) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: context.appSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.appBorder),
      ),
      child: Column(children: fields),
    );
  }
}

class _Field extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final TextInputType type;
  final int lines;

  const _Field({
    required this.label,
    required this.controller,
    this.type = TextInputType.text,
    this.lines = 1,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: type,
      maxLines: lines,
      decoration: InputDecoration(
        labelText: label,
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
      ),
    );
  }
}

// ── Password Change Screen ─────────────────────────────────────────────────

class _PasswordScreen extends StatefulWidget {
  const _PasswordScreen();

  @override
  State<_PasswordScreen> createState() => _PasswordScreenState();
}

class _PasswordScreenState extends State<_PasswordScreen> {
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  bool _loading = false;
  bool _obscureCurrent = true;
  bool _obscureNew = true;

  Future<void> _save() async {
    if (_newCtrl.text != _confirmCtrl.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Les mots de passe ne correspondent pas')),
      );
      return;
    }
    if (_newCtrl.text.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Minimum 6 caractères')),
      );
      return;
    }
    setState(() => _loading = true);
    try {
      await context.read<AuthProvider>().updateProfile({
        'currentPassword': _currentCtrl.text,
        'password': _newCtrl.text,
      });
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Mot de passe modifié'),
              backgroundColor: AppColors.primary),
        );
      }
    } catch (_) {
      if (mounted) {
        setState(() => _loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Mot de passe actuel incorrect')),
        );
      }
    }
  }

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appBg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 10, 18, 0),
              child: Row(
                children: [
                  IconButton(
                    icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const Expanded(
                    child: Text('Mot de passe',
                        style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.3)),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(18),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 4),
                      decoration: BoxDecoration(
                        color: context.appSurface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: context.appBorder),
                      ),
                      child: Column(
                        children: [
                          TextField(
                            controller: _currentCtrl,
                            obscureText: _obscureCurrent,
                            decoration: InputDecoration(
                              labelText: 'Mot de passe actuel',
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              suffixIcon: IconButton(
                                icon: Icon(_obscureCurrent
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                    size: 18, color: context.appTextMuted),
                                onPressed: () => setState(
                                    () => _obscureCurrent = !_obscureCurrent),
                              ),
                            ),
                          ),
                          const Divider(height: 1),
                          TextField(
                            controller: _newCtrl,
                            obscureText: _obscureNew,
                            decoration: InputDecoration(
                              labelText: 'Nouveau mot de passe',
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              suffixIcon: IconButton(
                                icon: Icon(_obscureNew
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                                    size: 18, color: context.appTextMuted),
                                onPressed: () =>
                                    setState(() => _obscureNew = !_obscureNew),
                              ),
                            ),
                          ),
                          const Divider(height: 1),
                          TextField(
                            controller: _confirmCtrl,
                            obscureText: true,
                            decoration: InputDecoration(
                              labelText: 'Confirmer le nouveau mot de passe',
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: _loading ? null : _save,
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        child: _loading
                            ? const SizedBox(
                                height: 20, width: 20,
                                child: CircularProgressIndicator(
                                    color: Colors.white, strokeWidth: 2))
                            : Text('Changer le mot de passe',
                                style: TextStyle(fontWeight: FontWeight.w600)),
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

// ── TVA Screen ────────────────────────────────────────────────────────────────

class _TvaScreen extends StatefulWidget {
  const _TvaScreen();

  @override
  State<_TvaScreen> createState() => _TvaScreenState();
}

class _TvaScreenState extends State<_TvaScreen> {
  bool _tvaEnabled = false;
  final _rateCtrl = TextEditingController(text: '18');

  @override
  void dispose() {
    _rateCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appBg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 10, 18, 0),
              child: Row(
                children: [
                  IconButton(
                    icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const Expanded(
                    child: Text('TVA et taxes',
                        style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.3)),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        color: context.appSurface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: context.appBorder),
                      ),
                      child: Column(
                        children: [
                          SwitchListTile(
                            value: _tvaEnabled,
                            onChanged: (v) => setState(() => _tvaEnabled = v),
                            activeColor: AppColors.primary,
                            title: Text('Activer la TVA',
                                style: TextStyle(
                                    fontSize: 14, fontWeight: FontWeight.w500)),
                            subtitle: Text('Afficher la TVA sur les devis',
                                style: TextStyle(
                                    fontSize: 12, color: context.appTextMuted)),
                            contentPadding:
                                const EdgeInsets.symmetric(horizontal: 16),
                          ),
                          if (_tvaEnabled) ...[
                            Divider(height: 1, color: context.appBorder),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 4),
                              child: TextField(
                                controller: _rateCtrl,
                                keyboardType: TextInputType.number,
                                decoration: InputDecoration(
                                  labelText: 'Taux TVA (%)',
                                  border: InputBorder.none,
                                  enabledBorder: InputBorder.none,
                                  focusedBorder: InputBorder.none,
                                  suffixText: '%',
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Text(
                        'La TVA standard au Bénin est de 18 %. Elle sera ajoutée automatiquement au total de vos devis.',
                        style: TextStyle(
                            fontSize: 12, color: context.appTextMuted, height: 1.5),
                      ),
                    ),
                    const SizedBox(height: 28),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Paramètres TVA enregistrés'),
                              backgroundColor: AppColors.primary,
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                          Navigator.pop(context);
                        },
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text('Enregistrer',
                            style: TextStyle(fontWeight: FontWeight.w600)),
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

// ── Theme Selector ─────────────────────────────────────────────────────────────

class _ThemeSelector extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final themeProvider = context.watch<ThemeProvider>();
    final current = themeProvider.mode;

    final options = [
      (ThemeMode.light,  Icons.wb_sunny_outlined,    'Clair'),
      (ThemeMode.dark,   Icons.nightlight_outlined,   'Sombre'),
      (ThemeMode.system, Icons.phone_android_outlined, 'Système'),
    ];

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: Row(
        children: options.map((opt) {
          final (mode, icon, label) = opt;
          final selected = current == mode;
          return Expanded(
            child: GestureDetector(
              onTap: () => themeProvider.setMode(mode),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: selected ? AppColors.primary : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: selected ? AppColors.primary : context.appBorder,
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon,
                        size: 20,
                        color: selected ? Colors.white : context.appTextMuted),
                    const SizedBox(height: 4),
                    Text(label,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: selected ? Colors.white : context.appTextMuted,
                        )),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

// ── MoMo Screen ───────────────────────────────────────────────────────────────

class _MoMoScreen extends StatefulWidget {
  const _MoMoScreen();

  @override
  State<_MoMoScreen> createState() => _MoMoScreenState();
}

class _MoMoScreenState extends State<_MoMoScreen> {
  late TextEditingController _phoneCtrl;
  late String _operator;
  String _country = 'bj';

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    _country = user?.phoneCountry ?? 'bj';
    _phoneCtrl = TextEditingController(
        text: displayPhone(user?.phone, _country));
    _operator = getCountry(_country).momoNetworks.first;
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appBg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(6, 10, 18, 0),
              child: Row(
                children: [
                  IconButton(
                    icon: Icon(Icons.arrow_back_ios_new_rounded, size: 18),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const Expanded(
                    child: Text('Mobile Money',
                        style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.3)),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Info banner
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: AppColors.primarySoft,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color: AppColors.primary.withOpacity(0.2)),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.info_outline_rounded,
                              color: AppColors.primary, size: 18),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Text(
                              'Vos clients pourront payer directement sur ce numéro MoMo.',
                              style: TextStyle(
                                  fontSize: 12.5,
                                  color: AppColors.primary,
                                  height: 1.4),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    // Opérateur
                    Text('Opérateur',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: context.appTextMuted,
                            letterSpacing: 0.5)),
                    const SizedBox(height: 8),
                    Container(
                      decoration: BoxDecoration(
                        color: context.appSurface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: context.appBorder),
                      ),
                      child: Column(
                        children: [
                          for (final op in getCountry(_country).momoNetworks)
                            RadioListTile<String>(
                              value: op,
                              groupValue: _operator,
                              onChanged: (v) =>
                                  setState(() => _operator = v ?? _operator),
                              activeColor: AppColors.primary,
                              title: Text(op,
                                  style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w500)),
                              contentPadding:
                                  const EdgeInsets.symmetric(horizontal: 12),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    // Numéro + pays
                    Text('Numéro de téléphone MoMo',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: context.appTextMuted,
                            letterSpacing: 0.5)),
                    const SizedBox(height: 8),
                    Container(
                      decoration: BoxDecoration(
                        color: context.appSurface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: context.appBorder),
                      ),
                      child: Row(
                        children: [
                          // Country picker
                          Container(
                            decoration: BoxDecoration(
                              border: Border(right: BorderSide(color: context.appBorder)),
                              borderRadius: const BorderRadius.only(
                                topLeft: Radius.circular(14),
                                bottomLeft: Radius.circular(14),
                              ),
                            ),
                            child: DropdownButtonHideUnderline(
                              child: DropdownButton<String>(
                                value: _country,
                                padding: const EdgeInsets.symmetric(horizontal: 12),
                                borderRadius: BorderRadius.circular(12),
                                onChanged: (v) => setState(() {
                                  _country = v ?? _country;
                                  _operator = getCountry(_country).momoNetworks.first;
                                  _phoneCtrl.clear();
                                }),
                                items: kCountries.map((c) => DropdownMenuItem(
                                  value: c.code,
                                  child: Text('${c.flag} ${c.dial}',
                                      style: const TextStyle(fontSize: 13)),
                                )).toList(),
                              ),
                            ),
                          ),
                          // Phone input
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                              child: TextField(
                                controller: _phoneCtrl,
                                keyboardType: TextInputType.phone,
                                inputFormatters: [PhoneFormatter(getCountry(_country).groups)],
                                decoration: InputDecoration(
                                  hintText: phonePlaceholder(getCountry(_country).groups),
                                  hintStyle: TextStyle(color: context.appTextSubtle),
                                  border: InputBorder.none,
                                  enabledBorder: InputBorder.none,
                                  focusedBorder: InputBorder.none,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: Text(
                        'NexaPay vous reverse 97% des paiements clients sur ce numéro (commission 3%).',
                        style: TextStyle(fontSize: 12, color: context.appTextMuted, height: 1.5),
                      ),
                    ),
                    const SizedBox(height: 28),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: () async {
                          final rawPhone = _phoneCtrl.text.trim();
                          if (rawPhone.isEmpty) return;
                          try {
                            await context.read<AuthProvider>().updateProfile({
                              'phone': toE164(rawPhone, _country),
                              'phoneCountry': _country,
                            });
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Numéro MoMo enregistré'),
                                  backgroundColor: AppColors.primary,
                                  behavior: SnackBarBehavior.floating,
                                ),
                              );
                              Navigator.pop(context);
                            }
                          } catch (_) {
                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content: Text('Erreur lors de la sauvegarde')),
                              );
                            }
                          }
                        },
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text('Enregistrer le numéro MoMo',
                            style: TextStyle(fontWeight: FontWeight.w600)),
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
