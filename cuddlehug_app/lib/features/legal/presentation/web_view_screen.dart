import 'dart:async';

import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Full-screen in-app browser for the legal pages (Privacy Policy, Terms).
///
/// Also exposes an "open in browser" action so the same URL can be handed
/// to the system browser when the customer prefers it.
class WebViewScreen extends StatefulWidget {
  const new({required this.title, required this.url, super.key});

  final String title;
  final String url;

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;
  var _progress = 0;
  var _failed = false;
  var _finished = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController();
    unawaited(_startLoad());
  }

  Future<void> _startLoad() async {
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
      ),
    );
    await _controller.loadRequest(Uri.parse(widget.url));
  }

  Future<void> _openExternally() async {
    final uri = Uri.parse(widget.url);
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
              onPressed: _openExternally,
            ),
          ],
        ),
        body: _failed
            ? Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.cloud_off_rounded,
                        size: 56,
                        color: AppColors.mutedForeground,
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Could not load this page',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Check your connection, or open it in your browser.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.mutedForeground),
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        width: 220,
                        child: AppButton(
                          label: 'Open in browser',
                          onPressed: _openExternally,
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
