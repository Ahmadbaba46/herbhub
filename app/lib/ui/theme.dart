import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show SystemUiOverlayStyle;

/// HerbHub colours — the "Arewa green + gold" design shared with Bua Family.
/// Text colours meet WCAG AA on their intended backgrounds.
abstract final class Herb {
  /// Dark mode in use. Set from the member's choice (or the phone setting);
  /// the app rebuilds everything when it changes.
  static bool dark = false;

  static Color _pick(int light, int night) => Color(dark ? night : light);

  /// Deep green for text on white chips and buttons, the same in both modes.
  static const onWhite = Color(0xFF134A2C);

  static Color get green => _pick(0xFF1D6B40, 0xFF2F8F59);
  static Color get greenDark => _pick(0xFF134A2C, 0xFFA8DDB9);
  static Color get greenTint => _pick(0xFFE3F0E7, 0xFF1E3326);
  static Color get greenIndicator => _pick(0xFFD6EADC, 0xFF27432F);

  static Color get ground => _pick(0xFFF4F6F2, 0xFF0F1511);
  static Color get surface => _pick(0xFFFFFFFF, 0xFF18201B);
  static Color get surfaceMuted => _pick(0xFFEEF2EC, 0xFF202A23);
  static Color get track => _pick(0xFFE6EBE5, 0xFF26312A);
  static Color get line => _pick(0xFFDDE3DA, 0xFF2C3830);
  static Color get lineStrong => _pick(0xFFC9D3CC, 0xFF3B4A40);

  static Color get ink => _pick(0xFF17231B, 0xFFE8EEE9);
  static Color get inkBody => _pick(0xFF2A372E, 0xFFD5DDD7);
  static Color get inkMuted => _pick(0xFF4E5C52, 0xFFB4C0B7);
  static Color get inkSubtle => _pick(0xFF5B6960, 0xFF9AA79E);

  static Color get gold => const Color(0xFFC99A3B);
  static Color get goldTint => _pick(0xFFFBF3E3, 0xFF2E2618);
  static Color get goldLine => _pick(0xFFEAD7AE, 0xFF5A4A28);
  static Color get goldInk => _pick(0xFF8A5A12, 0xFFE2C98F);

  static Color get danger => _pick(0xFFB3261E, 0xFFDB5248);
  static Color get dangerInk => _pick(0xFF8C1D17, 0xFFF2B8B3);
  static Color get dangerTint => _pick(0xFFFDECEA, 0xFF3A1D1B);

  static Color get info => _pick(0xFF2F6F8F, 0xFF6DB3D2);
  static Color get infoTint => _pick(0xFFDCECF2, 0xFF142A33);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: Herb.green,
    brightness: Herb.dark ? Brightness.dark : Brightness.light,
  ).copyWith(
    primary: Herb.green,
    onPrimary: Colors.white,
    primaryContainer: Herb.greenTint,
    onPrimaryContainer: Herb.greenDark,
    secondary: Herb.gold,
    tertiary: Herb.goldInk,
    tertiaryContainer: Herb.goldTint,
    surface: Herb.surface,
    onSurface: Herb.ink,
    onSurfaceVariant: Herb.inkMuted,
    surfaceContainerLowest: Herb.surface,
    surfaceContainerLow: Herb.ground,
    surfaceContainer: Herb.surfaceMuted,
    surfaceContainerHigh: Herb.surfaceMuted,
    surfaceContainerHighest: Herb.track,
    outline: Herb.lineStrong,
    outlineVariant: Herb.line,
    error: Herb.danger,
  );

  const radius14 = BorderRadius.all(Radius.circular(14));
  OutlineInputBorder border(Color c, [double w = 1]) =>
      OutlineInputBorder(borderRadius: const BorderRadius.all(Radius.circular(12)), borderSide: BorderSide(color: c, width: w));

  final base = ThemeData(useMaterial3: true, colorScheme: scheme, fontFamily: 'NotoSans');
  final text = base.textTheme.apply(bodyColor: Herb.ink, displayColor: Herb.ink).copyWith(
        headlineSmall: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Herb.ink),
        titleLarge: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: Herb.ink),
        titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: Herb.ink),
        titleSmall: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Herb.ink),
        bodyLarge: TextStyle(fontSize: 15, height: 1.5, color: Herb.inkBody),
        bodyMedium: TextStyle(fontSize: 14, color: Herb.ink),
        bodySmall: TextStyle(fontSize: 13, color: Herb.inkSubtle),
        labelLarge: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        labelSmall: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
      ).apply(fontFamily: 'NotoSans');

  return base.copyWith(
    scaffoldBackgroundColor: Herb.ground,
    textTheme: text,
    appBarTheme: AppBarTheme(
      backgroundColor: Herb.ground,
      foregroundColor: Herb.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      systemOverlayStyle: Herb.dark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      titleTextStyle: TextStyle(fontFamily: 'NotoSans', fontSize: 20, fontWeight: FontWeight.w700, color: Herb.ink),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: Herb.green,
        foregroundColor: Colors.white,
        minimumSize: const Size(64, 48),
        shape: const RoundedRectangleBorder(borderRadius: radius14),
        textStyle: const TextStyle(fontFamily: 'NotoSans', fontSize: 15, fontWeight: FontWeight.w600),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: Herb.greenDark,
        minimumSize: const Size(64, 48),
        side: BorderSide(color: Herb.lineStrong),
        shape: const RoundedRectangleBorder(borderRadius: radius14),
        textStyle: const TextStyle(fontFamily: 'NotoSans', fontSize: 14, fontWeight: FontWeight.w600),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: Herb.dark ? Herb.greenDark : Herb.green,
        minimumSize: const Size(44, 44),
        textStyle: const TextStyle(fontFamily: 'NotoSans', fontSize: 14, fontWeight: FontWeight.w600),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Herb.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: border(Herb.lineStrong),
      enabledBorder: border(Herb.lineStrong),
      focusedBorder: border(Herb.green, 2),
      errorBorder: border(Herb.danger),
      labelStyle: TextStyle(color: Herb.inkMuted),
      hintStyle: TextStyle(color: Herb.inkSubtle),
    ),
    cardTheme: CardThemeData(
      color: Herb.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(20))),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Herb.surface,
      selectedColor: Herb.green,
      side: BorderSide(color: Herb.lineStrong),
      shape: const StadiumBorder(),
      showCheckmark: false,
      labelStyle: TextStyle(fontFamily: 'NotoSans', fontSize: 13, fontWeight: FontWeight.w500, color: Herb.ink),
      secondaryLabelStyle:
          const TextStyle(fontFamily: 'NotoSans', fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Herb.surface,
      surfaceTintColor: Colors.transparent,
      indicatorColor: Herb.greenIndicator,
      height: 76,
      labelTextStyle: WidgetStateProperty.resolveWith((s) => TextStyle(
            fontFamily: 'NotoSans',
            fontSize: 11.5,
            fontWeight: s.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: s.contains(WidgetState.selected) ? Herb.greenDark : Herb.inkMuted,
          )),
      iconTheme: WidgetStateProperty.resolveWith(
          (s) => IconThemeData(color: s.contains(WidgetState.selected) ? Herb.greenDark : Herb.inkMuted)),
    ),
    tabBarTheme: TabBarThemeData(
      labelColor: Herb.greenDark,
      unselectedLabelColor: Herb.inkMuted,
      indicatorColor: Herb.green,
      indicatorSize: TabBarIndicatorSize.tab,
      dividerColor: Herb.line,
      labelStyle: const TextStyle(fontFamily: 'NotoSans', fontSize: 14, fontWeight: FontWeight.w700),
      unselectedLabelStyle: const TextStyle(fontFamily: 'NotoSans', fontSize: 14, fontWeight: FontWeight.w500),
    ),
    dividerTheme: DividerThemeData(color: Herb.surfaceMuted, space: 1, thickness: 1),
    switchTheme: SwitchThemeData(
      thumbColor: const WidgetStatePropertyAll(Colors.white),
      trackColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Herb.green : Herb.lineStrong),
      trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? Herb.green : null),
    ),
    floatingActionButtonTheme: FloatingActionButtonThemeData(
      backgroundColor: Herb.green,
      foregroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(18))),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
    dialogTheme: DialogThemeData(
      backgroundColor: Herb.surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.all(Radius.circular(24))),
    ),
    bottomSheetTheme: BottomSheetThemeData(backgroundColor: Herb.surface, surfaceTintColor: Colors.transparent),
    badgeTheme: BadgeThemeData(backgroundColor: Herb.danger),
  );
}
