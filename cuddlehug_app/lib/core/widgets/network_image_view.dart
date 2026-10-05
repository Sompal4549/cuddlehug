import 'package:cached_network_image/cached_network_image.dart';
import 'package:cuddlehug_app/core/theme/colors.dart';
import 'package:cuddlehug_app/core/utils/image_url_resolver.dart';
import 'package:flutter/material.dart';

/// Renders backend/seeded image paths with graceful loading and error
/// fallbacks (plan §4.5 resolver + local placeholder asset).
class NetworkImageView extends StatelessWidget {
  const new({
    required this.url,
    super.key,
    this.width,
    this.height,
    this.fit = BoxFit.cover,
  });

  final String? url;
  final double? width;
  final double? height;
  final BoxFit fit;

  static const placeholderAsset = 'assets/images/placeholder.png';

  @override
  Widget build(BuildContext context) {
    final resolved = resolveImageUrl(url);
    if (resolved.startsWith('assets/')) {
      return Image.asset(
        resolved,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: _fallback,
      );
    }
    return CachedNetworkImage(
      imageUrl: resolved,
      width: width,
      height: height,
      fit: fit,
      placeholder: (context, _) => _placeholder(),
      errorWidget: (context, _, _) => _fallback(context, null, null),
    );
  }

  Widget _placeholder() => Container(
    width: width,
    height: height,
    color: AppColors.muted,
    alignment: Alignment.center,
    child: const Icon(Icons.image_rounded, color: AppColors.border, size: 32),
  );

  Widget _fallback(BuildContext context, Object? error, StackTrace? stack) =>
      Image.asset(
        placeholderAsset,
        width: width,
        height: height,
        fit: fit,
        errorBuilder: (context, _, _) => _placeholder(),
      );
}
