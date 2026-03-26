/**
 * 전체 투표 시나리오 테스트
 *
 * 시나리오 순서:
 *  1. 사전 심사 투표 5명
 *  2. 1등을 찾아라 예측 100명
 *  3. 심사위원 평가 5명
 *  4. 현장 인기투표 100명
 *  5. 결과 집계 & 등수 발표
 *  6. 1,2,3등 확인
 *  7. 1위 팀 확정 → 1등을 찾아라 랜덤 추첨
 *  8. 현장 인기투표 랜덤 추첨
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// ─── In-memory Firestore mock ───
const store = {};

function getCollection(colPath) {
  if (!store[colPath]) store[colPath] = {};
  return store[colPath];
}

function makeDocSnap(colPath, docId) {
  const col = getCollection(colPath);
  const d = col[docId];
  return {
    exists: () => !!d,
    data: () => d ? { ...d } : undefined,
    id: docId,
    ref: { colPath, docId },
  };
}

function makeQuerySnap(colPath, filterFn) {
  const col = getCollection(colPath);
  const entries = Object.entries(col).filter(([id, data]) => filterFn ? filterFn(id, data) : true);
  const docs = entries.map(([id, data]) => ({
    id,
    data: () => ({ ...data }),
    ref: { colPath, docId: id },
  }));
  return {
    docs,
    size: docs.length,
    forEach: (cb) => docs.forEach(cb),
  };
}

// Track mock refs for doc/collection
const docRefs = {};

vi.mock('firebase/firestore', () => ({
  doc: (_db, colPath, docId) => {
    const key = `${colPath}/${docId}`;
    docRefs[key] = { colPath, docId };
    return { __col: colPath, __id: docId };
  },
  getDoc: async (ref) => makeDocSnap(ref.__col, ref.__id),
  setDoc: async (ref, data) => {
    const col = getCollection(ref.__col);
    col[ref.__id] = { ...data };
  },
  getDocs: async (queryOrCol) => {
    if (queryOrCol.__queryCol) {
      return makeQuerySnap(queryOrCol.__queryCol, queryOrCol.__filterFn);
    }
    return makeQuerySnap(queryOrCol.__col);
  },
  deleteDoc: async (ref) => {
    const col = getCollection(ref.__col);
    delete col[ref.__id];
  },
  collection: (_db, colPath) => ({ __col: colPath }),
  query: (colRef, ...constraints) => {
    let filterFn = null;
    for (const c of constraints) {
      if (c.__type === 'where') {
        const { field, op, value } = c;
        filterFn = (_id, data) => {
          if (op === '==') return data[field] === value;
          return true;
        };
      }
    }
    return { __queryCol: colRef.__col, __filterFn: filterFn };
  },
  where: (field, op, value) => ({ __type: 'where', field, op, value }),
  writeBatch: (_db) => {
    const ops = [];
    return {
      set: (ref, data) => ops.push({ type: 'set', ref, data }),
      delete: (ref) => ops.push({ type: 'delete', ref }),
      commit: async () => {
        for (const op of ops) {
          if (op.type === 'set') {
            const col = getCollection(op.ref.__col || op.ref.colPath);
            const id = op.ref.__id || op.ref.docId;
            col[id] = { ...op.data };
          } else if (op.type === 'delete') {
            const col = getCollection(op.ref.colPath);
            delete col[op.ref.docId];
          }
        }
      },
    };
  },
  serverTimestamp: () => new Date().toISOString(),
}));

vi.mock('../firebase', () => ({ db: {} }));

// ─── Import API after mocks ───
let api;
beforeAll(async () => {
  api = await import('../api.js');
});

// ─── Helper: 한국 이름 생성 ───
const lastNames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
const firstNames = ['민수', '서연', '지훈', '하늘', '유진', '도현', '서준', '소희', '태경', '민재', '지영', '성훈', '은별', '동욱', '하은', '수빈', '예린', '준호', '채원', '현우'];

function generateName(index) {
  return lastNames[index % lastNames.length] + firstNames[index % firstNames.length];
}

function generateVoterId(index) {
  const letter = String.fromCharCode(65 + (index % 26)); // A-Z
  const num = String(index).padStart(6, '0');
  return `${letter}${num}`;
}

// ═══════════════════════════════════════
// 시나리오 테스트 시작
// ═══════════════════════════════════════

describe('전체 투표 시나리오 테스트', () => {

  // ── STEP 1: 사전 심사 투표 5명 ──
  describe('STEP 1: 사전 심사 투표 (5명)', () => {
    // 투표 분배: Team1=1, Team2=1, Team3=2, Team4=0, Team5=1
    const prelimVoters = [
      { id: 'P000001', name: '사전심사1', team: 1 },
      { id: 'P000002', name: '사전심사2', team: 2 },
      { id: 'P000003', name: '사전심사3', team: 3 },
      { id: 'P000004', name: '사전심사4', team: 3 },
      { id: 'P000005', name: '사전심사5', team: 5 },
    ];

    it('5명이 사전심사 투표 완료', async () => {
      for (const v of prelimVoters) {
        const verify = await api.verifyPreliminary(v.id);
        expect(verify.already_voted).toBe(false);
        const result = await api.submitPreliminary(v.id, v.name, v.team);
        expect(result.success).toBe(true);
      }
    });

    it('중복 투표 방지', async () => {
      const verify = await api.verifyPreliminary('P000001');
      expect(verify.already_voted).toBe(true);
      expect(verify.team_id).toBe(1);
      await expect(api.submitPreliminary('P000001', '사전심사1', 2)).rejects.toThrow('이미 투표하셨습니다');
    });

    it('사전심사 투표 수 확인', async () => {
      const votes = await api.getPreliminaryVotes('pw');
      expect(votes.length).toBe(5);
    });
  });

  // ── STEP 2: 1등을 찾아라 예측 100명 ──
  describe('STEP 2: 1등을 찾아라 예측 (100명)', () => {
    // 분배: Team1=30, Team2=20, Team3=25, Team4=15, Team5=10
    const predictions = [];
    for (let i = 0; i < 100; i++) {
      let team;
      if (i < 30) team = 1;
      else if (i < 50) team = 2;
      else if (i < 75) team = 3;
      else if (i < 90) team = 4;
      else team = 5;
      predictions.push({ id: generateVoterId(i), name: generateName(i), team });
    }

    it('100명이 예측 투표 완료', async () => {
      for (const p of predictions) {
        const verify = await api.verifyPredict(p.id);
        expect(verify.already_predicted).toBe(false);
        const result = await api.submitPredict(p.id, p.name, p.team);
        expect(result.success).toBe(true);
      }
    });

    it('중복 예측 방지', async () => {
      const verify = await api.verifyPredict(predictions[0].id);
      expect(verify.already_predicted).toBe(true);
      await expect(api.submitPredict(predictions[0].id, predictions[0].name, 1)).rejects.toThrow('이미 참여하셨습니다');
    });

    it('예측 총 수 확인', async () => {
      const preds = await api.getPredictions('pw');
      expect(preds.length).toBe(100);
    });

    it('팀별 예측 분포 확인', async () => {
      const preds = await api.getPredictions('pw');
      const teamCounts = {};
      preds.forEach(p => { teamCounts[p.predicted_team_id] = (teamCounts[p.predicted_team_id] || 0) + 1; });
      expect(teamCounts[1]).toBe(30);
      expect(teamCounts[2]).toBe(20);
      expect(teamCounts[3]).toBe(25);
      expect(teamCounts[4]).toBe(15);
      expect(teamCounts[5]).toBe(10);
    });
  });

  // ── STEP 3: 심사위원 평가 5명 ──
  describe('STEP 3: 심사위원 평가 (5명)', () => {
    const judges = ['심사위원A', '심사위원B', '심사위원C', '심사위원D', '심사위원E'];

    // 심사위원별 팀 점수 (innovation, completeness, impact, presentation)
    // Team3이 전반적으로 높은 점수를 받도록 설계
    const scores = {
      '심사위원A': { 1: [7,7,8,7], 2: [6,7,7,6], 3: [9,9,9,8], 4: [7,6,7,7], 5: [6,6,6,7] },
      '심사위원B': { 1: [8,7,7,8], 2: [7,6,7,7], 3: [9,8,9,9], 4: [6,7,7,6], 5: [7,6,6,6] },
      '심사위원C': { 1: [7,8,8,7], 2: [7,7,6,7], 3: [8,9,9,9], 4: [7,7,7,7], 5: [6,7,6,7] },
      '심사위원D': { 1: [8,7,7,7], 2: [6,6,7,6], 3: [9,9,8,9], 4: [7,6,8,6], 5: [7,6,7,6] },
      '심사위원E': { 1: [7,7,8,8], 2: [7,7,7,7], 3: [9,8,9,8], 4: [6,7,7,7], 5: [6,7,6,6] },
    };

    it('심사위원 5명 등록', async () => {
      for (const name of judges) {
        const result = await api.addJudge('pw', name);
        expect(result.success).toBe(true);
      }
      const list = await api.getJudges('pw');
      expect(list.length).toBe(5);
    });

    it('심사위원 인증 성공', async () => {
      for (const name of judges) {
        const result = await api.judgeAuth(name);
        expect(result.success).toBe(true);
        expect(result.name).toBe(name);
      }
    });

    it('미등록 심사위원 인증 실패', async () => {
      await expect(api.judgeAuth('가짜심사위원')).rejects.toThrow('등록된 심사위원이 아닙니다');
    });

    it('5명이 5개 팀에 대해 모두 평가 (총 25개 평가)', async () => {
      for (const judge of judges) {
        for (let teamId = 1; teamId <= 5; teamId++) {
          const [innovation, completeness, impact, presentation] = scores[judge][teamId];
          const result = await api.submitJudgeScore({
            judge_name: judge,
            team_id: teamId,
            innovation,
            completeness,
            impact,
            presentation,
          });
          expect(result.success).toBe(true);
        }
      }
    });

    it('심사위원별 평가 수 확인', async () => {
      for (const judge of judges) {
        const judgeScores = await api.getJudgeScores(judge);
        expect(judgeScores.length).toBe(5);
      }
    });

    it('전체 평가 수 확인 (25개)', async () => {
      const all = await api.getJudgeScoresAdmin('pw');
      expect(all.length).toBe(25);
    });
  });

  // ── STEP 4: 현장 인기투표 100명 ──
  describe('STEP 4: 현장 인기투표 (100명)', () => {
    // 분배: Team1=15, Team2=20, Team3=35, Team4=10, Team5=20
    // Team3이 인기투표에서도 1위
    const voters = [];
    for (let i = 0; i < 100; i++) {
      let team;
      if (i < 15) team = 1;
      else if (i < 35) team = 2;
      else if (i < 70) team = 3;
      else if (i < 80) team = 4;
      else team = 5;
      // V prefix로 사전심사/예측 투표자와 구분
      voters.push({ id: generateVoterId(200 + i), name: `투표자${i + 1}`, team });
    }

    it('100명이 인기투표 완료', async () => {
      for (const v of voters) {
        const verify = await api.verifyVote(v.id);
        expect(verify.already_voted).toBe(false);
        const result = await api.submitVote(v.id, v.name, v.team);
        expect(result.success).toBe(true);
      }
    });

    it('중복 투표 방지', async () => {
      const verify = await api.verifyVote(voters[0].id);
      expect(verify.already_voted).toBe(true);
      await expect(api.submitVote(voters[0].id, voters[0].name, 2)).rejects.toThrow('이미 투표하셨습니다');
    });

    it('인기투표 총 수 확인', async () => {
      const votes = await api.getVotes('pw');
      expect(votes.length).toBe(100);
    });

    it('팀별 인기투표 분포 확인', async () => {
      const votes = await api.getVotes('pw');
      const teamCounts = {};
      votes.forEach(v => { teamCounts[v.team_id] = (teamCounts[v.team_id] || 0) + 1; });
      expect(teamCounts[1]).toBe(15);
      expect(teamCounts[2]).toBe(20);
      expect(teamCounts[3]).toBe(35);
      expect(teamCounts[4]).toBe(10);
      expect(teamCounts[5]).toBe(20);
    });
  });

  // ── STEP 5: 결과 집계 & 등수 발표 ──
  describe('STEP 5: 결과 집계 & 등수 발표', () => {
    let results;

    it('관리자 인증', async () => {
      const result = await api.adminAuth('ai1234');
      expect(result.success).toBe(true);
    });

    it('잘못된 비밀번호 거부', async () => {
      await expect(api.adminAuth('wrong')).rejects.toThrow('비밀번호 오류');
    });

    it('결과 집계 성공', async () => {
      const data = await api.getResults('pw');
      results = data.results;
      expect(results.length).toBe(5);
      expect(data.summary.totalVotes).toBe(100);
      expect(data.summary.totalPrelimVotes).toBe(5);
      expect(data.summary.judgeCount).toBe(5);
      expect(data.summary.totalPredictions).toBe(100);
      expect(data.summary.teamCount).toBe(5);
    });

    it('Team Spark (Team3)이 종합 1위', async () => {
      const data = await api.getResults('pw');
      results = data.results;
      expect(results[0].id).toBe(3);
      expect(results[0].name).toBe('Team Spark');
      console.log('\n=== 최종 순위 ===');
      results.forEach((r, i) => {
        console.log(`  ${i + 1}위: ${r.name} (${r.company}) - 최종점수: ${r.finalScore}`);
        console.log(`       심사위원: ${r.judgeAvg} | 인기투표: ${r.publicScore} (${r.voteCount}표) | 사전심사: ${r.prelimScore} (${r.prelimVoteCount}표)`);
      });
    });

    it('모든 팀의 최종 점수가 0보다 큼', async () => {
      const data = await api.getResults('pw');
      data.results.forEach(r => {
        expect(r.finalScore).toBeGreaterThan(0);
      });
    });

    it('점수 내림차순 정렬 확인', async () => {
      const data = await api.getResults('pw');
      for (let i = 0; i < data.results.length - 1; i++) {
        expect(data.results[i].finalScore).toBeGreaterThanOrEqual(data.results[i + 1].finalScore);
      }
    });
  });

  // ── STEP 6: 1, 2, 3등 발표 ──
  describe('STEP 6: 1, 2, 3등 발표', () => {
    it('상위 3팀 확인', async () => {
      const data = await api.getResults('pw');
      const top3 = data.results.slice(0, 3);
      console.log('\n=== 🏆 시상식 발표 ===');
      console.log(`  🥇 1등: ${top3[0].name} (${top3[0].company}) - ${top3[0].finalScore}점`);
      console.log(`  🥈 2등: ${top3[1].name} (${top3[1].company}) - ${top3[1].finalScore}점`);
      console.log(`  🥉 3등: ${top3[2].name} (${top3[2].company}) - ${top3[2].finalScore}점`);

      expect(top3[0].id).toBe(3); // Team Spark 1등
      expect(top3.length).toBe(3);
      // 1등 점수가 2등보다 높음
      expect(top3[0].finalScore).toBeGreaterThan(top3[1].finalScore);
    });
  });

  // ── STEP 7: 1등을 찾아라 랜덤 추첨 ──
  describe('STEP 7: 1등을 찾아라 랜덤 추첨', () => {
    it('1위 팀 확정 전에는 추첨 불가', async () => {
      const eligible = await api.getEligible('pw');
      expect(eligible.eligible.length).toBe(0);
      expect(eligible.winnerTeam).toBeNull();
      await expect(api.drawPick('pw')).rejects.toThrow('1위 팀이 확정되지 않았습니다');
    });

    it('1위 팀(Team3) 확정', async () => {
      const result = await api.updateSettings('pw', { winner_team_id: '3' });
      expect(result.success).toBe(true);
    });

    it('Team3을 예측한 25명이 추첨 대상', async () => {
      const eligible = await api.getEligible('pw');
      expect(eligible.eligible.length).toBe(25);
      expect(eligible.winnerTeam.name).toBe('Team Spark');
      expect(eligible.drawnIds.length).toBe(0);
      console.log(`\n=== 1등을 찾아라 추첨 ===`);
      console.log(`  1위팀: ${eligible.winnerTeam.name}`);
      console.log(`  정답자 수: ${eligible.eligible.length}명`);
    });

    it('랜덤 1명 추첨 성공', async () => {
      const result = await api.drawPick('pw');
      expect(result.winner).toBeDefined();
      expect(result.winner.voter_id).toBeTruthy();
      expect(result.winner.voter_name).toBeTruthy();
      console.log(`  🎰 당첨자: ${result.winner.voter_name} (${result.winner.voter_id})`);
    });

    it('추첨 후 당첨자 목록 확인', async () => {
      const winners = await api.getDrawWinners('pw');
      expect(winners.length).toBe(1);
    });

    it('추첨 후 추첨 가능 인원 1명 감소', async () => {
      const eligible = await api.getEligible('pw');
      expect(eligible.drawnIds.length).toBe(1);
      const remaining = eligible.eligible.filter(e => !eligible.drawnIds.includes(e.voter_id));
      expect(remaining.length).toBe(24);
    });

    it('연속 추첨 시 중복 당첨 없음', async () => {
      // 2명 더 추첨
      const result2 = await api.drawPick('pw');
      const result3 = await api.drawPick('pw');
      const winners = await api.getDrawWinners('pw');
      expect(winners.length).toBe(3);

      // 모두 다른 사람인지 확인
      const ids = winners.map(w => w.voter_id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);

      console.log(`  추가 당첨자: ${result2.winner.voter_name}, ${result3.winner.voter_name}`);
      console.log(`  총 당첨자: ${winners.length}명`);
    });
  });

  // ── STEP 8: 현장 인기투표 랜덤 추첨 ──
  describe('STEP 8: 현장 인기투표 랜덤 추첨', () => {
    it('인기투표 참여자 100명이 추첨 대상', async () => {
      const eligible = await api.getVoteDrawEligible('pw');
      expect(eligible.eligible.length).toBe(100);
      expect(eligible.drawnIds.length).toBe(0);
      console.log(`\n=== 현장 인기투표 랜덤 추첨 ===`);
      console.log(`  추첨 대상: ${eligible.eligible.length}명`);
    });

    it('랜덤 1명 추첨 성공', async () => {
      const result = await api.voteDrawPick('pw');
      expect(result.winner).toBeDefined();
      expect(result.winner.voter_id).toBeTruthy();
      expect(result.winner.voter_name).toBeTruthy();
      console.log(`  🎲 당첨자: ${result.winner.voter_name} (${result.winner.voter_id})`);
    });

    it('추첨 후 당첨자 목록 확인', async () => {
      const winners = await api.getVoteDrawWinners('pw');
      expect(winners.length).toBe(1);
    });

    it('추첨 후 추첨 가능 인원 감소', async () => {
      const eligible = await api.getVoteDrawEligible('pw');
      expect(eligible.drawnIds.length).toBe(1);
      const remaining = eligible.eligible.filter(e => !eligible.drawnIds.includes(e.voter_id));
      expect(remaining.length).toBe(99);
    });

    it('연속 추첨 시 중복 당첨 없음', async () => {
      const result2 = await api.voteDrawPick('pw');
      const result3 = await api.voteDrawPick('pw');
      const winners = await api.getVoteDrawWinners('pw');
      expect(winners.length).toBe(3);

      const ids = winners.map(w => w.voter_id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);

      console.log(`  추가 당첨자: ${result2.winner.voter_name}, ${result3.winner.voter_name}`);
      console.log(`  총 당첨자: ${winners.length}명`);
    });
  });

  // ── 최종 요약 ──
  describe('최종 요약', () => {
    it('전체 데이터 정합성 확인', async () => {
      const data = await api.getResults('pw');
      const votes = await api.getVotes('pw');
      const prelim = await api.getPreliminaryVotes('pw');
      const preds = await api.getPredictions('pw');
      const judgeScores = await api.getJudgeScoresAdmin('pw');
      const drawWinners = await api.getDrawWinners('pw');
      const voteDrawWinners = await api.getVoteDrawWinners('pw');

      console.log('\n══════════════════════════════');
      console.log('   📊 최종 요약');
      console.log('══════════════════════════════');
      console.log(`  사전심사 투표:       ${prelim.length}명`);
      console.log(`  1등을 찾아라 예측:   ${preds.length}명`);
      console.log(`  심사위원 평가:       ${judgeScores.length}건 (5명 × 5팀)`);
      console.log(`  현장 인기투표:       ${votes.length}명`);
      console.log(`  1등 예측 추첨 당첨:  ${drawWinners.length}명`);
      console.log(`  인기투표 추첨 당첨:  ${voteDrawWinners.length}명`);
      console.log('──────────────────────────────');
      console.log('  🏆 최종 순위:');
      data.results.forEach((r, i) => {
        const medal = ['🥇', '🥈', '🥉'][i] || '  ';
        console.log(`    ${medal} ${i + 1}위 ${r.name} (${r.company}) — ${r.finalScore}점`);
      });
      console.log('══════════════════════════════\n');

      expect(prelim.length).toBe(5);
      expect(preds.length).toBe(100);
      expect(judgeScores.length).toBe(25);
      expect(votes.length).toBe(100);
      expect(drawWinners.length).toBe(3);
      expect(voteDrawWinners.length).toBe(3);
      expect(data.results[0].name).toBe('Team Spark');
    });
  });

  // ── 데이터 초기화 테스트 ──
  describe('데이터 초기화', () => {
    it('전체 초기화 성공', async () => {
      const result = await api.resetData('pw');
      expect(result.success).toBe(true);
    });

    it('초기화 후 모든 데이터 비어있음', async () => {
      const votes = await api.getVotes('pw');
      const prelim = await api.getPreliminaryVotes('pw');
      const preds = await api.getPredictions('pw');
      const judgeScores = await api.getJudgeScoresAdmin('pw');
      const drawWinners = await api.getDrawWinners('pw');
      const voteDrawWinners = await api.getVoteDrawWinners('pw');

      expect(votes.length).toBe(0);
      expect(prelim.length).toBe(0);
      expect(preds.length).toBe(0);
      expect(judgeScores.length).toBe(0);
      expect(drawWinners.length).toBe(0);
      expect(voteDrawWinners.length).toBe(0);
    });
  });
});
