// Source manifest. Every product image in the film is a crop of a real Spine 2.0 recording
// (2880 x 1620, 30 fps) from louiebond1/spine branch spine-2, marketing/clips/.
// x, y, w, h are source pixels. `frames` lists the inclusive source frame ranges the edit uses;
// tools/extract.mjs writes each frame of each range to public/frames/<shot>/<frame>.png.
// `use` records which scene shows it and why, so a crop can't silently drift from the story.

export const clips = {
  "01": "01-home-what-needs-you.mp4",
  "02": "02-ask-a-question.mp4",
  "03": "03-champion-answers.mp4",
  "04": "04-answer-helps-someone-else.mp4",
  "05": "05-approve-the-idea.mp4",
  "06": "06-someone-joins.mp4",
  "07": "07-plan-moves-forward.mp4",
  "08": "08-blocked.mp4",
  "09": "09-pulse-catches-it.mp4",
  "10": "10-unblocked.mp4",
  "11": "11-goes-live.mp4",
  "12": "12-team-reports-hours.mp4",
  "13": "13-verified-outside-the-team.mp4",
  "14": "14-leadership-sees-it.mp4",
};

export const shots = {
  home: { clip: "01", x: 560, y: 214, w: 560, h: 92, frames: [[60, 60]], use: "02: \"3 things need you\" heading only" },
  question: { clip: "02", x: 560, y: 215, w: 1000, h: 235, frames: [[705, 705]], use: "03: Priya's posted question, private line" },
  claim: { clip: "03", x: 590, y: 600, w: 1540, h: 115, frames: [[190, 223]], use: "03: Mia clicks Claim (thread opens at 224)" },
  reply: { clip: "03", x: 570, y: 640, w: 1620, h: 180, frames: [[588, 588]], use: "03: Mia's sent answer, completed state" },
  suggest: { clip: "04", x: 870, y: 355, w: 840, h: 195, frames: [[262, 300]], use: "04: Ben's title and the real \"Already answered?\" (appears at 275)" },
  approveTitle: { clip: "05", x: 560, y: 240, w: 1200, h: 160, frames: [[200, 200]], use: "05: project title, before approval" },
  approveBtn: { clip: "05", x: 2200, y: 830, w: 600, h: 100, frames: [[222, 244]], use: "05: Approve press (page changes at 245)" },
  formingTeam: { clip: "05", x: 560, y: 380, w: 840, h: 140, frames: [[262, 262]], use: "05: Forming team, needs 2 more people" },
  team: { clip: "06", x: 590, y: 665, w: 700, h: 290, frames: [[120, 179]], use: "06: 1 of 3 becomes 2 of 3 at 152" },
  joinBtn: { clip: "06", x: 2525, y: 675, w: 250, h: 75, frames: [[120, 151]], use: "06: Jamie's Join the team press" },
  nextAction: { clip: "07", x: 560, y: 476, w: 900, h: 56, frames: [[200, 200], [252, 252]], use: "07: next action before and after the tick" },
  planRows: { clip: "07", x: 590, y: 738, w: 2130, h: 190, frames: [[215, 241]], use: "07: Louie ticks the first step (LM), next step JC" },
  planNext: { clip: "07", x: 590, y: 782, w: 2130, h: 80, frames: [[252, 252]], use: "07: the next open step, assigned JC" },
  aiLabel: { clip: "07", x: 2380, y: 712, w: 390, h: 44, frames: [[252, 252]], use: "07: \"First drafted by AI from the brief\" source label" },
  checkin: { clip: "08", x: 590, y: 830, w: 2180, h: 330, frames: [[455, 466]], use: "08: Blocked selected with the complete note, Check in press" },
  banner: { clip: "08", x: 560, y: 478, w: 2250, h: 105, frames: [[482, 482]], use: "08: posted blocker banner" },
  pulse: { clip: "09", x: 590, y: 440, w: 1180, h: 200, frames: [[232, 232]], use: "09: Pulse heading and the top blocked item" },
  pulseOpen: { clip: "09", x: 2620, y: 540, w: 170, h: 110, frames: [[232, 268]], use: "09: a leader presses Open on it (project opens at 269)" },
  unblock: { clip: "10", x: 560, y: 470, w: 2250, h: 200, frames: [[362, 380]], use: "10: Check in press, banner clears at 376" },
  recovery: { clip: "10", x: 590, y: 990, w: 1100, h: 250, frames: [[392, 392]], use: "10: Blocked then On track entries" },
  launchLeft: { clip: "11", x: 560, y: 220, w: 960, h: 330, frames: [[120, 165]], use: "11: title, stepper, You're launching this then Live" },
  launchBtn: { clip: "11", x: 2540, y: 475, w: 270, h: 90, frames: [[120, 149]], use: "11: Mark Live press" },
  report: { clip: "12", x: 590, y: 1330, w: 1500, h: 170, frames: [[410, 410]], use: "10: reported outcome, not verified yet" },
  verifyText: { clip: "13", x: 590, y: 820, w: 1290, h: 125, frames: [[240, 270]], use: "10: Verified by Alex Morgan appears at 259" },
  verifyBtn: { clip: "13", x: 2620, y: 845, w: 180, h: 80, frames: [[240, 270]], use: "10: Verify press" },
  // Narrower crops for the vertical version (same frames, fewer columns, so the text stays large).
  suggestV: { clip: "04", x: 870, y: 355, w: 570, h: 195, frames: [[268, 300]], use: "vertical 04: title and suggestion" },
  approveTitleV: { clip: "05", x: 555, y: 240, w: 660, h: 160, frames: [[200, 200]], use: "vertical 05: title" },
  formingTeamV: { clip: "05", x: 560, y: 380, w: 700, h: 140, frames: [[262, 262]], use: "vertical 05: Forming team" },
  nextActionV: { clip: "07", x: 560, y: 476, w: 560, h: 56, frames: [[200, 200], [252, 252]], use: "vertical 07: next action" },
  planRowsV: { clip: "07", x: 590, y: 738, w: 860, h: 190, frames: [[215, 241]], use: "vertical 07: the tick" },
  planNextV: { clip: "07", x: 590, y: 782, w: 860, h: 80, frames: [[252, 252]], use: "vertical 07: next open step" },
  checkinV: { clip: "08", x: 2040, y: 830, w: 740, h: 150, frames: [[455, 466]], use: "vertical 08: Blocked selected" },
  noteV: { clip: "08", x: 590, y: 985, w: 1120, h: 90, frames: [[466, 466]], use: "vertical 08: the complete note" },
  wentLiveV: { clip: "14", x: 560, y: 1215, w: 1000, h: 190, frames: [[300, 300]], use: "vertical 10: Went live" },
  wentLive: { clip: "14", x: 560, y: 1215, w: 1600, h: 190, frames: [[300, 300]], use: "10: Went live, Supplier Research Assistant (106 total cropped out)" },
};
