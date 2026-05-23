import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../theme.dart';
import '../../providers/clients_provider.dart';
import '../../utils/phone.dart';
import '../../widgets/avatar_widget.dart';

class ClientsScreen extends StatefulWidget {
  const ClientsScreen({super.key});

  @override
  State<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsScreenState extends State<ClientsScreen> {
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
        (_) => context.read<ClientsProvider>().loadClients());
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  String _fmtXOF(double n) {
    final s = n.toStringAsFixed(0);
    final buf = StringBuffer();
    int count = 0;
    for (int i = s.length - 1; i >= 0; i--) {
      if (count > 0 && count % 3 == 0) buf.write(' ');
      buf.write(s[i]);
      count++;
    }
    return '${buf.toString().split('').reversed.join()} F';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.appBg,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
              child: Row(
                children: [
                  const Expanded(
                      child: Text('Clients',
                          style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.5))),
                  ElevatedButton.icon(
                    onPressed: () => _showAddClient(),
                    icon: Icon(Icons.add_rounded, size: 16),
                    label: Text('Ajouter'),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      minimumSize: Size.zero,
                      textStyle: TextStyle(
                          fontSize: 13, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 12, 18, 4),
              child: TextField(
                controller: _searchCtrl,
                onChanged: (v) => context
                    .read<ClientsProvider>()
                    .loadClients(search: v.isNotEmpty ? v : null),
                decoration: InputDecoration(
                  hintText: 'Rechercher un client…',
                  prefixIcon: Icon(Icons.search_rounded,
                      size: 18, color: context.appTextMuted),
                  suffixIcon: _searchCtrl.text.isNotEmpty
                      ? IconButton(
                          icon:
                              Icon(Icons.close_rounded, size: 18),
                          onPressed: () {
                            _searchCtrl.clear();
                            context
                                .read<ClientsProvider>()
                                .loadClients();
                          },
                        )
                      : null,
                ),
              ),
            ),
            Expanded(
              child: Consumer<ClientsProvider>(
                builder: (ctx, prov, _) {
                  if (prov.loading) {
                    return const Center(
                        child: CircularProgressIndicator(
                            color: AppColors.primary));
                  }
                  if (prov.clients.isEmpty) {
                    return Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.people_outline,
                              size: 48, color: context.appTextSubtle),
                          const SizedBox(height: 12),
                          Text('Aucun client',
                              style: TextStyle(
                                  color: context.appTextMuted,
                                  fontSize: 15)),
                        ],
                      ),
                    );
                  }
                  return RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: () => prov.loadClients(),
                    child: ListView.separated(
                      padding:
                          const EdgeInsets.fromLTRB(18, 8, 18, 24),
                      itemCount: prov.clients.length,
                      separatorBuilder: (_, __) => Divider(
                          height: 1, color: context.appBorder),
                      itemBuilder: (ctx, i) {
                        final c = prov.clients[i];
                        return Padding(
                          padding:
                              const EdgeInsets.symmetric(vertical: 10),
                          child: Row(
                            children: [
                              AvatarWidget(
                                  name: c.name,
                                  color: c.color,
                                  size: 42),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(c.name,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                            fontSize: 13.5,
                                            fontWeight:
                                                FontWeight.w500)),
                                    const SizedBox(height: 2),
                                    Text(
                                      '${c.city ?? ''} · ${c.quotesCount} devis',
                                      style: TextStyle(
                                          fontSize: 11.5,
                                          color: context.appTextMuted),
                                    ),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment:
                                    CrossAxisAlignment.end,
                                children: [
                                  Text(_fmtXOF(c.totalBilled),
                                      style: TextStyle(
                                          fontSize: 12.5,
                                          fontWeight: FontWeight.w500)),
                                  Text('total facturé',
                                      style: TextStyle(
                                          fontSize: 10.5,
                                          color: context.appTextSubtle)),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddClient() {
    final nameCtrl = TextEditingController();
    final contactCtrl = TextEditingController();
    final emailCtrl = TextEditingController();
    final phoneCtrl = TextEditingController();
    final cityCtrl = TextEditingController();
    String phoneCountry = 'bj';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) {
          bool loading = false;
          return Padding(
            padding: EdgeInsets.fromLTRB(
                24,
                16,
                24,
                MediaQuery.of(ctx).viewInsets.bottom + 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                      width: 36,
                      height: 4,
                      decoration: BoxDecoration(
                          color: context.appBorder,
                          borderRadius: BorderRadius.circular(2))),
                ),
                const SizedBox(height: 16),
                Text('Nouveau client',
                    style: TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w600)),
                const SizedBox(height: 16),
                TextField(
                    controller: nameCtrl,
                    decoration:
                        InputDecoration(labelText: 'Nom *')),
                const SizedBox(height: 10),
                TextField(
                    controller: contactCtrl,
                    decoration:
                        InputDecoration(labelText: 'Contact')),
                const SizedBox(height: 10),
                TextField(
                    controller: emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    decoration:
                        InputDecoration(labelText: 'E-mail')),
                const SizedBox(height: 10),
                // Phone + country picker
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: context.appBorder),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      DropdownButtonHideUnderline(
                        child: DropdownButton<String>(
                          value: phoneCountry,
                          borderRadius: BorderRadius.circular(12),
                          onChanged: (v) {
                            setS(() {
                              phoneCountry = v ?? phoneCountry;
                              phoneCtrl.clear();
                            });
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
                          controller: phoneCtrl,
                          keyboardType: TextInputType.phone,
                          inputFormatters: [PhoneFormatter(getCountry(phoneCountry).groups)],
                          decoration: InputDecoration(
                            hintText: phonePlaceholder(getCountry(phoneCountry).groups),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
                            border: InputBorder.none,
                            enabledBorder: InputBorder.none,
                            focusedBorder: InputBorder.none,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
                TextField(
                    controller: cityCtrl,
                    decoration:
                        InputDecoration(labelText: 'Ville')),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: loading
                      ? null
                      : () async {
                          if (nameCtrl.text.trim().isEmpty) return;
                          setS(() => loading = true);
                          final rawPhone = phoneCtrl.text.trim();
                          try {
                            await context
                                .read<ClientsProvider>()
                                .createClient(
                                  name: nameCtrl.text.trim(),
                                  contact: contactCtrl.text.trim().isNotEmpty
                                      ? contactCtrl.text.trim()
                                      : null,
                                  email: emailCtrl.text.trim().isNotEmpty
                                      ? emailCtrl.text.trim()
                                      : null,
                                  phone: rawPhone.isNotEmpty
                                      ? toE164(rawPhone, phoneCountry)
                                      : null,
                                  phoneCountry: phoneCountry,
                                  city: cityCtrl.text.trim().isNotEmpty
                                      ? cityCtrl.text.trim()
                                      : null,
                                );
                            if (ctx.mounted) Navigator.pop(ctx);
                          } catch (_) {
                            setS(() => loading = false);
                          }
                        },
                  child: loading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : Text('Créer le client'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
