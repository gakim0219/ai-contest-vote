const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '요청 실패');
  return data;
}

// 팀
export const getTeams = () => request('/teams');

// 인기투표
export const verifyVote = (voter_id) => request('/vote/verify', { method: 'POST', body: JSON.stringify({ voter_id }) });
export const submitVote = (voter_id, voter_name, team_id) => request('/vote', { method: 'POST', body: JSON.stringify({ voter_id, voter_name, team_id }) });

// 사전심사 투표
export const verifyPreliminary = (voter_id) => request('/preliminary/verify', { method: 'POST', body: JSON.stringify({ voter_id }) });
export const submitPreliminary = (voter_id, voter_name, team_id) => request('/preliminary', { method: 'POST', body: JSON.stringify({ voter_id, voter_name, team_id }) });

// 심사위원
export const judgeAuth = (name) => request('/judge/auth', { method: 'POST', body: JSON.stringify({ name }) });
export const getJudgeScores = (name) => request(`/judge/scores/${encodeURIComponent(name)}`);
export const submitJudgeScore = (data) => request('/judge/score', { method: 'POST', body: JSON.stringify(data) });

// 예측
export const verifyPredict = (voter_id) => request('/predict/verify', { method: 'POST', body: JSON.stringify({ voter_id }) });
export const submitPredict = (voter_id, voter_name, predicted_team_id) => request('/predict', { method: 'POST', body: JSON.stringify({ voter_id, voter_name, predicted_team_id }) });

// 관리자
export const adminAuth = (password) => request('/admin/auth', { method: 'POST', body: JSON.stringify({ password }) });
export const getResults = (pw) => request('/admin/results', { headers: { 'x-admin-pw': pw } });
export const getVotes = (pw) => request('/admin/votes', { headers: { 'x-admin-pw': pw } });
export const getPreliminaryVotes = (pw) => request('/admin/preliminary-votes', { headers: { 'x-admin-pw': pw } });
export const getPredictions = (pw) => request('/admin/predictions', { headers: { 'x-admin-pw': pw } });
export const getJudgeScoresAdmin = (pw) => request('/admin/judge-scores', { headers: { 'x-admin-pw': pw } });
export const updateSettings = (pw, settings) => request('/admin/settings', { method: 'POST', headers: { 'x-admin-pw': pw }, body: JSON.stringify({ password: pw, settings }) });
export const resetData = (pw) => request('/admin/reset', { method: 'POST', headers: { 'x-admin-pw': pw }, body: JSON.stringify({ password: pw }) });

// 심사위원 관리
export const getJudges = (pw) => request('/admin/judges', { headers: { 'x-admin-pw': pw } });
export const addJudge = (pw, name) => request('/admin/judges', { method: 'POST', headers: { 'x-admin-pw': pw }, body: JSON.stringify({ password: pw, name }) });
export const removeJudge = (pw, name) => request(`/admin/judges/${encodeURIComponent(name)}`, { method: 'DELETE', headers: { 'x-admin-pw': pw } });

// 추첨
export const getEligible = (pw) => request('/draw/eligible', { headers: { 'x-admin-pw': pw } });
export const drawPick = (pw) => request('/draw/pick', { method: 'POST', headers: { 'x-admin-pw': pw }, body: JSON.stringify({ password: pw }) });
export const getDrawWinners = (pw) => request('/draw/winners', { headers: { 'x-admin-pw': pw } });
