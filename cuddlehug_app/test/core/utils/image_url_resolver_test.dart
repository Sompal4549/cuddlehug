import 'package:cuddlehug_app/core/utils/image_url_resolver.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('absolute http(s) and data URIs pass through', () {
    expect(resolveImageUrl('https://res.cloudinary.com/demo/w_400/img.jpg'),
        'https://res.cloudinary.com/demo/w_400/img.jpg');
    expect(resolveImageUrl('http://example.com/a.png'), 'http://example.com/a.png');
    expect(resolveImageUrl('data:image/png;base64,AAA'), 'data:image/png;base64,AAA');
  });

  test('seeded /images assets resolve to the web origin', () {
    expect(resolveImageUrl('/images/products/bear.jpg'),
        'http://localhost:3000/images/products/bear.jpg');
  });

  test('backend /uploads paths resolve to the API origin', () {
    expect(resolveImageUrl('/uploads/1712345678_photo.jpg'),
        'http://10.0.2.2:5000/uploads/1712345678_photo.jpg');
  });

  test('empty values fall back to the placeholder asset', () {
    expect(resolveImageUrl(null), 'assets/images/placeholder.png');
    expect(resolveImageUrl(''), 'assets/images/placeholder.png');
    expect(resolveImageUrl('   '), 'assets/images/placeholder.png');
  });
}
