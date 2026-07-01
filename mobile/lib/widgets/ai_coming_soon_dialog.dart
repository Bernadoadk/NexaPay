import 'package:flutter/material.dart';

Future<void> showAiComingSoonDialog(BuildContext context) {
  return showDialog<void>(
    context: context,
    builder: (dialogContext) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      titlePadding: const EdgeInsets.fromLTRB(22, 20, 22, 0),
      contentPadding: const EdgeInsets.fromLTRB(22, 12, 22, 4),
      actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
      title: const Row(
        children: [
          Icon(Icons.schedule_rounded, color: Color(0xFF0F8F65)),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Fonctionnalité IA en préparation',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
      content: const Text(
        "Nous finalisons l'activation des services IA afin de garantir une expérience fiable. Cette option sera disponible prochainement.",
        style: TextStyle(fontSize: 13.5, height: 1.45),
      ),
      actions: [
        FilledButton(
          onPressed: () => Navigator.of(dialogContext).pop(),
          child: const Text("D'accord"),
        ),
      ],
    ),
  );
}
