/// Supabase connection, supplied at build/run time with --dart-define:
///   flutter run \
///     --dart-define=SUPABASE_URL=https://YOUR-PROJECT.supabase.co \
///     --dart-define=SUPABASE_ANON_KEY=YOUR-PUBLISHABLE-ANON-KEY
///
/// Never hard-code the keys in source. The anon (publishable) key is safe to
/// ship in the app; row-level security is what protects the data.
const String supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const String supabaseKey = String.fromEnvironment('SUPABASE_ANON_KEY');
