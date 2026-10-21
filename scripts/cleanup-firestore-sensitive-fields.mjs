import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const projectId = process.argv.find((arg) => arg.startsWith('--project='))?.slice('--project='.length);
const applyChanges = process.argv.includes('--apply');
const backupAcknowledged = process.argv.includes('--acknowledge-backup');

if (!projectId) {
  console.error('Informe explicitamente o projeto: npm run cleanup:firestore-secrets -- --project=representapro-b84c3');
  process.exit(2);
}
if (applyChanges && !backupAcknowledged) {
  console.error('Para gravar, confirme que há backup: inclua --acknowledge-backup.');
  process.exit(2);
}
if (projectId === 'representapro-b84c3' && applyChanges && !backupAcknowledged) {
  console.error('A limpeza de produção exige backup confirmado.');
  process.exit(2);
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);
const sensitiveFields = ['senha', 'gmailUser', 'gmailAppPass'];
const counts = { usuarios: 0, empresas: 0, total: 0 };

for (const collectionName of ['usuarios', 'empresas']) {
  const snapshot = await db.collection(collectionName).get();
  const affected = snapshot.docs.filter((document) =>
    sensitiveFields.some((field) => Object.hasOwn(document.data(), field)),
  );
  counts[collectionName] = affected.length;
  counts.total += affected.length;

  if (applyChanges) {
    for (let offset = 0; offset < affected.length; offset += 400) {
      const batch = db.batch();
      affected.slice(offset, offset + 400).forEach((document) => {
        const patch = Object.fromEntries(sensitiveFields.map((field) => [field, FieldValue.delete()]));
        batch.update(document.ref, patch);
      });
      await batch.commit();
    }
  }
}

console.log(JSON.stringify({ projectId, mode: applyChanges ? 'apply' : 'dry-run', affectedDocuments: counts }, null, 2));
if (!applyChanges) {
  console.log('Dry-run: nenhuma alteração foi gravada. Faça backup e rode novamente com --apply --acknowledge-backup para limpar os campos.');
}
