import 'dart:async';

import 'package:cuddlehug_app/core/config/app_config.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Full-screen in-app browser for the legal pages (Privacy Policy, Terms).
///
/// Also exposes an "open in browser" action so the same URL can be handed
/// to the system browser when the customer prefers it.
///
/// Navigation policy (plan §16):
/// * only `http`/`https` URLs may load — `javascript:`, `file:`, `data:` and
///   custom schemes are refused before they reach the WebView;
/// * only first-party hosts may load *inside* the app; anything else is
///   handed to the system browser instead of being rendered with app origin
///   privileges;
/// * the initial URL is validated by the same rule, so a misconfigured
///   caller cannot open an arbitrary page.
class WebViewScreen extends StatefulWidget {
  const new({required this.title, required this.url, super.key});

  final String title;
  final String url;

  /// Hosts that may render inside the app WebView.
  static bool isAllowedHost(String host) {
    final lower = host.toLowerCase();
    return lower == 'cuddlehug.com' ||
        lower.endsWith('.cuddlehug.com') ||
        lower == 'cuddlehug.in' ||
        lower.endsWith('.cuddlehug.in') ||
        lower == Uri.parse(AppConfig.current.webAssetBase).host;
  }

  /// `http(s)` + first-party host.
  static bool isAllowedInApp(Uri uri) =>
      (uri.scheme == 'http' || uri.scheme == 'https') &&
      uri.host.isNotEmpty &&
      isAllowedHost(uri.host);

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;
  var _progress = 0;
  var _failed = false;
  var _finished = false;
  var _blocked = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController();
    unawaited(_startLoad());
  }

  Future<void> _startLoad() async {
    final uri = Uri.tryParse(widget.url);
    if (uri == null || !WebViewScreen.isAllowedInApp(uri)) {
      if (mounted) setState(() => _blocked = true);
      return;
    }
    await _controller.setJavaScriptMode(JavaScriptMode.unrestricted);
    await _controller.setNavigationDelegate(
      NavigationDelegate(
        onProgress: (progress) {
          if (mounted) setState(() => _progress = progress);
        },
        onPageFinished: (_) {
          if (mounted) setState(() => _finished = true);
        },
        onWebResourceError: (error) {
          if ((error.isForMainFrame ?? false) && mounted) {
            setState(() => _failed = true);
          }
        },
        onNavigationRequest: (request) {
          final target = Uri.tryParse(request.url);
          if (target != null && WebViewScreen.isAllowedInApp(target)) {
            return NavigationDecision.navigate;
          }
          // Anything else leaves the app: no silent redirect into an
          // untrusted origin, and no custom-scheme execution.
          unawaited(_openExternally(request.url));
          return NavigationDecision.prevent;
        },
      ),
    );
    await _controller.loadRequest(uri);
  }

  Future<void> _openExternally([String? raw]) async {
    final uri = Uri.tryParse(raw ?? widget.url);
    if (uri == null) return;
    if (uri.scheme != 'http' && uri.scheme != 'https') return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.title),
      actions: [
        IconButton(
          tooltip: 'Open in browser',
          icon: const Icon(Icons.open_in_new_rounded),
          onPressed: _blocked ? null : () => unawaited(_openExternally()),
        ),
      ],
    ),
    body: _blocked || _failed
        ? Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.block_rounded,
                    size: 56,
                    color: AppColors.mutedForeground,
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Could not load this page',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Check your connection, or open it in your browser.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.mutedForeground),
                  ),
                  const SizedBox(height: 24),
                  if (!_blocked)
                    SizedBox(
                      width: 220,
                      child: AppButton(
                        label: 'Open in browser',
                        onPressed: () => unawaited(_openExternally()),
                      ),
                    ),
                ],
              ),
            ),
          )
        : Column(
            children: [
              if (!_finished)
                LinearProgressIndicator(
                  value: _progress == 0 ? null : _progress / 100,
                ),
              Expanded(child: WebViewWidget(controller: _controller)),
            ],
          ),
  );
}
