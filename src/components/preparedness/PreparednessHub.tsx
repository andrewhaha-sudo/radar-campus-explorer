import { useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { courses, drillSteps, emptyProgress, learningPoints, parseProgress, recordScore, progressExport } from "../../lib/preparedness";
import type { LearningProgress } from "../../lib/preparedness";
import "./preparedness.css";

export function PreparednessHub({ ownerId }: { ownerId: string }) {
  const storageKey = `campus-preparedness-v1:${ownerId}`;
  const [initial] = useState(() => {
    try { return { progress: parseProgress(localStorage.getItem(storageKey)), warning: "" }; }
    catch { return { progress: emptyProgress(), warning: "Saved progress is unavailable. You can still practice in this session." }; }
  });
  const [progress, setProgress] = useState(initial.progress);
  const [notice, setNotice] = useState(initial.warning);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState(false);
  const course = courses.find(c => c.id === courseId);
  const question = course?.questions[step];
  function save(next: LearningProgress) {
    setProgress(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setNotice("Progress saved on this device."); }
    catch { setNotice("Storage is unavailable. Progress is kept for this session only; download a copy before closing."); }
  }
  function begin(id: string) { setCourseId(id); setStep(0); setChoice(null); setChecked(false); setScore(0); setResult(false); }
  function next() {
    if (!course || !question || !checked) return;
    const total = score + (choice === question.answer ? 1 : 0);
    if (step === course.questions.length - 1) {
      setScore(total); setResult(true); save(recordScore(progress, course.id, total));
    } else { setScore(total); setStep(step + 1); setChoice(null); setChecked(false); }
  }
  function download() {
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify(progressExport(progress), null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "campus-preparedness-progress.json";
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Download prepared. This practice record contains no account ID or location.");
    } catch { setNotice("Download could not be prepared. Please try again."); }
  }
  return <section className="preparedness-hub" aria-label="Preparedness practice">
    <div className="preparedness-summary">
      <strong>{learningPoints(progress)} / 120 practice points</strong>
      <p>Private practice on this device. Scores and checklist entries are self-reported, not safety certificates or verified attendance.</p>
      <p role="status">{notice}</p>
    </div>
    {course && question ? <section aria-label={course.title} className="preparedness-card">
      <h3>{course.title}</h3>
      {result ? <>
        <h4>Practice complete: {score} / {course.questions.length}</h4>
        <p>Best score: {progress.best[course.id]} / {course.questions.length}. Repeating a quiz improves your best score without adding duplicate points.</p>
        <button className="game-nav-button" onClick={() => begin(course.id)}>Try again</button>
      </> : <>
        <p>Question {step + 1} of {course.questions.length}</p>
        <fieldset disabled={checked}>
          <legend>{question.prompt}</legend>
          {question.choices.map((answer, index) => <label key={`${step}-${index}`}>
            <input type="radio" name="preparedness-answer" checked={choice === index} onChange={() => setChoice(index)} />
            <span>{answer}</span>
          </label>)}
        </fieldset>
        {checked && <div className="preparedness-feedback" role="status">
          <strong>{choice === question.answer ? "Correct." : "Review this answer."}</strong>
          <p>{question.explanation}</p>
        </div>}
        {checked ? <button className="game-nav-button" onClick={next}>{step === course.questions.length - 1 ? "Finish quiz" : "Next question"}</button>
          : <button className="game-nav-button" disabled={choice === null} onClick={() => setChecked(true)}>Check answer</button>}
      </>}
      <p><a href={course.source} target="_blank" rel="noreferrer">Read official preparedness guidance ↗</a></p>
      <button className="campus-secondary" onClick={() => setCourseId(null)}>Back to preparedness</button>
    </section> : <>
      <h3>Safety quizzes</h3>
      <div className="preparedness-courses">{courses.map(c => <article className="preparedness-card" key={c.id}>
        <h4>{c.title}</h4>
        <p>{progress.best[c.id] === undefined ? "3 questions · ready when you are" : `Best score: ${progress.best[c.id]} / ${c.questions.length}`}</p>
        {progress.best[c.id] === c.questions.length && <p className="preparedness-badge">Practice badge earned</p>}
        <button className="game-nav-button" onClick={() => begin(c.id)}>Practice {c.title.toLowerCase()}</button>
      </article>)}</div>
      <section className="preparedness-card" aria-label="Supervised drill checklist">
        <h3>Supervised drill checklist</h3>
        <p>{progress.checked.length} / {drillSteps.length} checked. Complete these with school staff; checking a box does not notify a teacher.</p>
        {drillSteps.map(item => <label className="preparedness-check" key={item.id}>
          <input type="checkbox" checked={progress.checked.includes(item.id)} onChange={event => save({ ...progress,
            checked: event.target.checked ? [...progress.checked, item.id] : progress.checked.filter(id => id !== item.id) })} />
          <span>{item.text}</span>
        </label>)}
      </section>
      <div className="preparedness-actions">
        <button className="game-nav-button" onClick={download}>Download practice record</button>
        <AlertDialog.Root>
          <AlertDialog.Trigger className="campus-secondary">Reset practice progress</AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="student-overlay" />
            <AlertDialog.Content className="radar-dialog neon-frame">
              <AlertDialog.Title>Reset practice progress?</AlertDialog.Title>
              <AlertDialog.Description>This clears quiz scores and checklist entries for this profile on this device. Download a copy first if you want to keep it.</AlertDialog.Description>
              <div className="preparedness-actions">
                <AlertDialog.Cancel className="campus-secondary">Keep progress</AlertDialog.Cancel>
                <AlertDialog.Action className="campus-primary" onClick={() => save(emptyProgress())}>Reset progress</AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
      <p><a href="https://www.phivolcs.dost.gov.ph/" target="_blank" rel="noreferrer">PHIVOLCS ↗</a> · <a href="https://www.pagasa.dost.gov.ph/" target="_blank" rel="noreferrer">PAGASA ↗</a></p>
    </>}
  </section>;
}
