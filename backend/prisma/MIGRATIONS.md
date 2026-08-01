# Migrations Prisma en production

## Règle de sécurité

Vercel exécute `npm run db:deploy`, qui lance uniquement `prisma migrate deploy`.
Ne remettez jamais `prisma db push` dans le build Vercel : cette commande peut
proposer la suppression de tables. Le garde-fou `scripts/verify-migrations.mjs`
bloque aussi les migrations contenant `DROP TABLE`, `DROP COLUMN`, `DROP TYPE`,
`TRUNCATE` ou `DELETE FROM`.

## Initialiser l'historique (une fois, au prochain déploiement)

La migration `20260801121500_baseline` représente le schéma actuel. Lors du
premier déploiement sur une base Neon déjà remplie, le script détecte l'erreur
Prisma `P3005`, marque uniquement cette baseline comme appliquée, puis lance
les migrations. La baseline n'est donc jamais exécutée sur Neon : aucune table
ni donnée existante n'est modifiée. Les tables hors schéma Prisma sont aussi
préservées.

## Changements futurs

1. Modifier `prisma/schema.prisma`.
2. Créer la migration sur une base de développement, jamais sur Neon production :
   `npx prisma migrate dev --name description_du_changement`.
3. Relire `migration.sql`, versionner la migration avec le code, puis pousser.
4. Si le SQL est destructif, le déploiement sera bloqué : faire une sauvegarde
   Neon et planifier une intervention manuelle validée.
