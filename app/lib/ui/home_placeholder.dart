import 'package:flutter/material.dart';
import 'theme.dart';

/// Temporary first screen so the themed shell runs end-to-end while the real
/// Owner / Helper / Patient flows are built out. Shows the approved design.
class HomePlaceholder extends StatefulWidget {
  const HomePlaceholder({super.key, required this.configured});
  final bool configured;

  @override
  State<HomePlaceholder> createState() => _HomePlaceholderState();
}

class _HomePlaceholderState extends State<HomePlaceholder> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('HerbHub')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Foundation ready',
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Herb.ink)),
                const SizedBox(height: 6),
                Text(
                  widget.configured
                      ? 'Connected to Supabase. The Owner, Helper and Patient flows are being built on top of this shell.'
                      : 'Set SUPABASE_URL and SUPABASE_ANON_KEY with --dart-define to connect the backend.',
                  style: TextStyle(color: Herb.inkMuted, height: 1.5),
                ),
              ]),
            ),
          ),
          const SizedBox(height: 14),
          Wrap(spacing: 8, runSpacing: 8, children: const [
            _Chip('Remedies'),
            _Chip('Services'),
            _Chip('Jobs'),
            _Chip('Chat'),
            _Chip('Payments'),
          ]),
          const SizedBox(height: 14),
          FilledButton(onPressed: () {}, child: const Text('Primary action')),
        ],
      ),
      floatingActionButton: FloatingActionButton(onPressed: () {}, child: const Icon(Icons.add)),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.science_outlined), selectedIcon: Icon(Icons.science), label: 'Catalog'),
          NavigationDestination(icon: Icon(Icons.chat_bubble_outline), selectedIcon: Icon(Icons.chat_bubble), label: 'Chats'),
          NavigationDestination(icon: Icon(Icons.insights_outlined), selectedIcon: Icon(Icons.insights), label: 'Insights'),
          NavigationDestination(icon: Icon(Icons.menu), selectedIcon: Icon(Icons.menu), label: 'More'),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Chip(label: Text(label));
}
