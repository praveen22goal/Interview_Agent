"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bot,
  CircleAlert,
  ClipboardList,
  Code2,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

type Difficulty = "Easy" | "Medium" | "Hard";
type Message = { role: "interviewer" | "candidate"; content: string };
type Screen = "setup" | "interview" | "report";
type RetryAction = "answer" | "report" | null;
type ConnectionState = "checking" | "ready" | "key-needed" | "offline";
type InterviewTurn = { message: string; ended: boolean };
type InterviewReport = {
  score: number;
  category: "Excellent" | "Good" | "Adequate" | "Weak";
  passed: boolean;
  strengths: string[];
  weaknesses: string[];
  topics_to_revise: string[];
  verdict: string;
};

const difficulties: { name: Difficulty; note: string }[] = [
  { name: "Easy", note: "Foundations" },
  { name: "Medium", note: "Applied reasoning" },
  { name: "Hard", note: "Trade-offs" },
];

async function apiRequest<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("The backend could not be reached. Make sure the FastAPI server is running on port 8000.");
  }

  const data = (await response.json().catch(() => ({}))) as { detail?: string };
  if (!response.ok) {
    throw new Error(data.detail || `The request failed (${response.status}). Please try again.`);
  }
  return data as T;
}

function Header({ connectionState }: { connectionState: ConnectionState }) {
  const statusText = {
    checking: "Checking API",
    ready: "Coach ready",
    "key-needed": "Groq key needed",
    offline: "Backend offline",
  }[connectionState];
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="AI Interview Coach home">
        <span className="brand-mark"><Code2 aria-hidden="true" /></span>
        <span>AI Interview Coach</span>
      </a>
      <div className="top-status" aria-live="polite">
        <span
          className="status-dot"
          style={{
            background: connectionState === "offline" ? "var(--coral)" : connectionState === "key-needed" ? "#e2b35d" : undefined,
          }}
        />
        {statusText}
      </div>
    </header>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="error-banner" role="alert">
      <CircleAlert aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("setup");
  const [topic, setTopic] = useState("Binary Trees");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retryAction, setRetryAction] = useState<RetryAction>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>("checking");
  const messageEndRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let active = true;
    apiRequest<{ status: string; groq_configured: boolean }>("/health")
      .then((health) => { if (active) setConnectionState(health.groq_configured ? "ready" : "key-needed"); })
      .catch(() => { if (active) setConnectionState("offline"); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, screen]);

  useEffect(() => {
    if (screen === "interview" && !busy) answerRef.current?.focus();
  }, [screen, busy]);

  const startInterview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanTopic = topic.trim();
    if (cleanTopic.length < 2) {
      setError("Enter a technical topic with at least two characters.");
      return;
    }
    setBusy(true);
    setError("");
    setRetryAction(null);
    try {
      const turn = await apiRequest<InterviewTurn>("/api/interview/start", {
        topic: cleanTopic,
        difficulty,
      });
      setTopic(cleanTopic);
      setMessages([{ role: "interviewer", content: turn.message }]);
      setDraft("");
      setScreen("interview");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The interview could not be started.");
    } finally {
      setBusy(false);
    }
  };

  const requestNextTurn = async (conversation: Message[]) => {
    setBusy(true);
    setError("");
    setRetryAction("answer");
    try {
      const latestAnswer = conversation.at(-1);
      const transcript = latestAnswer?.role === "candidate" ? conversation.slice(0, -1) : conversation;
      const turn = await apiRequest<InterviewTurn>("/api/interview/answer", {
        topic,
        difficulty,
        conversation: transcript,
        answer: latestAnswer?.role === "candidate" ? latestAnswer.content : "",
      });
      const updatedConversation = [...conversation, { role: "interviewer" as const, content: turn.message }];
      setMessages(updatedConversation);
      setRetryAction(null);
      if (turn.ended) {
        setScreen("report");
        await requestReport(updatedConversation);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The interviewer could not respond.");
    } finally {
      setBusy(false);
    }
  };

  const requestReport = async (conversation: Message[]) => {
    setBusy(true);
    setError("");
    setRetryAction("report");
    try {
      const result = await apiRequest<InterviewReport>("/api/interview/report", {
        topic,
        difficulty,
        conversation,
      });
      setReport(result);
      setRetryAction(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Your report could not be generated.");
    } finally {
      setBusy(false);
    }
  };

  const sendAnswer = async () => {
    const answer = draft.trim();
    if (!answer || busy) return;
    const conversation = [...messages, { role: "candidate" as const, content: answer }];
    setMessages(conversation);
    setDraft("");
    await requestNextTurn(conversation);
  };

  const onAnswerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendAnswer();
    }
  };

  const retry = () => {
    if (retryAction === "report") void requestReport(messages);
    else if (retryAction === "answer") void requestNextTurn(messages);
  };

  const startAgain = () => {
    setMessages([]);
    setDraft("");
    setReport(null);
    setError("");
    setRetryAction(null);
    setBusy(false);
    setScreen("setup");
  };

  const scoreTone = report
    ? report.score >= 85 ? "excellent" : report.score >= 70 ? "good" : report.score >= 55 ? "adequate" : "weak"
    : "weak";

  return (
    <div className="shell">
      <Header connectionState={connectionState} />
      <main className="page">
        {screen === "setup" && (
          <>
            <div className="page-heading">
              <div className="kicker"><Sparkles aria-hidden="true" /> TECHNICAL INTERVIEW PRACTICE</div>
              <h1>AI Interview Coach</h1>
              <p>Take a breath. Think out loud. Let’s see what you know.</p>
            </div>
            <div className="setup-grid">
              <form className="panel form-panel" onSubmit={startInterview}>
                <div className="panel-heading">
                  <h2>Set up your interview</h2>
                  <span>01 / SESSION</span>
                </div>
                <label className="field-label" htmlFor="topic">Technical topic</label>
                <input
                  className="topic-input"
                  id="topic"
                  name="topic"
                  type="text"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="For example, Binary Trees"
                  maxLength={120}
                  autoComplete="off"
                  required
                />
                <p className="field-note">Choose a subject you want to explore in depth.</p>
                <div className="field-label" id="difficulty-label">Difficulty</div>
                <div className="difficulty-row" role="group" aria-labelledby="difficulty-label">
                  {difficulties.map((option) => (
                    <button
                      aria-pressed={difficulty === option.name}
                      className={`difficulty-option${difficulty === option.name ? " selected" : ""}`}
                      key={option.name}
                      onClick={() => setDifficulty(option.name)}
                      type="button"
                    >
                      <strong><i className="difficulty-indicator" />{option.name}</strong>
                      <small>{option.note}</small>
                    </button>
                  ))}
                </div>
                <div className="form-divider" />
                <div className="form-footer">
                  <span className="form-footnote"><ShieldCheck aria-hidden="true" /> Your conversation stays in this session.</span>
                  <button className="primary-button" disabled={busy} type="submit">
                    {busy ? <><LoaderCircle aria-hidden="true" /> Starting</> : <>Start interview <ArrowRight aria-hidden="true" /></>}
                  </button>
                </div>
                {error && <ErrorBanner message={error} />}
              </form>
              <aside className="panel context-panel" aria-label="Session details">
                <div className="context-heading"><ClipboardList aria-hidden="true" /> Session details</div>
                <div className="context-row"><span>Topic</span><strong>{topic.trim() || "Not set"}</strong></div>
                <div className="context-row"><span>Difficulty</span><strong>{difficulty}</strong></div>
                <div className="context-row"><span>Interviewer</span><strong>Groq · GPT-OSS 120B</strong></div>
                <div className="context-row"><span>Format</span><strong>Adaptive</strong></div>
                <div className="context-note"><strong>INTERVIEW ROOM</strong>One question at a time. No hints, no model answers.</div>
              </aside>
            </div>
          </>
        )}

        {screen === "interview" && (
          <section className="interview-wrap" aria-label="Live technical interview">
            <div className="interview-heading">
              <div><div className="kicker"><span className="status-dot" /> LIVE INTERVIEW</div><h1>{topic}</h1></div>
              <div className="session-meta">
                <span className="meta-pill"><Target aria-hidden="true" /> {difficulty}</span>
                <span className="meta-pill"><MessageSquareText aria-hidden="true" /> Adaptive session</span>
              </div>
            </div>
            <div className="chat-panel panel">
              <div className="chat-header">
                <span className="chat-header-title"><Bot aria-hidden="true" /> Interviewer</span>
                <span className="chat-count">{messages.filter((message) => message.role === "interviewer").length} messages</span>
              </div>
              <div className="message-list" aria-live="polite" aria-label="Interview conversation">
                {messages.map((message, index) => (
                  <article className={`message-row ${message.role}`} key={`${message.role}-${index}`}>
                    <span className="message-avatar" aria-hidden="true">{message.role === "interviewer" ? "AI" : "YOU"}</span>
                    <div className="message-content">
                      <div className="message-author">{message.role === "interviewer" ? "Interviewer" : "You"}</div>
                      <div className="message-bubble">{message.content}</div>
                    </div>
                  </article>
                ))}
                {busy && screen === "interview" && (
                  <div className="thinking-indicator"><LoaderCircle aria-hidden="true" /> Thinking through your answer…</div>
                )}
                <div ref={messageEndRef} />
              </div>
              <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void sendAnswer(); }}>
                <label className="field-label" htmlFor="answer">Your answer</label>
                <textarea
                  className="answer-input"
                  id="answer"
                  ref={answerRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={onAnswerKeyDown}
                  placeholder="Walk me through your reasoning…"
                  maxLength={4000}
                  disabled={busy}
                />
                {error && <ErrorBanner message={error} />}
                <div className="composer-footer">
                  <span className="keyboard-hint"><kbd>Enter</kbd> send · <kbd>Shift + Enter</kbd> new line</span>
                  {error && retryAction === "answer" ? (
                    <button className="primary-button" disabled={busy} onClick={retry} type="button">
                      {busy ? <LoaderCircle aria-hidden="true" /> : <RotateCcw aria-hidden="true" />} Retry
                    </button>
                  ) : (
                    <button className="primary-button" disabled={busy || !draft.trim()} type="submit">
                      {busy ? <><LoaderCircle aria-hidden="true" /> Thinking</> : <>Send answer <Send aria-hidden="true" /></>}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </section>
        )}

        {screen === "report" && (
          <section className="report-wrap" aria-label="Interview report">
            {!report && !error && (
              <div className="panel loading-state"><LoaderCircle aria-hidden="true" /><strong>Putting your report together</strong><span>Reviewing your answers for specific, evidence-based feedback.</span></div>
            )}
            {!report && error && (
              <div className="empty-error" role="alert">
                <CircleAlert aria-hidden="true" />
                <p>{error}</p>
                <button className="secondary-button" disabled={busy} onClick={retry} type="button">
                  {busy ? <LoaderCircle aria-hidden="true" /> : <RotateCcw aria-hidden="true" />} Retry report
                </button>
              </div>
            )}
            {report && (
              <>
                <div className="report-top">
                  <div><div className="kicker"><BadgeCheck aria-hidden="true" /> SESSION REVIEW</div><h1>Interview Complete</h1><p className="report-subtitle">A clear-eyed read on how this session went.</p></div>
                  <button className="secondary-button" onClick={startAgain} type="button"><ArrowLeft aria-hidden="true" /> New interview</button>
                </div>
                <div className="report-hero">
                  <div>
                    <div className="report-topic"><strong>{topic}</strong> · {difficulty} · {report.category}</div>
                    <p className="report-verdict">{report.verdict}</p>
                    <span className={`report-badge${report.passed ? "" : " fail"}`}>
                      {report.passed ? <Trophy aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
                      {report.passed ? "Pass" : "Fail"}
                    </span>
                  </div>
                  <div className={`score-display ${scoreTone}`} aria-label={`Score ${report.score} out of 100`}>
                    <strong className="score-number">{report.score}</strong><span className="score-outof">OUT OF 100</span>
                  </div>
                </div>
                <div className="report-grid">
                  <section className="report-section">
                    <h2><Sparkles aria-hidden="true" /> What you did well</h2>
                    <ul>{report.strengths.map((item, index) => <li key={`strength-${index}`}>{item}</li>)}</ul>
                  </section>
                  <section className="report-section weakness">
                    <h2><Target aria-hidden="true" /> Areas to improve</h2>
                    <ul>{report.weaknesses.map((item, index) => <li key={`weakness-${index}`}>{item}</li>)}</ul>
                  </section>
                  <section className="report-section topics full">
                    <h2><ClipboardList aria-hidden="true" /> Topics to revise</h2>
                    <ul>{report.topics_to_revise.map((item, index) => <li key={`topic-${index}`}>{item}</li>)}</ul>
                  </section>
                </div>
                <div className="report-actions">
                  <span className="report-footnote">Practice feedback based on this conversation, not a hiring decision.</span>
                  <button className="primary-button" onClick={startAgain} type="button">Start a new interview <ArrowRight aria-hidden="true" /></button>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
