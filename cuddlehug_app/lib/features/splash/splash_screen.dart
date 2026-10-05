import 'package:cuddlehug_app/core/routing/route_paths.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/features/auth/application/auth_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Session bootstrap (plan §5.4): restore the session from secure storage,
/// shown for a minimum of 400ms so it never flashes, then land on home.
class SplashScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  Future<void> _bootstrap() async {
    final stopwatch = Stopwatch()..start();
    await ref.read(authControllerProvider.notifier).restoreSession();
    final elapsed = stopwatch.elapsedMilliseconds;
    if (elapsed < 400) {
      await Future<void>.delayed(Duration(milliseconds: 400 - elapsed));
    }
    if (!mounted) return;
    // A push / OS deep link may already have navigated somewhere more
    // specific while we were restoring the session — never clobber it.
    if (GoRouterState.of(context).matchedLocation != RoutePaths.splash) return;
    context.go(RoutePaths.home);
  }

  @override
  Widget build(BuildContext context) => const Scaffold(
    backgroundColor: AppColors.background,
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'CuddleHug',
            style: TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w800,
              color: AppColors.foreground,
            ),
          ),
          SizedBox(height: 24),
          CircularProgressIndicator(),
        ],
      ),
    ),
  );
}
