// Original RADAR learning content; no ResQverse source or assets are included.
export const courses = [
  { id: "earthquake", title: "Earthquake readiness", source: "https://www.ready.gov/earthquakes", questions: [
    { prompt: "Shaking begins while you are inside a classroom. What should you do?", choices: ["Run toward the stairs", "Drop, cover and hold on", "Stand beside a window"], answer: 1, explanation: "Drop to your hands and knees, cover your head and neck, and hold on to sturdy shelter if available. Stay away from windows." },
    { prompt: "The shaking has stopped. What should guide your next action?", choices: ["The school's approved plan and staff instructions", "An unverified route from a game", "A crowd running in any direction"], answer: 0, explanation: "Follow staff instructions and the approved evacuation plan. Watch for damage and aftershocks; an illustrated game map is not an approved evacuation plan." },
    { prompt: "You are outdoors when shaking starts. What should you move away from, if you can do so safely?", choices: ["Open ground", "The designated assembly area", "Buildings, trees and power lines"], answer: 2, explanation: "In an open area, stay away from structures, trees and overhead wires. Protect yourself until the shaking stops." },
  ]},
  { id: "flood", title: "Flood awareness", source: "https://www.ready.gov/floods", questions: [
    { prompt: "Floodwater covers your usual path. What is the best response?", choices: ["Test its depth by walking in", "Keep out and follow official instructions for another route", "Cross if a friend goes first"], answer: 1, explanation: "Do not walk, swim or drive through floodwater. It can hide currents, debris, contamination and electrical hazards." },
    { prompt: "Which source should you use for current weather warnings in the Philippines?", choices: ["PAGASA advisories and official local announcements", "An old screenshot with no date", "A sample alert in a learning game"], answer: 0, explanation: "Check current official advisories and local authorities. Always check the location and time of a warning." },
    { prompt: "Authorities instruct your area to evacuate before flooding. What should you do?", choices: ["Wait until water reaches the classroom", "Return alone to collect belongings", "Follow the instruction and the school's evacuation procedure"], answer: 2, explanation: "Act on official evacuation instructions and follow school procedures. Do not delay to retrieve belongings." },
  ]},
  { id: "fire", title: "Fire preparedness", source: "https://www.ready.gov/home-fires", questions: [
    { prompt: "The fire alarm sounds at school. What should you do?", choices: ["Use a lift to leave faster", "Follow staff instructions and the approved evacuation procedure", "Hide until someone finds you"], answer: 1, explanation: "Follow the school's fire evacuation procedure and staff instructions. Use designated stairs rather than lifts, and leave belongings behind." },
    { prompt: "After leaving a building during a fire, what should you do?", choices: ["Stay out and report to the designated assembly point", "Go back for a phone", "Re-enter when smoke looks lighter"], answer: 0, explanation: "Stay outside and follow staff and emergency responders. Do not re-enter until authorities say it is safe." },
    { prompt: "You notice an obstructed classroom exit before a drill. What is the appropriate action?", choices: ["Ignore it until an emergency", "Mark it safe in the app", "Tell school staff so it can be addressed"], answer: 2, explanation: "Report blocked exits to school staff. Do not assume an exit is usable just because it appears on a map." },
  ]},
] as const;
export const drillSteps = [
  { id: "plan", text: "Review the school's approved drill procedure with staff." },
  { id: "signals", text: "Learn the school's alarm signals and staff instructions." },
  { id: "assembly", text: "Identify the official assembly point with a teacher." },
  { id: "access", text: "Discuss any mobility, communication or assistance needs with staff." },
  { id: "practice", text: "Take part in a staff-supervised drill." },
  { id: "review", text: "Join the headcount and discuss improvements with staff." },
] as const;
export interface LearningProgress { version: 1; best: Record<string, number>; checked: string[] }
export function emptyProgress(): LearningProgress { return { version: 1, best: {}, checked: [] }; }
export function parseProgress(raw: string | null): LearningProgress {
  if (!raw) return emptyProgress();
  const data = JSON.parse(raw);
  if (!data || data.version !== 1 || !data.best || typeof data.best !== "object" || !Array.isArray(data.checked)) throw new Error("Saved progress could not be read.");
  const best: Record<string, number> = {};
  for (const course of courses) {
    const score = data.best[course.id];
    if (Number.isInteger(score) && score >= 0 && score <= course.questions.length) best[course.id] = score;
  }
  return { version: 1, best, checked: drillSteps.filter(step => data.checked.includes(step.id)).map(step => step.id) };
}
export function recordScore(progress: LearningProgress, id: string, score: number): LearningProgress {
  const course = courses.find(c => c.id === id);
  if (!course || !Number.isInteger(score) || score < 0 || score > course.questions.length) return progress;
  return { ...progress, best: { ...progress.best, [id]: Math.max(progress.best[id] ?? 0, score) } };
}
export function learningPoints(progress: LearningProgress) {
  return courses.reduce((sum, c) => sum + (progress.best[c.id] ?? 0) * 10, 0) + progress.checked.length * 5;
}
export function progressExport(progress: LearningProgress) {
  return { application: "RADAR Campus Explorer", type: "self-reported preparedness practice", version: 1,
    quizzes: courses.map(c => ({ title: c.title, bestScore: progress.best[c.id] ?? null, totalQuestions: c.questions.length })),
    drillChecklist: drillSteps.map(step => ({ step: step.text, checked: progress.checked.includes(step.id) })),
    points: learningPoints(progress), notice: "Personal practice record, not a safety certification or verified attendance record." };
}
