// 로컬 개발용: firebase emulators:start와 함께 사용
// 또는 단독으로 Firestore 에뮬레이터에 연결
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
process.env.GCLOUD_PROJECT = 'demo-ai-contest';

const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-ai-contest' });

const { app } = require('./index');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Local dev server on http://localhost:${PORT}`);
  console.log(`Firestore emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
});
