import { useState } from "react";
const pairs = [
  {
    id: "quake",
    situation: "Shaking starts indoors",
    action: "Drop, cover and hold on",
    explain:
      "Protect your head and neck. Follow your teacher when the shaking stops.",
  },
  {
    id: "water",
    situation: "Floodwater covers the path",
    action: "Stay out of the water",
    explain:
      "Tell an adult. Floodwater can be dangerous even when it looks shallow.",
  },
  {
    id: "alarm",
    situation: "The school fire alarm sounds",
    action: "Follow the school evacuation plan",
    explain: "Listen to staff, leave belongings, and use the approved route.",
  },
];
const scenes = [
  {
    title: "A classroom starts shaking",
    question: "Which action protects you first?",
    options: [
      "Run to a window",
      "Drop, cover and hold on",
      "Run down the stairs",
    ],
    answer: 1,
    feedback:
      "Protect your head and neck and hold on to sturdy shelter if available.",
  },
  {
    title: "The shaking has stopped",
    question: "Who helps you decide what to do next?",
    options: [
      "School staff following the approved plan",
      "A stranger in a game",
      "An old social media post",
    ],
    answer: 0,
    feedback:
      "Listen to your teacher and follow the school's approved procedures.",
  },
  {
    title: "At the official assembly point",
    question: "What should you do?",
    options: [
      "Go back for your bag",
      "Leave without telling anyone",
      "Stay with your group for the headcount",
    ],
    answer: 2,
    feedback:
      "Stay with your group. Tell staff if you need help or someone is missing.",
  },
];
export function KidsActivities({ ownerId }: { ownerId: string }) {
  const [activity, setActivity] = useState("matching");
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [correct, setCorrect] = useState(false);
  const [badges, setBadges] = useState<string[]>(() => {
    try {
      const v = JSON.parse(
        localStorage.getItem(`campus-kids-v1:${ownerId}`) ?? "[]",
      );
      return Array.isArray(v)
        ? [...new Set(v.filter((x) => x === "matching" || x === "scenario"))]
        : [];
    } catch {
      return [];
    }
  });
  const [storageNotice, setStorageNotice] = useState("");
  function award(id: string) {
    const next = [...new Set([...badges, id])];
    setBadges(next);
    try {
      localStorage.setItem(`campus-kids-v1:${ownerId}`, JSON.stringify(next));
    } catch {
      setStorageNotice(
        "This badge is available only until you close this activity; device storage is unavailable.",
      );
    }
  }
  return (
    <section aria-label="Children's activities">
      <h3>Learn together</h3>
      <p>
        Read and play with a teacher or trusted adult. These are on-screen
        practice activities, not instructions to start a physical drill.
      </p>
      <p>{badges.length} / 2 activity badges on this device.</p>
      {storageNotice && <p role="status">{storageNotice}</p>}
      <nav className="preparedness-actions" aria-label="Children's activity">
        <button
          className="campus-secondary"
          aria-pressed={activity === "matching"}
          onClick={() => {
            setActivity("matching");
            setFeedback("");
          }}
        >
          Matching game
        </button>
        <button
          className="campus-secondary"
          aria-pressed={activity === "scenario"}
          onClick={() => {
            setActivity("scenario");
            setFeedback("");
          }}
        >
          Classroom scenario
        </button>
        <button
          className="campus-secondary"
          aria-pressed={activity === "verses"}
          onClick={() => setActivity("verses")}
        >
          Safety verses
        </button>
      </nav>
      {activity === "matching" && (
        <div className="preparedness-card">
          <h4>Match each situation to an action</h4>
          <p>{matched.length} / 3 matched</p>
          <div className="preparedness-actions">
            {pairs.map((p) => (
              <button
                className="campus-secondary"
                key={p.id}
                aria-pressed={selected === p.id}
                disabled={matched.includes(p.id)}
                onClick={() => {
                  setSelected(p.id);
                  setFeedback("");
                }}
              >
                {p.situation}
              </button>
            ))}
          </div>
          <div className="preparedness-actions">
            {[pairs[2], pairs[0], pairs[1]].map((p) => (
              <button
                className="game-nav-button"
                key={p.id}
                disabled={!selected || matched.includes(p.id)}
                onClick={() => {
                  if (selected === p.id) {
                    const next = [...matched, p.id];
                    setMatched(next);
                    setSelected(null);
                    setFeedback(`Good match. ${p.explain}`);
                    if (next.length === 3) award("matching");
                  } else
                    setFeedback(
                      "Try another action. Ask an adult to help you think it through.",
                    );
                }}
              >
                {p.action}
              </button>
            ))}
          </div>
          {matched.length === 3 && <p>Matching badge earned!</p>}
          <p role="status">{feedback}</p>
        </div>
      )}
      {activity === "scenario" && (
        <div className="preparedness-card">
          {step < scenes.length ? (
            <>
              <h4>{scenes[step].title}</h4>
              <p>{scenes[step].question}</p>
              <div className="preparedness-actions">
                {scenes[step].options.map((o, i) => (
                  <button
                    className="campus-secondary"
                    key={o}
                    disabled={correct}
                    onClick={() => {
                      const right = i === scenes[step].answer;
                      setCorrect(right);
                      setFeedback(
                        right
                          ? scenes[step].feedback
                          : "Try again. Think about protecting yourself and following school staff.",
                      );
                    }}
                  >
                    {o}
                  </button>
                ))}
              </div>
              <p role="status">{feedback}</p>
              {correct && (
                <button
                  className="game-nav-button"
                  onClick={() => {
                    if (step === scenes.length - 1) award("scenario");
                    setStep(step + 1);
                    setCorrect(false);
                    setFeedback("");
                  }}
                >
                  Continue story
                </button>
              )}
            </>
          ) : (
            <>
              <h4>Scenario badge earned!</h4>
              <p>
                Talk with your teacher about how your own school's plan works.
              </p>
              <button className="campus-secondary" onClick={() => setStep(0)}>
                Play the story again
              </button>
            </>
          )}
        </div>
      )}
      {activity === "verses" && (
        <>
          <article className="preparedness-card">
            <h4>Earthquake practice</h4>
            <p>
              When the classroom starts to sway,
              <br />
              Drop and cover where you stay.
              <br />
              Hold on, protect your head with care,
              <br />
              Listen to the teacher there.
            </p>
          </article>
          <article className="preparedness-card">
            <h4>Flood awareness</h4>
            <p>
              Water on the road ahead?
              <br />
              Choose to stay away instead.
              <br />
              Tell an adult what you see;
              <br />
              Safe decisions start with me.
            </p>
          </article>
          <p>
            Original learning verses. Discuss official guidance and your school
            plan with an adult.
          </p>
        </>
      )}
    </section>
  );
}
