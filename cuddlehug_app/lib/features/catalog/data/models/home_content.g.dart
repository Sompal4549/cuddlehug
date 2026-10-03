// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'home_content.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

HeroSlide _$HeroSlideFromJson(Map<String, dynamic> json) =>
    HeroSlide(image: json['image'] as String, alt: json['alt'] as String);

Map<String, dynamic> _$HeroSlideToJson(HeroSlide instance) => <String, dynamic>{
  'image': instance.image,
  'alt': instance.alt,
};

HomeContent _$HomeContentFromJson(Map<String, dynamic> json) => HomeContent(
  settings: json['settings'] as Map<String, dynamic>,
  categories: (json['categories'] as List<dynamic>)
      .map((e) => ShopCategory.fromJson(e as Map<String, dynamic>))
      .toList(),
  featured: (json['featured'] as List<dynamic>)
      .map((e) => ProductCard.fromJson(e as Map<String, dynamic>))
      .toList(),
  bestSellers: (json['bestSellers'] as List<dynamic>)
      .map((e) => ProductCard.fromJson(e as Map<String, dynamic>))
      .toList(),
  newArrivals: (json['newArrivals'] as List<dynamic>)
      .map((e) => ProductCard.fromJson(e as Map<String, dynamic>))
      .toList(),
  hero:
      (json['hero'] as List<dynamic>?)
          ?.map((e) => HeroSlide.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$HomeContentToJson(HomeContent instance) =>
    <String, dynamic>{
      'settings': instance.settings,
      'categories': instance.categories,
      'featured': instance.featured,
      'bestSellers': instance.bestSellers,
      'newArrivals': instance.newArrivals,
      'hero': instance.hero,
    };
