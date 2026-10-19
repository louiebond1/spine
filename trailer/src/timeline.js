// Scene IDs, start frames, durations and narration. 2400 frames at 30 fps, final displayed frame 2399.

export const TOTAL = 2400;

export const scenes = [
  { id: "01", name: "Company wide fragmentation", start: 0, dur: 180 },
  { id: "02", name: "A warm arrival", start: 180, dur: 120 },
  { id: "03", name: "A question only the company can answer", start: 300, dur: 360 },
  { id: "04", name: "The next person benefits", start: 660, dur: 180 },
  { id: "05", name: "A useful idea gets a start", start: 840, dur: 210 },
  { id: "06", name: "Someone chooses to join", start: 1050, dur: 270 },
  { id: "07", name: "The next action is clear", start: 1320, dur: 210 },
  { id: "08", name: "A real blocker reaches a person", start: 1530, dur: 300 },
  { id: "09", name: "The project reaches use", start: 1830, dur: 150 },
  { id: "10", name: "Reporting becomes evidence", start: 1980, dur: 270 },
  { id: "11", name: "The final invitation", start: 2250, dur: 150 },
];

// Narration from the brief, split into caption cues. Times are local seconds within each scene,
// placed at least 0.25 s from scene boundaries and never ahead of the action they describe.
export const narration = {
  "01": [[0.4, 2.7, "AI is everywhere at work."], [3.0, 5.6, "But good questions and ideas can get lost."]],
  "02": [[0.4, 3.6, "Welcome to Spine."]],
  "03": [[0.6, 4.4, "Ask the question only your company can answer."], [5.6, 9.2, "A Champion helps you move forward."]],
  "04": [[1.4, 5.6, "Once shared, that answer helps the next person too."]],
  "05": [[0.4, 4.2, "Give a useful idea a place to start"], [4.7, 6.7, "and a decision that moves it forward."]],
  "06": [[1.6, 5.4, "Find the people who want to build it with you."]],
  "07": [[1.0, 2.9, "A clear plan. A named owner."], [3.0, 5.8, "Everyone knows the next step."]],
  "08": [[0.4, 2.9, "When work gets blocked,"], [3.5, 5.9, "Pulse brings it to someone's attention,"], [6.5, 9.4, "so the team can move again."]],
  "09": [[1.0, 4.2, "Take it live and put it to work."]],
  "10": [[0.4, 2.9, "Report what it saved."], [3.5, 6.3, "Have someone outside the team verify it."], [6.6, 8.7, "Give leadership a clear view."]],
  "11": [[0.6, 4.4, "Spine. Run your company's AI adoption."]],
};

export function sceneAt(frame) {
  for (const s of scenes) if (frame >= s.start && frame < s.start + s.dur) return s;
  return null;
}
