# Migrations Prisma en production

## Règle de sécurité

Vercel exécute `npm run db:deploy`, qui lance uniquement `prisma migrate deploy`.
Ne remettez jamais `prisma db push` dans le build Vercel : cette commande peut
proposer la suppression de tables. Le garde-fou `scripts/verify-migrations.mjs`
bloque aussi les migrations contenant `DROP TABLE`, `DROP COLUMN`, `DROP TYPE`,
`TRUNCATE` ou `DELETE FROM`.

## Initialiser l'historique (une fois, avant le prochain changement de schéma)

Neon contient déjà des utilisateurs. Créez une migration *baseline* puis
marquez-la comme appliquée : elle ne doit jamais être exécutée sur Neon.

```powershell
New-Item -ItemType Directory -Force prisma/migrations/20260801000000_baseline
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script | Set-Content -Encoding utf8 prisma/migrations/20260801000000_baseline/migration.sql
npx prisma migrate resolve --applied 20260801000000_baseline
npx prisma migrate status
```

La deuxième commande écrit seulement l'historique Prisma ; elle ne modifie pas
les tables métier. Exécutez les commandes avec `DATABASE_URL` pointant vers
Neon production. Ne poussez la baseline qu'après `migrate resolve`, sinon
Vercel tentera de créer des tables qui existent déjà.

## Changements futurs

1. Modifier `prisma/schema.prisma`.
2. Créer la migration sur une base de développement, jamais sur Neon production :
   `npx prisma migrate dev --name description_du_changement`.
3. Relire `migration.sql`, versionner la migration avec le code, puis pousser.
4. Si le SQL est destructif, le déploiement sera bloqué : faire une sauvegarde
   Neon et planifier une intervention manuelle validée.
