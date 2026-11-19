import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config.dart';
import 'ui/theme.dart';
import 'ui/home_placeholder.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final configured = supabaseUrl.isNotEmpty && supabaseKey.isNotEmpty;
  if (configured) {
    await Supabase.initialize(url: supabaseUrl, anonKey: supabaseKey);
  }
  runApp(ProviderScope(child: HerbHubApp(configured: configured)));
}

/// Locales the patient app supports. English, Hausa and Arabic (right-to-left).
const supportedLocales = [
  Locale('en'),
  Locale('ha'),
  Locale('ar'),
];

class HerbHubApp extends StatelessWidget {
  const HerbHubApp({super.key, required this.configured});

  final bool configured;

  @override
  Widget build(BuildContext context) {
    final brightness = MediaQuery.platformBrightnessOf(context);
    Herb.dark = brightness == Brightness.dark;
    return MaterialApp(
      title: 'HerbHub',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: supportedLocales,
      home: HomePlaceholder(configured: configured),
    );
  }
}
