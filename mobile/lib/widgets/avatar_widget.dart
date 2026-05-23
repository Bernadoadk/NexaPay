import 'package:flutter/material.dart';

class AvatarWidget extends StatelessWidget {
  final String name;
  final String color;
  final double size;
  final String? photoUrl;

  const AvatarWidget({
    super.key,
    required this.name,
    required this.color,
    this.size = 36,
    this.photoUrl,
  });

  String get _initials {
    final parts = name.trim().split(' ').where((s) => s.isNotEmpty).toList();
    if (parts.isEmpty) return '?';
    if (parts.length == 1) return parts[0][0].toUpperCase();
    return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
  }

  Color get _bgColor {
    try {
      final hex = color.replaceFirst('#', '');
      return Color(int.parse('FF$hex', radix: 16));
    } catch (_) {
      return const Color(0xFF0F8F65);
    }
  }

  @override
  Widget build(BuildContext context) {
    final radius = BorderRadius.circular(size * 0.3);

    if (photoUrl != null && photoUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: radius,
        child: Image.network(
          photoUrl!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _buildInitials(radius),
        ),
      );
    }

    return _buildInitials(radius);
  }

  Widget _buildInitials(BorderRadius radius) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: _bgColor, borderRadius: radius),
      child: Center(
        child: Text(
          _initials,
          style: TextStyle(
            color: Colors.white,
            fontSize: size * 0.38,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
