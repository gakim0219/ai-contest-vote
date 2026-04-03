import { db } from './firebase';
import {
  doc, getDoc, setDoc, getDocs, deleteDoc,
  collection, query, where, writeBatch,
  serverTimestamp,
} from 'firebase/firestore';

// ── 팀 데이터 ──
const TEAMS = [
  { id: 1, name: "엔진품질기획팀", project: "엔진품질 실패비용 의사결정 AI Agent", desc: "엔진품질 실패비용 의사결정 지원", members: "양영철, 조재훈, 조남준", company: "HD현대중공업" },
  { id: 2, name: "ICT솔루션연구실", project: "INTEGRICT Transformer DGA Report Copilot Agent", desc: "Transformer DGA Report 분석 지원", members: "민다함, 김준엽, 손준영", company: "HD현대일렉트릭" },
  { id: 3, name: "글로벌구매기획부", project: "HD현대 구매AI \"PROCURA\"", desc: "구매 업무 AI 지원", members: "박성완, 오승훈, 신소라", company: "HD한국조선해양" },
  { id: 4, name: "건기기능구매팀", project: "협력사 재무 risk 분석 Agent", desc: "협력사 재무 리스크 분석 지원", members: "김병욱, 고재훈", company: "HD건설기계" },
  { id: 5, name: "기장설계부", project: "Valve List Agent", desc: "Valve List 업무 자동화 지원", members: "진가람", company: "HD현대이엔티" },
];

const DEFAULTS = {
  admin_password: 'ai1234',
  judge_weight: '30',
  public_weight: '20',
  preliminary_weight: '50',
  winner_team_id: '',
  innovation_weight: '25',
  completeness_weight: '25',
  impact_weight: '30',
  presentation_weight: '20',
};

async function getSetting(key) {
  const snap = await getDoc(doc(db, 'settings', key));
  return snap.exists() ? snap.data().value : (DEFAULTS[key] || '');
}

async function getSettingsObj() {
  const snap = await getDocs(collection(db, 'settings'));
  const obj = { ...DEFAULTS };
  snap.forEach(d => { obj[d.id] = d.data().value; });
  return obj;
}

// ── 팀 ──
export const getTeams = () => Promise.resolve(TEAMS);

// ── 인기투표 ──
export async function verifyVote(voter_id) {
  const snap = await getDoc(doc(db, 'public_votes', voter_id));
  if (snap.exists()) return { already_voted: true, team_id: snap.data().team_id };
  return { already_voted: false };
}

export async function submitVote(voter_id, voter_name, team_id) {
  const ref = doc(db, 'public_votes', voter_id);
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error('이미 투표하셨습니다');
  await setDoc(ref, { voter_id, voter_name, team_id, voted_at: serverTimestamp() });
  return { success: true };
}

// ── 사전심사 (관리자 점수 입력) ──
export async function getPreliminaryScores() {
  const snap = await getDocs(collection(db, 'preliminary_scores'));
  const scores = {};
  snap.forEach(d => { scores[d.id] = d.data().score; });
  return scores;
}

export async function savePreliminaryScores(scores) {
  const batch = writeBatch(db);
  Object.entries(scores).forEach(([teamId, score]) => {
    batch.set(doc(db, 'preliminary_scores', String(teamId)), { score: Number(score), updated_at: serverTimestamp() });
  });
  await batch.commit();
  return { success: true };
}

// ── 심사위원 ──
export async function judgeAuth(name) {
  const snap = await getDoc(doc(db, 'judges', name.trim()));
  if (!snap.exists()) throw new Error('등록된 심사위원이 아닙니다');
  return { success: true, name: name.trim() };
}

export async function getJudgeScores(name) {
  const snap = await getDocs(query(collection(db, 'judge_scores'), where('judge_name', '==', name)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function submitJudgeScore(data) {
  const docId = `${data.judge_name}__${data.team_id}`;
  await setDoc(doc(db, 'judge_scores', docId), { ...data, submitted_at: serverTimestamp() });
  return { success: true };
}

// ── 예측 ──
export async function verifyPredict(voter_id) {
  const snap = await getDoc(doc(db, 'predictions', voter_id));
  if (snap.exists()) return { already_predicted: true, predicted_team_id: snap.data().predicted_team_id };
  return { already_predicted: false };
}

export async function submitPredict(voter_id, voter_name, predicted_team_id) {
  const ref = doc(db, 'predictions', voter_id);
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error('이미 참여하셨습니다');
  await setDoc(ref, { voter_id, voter_name, predicted_team_id, predicted_at: serverTimestamp() });
  return { success: true };
}

// ── 관리자 인증 ──
export async function adminAuth(password) {
  const stored = await getSetting('admin_password');
  if (password !== stored) throw new Error('비밀번호 오류');
  return { success: true };
}

// ── 관리자: 결과 집계 ──
export async function getResults(_pw) {
  const settings = await getSettingsObj();
  const judgeWeight = parseInt(settings.judge_weight) || 50;
  const publicWeight = parseInt(settings.public_weight) || 30;
  const prelimWeight = parseInt(settings.preliminary_weight) || 20;
  const invW = parseInt(settings.innovation_weight) || 25;
  const comW = parseInt(settings.completeness_weight) || 25;
  const impW = parseInt(settings.impact_weight) || 30;
  const preW = parseInt(settings.presentation_weight) || 20;
  const totalCriteriaW = invW + comW + impW + preW;

  const [votesSnap, prelimScores, scoresSnap, predsSnap, judgesSnap] = await Promise.all([
    getDocs(collection(db, 'public_votes')),
    getPreliminaryScores(),
    getDocs(collection(db, 'judge_scores')),
    getDocs(collection(db, 'predictions')),
    getDocs(collection(db, 'judges')),
  ]);

  const totalVotes = votesSnap.size || 1;
  const voteMap = {};
  votesSnap.forEach(d => { const tid = d.data().team_id; voteMap[tid] = (voteMap[tid] || 0) + 1; });
  const allScores = scoresSnap.docs.map(d => d.data());
  const judgeNames = new Set(allScores.map(s => s.judge_name));

  const maxVotes = Math.max(...TEAMS.map(t => voteMap[t.id] || 0), 1);

  const results = TEAMS.map(team => {
    const teamScores = allScores.filter(s => s.team_id === team.id);
    let judgeAvg = 0;
    if (teamScores.length > 0) {
      const avgInv = teamScores.reduce((a, s) => a + s.innovation, 0) / teamScores.length;
      const avgCom = teamScores.reduce((a, s) => a + s.completeness, 0) / teamScores.length;
      const avgImp = teamScores.reduce((a, s) => a + s.impact, 0) / teamScores.length;
      const avgPre = teamScores.reduce((a, s) => a + s.presentation, 0) / teamScores.length;
      judgeAvg = (avgInv * invW + avgCom * comW + avgImp * impW + avgPre * preW) / totalCriteriaW;
    }
    const teamVotes = voteMap[team.id] || 0;
    const publicScore = (teamVotes / maxVotes) * 10;
    const prelimScore = prelimScores[String(team.id)] || 0;
    const finalScore = judgeAvg * (judgeWeight / 10) + publicScore * (publicWeight / 10) + prelimScore * (prelimWeight / 10);
    return {
      ...team, judgeAvg: Math.round(judgeAvg * 100) / 100, voteCount: teamVotes,
      publicScore: Math.round(publicScore * 100) / 100,
      prelimScore: Math.round(prelimScore * 100) / 100, finalScore: Math.round(finalScore * 100) / 100,
    };
  }).sort((a, b) => b.finalScore - a.finalScore);

  return {
    results,
    summary: { totalVotes: votesSnap.size, judgeCount: judgeNames.size, totalJudges: judgesSnap.size, totalPredictions: predsSnap.size, teamCount: TEAMS.length },
    settings,
  };
}

// ── 관리자: 상세 조회 ──
export async function getVotes(_pw) {
  const snap = await getDocs(collection(db, 'public_votes'));
  return snap.docs.map(d => ({ id: d.id, voter_id: d.id, ...d.data() }));
}

export async function getPredictions(_pw) {
  const snap = await getDocs(collection(db, 'predictions'));
  return snap.docs.map(d => ({ id: d.id, voter_id: d.id, ...d.data() }));
}
export async function getJudgeScoresAdmin(_pw) {
  const snap = await getDocs(collection(db, 'judge_scores'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ── 관리자: 설정 ──
export async function updateSettings(_pw, settings) {
  const batch = writeBatch(db);
  Object.entries(settings).forEach(([k, v]) => {
    batch.set(doc(db, 'settings', k), { value: String(v) });
  });
  await batch.commit();
  return { success: true, settings: await getSettingsObj() };
}

// ── 관리자: 초기화 ──
export async function resetData(_pw) {
  const cols = ['public_votes', 'judge_scores', 'predictions', 'draw_winners', 'vote_draw_winners', 'preliminary_scores'];
  for (const col of cols) {
    const snap = await getDocs(collection(db, col));
    if (snap.size > 0) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }
  const batch = writeBatch(db);
  Object.entries(DEFAULTS).forEach(([k, v]) => {
    if (k !== 'admin_password') batch.set(doc(db, 'settings', k), { value: v });
  });
  await batch.commit();
  return { success: true };
}

// ── 심사위원 관리 ──
export async function getJudges(_pw) {
  const snap = await getDocs(collection(db, 'judges'));
  return snap.docs.map(d => ({ id: d.id, name: d.id, ...d.data() }));
}
export async function addJudge(_pw, name) {
  const ref = doc(db, 'judges', name.trim());
  const existing = await getDoc(ref);
  if (existing.exists()) throw new Error('이미 등록된 심사위원입니다');
  await setDoc(ref, { created_at: serverTimestamp() });
  return { success: true };
}
export async function removeJudge(_pw, name) {
  await deleteDoc(doc(db, 'judges', name));
  return { success: true };
}

// ── 추첨 ──
export async function getEligible(_pw) {
  const winnerTeamId = await getSetting('winner_team_id');
  if (!winnerTeamId) return { eligible: [], winnerTeam: null, drawnIds: [] };
  const tid = parseInt(winnerTeamId);
  const winnerTeam = TEAMS.find(t => t.id === tid);
  const predsSnap = await getDocs(query(collection(db, 'predictions'), where('predicted_team_id', '==', tid)));
  const eligible = predsSnap.docs.map(d => ({ voter_id: d.id, voter_name: d.data().voter_name }));
  const drawnSnap = await getDocs(collection(db, 'draw_winners'));
  const drawnIds = drawnSnap.docs.map(d => d.id);
  return { eligible, winnerTeam, drawnIds };
}

export async function drawPick(_pw) {
  const winnerTeamId = await getSetting('winner_team_id');
  if (!winnerTeamId) throw new Error('1위 팀이 확정되지 않았습니다');
  const tid = parseInt(winnerTeamId);
  const predsSnap = await getDocs(query(collection(db, 'predictions'), where('predicted_team_id', '==', tid)));
  const eligible = predsSnap.docs.map(d => ({ voter_id: d.id, voter_name: d.data().voter_name }));
  const drawnSnap = await getDocs(collection(db, 'draw_winners'));
  const drawnIds = drawnSnap.docs.map(d => d.id);
  const remaining = eligible.filter(e => !drawnIds.includes(e.voter_id));
  if (remaining.length === 0) throw new Error('추첨 가능한 사람이 없습니다');
  const pick = remaining[Math.floor(Math.random() * remaining.length)];
  await setDoc(doc(db, 'draw_winners', pick.voter_id), { voter_name: pick.voter_name, drawn_at: serverTimestamp() });
  return { winner: pick };
}

export async function getDrawWinners(_pw) {
  const snap = await getDocs(collection(db, 'draw_winners'));
  return snap.docs.map(d => ({ id: d.id, voter_id: d.id, voter_name: d.data().voter_name, drawn_at: d.data().drawn_at }));
}

// ── 인기투표 + 예측투표 통합 랜덤 추첨 ──
export async function getVoteDrawEligible(_pw) {
  const [votesSnap, predsSnap, drawnSnap] = await Promise.all([
    getDocs(collection(db, 'public_votes')),
    getDocs(collection(db, 'predictions')),
    getDocs(collection(db, 'vote_draw_winners')),
  ]);
  const seen = new Set();
  const eligible = [];
  votesSnap.docs.forEach(d => {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      eligible.push({ voter_id: d.id, voter_name: d.data().voter_name });
    }
  });
  predsSnap.docs.forEach(d => {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      eligible.push({ voter_id: d.id, voter_name: d.data().voter_name });
    }
  });
  const drawnIds = drawnSnap.docs.map(d => d.id);
  return { eligible, drawnIds };
}

export async function voteDrawPick(_pw) {
  const { eligible, drawnIds } = await getVoteDrawEligible(_pw);
  const remaining = eligible.filter(e => !drawnIds.includes(e.voter_id));
  if (remaining.length === 0) throw new Error('추첨 가능한 사람이 없습니다');
  const pick = remaining[Math.floor(Math.random() * remaining.length)];
  await setDoc(doc(db, 'vote_draw_winners', pick.voter_id), { voter_name: pick.voter_name, drawn_at: serverTimestamp() });
  return { winner: pick };
}

export async function getVoteDrawWinners(_pw) {
  const snap = await getDocs(collection(db, 'vote_draw_winners'));
  return snap.docs.map(d => ({ id: d.id, voter_id: d.id, voter_name: d.data().voter_name, drawn_at: d.data().drawn_at }));
}
