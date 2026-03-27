/**
 * Node.js용 시드 스크립트 (test-seed.js 기반)
 * 실행: node test-seed-node.mjs
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCsIhHtkEHySddlG1CnOXyljX8rIghG-OQ",
  authDomain: "ai-contest-vote.firebaseapp.com",
  projectId: "ai-contest-vote",
  storageBucket: "ai-contest-vote.firebasestorage.app",
  messagingSenderId: "135860317606",
  appId: "1:135860317606:web:a118f601f527b4a848b367",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const log = (emoji, msg) => console.log(`${emoji} ${msg}`);

const lastNames = ['김','이','박','최','정','강','조','윤','장','임','한','오','서','신','권','황','안','송','류','홍'];
const firstNames = ['민수','서연','지훈','하늘','유진','도현','서준','소희','태경','민재','지영','성훈','은별','동욱','하은','수빈','예린','준호','채원','현우'];
const genName = (i) => lastNames[i % 20] + firstNames[i % 20];
const genId = (prefix, i) => `${prefix}${String(i).padStart(6, '0')}`;

// ════════════════════════════════════════
// STEP 1: 데이터 초기화
// ════════════════════════════════════════
log('🗑️', '\nSTEP 1: 기존 데이터 초기화 중...');
const colsToClean = ['public_votes', 'preliminary_votes', 'predictions', 'judge_scores', 'draw_winners', 'vote_draw_winners', 'judges'];
for (const colName of colsToClean) {
  const snap = await getDocs(collection(db, colName));
  if (snap.size > 0) {
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    log('  ', `  ${colName}: ${snap.size}건 삭제`);
  }
}

const defaults = {
  judge_weight: '50', public_weight: '30', preliminary_weight: '20',
  winner_team_id: '', innovation_weight: '25', completeness_weight: '25',
  impact_weight: '30', presentation_weight: '20',
};
const settingsBatch = writeBatch(db);
Object.entries(defaults).forEach(([k, v]) => {
  settingsBatch.set(doc(db, 'settings', k), { value: v });
});
await settingsBatch.commit();
log('✅', 'STEP 1 완료: 데이터 초기화됨\n');

// ════════════════════════════════════════
// STEP 2: 심사위원 5명 등록
// ════════════════════════════════════════
log('⚖️', 'STEP 2: 심사위원 5명 등록 중...');
const judgeNames = ['김위원장', '이심사', '박평가', '최전문', '정위원'];
for (const name of judgeNames) {
  await setDoc(doc(db, 'judges', name), { created_at: serverTimestamp() });
}
log('✅', `STEP 2 완료: [${judgeNames.join(', ')}] 등록됨\n`);

// ════════════════════════════════════════
// STEP 3: 사전 심사 투표 5명
// ════════════════════════════════════════
log('📋', 'STEP 3: 사전 심사 투표 5명 진행 중...');
const prelimVotes = [
  { id: 'P000001', name: '사전심사_박부장', team: 1 },
  { id: 'P000002', name: '사전심사_김차장', team: 2 },
  { id: 'P000003', name: '사전심사_이과장', team: 3 },
  { id: 'P000004', name: '사전심사_정대리', team: 3 },
  { id: 'P000005', name: '사전심사_한주임', team: 5 },
];
for (const v of prelimVotes) {
  await setDoc(doc(db, 'preliminary_votes', v.id), {
    voter_id: v.id, voter_name: v.name, team_id: v.team, voted_at: serverTimestamp()
  });
}
log('  ', '  Team1=1표, Team2=1표, Team3=2표, Team4=0표, Team5=1표');
log('✅', 'STEP 3 완료: 사전 심사 투표 5명 완료\n');

// ════════════════════════════════════════
// STEP 4: 1등을 찾아라 예측 100명
// ════════════════════════════════════════
log('🎯', 'STEP 4: 1등을 찾아라 예측 100명 진행 중...');
const predDist = [
  { team: 1, count: 30 },
  { team: 2, count: 20 },
  { team: 3, count: 25 },
  { team: 4, count: 15 },
  { team: 5, count: 10 },
];
let predIdx = 0;
for (const { team, count } of predDist) {
  const batch = writeBatch(db);
  for (let i = 0; i < count; i++) {
    const id = genId('E', predIdx);
    batch.set(doc(db, 'predictions', id), {
      voter_id: id,
      voter_name: `예측자_${genName(predIdx)}`,
      predicted_team_id: team,
      predicted_at: serverTimestamp(),
    });
    predIdx++;
  }
  await batch.commit();
}
log('  ', '  Team1=30명, Team2=20명, Team3=25명, Team4=15명, Team5=10명');
log('✅', `STEP 4 완료: 예측 ${predIdx}명 완료\n`);

// ════════════════════════════════════════
// STEP 5: 심사위원 평가 5명 × 5팀
// ════════════════════════════════════════
log('⭐', 'STEP 5: 심사위원 5명 × 5팀 평가 진행 중...');
const judgeScoreData = {
  '김위원장': { 1:[7,7,8,7], 2:[6,7,7,6], 3:[9,9,9,8], 4:[7,6,7,7], 5:[6,6,6,7] },
  '이심사':   { 1:[8,7,7,8], 2:[7,6,7,7], 3:[9,8,9,9], 4:[6,7,7,6], 5:[7,6,6,6] },
  '박평가':   { 1:[7,8,8,7], 2:[7,7,6,7], 3:[8,9,9,9], 4:[7,7,7,7], 5:[6,7,6,7] },
  '최전문':   { 1:[8,7,7,7], 2:[6,6,7,6], 3:[9,9,8,9], 4:[7,6,8,6], 5:[7,6,7,6] },
  '정위원':   { 1:[7,7,8,8], 2:[7,7,7,7], 3:[9,8,9,8], 4:[6,7,7,7], 5:[6,7,6,6] },
};
for (const [judge, teams] of Object.entries(judgeScoreData)) {
  const batch = writeBatch(db);
  for (let tid = 1; tid <= 5; tid++) {
    const [innovation, completeness, impact, presentation] = teams[tid];
    batch.set(doc(db, 'judge_scores', `${judge}__${tid}`), {
      judge_name: judge, team_id: tid,
      innovation, completeness, impact, presentation,
      submitted_at: serverTimestamp(),
    });
  }
  await batch.commit();
  log('  ', `  ${judge}: 5팀 평가 완료`);
}
log('✅', 'STEP 5 완료: 심사위원 평가 25건 완료\n');

// ════════════════════════════════════════
// STEP 6: 현장 인기투표 100명
// ════════════════════════════════════════
log('🗳️', 'STEP 6: 현장 인기투표 100명 진행 중...');
const voteDist = [
  { team: 1, count: 15 },
  { team: 2, count: 20 },
  { team: 3, count: 35 },
  { team: 4, count: 10 },
  { team: 5, count: 20 },
];
let voteIdx = 0;
for (const { team, count } of voteDist) {
  const batch = writeBatch(db);
  for (let i = 0; i < count; i++) {
    const id = genId('V', voteIdx);
    batch.set(doc(db, 'public_votes', id), {
      voter_id: id,
      voter_name: `투표자_${genName(voteIdx)}`,
      team_id: team,
      voted_at: serverTimestamp(),
    });
    voteIdx++;
  }
  await batch.commit();
}
log('  ', '  Team1=15표, Team2=20표, Team3=35표, Team4=10표, Team5=20표');
log('✅', `STEP 6 완료: 인기투표 ${voteIdx}명 완료\n`);

// ════════════════════════════════════════
// 완료
// ════════════════════════════════════════
log('🎉', '══════════════════════════════════════');
log('🎉', '  데이터 시딩 완료!');
log('🎉', '══════════════════════════════════════');
log('📊', '');
log('📊', '  투입된 데이터:');
log('📊', '  ├─ 사전심사 투표:   5명');
log('📊', '  ├─ 1등 예측:       100명');
log('📊', '  ├─ 심사위원 평가:   25건 (5명 × 5팀)');
log('📊', '  └─ 현장 인기투표:   100명');
log('📊', '');
log('🏆', '  예상 최종 순위:');
log('🏆', '  🥇 1위: Team Spark  (HD현대인프라코어)');
log('🏆', '  🥈 2위: Team Alpha  (HD한국조선해양)');
log('🏆', '  🥉 3위: Team Nova   (HD현대건설기계)');
log('🏆', '     4위: Team Zenith (HD현대마린솔루션)');
log('🏆', '     5위: Team Orbit  (HD현대일렉트릭)');
log('', '');
log('👀', '  확인 페이지:');
log('', '  /admin       → 관리자(비번: ai1234) 종합 순위 확인');
log('', '  /ceremony    → 시상식 순차 공개');
log('', '  /draw        → 1등 예측 추첨');
log('', '  /random-vote → 인기투표 추첨');

process.exit(0);
