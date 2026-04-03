const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ── 팀 데이터 ──
const TEAMS = [
  { id: 1, name: "엔진품질기획팀", project: "엔진품질 실패비용 의사결정 AI Agent", desc: "엔진품질 실패비용 의사결정 지원", members: "양영철, 조재훈, 조남준", company: "HD현대중공업" },
  { id: 2, name: "ICT솔루션연구실", project: "INTEGRICT Transformer DGA Report Copilot Agent", desc: "Transformer DGA Report 분석 지원", members: "민다함, 김준엽, 손준영", company: "HD현대일렉트릭" },
  { id: 3, name: "글로벌구매기획부", project: "HD현대 구매AI \"PROCURA\"", desc: "구매 업무 AI 지원", members: "박성완, 오승훈, 신소라", company: "HD한국조선해양" },
  { id: 4, name: "건기기능구매팀", project: "협력사 재무 risk 분석 Agent", desc: "협력사 재무 리스크 분석 지원", members: "김병욱, 고재훈", company: "HD건설기계" },
  { id: 5, name: "기장설계부", project: "Valve List Agent", desc: "Valve List 업무 자동화 지원", members: "진가람", company: "HD현대이엔티" },
];

// ── 기본 설정값 ──
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

// ── 헬퍼 ──
async function getSetting(key) {
  const doc = await db.collection('settings').doc(key).get();
  return doc.exists ? doc.data().value : (DEFAULTS[key] || '');
}

async function getSettingsObj() {
  const snap = await db.collection('settings').get();
  const obj = { ...DEFAULTS };
  snap.forEach(doc => { obj[doc.id] = doc.data().value; });
  return obj;
}

async function getJudgeList() {
  const snap = await db.collection('judges').orderBy('created_at').get();
  return snap.docs.map(d => d.id);
}

async function checkAdminPw(pw) {
  const stored = await getSetting('admin_password');
  return pw === stored;
}

// 관리자 인증 미들웨어
async function adminAuth(req, res, next) {
  const pw = req.headers['x-admin-pw'] || req.body?.password;
  if (!pw || !(await checkAdminPw(pw))) {
    return res.status(401).json({ error: '비밀번호가 올바르지 않습니다' });
  }
  next();
}

// ════════════════════════════════════════════
// 팀 API
// ════════════════════════════════════════════
app.get('/api/teams', (req, res) => {
  res.json(TEAMS);
});

// ════════════════════════════════════════════
// 인기투표 API
// ════════════════════════════════════════════
app.post('/api/vote/verify', async (req, res) => {
  try {
    const { voter_id } = req.body;
    if (!voter_id || !/^[A-Za-z]\d{6}$/.test(voter_id)) {
      return res.status(400).json({ error: '사번은 영문 1자리 + 숫자 6자리입니다 (예: A000000)' });
    }
    const doc = await db.collection('public_votes').doc(voter_id).get();
    if (doc.exists) {
      return res.json({ already_voted: true, team_id: doc.data().team_id });
    }
    res.json({ already_voted: false });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/vote', async (req, res) => {
  try {
    const { voter_id, voter_name, team_id } = req.body;
    if (!voter_id || !voter_name || !team_id) {
      return res.status(400).json({ error: '필수 항목이 누락되었습니다' });
    }
    if (!/^[A-Za-z]\d{6}$/.test(voter_id)) {
      return res.status(400).json({ error: '사번은 영문 1자리 + 숫자 6자리입니다 (예: A000000)' });
    }
    if (!TEAMS.find(t => t.id === team_id)) {
      return res.status(400).json({ error: '유효하지 않은 팀입니다' });
    }
    const ref = db.collection('public_votes').doc(voter_id);
    const existing = await ref.get();
    if (existing.exists) return res.status(409).json({ error: '이미 투표하셨습니다' });
    await ref.set({ voter_name, team_id, voted_at: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

// ════════════════════════════════════════════
// 사전심사 점수 API (관리자 직접 입력)
// ════════════════════════════════════════════
app.get('/api/admin/preliminary-scores', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('preliminary_scores').get();
    const scores = {};
    snap.forEach(d => { scores[d.id] = d.data().score; });
    res.json(scores);
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/admin/preliminary-scores', adminAuth, async (req, res) => {
  try {
    const { scores } = req.body;
    if (!scores || typeof scores !== 'object') {
      return res.status(400).json({ error: '점수 데이터가 필요합니다' });
    }
    const batch = db.batch();
    Object.entries(scores).forEach(([teamId, score]) => {
      batch.set(db.collection('preliminary_scores').doc(String(teamId)), {
        score: Number(score),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

// ════════════════════════════════════════════
// 심사위원 API
// ════════════════════════════════════════════
app.post('/api/judge/auth', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: '이름을 입력해주세요' });
    const judges = await getJudgeList();
    if (!judges.includes(name.trim())) {
      return res.status(401).json({ error: '등록된 심사위원이 아닙니다' });
    }
    res.json({ success: true, name: name.trim() });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

app.get('/api/judge/scores/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const judges = await getJudgeList();
    if (!judges.includes(name)) return res.status(401).json({ error: '권한 없음' });
    const snap = await db.collection('judge_scores').where('judge_name', '==', name).get();
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/judge/score', async (req, res) => {
  try {
    const { judge_name, team_id, innovation, completeness, impact, presentation } = req.body;
    if (!judge_name || !team_id) return res.status(400).json({ error: '필수 항목 누락' });
    const judges = await getJudgeList();
    if (!judges.includes(judge_name)) return res.status(401).json({ error: '권한 없음' });
    if (!TEAMS.find(t => t.id === team_id)) return res.status(400).json({ error: '유효하지 않은 팀' });
    const scores = [innovation, completeness, impact, presentation];
    if (scores.some(s => !s || s < 1 || s > 10)) {
      return res.status(400).json({ error: '점수는 1~10 사이여야 합니다' });
    }
    const docId = `${judge_name}__${team_id}`;
    await db.collection('judge_scores').doc(docId).set({
      judge_name, team_id, innovation, completeness, impact, presentation,
      submitted_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

// ════════════════════════════════════════════
// 심사위원 관리 API (관리자)
// ════════════════════════════════════════════
app.get('/api/admin/judges', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('judges').orderBy('created_at').get();
    const rows = snap.docs.map(d => ({ id: d.id, name: d.id, ...d.data() }));
    res.json(rows);
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/admin/judges', adminAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: '이름을 입력해주세요' });
    const ref = db.collection('judges').doc(name.trim());
    const existing = await ref.get();
    if (existing.exists) return res.status(409).json({ error: '이미 등록된 심사위원입니다' });
    await ref.set({ created_at: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

app.delete('/api/admin/judges/:name', adminAuth, async (req, res) => {
  try {
    await db.collection('judges').doc(req.params.name).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

// ════════════════════════════════════════════
// 예측 API
// ════════════════════════════════════════════
app.post('/api/predict/verify', async (req, res) => {
  try {
    const { voter_id } = req.body;
    if (!voter_id || !/^[A-Za-z]\d{6}$/.test(voter_id)) {
      return res.status(400).json({ error: '사번은 영문 1자리 + 숫자 6자리입니다 (예: A000000)' });
    }
    const doc = await db.collection('predictions').doc(voter_id).get();
    if (doc.exists) {
      return res.json({ already_predicted: true, predicted_team_id: doc.data().predicted_team_id });
    }
    res.json({ already_predicted: false });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/predict', async (req, res) => {
  try {
    const { voter_id, voter_name, predicted_team_id } = req.body;
    if (!voter_id || !voter_name || !predicted_team_id) {
      return res.status(400).json({ error: '필수 항목이 누락되었습니다' });
    }
    if (!/^[A-Za-z]\d{6}$/.test(voter_id)) {
      return res.status(400).json({ error: '사번은 영문 1자리 + 숫자 6자리입니다 (예: A000000)' });
    }
    if (!TEAMS.find(t => t.id === predicted_team_id)) {
      return res.status(400).json({ error: '유효하지 않은 팀입니다' });
    }
    const ref = db.collection('predictions').doc(voter_id);
    const existing = await ref.get();
    if (existing.exists) return res.status(409).json({ error: '이미 참여하셨습니다' });
    await ref.set({ voter_name, predicted_team_id, predicted_at: admin.firestore.FieldValue.serverTimestamp() });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

// ════════════════════════════════════════════
// 관리자 API
// ════════════════════════════════════════════
app.post('/api/admin/auth', async (req, res) => {
  try {
    const { password } = req.body;
    if (!(await checkAdminPw(password))) return res.status(401).json({ error: '비밀번호 오류' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/admin/change-password', adminAuth, async (req, res) => {
  try {
    const { new_password } = req.body;
    if (!new_password || new_password.length < 4) {
      return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다' });
    }
    await db.collection('settings').doc('admin_password').set({ value: new_password });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

app.get('/api/admin/results', adminAuth, async (req, res) => {
  try {
    const settings = await getSettingsObj();
    const judgeWeight = parseInt(settings.judge_weight) || 50;
    const publicWeight = parseInt(settings.public_weight) || 30;
    const prelimWeight = parseInt(settings.preliminary_weight) || 20;
    const invW = parseInt(settings.innovation_weight) || 25;
    const comW = parseInt(settings.completeness_weight) || 25;
    const impW = parseInt(settings.impact_weight) || 30;
    const preW = parseInt(settings.presentation_weight) || 20;
    const totalCriteriaW = invW + comW + impW + preW;

    // 데이터 병렬 조회
    const [votesSnap, prelimScoresSnap, scoresSnap, predsSnap, judgesSnap] = await Promise.all([
      db.collection('public_votes').get(),
      db.collection('preliminary_scores').get(),
      db.collection('judge_scores').get(),
      db.collection('predictions').get(),
      db.collection('judges').get(),
    ]);

    const totalVotes = votesSnap.size || 1;

    // 팀별 투표수 집계
    const voteMap = {};
    votesSnap.forEach(d => { const tid = d.data().team_id; voteMap[tid] = (voteMap[tid] || 0) + 1; });
    const prelimScoresMap = {};
    prelimScoresSnap.forEach(d => { prelimScoresMap[d.id] = d.data().score; });

    // 심사 점수
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
      const prelimScore = prelimScoresMap[String(team.id)] || 0;
      const finalScore = judgeAvg * (judgeWeight / 10) + publicScore * (publicWeight / 10) + prelimScore * (prelimWeight / 10);

      return {
        ...team,
        judgeAvg: Math.round(judgeAvg * 100) / 100,
        voteCount: teamVotes,
        publicScore: Math.round(publicScore * 100) / 100,
        prelimScore: Math.round(prelimScore * 100) / 100,
        finalScore: Math.round(finalScore * 100) / 100,
      };
    }).sort((a, b) => b.finalScore - a.finalScore);

    res.json({
      results,
      summary: {
        totalVotes: votesSnap.size,
        judgeCount: judgeNames.size,
        totalJudges: judgesSnap.size,
        totalPredictions: predsSnap.size,
        teamCount: TEAMS.length,
      },
      settings,
    });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류' }); }
});

app.get('/api/admin/votes', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('public_votes').orderBy('voted_at', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, voter_id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});


app.get('/api/admin/predictions', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('predictions').orderBy('predicted_at', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, voter_id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

app.get('/api/admin/judge-scores', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('judge_scores').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: '설정 데이터가 필요합니다' });
    }
    const batch = db.batch();
    Object.entries(settings).forEach(([k, v]) => {
      batch.set(db.collection('settings').doc(k), { value: String(v) });
    });
    await batch.commit();
    const updated = await getSettingsObj();
    res.json({ success: true, settings: updated });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/admin/reset', adminAuth, async (req, res) => {
  try {
    const collections = ['public_votes', 'judge_scores', 'predictions', 'draw_winners', 'preliminary_scores'];
    for (const col of collections) {
      const snap = await db.collection(col).get();
      const batch = db.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    }
    // 설정 초기화 (비밀번호 제외)
    const batch = db.batch();
    Object.entries(DEFAULTS).forEach(([k, v]) => {
      if (k !== 'admin_password') {
        batch.set(db.collection('settings').doc(k), { value: v });
      }
    });
    await batch.commit();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

// ════════════════════════════════════════════
// 추첨 API
// ════════════════════════════════════════════
app.get('/api/draw/eligible', adminAuth, async (req, res) => {
  try {
    const winnerTeamId = await getSetting('winner_team_id');
    if (!winnerTeamId) {
      return res.json({ eligible: [], winnerTeam: null, drawnIds: [] });
    }
    const tid = parseInt(winnerTeamId);
    const winnerTeam = TEAMS.find(t => t.id === tid);
    const predsSnap = await db.collection('predictions').where('predicted_team_id', '==', tid).get();
    const eligible = predsSnap.docs.map(d => ({ voter_id: d.id, voter_name: d.data().voter_name }));
    const drawnSnap = await db.collection('draw_winners').get();
    const drawnIds = drawnSnap.docs.map(d => d.id);
    res.json({ eligible, winnerTeam, drawnIds });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

app.post('/api/draw/pick', adminAuth, async (req, res) => {
  try {
    const winnerTeamId = await getSetting('winner_team_id');
    if (!winnerTeamId) return res.status(400).json({ error: '1위 팀이 확정되지 않았습니다' });
    const tid = parseInt(winnerTeamId);

    const predsSnap = await db.collection('predictions').where('predicted_team_id', '==', tid).get();
    const eligible = predsSnap.docs.map(d => ({ voter_id: d.id, voter_name: d.data().voter_name }));
    const drawnSnap = await db.collection('draw_winners').get();
    const drawnIds = drawnSnap.docs.map(d => d.id);
    const remaining = eligible.filter(e => !drawnIds.includes(e.voter_id));

    if (remaining.length === 0) return res.status(400).json({ error: '추첨 가능한 사람이 없습니다' });

    const pick = remaining[Math.floor(Math.random() * remaining.length)];
    await db.collection('draw_winners').doc(pick.voter_id).set({
      voter_name: pick.voter_name,
      drawn_at: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ winner: pick });
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

app.get('/api/draw/winners', adminAuth, async (req, res) => {
  try {
    const snap = await db.collection('draw_winners').orderBy('drawn_at').get();
    res.json(snap.docs.map(d => ({ id: d.id, voter_id: d.id, voter_name: d.data().voter_name, drawn_at: d.data().drawn_at })));
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
});

// ════════════════════════════════════════════
exports.api = onRequest({ region: 'asia-northeast3' }, app);
exports.app = app;
