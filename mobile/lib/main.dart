import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'services/api_client.dart';
import 'providers/auth_provider.dart';
import 'providers/quotes_provider.dart';
import 'providers/clients_provider.dart';
import 'providers/products_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/credits_provider.dart';
import 'theme.dart';
import 'screens/splash_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/onboarding_screen.dart';
import 'screens/main_screen.dart';
import 'screens/credits/credits_screen.dart';
import 'screens/payouts/payouts_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));
  await ApiClient.init();
  runApp(const NexaPayApp());
}

class NexaPayApp extends StatelessWidget {
  const NexaPayApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => AuthProvider()..checkAuth()),
        ChangeNotifierProvider(create: (_) => QuotesProvider()),
        ChangeNotifierProvider(create: (_) => ClientsProvider()),
        ChangeNotifierProvider(create: (_) => ProductsProvider()),
        ChangeNotifierProvider(create: (_) => CreditsProvider()),
      ],
      child: Consumer<ThemeProvider>(
        builder: (_, themeProvider, __) => MaterialApp(
          title: 'NexaPay',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: themeProvider.mode,
          home: const _AppEntry(),
          routes: {
            '/credits': (_) => const CreditsScreen(),
            '/payouts': (_) => const PayoutsScreen(),
          },
        ),
      ),
    );
  }
}

class _AppEntry extends StatefulWidget {
  const _AppEntry();

  @override
  State<_AppEntry> createState() => _AppEntryState();
}

class _AppEntryState extends State<_AppEntry> {
  bool _splashDone = false;

  @override
  Widget build(BuildContext context) {
    if (!_splashDone) {
      return SplashScreen(onDone: () {
        if (mounted) setState(() => _splashDone = true);
      });
    }

    return Consumer<AuthProvider>(
      builder: (ctx, auth, __) {
        if (auth.isLoading) {
          return Scaffold(
            backgroundColor: ctx.appBg,
            body: const Center(
              child: CircularProgressIndicator(color: AppColors.primary),
            ),
          );
        }
        if (!auth.isAuthenticated) return const LoginScreen();
        // Block app access until a MoMo number is set. Social signups land
        // here on first run; email signups too if they skipped the phone
        // field. Cleared automatically once `updateProfile` sets `phone`.
        if (auth.user?.needsMomoSetup == true) return const OnboardingScreen();
        return const MainScreen();
      },
    );
  }
}
