import 'package:flutter/material.dart';

class AppColors {
  // Light
  static const primary = Color(0xFF0F8F65);
  static const primaryDark = Color(0xFF0C7A56);
  static const primarySoft = Color(0xFFE8F5F0);
  static const background = Color(0xFFF5F7F5);
  static const surface = Color(0xFFFFFFFF);
  static const border = Color(0xFFE5E7E5);
  static const borderStrong = Color(0xFFD9D6CB);
  static const text = Color(0xFF1A1A1A);
  static const textMuted = Color(0xFF6B7280);
  static const textSubtle = Color(0xFF9CA3AF);

  // Dark
  static const primaryDarkMode = Color(0xFF0F8F65);
  static const primaryHoverDark = Color(0xFF12A875);
  static const primarySoftDark = Color(0xFF0F2E22);
  static const backgroundDark = Color(0xFF0F1412);
  static const surfaceDark = Color(0xFF1A201E);
  static const surface2Dark = Color(0xFF131918);
  static const borderDark = Color(0xFF2A302E);
  static const borderStrongDark = Color(0xFF384442);
  static const textDark = Color(0xFFE8EAE9);
  static const textMutedDark = Color(0xFF8A9490);
  static const textSubtleDark = Color(0xFF5A6560);

  static const statusDraft = Color(0xFF6B7280);
  static const statusSent = Color(0xFF2563EB);
  static const statusPaid = Color(0xFF0F8F65);
  static const statusOverdue = Color(0xFFB43A3A);
}

extension AppThemeX on BuildContext {
  bool get _dark => Theme.of(this).brightness == Brightness.dark;
  Color get appBg         => _dark ? AppColors.backgroundDark  : AppColors.background;
  Color get appSurface    => _dark ? AppColors.surfaceDark      : AppColors.surface;
  Color get appSurface2   => _dark ? AppColors.surface2Dark     : const Color(0xFFF0F2F1);
  Color get appBorder       => _dark ? AppColors.borderDark       : AppColors.border;
  Color get appBorderStrong => _dark ? AppColors.borderStrongDark : AppColors.borderStrong;
  Color get appText         => _dark ? AppColors.textDark         : AppColors.text;
  Color get appTextMuted  => _dark ? AppColors.textMutedDark    : AppColors.textMuted;
  Color get appTextSubtle => _dark ? AppColors.textSubtleDark   : AppColors.textSubtle;
}

class AppTheme {
  static ThemeData get dark => ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.primaryDarkMode,
          brightness: Brightness.dark,
          primary: AppColors.primaryDarkMode,
          surface: AppColors.surfaceDark,
          // Force light text on surface/background so cards don't render
          // "white text on white card" in dark mode (Material 3 seed default
          // sometimes produces an `onSurface` that's still too dark).
          onSurface: AppColors.textDark,
          onSurfaceVariant: AppColors.textMutedDark,
          onPrimary: Colors.white,
          onBackground: AppColors.textDark,
        ),
        scaffoldBackgroundColor: AppColors.backgroundDark,
        textTheme: const TextTheme(
          displayLarge: TextStyle(color: AppColors.textDark),
          displayMedium: TextStyle(color: AppColors.textDark),
          displaySmall: TextStyle(color: AppColors.textDark),
          headlineLarge: TextStyle(color: AppColors.textDark),
          headlineMedium: TextStyle(color: AppColors.textDark),
          headlineSmall: TextStyle(color: AppColors.textDark),
          titleLarge: TextStyle(color: AppColors.textDark),
          titleMedium: TextStyle(color: AppColors.textDark),
          titleSmall: TextStyle(color: AppColors.textDark),
          bodyLarge: TextStyle(color: AppColors.textDark),
          bodyMedium: TextStyle(color: AppColors.textDark),
          bodySmall: TextStyle(color: AppColors.textMutedDark),
          labelLarge: TextStyle(color: AppColors.textDark),
          labelMedium: TextStyle(color: AppColors.textDark),
          labelSmall: TextStyle(color: AppColors.textMutedDark),
        ),
        iconTheme: const IconThemeData(color: AppColors.textDark),
        listTileTheme: const ListTileThemeData(
          textColor: AppColors.textDark,
          iconColor: AppColors.textMutedDark,
        ),
        dialogTheme: const DialogThemeData(
          backgroundColor: AppColors.surfaceDark,
          surfaceTintColor: Colors.transparent,
        ),
        bottomSheetTheme: const BottomSheetThemeData(
          backgroundColor: AppColors.surfaceDark,
          surfaceTintColor: Colors.transparent,
        ),
        popupMenuTheme: const PopupMenuThemeData(
          color: AppColors.surfaceDark,
          surfaceTintColor: Colors.transparent,
          textStyle: TextStyle(color: AppColors.textDark),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: AppColors.surfaceDark,
          foregroundColor: AppColors.textDark,
          elevation: 0,
          scrolledUnderElevation: 0,
          titleTextStyle: TextStyle(
            color: AppColors.textDark,
            fontSize: 18,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.5,
          ),
        ),
        cardTheme: CardThemeData(
          color: AppColors.surfaceDark,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: AppColors.borderDark),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primaryDarkMode,
            foregroundColor: Colors.white,
            elevation: 0,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            padding: const EdgeInsets.symmetric(vertical: 14),
            textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.surfaceDark,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.borderDark),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.borderDark),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.primaryDarkMode, width: 1.5),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          hintStyle: const TextStyle(color: AppColors.textMutedDark, fontSize: 14),
          labelStyle: const TextStyle(color: AppColors.textMutedDark),
          floatingLabelStyle: const TextStyle(color: AppColors.primaryDarkMode),
        ),
      );

  static ThemeData get light => ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          primary: AppColors.primary,
          surface: AppColors.surface,
          onSurface: AppColors.text,
          onSurfaceVariant: AppColors.textMuted,
          onPrimary: Colors.white,
        ),
        scaffoldBackgroundColor: AppColors.background,
        textTheme: const TextTheme(
          displayLarge: TextStyle(color: AppColors.text),
          displayMedium: TextStyle(color: AppColors.text),
          displaySmall: TextStyle(color: AppColors.text),
          headlineLarge: TextStyle(color: AppColors.text),
          headlineMedium: TextStyle(color: AppColors.text),
          headlineSmall: TextStyle(color: AppColors.text),
          titleLarge: TextStyle(color: AppColors.text),
          titleMedium: TextStyle(color: AppColors.text),
          titleSmall: TextStyle(color: AppColors.text),
          bodyLarge: TextStyle(color: AppColors.text),
          bodyMedium: TextStyle(color: AppColors.text),
          bodySmall: TextStyle(color: AppColors.textMuted),
          labelLarge: TextStyle(color: AppColors.text),
          labelMedium: TextStyle(color: AppColors.text),
          labelSmall: TextStyle(color: AppColors.textMuted),
        ),
        listTileTheme: const ListTileThemeData(
          textColor: AppColors.text,
          iconColor: AppColors.textMuted,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: AppColors.surface,
          foregroundColor: AppColors.text,
          elevation: 0,
          scrolledUnderElevation: 0,
          titleTextStyle: TextStyle(
            color: AppColors.text,
            fontSize: 18,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.5,
          ),
        ),
        cardTheme: CardThemeData(
          color: AppColors.surface,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: const BorderSide(color: AppColors.border),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            elevation: 0,
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            padding: const EdgeInsets.symmetric(vertical: 14),
            textStyle:
                const TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: AppColors.surface,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(10),
            borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
          ),
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          hintStyle:
              const TextStyle(color: AppColors.textMuted, fontSize: 14),
          labelStyle: const TextStyle(color: AppColors.textMuted),
          floatingLabelStyle: const TextStyle(color: AppColors.primary),
        ),
      );
}
